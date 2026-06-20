const { Router } = require('express');
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');
const { actorOrgId, orgCond } = require('../lib/scope');

const router = Router();

// Columns of the documents register, in the order shown in the UI.
const DOC_COLUMNS = [
  'status', 'status_g', 'n_contrato', 'empresa', 'contrato', 'descripcion_contrato',
  'fecha', 'transmittal', 'referencia', 'documento_nro', 'rev', 'descripcion',
  'tipo_doc', 'status_contratista', 'responsable',
];

// Link columns settable via create/update (not part of the paste grid).
const LINK_COLUMNS = ['claim_id', 'parent_id'];
// Annotations set in the claim workspace (complementary per-line data).
const ANNOTATION_COLUMNS = ['claim_note', 'claim_data'];
const JSON_COLUMNS = ['claim_data'];
const WRITE_COLUMNS = [...DOC_COLUMNS, ...LINK_COLUMNS, ...ANNOTATION_COLUMNS];

// A Cerrado claim no longer accepts documents. Rejects an attempt to link a
// document to a closed claim; unlinking (claim_id null/empty) is always allowed.
async function assertClaimAcceptsDocs(body) {
  if (!Object.prototype.hasOwnProperty.call(body, 'claim_id')) return;
  const raw = body.claim_id;
  if (raw == null || raw === '') return;
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) return;
  const { rows } = await pool.query('SELECT status FROM claims WHERE id = $1', [id]);
  if (rows.length && String(rows[0].status || '').trim().toUpperCase() === 'CERRADO') {
    const err = new Error('El claim está cerrado y no acepta más documentos');
    err.statusCode = 409;
    throw err;
  }
}

// A document is PENDING when STATUS G is not "ATENDIDO"; due 3 days after FECHA.
const PENDING_SQL = "UPPER(TRIM(COALESCE(status_g,''))) <> 'ATENDIDO'";
const DIAS_ATRASO_SQL =
  "CASE WHEN fecha IS NOT NULL THEN GREATEST(0, (CURRENT_DATE - (fecha + INTERVAL '3 day')::date)) END";

// Carga masiva por pegado desde Excel
router.post('/bulk', createBulkHandler({
  table: 'documents',
  columns: DOC_COLUMNS,
  required: [],
  dateColumns: ['fecha'],
}));

// Listar documentos (con búsqueda opcional)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const params = [];
    const conds = [];
    const oc = orgCond(req, params);
    if (oc) conds.push(oc);
    if (search) {
      params.push(`%${search}%`);
      const s = params.length;
      conds.push(`(documento_nro ILIKE $${s} OR descripcion ILIKE $${s}
                 OR n_contrato ILIKE $${s} OR empresa ILIKE $${s} OR transmittal ILIKE $${s})`);
    }
    const query = `SELECT *, (${PENDING_SQL}) AS is_pending, ${DIAS_ATRASO_SQL} AS dias_atraso FROM documents`
      + (conds.length ? ' WHERE ' + conds.join(' AND ') : '')
      + ' ORDER BY fecha ASC NULLS LAST, transmittal ASC NULLS LAST, id ASC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener documento por ID
router.get('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = 'SELECT * FROM documents WHERE id = $1';
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    const { rows } = await pool.query(q, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parse a JSON string defensively; non-JSON falls back to an empty object.
function safeParse(s) {
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? o : {}; }
  catch { return {}; }
}

// Build (columns, placeholders, values) for the documents register fields.
// Only columns present in the body are included, so a partial update (e.g.
// assigning a claim) never nulls out the fields it did not send.
function buildFields(body) {
  const cols = [];
  const placeholders = [];
  const values = [];
  let p = 1;
  for (const c of WRITE_COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(body, c)) continue;
    let v = body[c];
    if (JSON_COLUMNS.includes(c)) {
      // Accept an object or a JSON string; store as JSONB text.
      v = v == null ? null : JSON.stringify(typeof v === 'string' ? safeParse(v) : v);
    } else {
      if (typeof v === 'string') v = v.trim();
      if (v === '' || v === undefined) v = null;
      if (LINK_COLUMNS.includes(c) && v != null) {
        const n = parseInt(v, 10);
        v = Number.isFinite(n) ? n : null;
      }
    }
    cols.push(c);
    placeholders.push(`$${p++}`);
    values.push(v);
  }
  return { cols, placeholders, values, nextParam: p };
}

// When a document is linked to a claim, the claim inherits the document's
// N° de contrato if the claim does not have one yet. Keeps a freshly created
// claim aligned with the contract of the documents it groups, without ever
// overwriting a contract already set on the claim.
async function backfillClaimContract(doc) {
  if (!doc || doc.claim_id == null) return;
  const contrato = (doc.n_contrato || '').trim();
  if (!contrato) return;
  await pool.query(
    `UPDATE claims
       SET n_contrato = $1, updated_at = NOW()
     WHERE id = $2 AND COALESCE(TRIM(n_contrato), '') = ''`,
    [contrato, doc.claim_id]
  );
}

// Crear documento
router.post('/', async (req, res) => {
  try {
    await assertClaimAcceptsDocs(req.body);
    const { cols, placeholders, values } = buildFields(req.body);
    // Stamp the document with the actor's organization (tenant isolation).
    cols.push('organization_id');
    placeholders.push(`$${values.length + 1}`);
    values.push(actorOrgId(req));
    const sql = `INSERT INTO documents (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const { rows } = await pool.query(sql, values);
    await backfillClaimContract(rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Actualizar documento (parcial: solo los campos enviados)
router.put('/:id', async (req, res) => {
  try {
    await assertClaimAcceptsDocs(req.body);
    const { cols, values, nextParam } = buildFields(req.body);
    if (cols.length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });
    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const params = [...values, req.params.id];
    let q = `UPDATE documents SET ${setClause}, updated_at = NOW() WHERE id = $${nextParam}`;
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING *';
    const { rows } = await pool.query(q, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    await backfillClaimContract(rows[0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Eliminar documento
router.delete('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = 'DELETE FROM documents WHERE id = $1';
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING *';
    const { rows } = await pool.query(q, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json({ message: 'Documento eliminado', document: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
