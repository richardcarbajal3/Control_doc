// Autosincronización del registro de Documentos desde un Excel en SharePoint.
//
// Flujo: descarga el .xlsx (lib/sharepoint) -> lee la hoja configurada ->
// detecta la fila de encabezados -> mapea columnas por NOMBRE (insensible a
// mayúsculas/espacios) -> hace upsert por (organization_id, # TRANSMITTAL,
// DOCUMENTO NRO). No borra: solo inserta filas nuevas y actualiza existentes,
// para no destruir vínculos a claims hechos dentro de la app.

const XLSX = require('xlsx');
const { pool } = require('../db');
const { downloadSharePointFile } = require('./sharepoint');
const { parseDateValue, parseNumberValue } = require('./bulkInsert');

// Columnas reales de la tabla documents que provienen del Excel, con su
// encabezado esperado. El mapeo real es por nombre normalizado (ver normHeader).
const COLUMN_BY_HEADER = {
  'STATUS': 'status',
  'STATUS G': 'status_g',
  'N° CONTRATO': 'n_contrato',
  'EMPRESA': 'empresa',
  'CONTRATO': 'contrato',
  'DESCRIPCIÓN CONTRATO': 'descripcion_contrato',
  'FECHA': 'fecha',
  '# TRANSMITTAL': 'transmittal',
  'ITEM': 'item',
  'REFERENCIA': 'referencia',
  'DOCUMENTO NRO': 'documento_nro',
  'REV.': 'rev',
  'REV': 'rev',
  'DESCRIPCIÓN': 'descripcion',
  'TIPO DE DOC': 'tipo_doc',
  'ESTATUS DE DOCUMENTO': 'status_contratista',
  'STATUS DE CONTRATISTA': 'status_contratista', // alias por compatibilidad
  'RESPONSABLE': 'responsable',
};

const DATE_COLUMNS = new Set(['fecha']);
const KEY_HEADERS = ['# TRANSMITTAL', 'DOCUMENTO NRO']; // para autodetectar encabezados

// Normaliza un encabezado: recorta, colapsa espacios internos y pasa a mayúsculas.
// Así "Documento Nro", "  documento   nro " y "DOCUMENTO NRO" coinciden.
function normHeader(h) {
  return String(h == null ? '' : h).replace(/\s+/g, ' ').trim().toUpperCase();
}

// Busca, en las primeras filas, la que parece la fila de encabezados: la que
// contiene "# TRANSMITTAL" (o el mayor número de encabezados conocidos).
function findHeaderRow(rows) {
  let best = { idx: -1, score: 0 };
  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i++) {
    const set = new Set((rows[i] || []).map(normHeader));
    const hasTransmittal = set.has('# TRANSMITTAL');
    let score = 0;
    for (const h of Object.keys(COLUMN_BY_HEADER)) if (set.has(normHeader(h))) score++;
    if (hasTransmittal && score > best.score) best = { idx: i, score };
  }
  return best.idx;
}

// Convierte el buffer del Excel en filas-objeto {columnaBD: valor, extra_data:{}}
// listas para upsert. Solo incluye filas con # TRANSMITTAL no vacío.
function rowsFromWorkbook(buffer, sheetName) {
  const wb = XLSX.read(buffer, { cellDates: false });
  const realName = wb.SheetNames.find((n) => n.toLowerCase() === String(sheetName).toLowerCase());
  if (!realName) {
    throw new Error(`La hoja "${sheetName}" no existe. Hojas disponibles: ${wb.SheetNames.join(', ')}`);
  }
  const ws = wb.Sheets[realName];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  const headerIdx = findHeaderRow(matrix);
  if (headerIdx < 0) {
    throw new Error(`No se encontró la fila de encabezados (se requiere "# TRANSMITTAL") en la hoja "${realName}"`);
  }
  const headers = matrix[headerIdx].map(normHeader);
  const transmittalCol = headers.indexOf(normHeader('# TRANSMITTAL'));

  const out = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] || [];
    const transmittal = String(cells[transmittalCol] == null ? '' : cells[transmittalCol]).trim();
    if (!transmittal) continue; // data suelta debajo de los registros -> se ignora

    const known = {};
    const extra = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      let v = cells[c];
      if (typeof v === 'string') v = v.trim();
      if (v === '' || v == null) continue;
      const col = COLUMN_BY_HEADER[header];
      if (col) {
        known[col] = DATE_COLUMNS.has(col) ? parseDateValue(v) : v;
      } else {
        extra[matrix[headerIdx][c]] = v; // preserva el encabezado original en extra_data
      }
    }
    known.extra_data = extra;
    out.push(known);
  }
  return out;
}

