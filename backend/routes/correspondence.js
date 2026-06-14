const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, project_id, contract_id } = req.query;
    const params = [];
    const conditions = [];

    if (project_id) {
      params.push(project_id);
      conditions.push(`co.project_id = $${params.length}`);
    }
    if (contract_id) {
      params.push(contract_id);
      conditions.push(`co.contract_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(co.code ILIKE $${params.length} OR co.subject ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT co.*,
         p.code AS project_code, p.name AS project_name,
         ct.code AS contract_code, ct.titulo AS contract_titulo,
         c1.razon_social AS sender_name,
         c2.razon_social AS receiver_name
       FROM correspondence co
       LEFT JOIN projects p ON p.id = co.project_id
       LEFT JOIN contracts ct ON ct.id = co.contract_id
       LEFT JOIN companies c1 ON c1.id = co.sender_company_id
       LEFT JOIN companies c2 ON c2.id = co.receiver_company_id
       ${where}
       ORDER BY co.issue_date DESC, co.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT co.*,
         p.code AS project_code, p.name AS project_name,
         ct.code AS contract_code, ct.titulo AS contract_titulo,
         c1.razon_social AS sender_name,
         c2.razon_social AS receiver_name
       FROM correspondence co
       LEFT JOIN projects p ON p.id = co.project_id
       LEFT JOIN contracts ct ON ct.id = co.contract_id
       LEFT JOIN companies c1 ON c1.id = co.sender_company_id
       LEFT JOIN companies c2 ON c2.id = co.receiver_company_id
       WHERE co.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Correspondencia no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function validate(body) {
  const { code, subject, project_id, sender_company_id, receiver_company_id, issue_date, due_date } = body;
  if (!code || !subject) return 'Código y asunto son requeridos';
  if (!project_id) return 'El proyecto es requerido';
  if (!sender_company_id) return 'La empresa remitente es requerida';
  if (!receiver_company_id) return 'La empresa destinataria es requerida';
  if (!issue_date) return 'La fecha de emisión es requerida';
  if (String(sender_company_id) === String(receiver_company_id))
    return 'La empresa remitente y la destinataria no pueden ser la misma';
  if (due_date && due_date < issue_date)
    return 'La fecha de vencimiento no puede ser anterior a la fecha de emisión';
  return null;
}

router.post('/', async (req, res) => {
  const {
    code, subject, correspondence_type, direction, project_id, contract_id,
    sender_company_id, receiver_company_id, issue_date, due_date, status, description
  } = req.body;

  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = await pool.query(
      `INSERT INTO correspondence
         (code, subject, correspondence_type, direction, project_id, contract_id,
          sender_company_id, receiver_company_id, issue_date, due_date, status, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        code, subject, correspondence_type || 'Carta', direction || 'Saliente',
        project_id, contract_id || null,
        sender_company_id, receiver_company_id,
        issue_date, due_date || null,
        status || 'Pendiente', description || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de correspondencia ya existe' });
    if (err.code === '23503') return res.status(400).json({ error: 'Proyecto, empresa o contrato referenciado no existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const {
    code, subject, correspondence_type, direction, project_id, contract_id,
    sender_company_id, receiver_company_id, issue_date, due_date, status, description
  } = req.body;

  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = await pool.query(
      `UPDATE correspondence SET
         code=$1, subject=$2, correspondence_type=$3, direction=$4, project_id=$5,
         contract_id=$6, sender_company_id=$7, receiver_company_id=$8,
         issue_date=$9, due_date=$10, status=$11, description=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [
        code, subject, correspondence_type, direction, project_id,
        contract_id || null, sender_company_id, receiver_company_id,
        issue_date, due_date || null, status, description || null,
        req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Correspondencia no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de correspondencia ya existe' });
    if (err.code === '23503') return res.status(400).json({ error: 'Proyecto, empresa o contrato referenciado no existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM correspondence WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Correspondencia no encontrada' });
    res.json({ message: 'Correspondencia eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
