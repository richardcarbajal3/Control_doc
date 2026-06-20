const { Router } = require('express');
const { pool } = require('../db');
const { actorOrgId, orgCond } = require('../lib/scope');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const params = [];
    const oc = orgCond(req, params);
    const q = `SELECT * FROM doc_classification_rules${oc ? ` WHERE ${oc}` : ''} ORDER BY priority ASC, id ASC`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { source, pattern, familia, priority } = req.body;
    const orgId = actorOrgId(req);
    const { rows } = await pool.query(
      `INSERT INTO doc_classification_rules (organization_id, source, pattern, familia, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, source || 'codigo', String(pattern || '').trim(), String(familia || '').trim(), priority ?? 10]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { pattern, familia, priority } = req.body;
    const params = [
      String(pattern || '').trim(),
      String(familia || '').trim(),
      priority ?? 10,
      req.params.id,
    ];
    let q = `UPDATE doc_classification_rules SET pattern=$1, familia=$2, priority=$3 WHERE id=$4`;
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING *';
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = `DELETE FROM doc_classification_rules WHERE id=$1`;
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING *';
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
