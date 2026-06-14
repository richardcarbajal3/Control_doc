const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT ct.*,
        p.name AS project_name,
        c1.razon_social AS contratista_name,
        c2.razon_social AS mandante_name
      FROM contracts ct
      LEFT JOIN projects p ON p.id = ct.project_id
      LEFT JOIN companies c1 ON c1.id = ct.contratista_id
      LEFT JOIN companies c2 ON c2.id = ct.mandante_id
    `;
    const params = [];
    if (search) {
      query += ' WHERE ct.code ILIKE $1 OR ct.titulo ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY ct.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ct.*,
        p.name AS project_name,
        c1.razon_social AS contratista_name,
        c2.razon_social AS mandante_name
       FROM contracts ct
       LEFT JOIN projects p ON p.id = ct.project_id
       LEFT JOIN companies c1 ON c1.id = ct.contratista_id
       LEFT JOIN companies c2 ON c2.id = ct.mandante_id
       WHERE ct.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const {
    code, titulo, tipo, project_id, contratista_id, mandante_id,
    monto_original, moneda, fecha_firma, fecha_inicio, fecha_fin,
    fecha_fin_real, estado, descripcion
  } = req.body;
  if (!code || !titulo) return res.status(400).json({ error: 'Código y título son requeridos' });
  if (contratista_id && mandante_id && String(contratista_id) === String(mandante_id))
    return res.status(400).json({ error: 'El contratista y el mandante no pueden ser la misma empresa' });
  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin' });
  if (monto_original != null && monto_original !== '' && Number(monto_original) < 0)
    return res.status(400).json({ error: 'El monto original no puede ser negativo' });
  try {
    const result = await pool.query(
      `INSERT INTO contracts (code, titulo, tipo, project_id, contratista_id, mandante_id,
        monto_original, moneda, fecha_firma, fecha_inicio, fecha_fin, fecha_fin_real, estado, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        code, titulo, tipo || 'Obra',
        project_id || null, contratista_id || null, mandante_id || null,
        monto_original || null, moneda || 'PEN',
        fecha_firma || null, fecha_inicio || null, fecha_fin || null, fecha_fin_real || null,
        estado || 'Borrador', descripcion || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de contrato ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const {
    code, titulo, tipo, project_id, contratista_id, mandante_id,
    monto_original, moneda, fecha_firma, fecha_inicio, fecha_fin,
    fecha_fin_real, estado, descripcion
  } = req.body;
  if (!code || !titulo) return res.status(400).json({ error: 'Código y título son requeridos' });
  if (contratista_id && mandante_id && String(contratista_id) === String(mandante_id))
    return res.status(400).json({ error: 'El contratista y el mandante no pueden ser la misma empresa' });
  if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin)
    return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin' });
  if (monto_original != null && monto_original !== '' && Number(monto_original) < 0)
    return res.status(400).json({ error: 'El monto original no puede ser negativo' });
  try {
    const result = await pool.query(
      `UPDATE contracts SET code=$1, titulo=$2, tipo=$3, project_id=$4, contratista_id=$5,
        mandante_id=$6, monto_original=$7, moneda=$8, fecha_firma=$9, fecha_inicio=$10,
        fecha_fin=$11, fecha_fin_real=$12, estado=$13, descripcion=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [
        code, titulo, tipo,
        project_id || null, contratista_id || null, mandante_id || null,
        monto_original || null, moneda,
        fecha_firma || null, fecha_inicio || null, fecha_fin || null, fecha_fin_real || null,
        estado, descripcion || null, req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de contrato ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json({ message: 'Contrato eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
