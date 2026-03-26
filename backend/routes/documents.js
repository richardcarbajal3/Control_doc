const { Router } = require('express');
const { pool } = require('../db');

const router = Router();

// Listar documentos (con búsqueda opcional)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM documents';
    const params = [];

    if (search) {
      query += ' WHERE code ILIKE $1 OR title ILIKE $1';
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

// Crear documento
router.post('/', async (req, res) => {
  try {
    const { code, title, version, status } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO documents (code, title, version, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [code, title, version || '1.0', status || 'Borrador']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un documento con ese código' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Actualizar documento
router.put('/:id', async (req, res) => {
  try {
    const { code, title, version, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE documents
       SET code = $1, title = $2, version = $3, status = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [code, title, version, status, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un documento con ese código' });
    }
    res.status(500).json({ error: err.message });
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
