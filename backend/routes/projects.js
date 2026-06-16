const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');
const { actorOrgId, orgCond } = require('../lib/scope');

// Carga masiva por pegado desde Excel
router.post('/bulk', createBulkHandler({
  table: 'projects',
  columns: ['code', 'name', 'descripcion', 'tipo', 'ubicacion', 'fecha_inicio', 'fecha_fin', 'estado', 'company_id'],
  required: ['code', 'name'],
  numericColumns: ['company_id'],
  dateColumns: ['fecha_inicio', 'fecha_fin'],
}));

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const params = [];
    const conds = [];
    const oc = orgCond(req, params, 'p.organization_id');
    if (oc) conds.push(oc);
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(p.code ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
    }
    const query = `
      SELECT p.*, c.razon_social AS company_name
      FROM projects p
      LEFT JOIN companies c ON c.id = p.company_id`
      + (conds.length ? ' WHERE ' + conds.join(' AND ') : '')
      + ' ORDER BY p.name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = `SELECT p.*, c.razon_social AS company_name
       FROM projects p LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.id = $1`;
    const oc = orgCond(req, params, 'p.organization_id');
    if (oc) q += ` AND ${oc}`;
    const result = await pool.query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { code, name, descripcion, tipo, ubicacion, fecha_inicio, fecha_fin, estado, company_id } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Código y nombre son requeridos' });
  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin' });
  try {
    const result = await pool.query(
      `INSERT INTO projects (code, name, descripcion, tipo, ubicacion, fecha_inicio, fecha_fin, estado, company_id, organization_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [code, name, descripcion || null, tipo || 'Construcción', ubicacion || null,
       fecha_inicio || null, fecha_fin || null, estado || 'Planificación', company_id || null, actorOrgId(req)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de proyecto ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { code, name, descripcion, tipo, ubicacion, fecha_inicio, fecha_fin, estado, company_id } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Código y nombre son requeridos' });
  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin' });
  try {
    const params = [code, name, descripcion || null, tipo, ubicacion || null,
       fecha_inicio || null, fecha_fin || null, estado, company_id || null, req.params.id];
    let q = `UPDATE projects SET code=$1, name=$2, descripcion=$3, tipo=$4, ubicacion=$5,
       fecha_inicio=$6, fecha_fin=$7, estado=$8, company_id=$9, updated_at=NOW()
       WHERE id=$10`;
    const oc = orgCond(req, params, 'organization_id');
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING *';
    const result = await pool.query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de proyecto ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = 'DELETE FROM projects WHERE id = $1';
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING id';
    const result = await pool.query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ message: 'Proyecto eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
