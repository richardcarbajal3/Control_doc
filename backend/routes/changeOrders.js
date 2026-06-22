const { Router } = require('express');
const { pool } = require('../db');
const { actorOrgId, orgCond } = require('../lib/scope');

const router = Router();

const COLS = ['code', 'n_contrato', 'title', 'description', 'monto_solicitado', 'monto_aprobado', 'currency', 'status'];

// List change orders
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const params = [];
    const conds = [];
    const oc = orgCond(req, params, 'co.organization_id');
    if (oc) conds.push(oc);
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(co.code ILIKE $${params.length} OR co.title ILIKE $${params.length} OR co.n_contrato ILIKE $${params.length})`);
    }
    const q = `
      SELECT co.*,
        COUNT(cod.document_id) AS doc_count
      FROM change_orders co
      LEFT JOIN change_order_documents cod ON cod.change_order_id = co.id
      ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
      GROUP BY co.id
      ORDER BY co.created_at DESC`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one OC with its documents
router.get('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = 'SELECT * FROM change_orders WHERE id = $1';
    const oc = orgCond(req, params, 'organization_id');
    if (oc) q += ` AND ${oc}`;
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    const docs = await pool.query(
      `SELECT d.* FROM documents d
       JOIN change_order_documents cod ON cod.document_id = d.id
       WHERE cod.change_order_id = $1
       ORDER BY d.fecha NULLS LAST, d.id`,
      [req.params.id]
    );
    res.json({ ...rows[0], documents: docs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const vals = COLS.map((c) => req.body[c] ?? null);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    const orgId = actorOrgId(req);
    const { rows } = await pool.query(
      `INSERT INTO change_orders (${COLS.join(',')}, organization_id) VALUES (${placeholders},$${vals.length + 1}) RETURNING *`,
      [...vals, orgId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const sets = COLS.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const vals = COLS.map((c) => req.body[c] ?? null);
    const params = [...vals, new Date(), req.params.id];
    let q = `UPDATE change_orders SET ${sets}, updated_at = $${vals.length + 1} WHERE id = $${vals.length + 2} RETURNING *`;
    const oc = orgCond(req, params, 'organization_id');
    if (oc) q = q.replace('RETURNING', `AND ${oc} RETURNING`);
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = 'DELETE FROM change_orders WHERE id = $1';
    const oc = orgCond(req, params, 'organization_id');
    if (oc) q += ` AND ${oc}`;
    await pool.query(q, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link document to OC
router.post('/:id/documents', async (req, res) => {
  const { document_id } = req.body;
  if (!document_id) return res.status(400).json({ error: 'document_id requerido' });
  try {
    await pool.query(
      `INSERT INTO change_order_documents (change_order_id, document_id, organization_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [req.params.id, document_id, actorOrgId(req)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unlink document from OC
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM change_order_documents WHERE change_order_id = $1 AND document_id = $2',
      [req.params.id, req.params.docId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
