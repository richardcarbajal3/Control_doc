const { Router } = require('express');
const { pool } = require('../db');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { search, project_id, contract_id, correspondence_id } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(d.code ILIKE $${params.length} OR d.title ILIKE $${params.length})`);
    }
    if (project_id) {
      params.push(project_id);
      conditions.push(`d.project_id = $${params.length}`);
    }
    if (contract_id) {
      params.push(contract_id);
      conditions.push(`d.contract_id = $${params.length}`);
    }
    if (correspondence_id) {
      params.push(correspondence_id);
      conditions.push(`d.correspondence_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT d.*,
         p.name AS project_name,
         ct.titulo AS contract_titulo,
         co.subject AS correspondence_subject
       FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN contracts ct ON ct.id = d.contract_id
       LEFT JOIN correspondence co ON co.id = d.correspondence_id
       ${where}
       ORDER BY d.updated_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*,
         p.name AS project_name,
         ct.titulo AS contract_titulo,
         co.subject AS correspondence_subject
       FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN contracts ct ON ct.id = d.contract_id
       LEFT JOIN correspondence co ON co.id = d.correspondence_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { code, title, tipo, version, status, project_id, contract_id, correspondence_id, descripcion } = req.body;
  if (!code || !code.trim()) return res.status(400).json({ error: 'El código es obligatorio' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO documents (code, title, tipo, version, status, project_id, contract_id, correspondence_id, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        code.trim(), title.trim(), tipo || 'Documento',
        version || '1.0', status || 'Borrador',
        project_id || null, contract_id || null, correspondence_id || null,
        descripcion || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un documento con ese código' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { code, title, tipo, version, status, project_id, contract_id, correspondence_id, descripcion } = req.body;
  if (!code || !code.trim()) return res.status(400).json({ error: 'El código es obligatorio' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
  try {
    const { rows } = await pool.query(
      `UPDATE documents
       SET code=$1, title=$2, tipo=$3, version=$4, status=$5,
           project_id=$6, contract_id=$7, correspondence_id=$8, descripcion=$9,
           updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [
        code.trim(), title.trim(), tipo || 'Documento',
        version, status,
        project_id || null, contract_id || null, correspondence_id || null,
        descripcion || null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un documento con ese código' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ message: 'Documento eliminado', document: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
