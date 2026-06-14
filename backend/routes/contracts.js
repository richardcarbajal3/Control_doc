const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const VALID_TYPES = ['Obra', 'Suministro', 'Servicios', 'Consultoría'];
const VALID_CURRENCIES = ['PEN', 'USD', 'EUR'];
const VALID_STATUSES = ['Draft', 'Active', 'In Settlement', 'Closed', 'Terminated'];

function validate(body) {
  const { code, title, type, currency, status, contratista_id, mandante_id, start_date, end_date, amount } = body;
  if (!code || !String(code).trim()) return 'El código es requerido';
  if (!title || !String(title).trim()) return 'El título es requerido';
  if (type && !VALID_TYPES.includes(type)) return `Tipo inválido. Valores permitidos: ${VALID_TYPES.join(', ')}`;
  if (currency && !VALID_CURRENCIES.includes(currency)) return `Moneda inválida. Valores permitidos: ${VALID_CURRENCIES.join(', ')}`;
  if (status && !VALID_STATUSES.includes(status)) return `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}`;
  if (contratista_id && mandante_id && String(contratista_id) === String(mandante_id))
    return 'El contratista y el mandante no pueden ser la misma empresa';
  if (start_date && end_date && start_date > end_date)
    return 'La fecha de inicio no puede ser posterior a la fecha de fin';
  if (amount != null && amount !== '' && Number(amount) < 0)
    return 'El monto no puede ser negativo';
  return null;
}

router.get('/', async (req, res) => {
  try {
    const { search, project_id, status } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ct.code ILIKE $${params.length} OR ct.title ILIKE $${params.length})`);
    }
    if (project_id) {
      params.push(project_id);
      conditions.push(`ct.project_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`ct.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT ct.*,
         p.name  AS project_name,
         c1.razon_social AS contratista_name,
         c2.razon_social AS mandante_name
       FROM contracts ct
       LEFT JOIN projects p  ON p.id  = ct.project_id
       LEFT JOIN companies c1 ON c1.id = ct.contratista_id
       LEFT JOIN companies c2 ON c2.id = ct.mandante_id
       ${where}
       ORDER BY ct.created_at DESC`,
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
      `SELECT ct.*,
         p.name  AS project_name,
         c1.razon_social AS contratista_name,
         c2.razon_social AS mandante_name
       FROM contracts ct
       LEFT JOIN projects p  ON p.id  = ct.project_id
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
  const { code, title, type, project_id, contratista_id, mandante_id,
          amount, currency, start_date, end_date, status, description } = req.body;

  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = await pool.query(
      `INSERT INTO contracts
         (code, title, type, project_id, contratista_id, mandante_id,
          amount, currency, start_date, end_date, status, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        code.trim(), title.trim(), type || 'Obra',
        project_id || null, contratista_id || null, mandante_id || null,
        amount || null, currency || 'PEN',
        start_date || null, end_date || null,
        status || 'Draft', description || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de contrato ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { code, title, type, project_id, contratista_id, mandante_id,
          amount, currency, start_date, end_date, status, description } = req.body;

  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = await pool.query(
      `UPDATE contracts
       SET code=$1, title=$2, type=$3, project_id=$4, contratista_id=$5,
           mandante_id=$6, amount=$7, currency=$8, start_date=$9,
           end_date=$10, status=$11, description=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [
        code.trim(), title.trim(), type,
        project_id || null, contratista_id || null, mandante_id || null,
        amount || null, currency,
        start_date || null, end_date || null,
        status, description || null,
        req.params.id,
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
