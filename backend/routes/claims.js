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
      LEFT JOIN claim_documents cd ON cd.claim_id = c.id
      LEFT JOIN documents d ON d.id = cd.document_id`
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
       JOIN claim_documents cd ON cd.document_id = d.id
       WHERE cd.claim_id = $1
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

// Verify a claim exists in the actor's org; returns its row or null.
async function getClaimInOrg(req, claimId) {
  const params = [claimId];
  let q = 'SELECT id, status, organization_id FROM claims WHERE id = $1';
  const oc = orgCond(req, params, 'organization_id');
  if (oc) q += ` AND ${oc}`;
  const r = await pool.query(q, params);
  return r.rows[0] || null;
}

// Add a document to a claim (M2M membership). A Cerrado claim rejects new docs.
// Linking to one claim never removes the document from any other claim.
router.post('/:id/documents', async (req, res) => {
  const docId = parseInt(req.body.document_id, 10);
  if (!Number.isFinite(docId)) return res.status(400).json({ error: 'document_id inválido' });
  try {
    const claim = await getClaimInOrg(req, req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim no encontrado' });
    if (String(claim.status || '').trim().toUpperCase() === 'CERRADO')
      return res.status(409).json({ error: 'El claim está cerrado y no acepta más documentos' });
    await pool.query(
      `INSERT INTO claim_documents (claim_id, document_id, organization_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.params.id, docId, actorOrgId(req)]
    );
    // The claim inherits the document's contract if it has none yet; never
    // overwrites a contract already set on the claim.
    await pool.query(
      `UPDATE claims c
          SET n_contrato = d.n_contrato, updated_at = NOW()
         FROM documents d
        WHERE c.id = $1 AND d.id = $2
          AND COALESCE(TRIM(c.n_contrato), '') = ''
          AND COALESCE(TRIM(d.n_contrato), '') <> ''`,
      [req.params.id, docId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a document from a single claim (does not affect its other claims).
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const claim = await getClaimInOrg(req, req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim no encontrado' });
    await pool.query(
      'DELETE FROM claim_documents WHERE claim_id = $1 AND document_id = $2',
      [req.params.id, req.params.docId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
