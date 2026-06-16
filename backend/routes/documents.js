const { Router } = require('express');
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');

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
const ANNOTATION_COLUMNS = ['claim_note'];
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
    let query = `SELECT *, (${PENDING_SQL}) AS is_pending, ${DIAS_ATRASO_SQL} AS dias_atraso FROM documents`;
    const params = [];

    if (search) {
      query += ` WHERE documento_nro ILIKE $1 OR descripcion ILIKE $1
                 OR n_contrato ILIKE $1 OR empresa ILIKE $1 OR transmittal ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY updated_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener documento por ID
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === undefined) v = null;
    if (LINK_COLUMNS.includes(c) && v != null) {
      const n = parseInt(v, 10);
      v = Number.isFinite(n) ? n : null;
    }
    cols.push(c);
    placeholders.push(`$${p++}`);
    values.push(v);
  }
  return { cols, placeholders, values, nextParam: p };
}

// Crear documento
router.post('/', async (req, res) => {
  try {
    await assertClaimAcceptsDocs(req.body);
    const { cols, placeholders, values } = buildFields(req.body);
    const sql = cols.length
      ? `INSERT INTO documents (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
      : 'INSERT INTO documents DEFAULT VALUES RETURNING *';
    const { rows } = await pool.query(sql, values);
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
    const { rows } = await pool.query(
      `UPDATE documents SET ${setClause}, updated_at = NOW() WHERE id = $${nextParam} RETURNING *`,
      [...values, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Eliminar documento
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM documents WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json({ message: 'Documento eliminado', document: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