// Aplica las filas a la BD con upsert manual por (organization_id, transmittal,
// documento_nro). Evita necesitar un índice único en producción (que podría
// chocar con datos existentes) y no borra filas que ya no estén en el Excel.
async function upsertRows(rows, orgId) {
  const stats = { total: rows.length, inserted: 0, updated: 0, skipped: 0, errors: [] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Mapa de documentos existentes de esta organización: clave -> id.
    const keyOf = (t, d) => `${String(t).trim()}||${String(d == null ? '' : d).trim()}`;
    const existing = new Map();
    const orgCond = orgId == null ? 'organization_id IS NULL' : 'organization_id = $1';
    const { rows: cur } = await client.query(
      `SELECT id, transmittal, documento_nro FROM documents WHERE ${orgCond}`,
      orgId == null ? [] : [orgId]
    );
    for (const d of cur) existing.set(keyOf(d.transmittal, d.documento_nro), d.id);

    const cols = ['status', 'status_g', 'n_contrato', 'empresa', 'contrato', 'descripcion_contrato',
      'fecha', 'transmittal', 'item', 'referencia', 'documento_nro', 'rev', 'descripcion',
      'tipo_doc', 'status_contratista', 'responsable'];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = keyOf(row.transmittal, row.documento_nro);
      const extra = JSON.stringify(row.extra_data || {});
      try {
        await client.query('SAVEPOINT sp');
        if (existing.has(key)) {
          // UPDATE solo de las columnas presentes (no pisa con null lo no enviado).
          const sets = [];
          const vals = [];
          let p = 1;
          for (const c of cols) {
            if (c in row) { sets.push(`${c} = $${p++}`); vals.push(row[c]); }
          }
          sets.push(`extra_data = $${p++}`); vals.push(extra);
          sets.push('updated_at = NOW()');
          vals.push(existing.get(key));
          await client.query(`UPDATE documents SET ${sets.join(', ')} WHERE id = $${p}`, vals);
          stats.updated++;
        } else {
          const insCols = ['organization_id'];
          const insVals = [orgId];
          for (const c of cols) if (c in row) { insCols.push(c); insVals.push(row[c]); }
          insCols.push('extra_data'); insVals.push(extra);
          const ph = insVals.map((_, k) => `$${k + 1}`);
          const { rows: ins } = await client.query(
            `INSERT INTO documents (${insCols.join(', ')}) VALUES (${ph.join(', ')}) RETURNING id`,
            insVals
          );
          existing.set(key, ins[0].id); // evita doble inserción si el Excel repite la clave
          stats.inserted++;
        }
        await client.query('RELEASE SAVEPOINT sp');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
        stats.skipped++;
        if (stats.errors.length < 50) stats.errors.push({ row: i + 1, key, error: e.message });
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return stats;
}

// Punto de entrada: descarga, parsea y sincroniza. Devuelve estadísticas.
async function syncDocuments({ shareUrl, sheet, orgId } = {}) {
  const url = shareUrl || process.env.SYNC_SHARE_URL;
  const sheetName = sheet || process.env.SYNC_SHEET || 'Documentos';
  const org = orgId !== undefined ? orgId : parseOrgId(process.env.SYNC_ORG_ID);
  if (!url) throw new Error('Falta SYNC_SHARE_URL (enlace de SharePoint del Excel)');

  const startedAt = new Date();
  const { buffer } = await downloadSharePointFile(url);
  const rows = rowsFromWorkbook(buffer, sheetName);
  const stats = await upsertRows(rows, org);
  return { ...stats, sheet: sheetName, orgId: org, startedAt, finishedAt: new Date() };
}

// SYNC_ORG_ID vacío/ausente => null (organización del owner/superadmin).
function parseOrgId(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`SYNC_ORG_ID inválido: ${raw}`);
  return n;
}

module.exports = { syncDocuments, rowsFromWorkbook, findHeaderRow, normHeader };
