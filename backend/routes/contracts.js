const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');

// Normaliza la moneda del Excel del usuario al enum del modelo (PEN/USD/EUR).
// Cualquier valor no reconocido se conserva tal cual.
function normalizeCurrency(v) {
  const s = String(v).trim().toUpperCase();
  if (/US\$|USD|D[OÓ]LAR|^\$/.test(s)) return 'USD';
  if (/S\/|PEN|SOL/.test(s)) return 'PEN';
  if (/EUR|€/.test(s)) return 'EUR';
  return v;
}

// El monto oficial se toma de la columna SIN IGV que corresponde a la moneda
// del contrato (US$ → columna US$, S/ → columna S/). Solo se aplica si la fila
// no trae ya un `amount` explícito.
function deriveAmount(known, extra) {
  if (known.amount != null && String(known.amount).trim() !== '') return;
  const cur = normalizeCurrency(known.currency || '');
  let src = null;
  if (cur === 'USD') src = extra['MONTO CONTRATADO US$ (SIN IGV)'];
  else if (cur === 'PEN') src = extra['MONTO CONTRATADO S/ (SIN IGV)'];
  if (src != null && String(src).trim() !== '') known.amount = src;
}

// Carga masiva por pegado desde Excel
router.post('/bulk', createBulkHandler({
  table: 'contracts',
  columns: ['code', 'title', 'type', 'project_id', 'contractor_id', 'mandante_id',
    'amount', 'currency', 'start_date', 'end_date', 'actual_end_date', 'status', 'description'],
  required: ['code', 'title'],
  numericColumns: ['amount', 'project_id', 'contractor_id', 'mandante_id'],
  dateColumns: ['start_date', 'end_date', 'actual_end_date'],
  transforms: { currency: normalizeCurrency },
  rowTransform: deriveAmount,
}));

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT ct.*,
        p.name AS project_name,
        c1.razon_social AS contractor_name,
        c2.razon_social AS mandante_name
      FROM contracts ct
      LEFT JOIN projects p ON p.id = ct.project_id
      LEFT JOIN companies c1 ON c1.id = ct.contractor_id
      LEFT JOIN companies c2 ON c2.id = ct.mandante_id
    `;
    const params = [];
    if (search) {
      query += ' WHERE ct.code ILIKE $1 OR ct.title ILIKE $1';
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
        c1.razon_social AS contractor_name,
        c2.razon_social AS mandante_name
       FROM contracts ct
       LEFT JOIN projects p ON p.id = ct.project_id
       LEFT JOIN companies c1 ON c1.id = ct.contractor_id
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
    code, title, type, project_id, contractor_id, mandante_id,
    amount, currency, start_date, end_date, actual_end_date,
    status, description
  } = req.body;
  if (!code || !title) return res.status(400).json({ error: 'Código y título son requeridos' });
  if (contractor_id && mandante_id && String(contractor_id) === String(mandante_id))
    return res.status(400).json({ error: 'El contratista y el mandante no pueden ser la misma empresa' });
  if (start_date && end_date && start_date > end_date)
    return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin' });
  if (amount != null && amount !== '' && Number(amount) < 0)
    return res.status(400).json({ error: 'El monto no puede ser negativo' });
  try {
    const result = await pool.query(
      `INSERT INTO contracts (code, title, type, project_id, contractor_id, mandante_id,
        amount, currency, start_date, end_date, actual_end_date, status, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        code, title, type || 'Work',
        project_id || null, contractor_id || null, mandante_id || null,
        amount || null, currency || 'PEN',
        start_date || null, end_date || null, actual_end_date || null,
        status || 'Draft', description || null
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
    code, title, type, project_id, contractor_id, mandante_id,
    amount, currency, start_date, end_date, actual_end_date,
    status, description
  } = req.body;
  if (!code || !title) return res.status(400).json({ error: 'Código y título son requeridos' });
  if (contractor_id && mandante_id && String(contractor_id) === String(mandante_id))
    return res.status(400).json({ error: 'El contratista y el mandante no pueden ser la misma empresa' });
  if (start_date && end_date && start_date > end_date)
    return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin' });
  if (amount != null && amount !== '' && Number(amount) < 0)
    return res.status(400).json({ error: 'El monto no puede ser negativo' });
  try {
    const result = await pool.query(
      `UPDATE contracts SET code=$1, title=$2, type=$3, project_id=$4, contractor_id=$5,
        mandante_id=$6, amount=$7, currency=$8, start_date=$9, end_date=$10,
        actual_end_date=$11, status=$12, description=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [
        code, title, type,
        project_id || null, contractor_id || null, mandante_id || null,
        amount || null, currency,
        start_date || null, end_date || null, actual_end_date || null,
        status, description || null, req.params.id
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
