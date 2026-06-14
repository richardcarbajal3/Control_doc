const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM companies';
    const params = [];
    if (search) {
      query += ' WHERE ruc ILIKE $1 OR razon_social ILIKE $1 OR nombre_comercial ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY razon_social ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { ruc, razon_social, nombre_comercial, tipo, pais, email_contacto, telefono, estado } = req.body;
  if (!ruc || !razon_social) return res.status(400).json({ error: 'RUC y razón social son requeridos' });
  try {
    const result = await pool.query(
      `INSERT INTO companies (ruc, razon_social, nombre_comercial, tipo, pais, email_contacto, telefono, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [ruc, razon_social, nombre_comercial || null, tipo || 'Contratista', pais || 'Perú', email_contacto || null, telefono || null, estado || 'Activa']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'RUC ya registrado' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { ruc, razon_social, nombre_comercial, tipo, pais, email_contacto, telefono, estado } = req.body;
  if (!ruc || !razon_social) return res.status(400).json({ error: 'RUC y razón social son requeridos' });
  try {
    const result = await pool.query(
      `UPDATE companies SET ruc=$1, razon_social=$2, nombre_comercial=$3, tipo=$4, pais=$5,
       email_contacto=$6, telefono=$7, estado=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [ruc, razon_social, nombre_comercial || null, tipo, pais, email_contacto || null, telefono || null, estado, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'RUC ya registrado' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM companies WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ message: 'Empresa eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
