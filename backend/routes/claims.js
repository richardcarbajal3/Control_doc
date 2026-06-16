const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');
const { actorOrgId, orgCond } = require('../lib/scope');

// A document is PENDING when STATUS G is not "ATENDIDO" (case/space-insensitive).
const PENDING_SQL = "UPPER(TRIM(COALESCE(d.status_g,''))) <> 'ATENDIDO'";
// Days overdue: a document is due 3 days after its FECHA (date of entry).
const DIAS_ATRASO_SQL =
  "CASE WHEN d.fecha IS NOT NULL THEN GREATEST(0, (CURRENT_DATE - (d.fecha + INTERVAL '3 day')::date)) END";

// Carga masiva por pegado desde Excel
router.post('/bulk', createBulkHandler({
  table: 'claims',
  columns: ['code', 'title', 'type', 'n_contrato', 'status', 'description'],
  required: ['title'],
}));

// Listar claims con conteo de documentos y pendientes
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const params = [];
    const conds = [];
    const oc = orgCond(req, params, 'c.organization_id');
    if (oc) conds.push(oc);
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(c.code ILIKE $${params.length} OR c.title ILIKE $${params.length} OR c.n_contrato ILIKE $${params.length})`);
    }
    const query = `
      SELECT c.*,
        COUNT(d.id) AS doc_count,
        COUNT(d.id) FILTER (WHERE ${PENDING_SQL}) AS pendientes
      FROM claims c
      LEFT JOIN documents d ON d.claim_id = c.id`
      + (conds.length ? ' WHERE ' + conds.join(' AND ') : '')
      + ' GROUP BY c.id ORDER BY c.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener un claim con sus documentos de soporte (con días de atraso)
router.get('/:id', async (req, res) => {
  try {
    const cParams = [req.params.id];
    let cq = 'SELECT * FROM claims WHERE id = $1';
    const coc = orgCond(req, cParams, 'organization_id');
    if (coc) cq += ` AND ${coc}`;
    const claimRes = await pool.query(cq, cParams);
    if (claimRes.rows.length === 0) return res.status(404).json({ error: 'Claim no encontrado' });
    const docs = await pool.query(
      `SELECT d.*,
         (${PENDING_SQL}) AS is_pending,
         ${DIAS_ATRASO_SQL} AS dias_atraso
       FROM documents d
       WHERE d.claim_id = $1
       ORDER BY d.fecha NULLS LAST, d.id`,
      [req.params.id]
    );
    res.json({ ...claimRes.rows[0], documents: docs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { code, title, type, n_contrato, status, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const result = await pool.query(
      `INSERT INTO claims (code, title, type, n_contrato, status, description, organization_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code || null, title.trim(), type || 'Otro', n_contrato || null, status || 'Abierto', description || null, actorOrgId(req)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { code, title, type, n_contrato, status, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const params = [code || null, title.trim(), type, n_contrato || null, status, description || null, req.params.id];
    let q = `UPDATE claims SET code=$1, title=$2, type=$3, n_contrato=$4, status=$5, description=$6, updated_at=NOW()
       WHERE id=$7`;
    const oc = orgCond(req, params, 'organization_id');
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING *';
    const result = await pool.query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = 'DELETE FROM claims WHERE id = $1';
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING id';
    const result = await pool.query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim no encontrado' });
    res.json({ message: 'Claim eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
