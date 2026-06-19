const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { createBulkHandler } = require('../lib/bulkInsert');
const { actorOrgId, orgCond } = require('../lib/scope');

// Normaliza la moneda del Excel del usuario al enum del modelo (PEN/USD/EUR).
// Cualquier valor no reconocido se conserva tal cual.
function normalizeCurrency(v) {
  const s = String(v).trim().toUpperCase();
  if (/US\$|USD|D[OÓ]LAR|^\$/.test(s)) return 'USD';
  if (/S\/|PEN|SOL/.test(s)) return 'PEN';
  if (/EUR|€/.test(s)) return 'EUR';
  return v;
}

// ESTADO en el Excel es el estado de TODO el contrato (cerrado o no). Lo
// llevamos al enum del modelo; cualquier valor no reconocido se conserva crudo.
function normalizeContractStatus(v) {
  const s = String(v).trim().toUpperCase();
  if (/CERRAD|CLOSED/.test(s)) return 'Closed';
  if (/RESCIND|RESUEL|TERMINAD/.test(s)) return 'Terminated';
  if (/LIQUID|SETTLEMENT/.test(s)) return 'In Settlement';
  if (/VIGENTE|ACTIV|ABIERT|EN EJEC|CURSO/.test(s)) return 'Active';
  if (/BORRADOR|DRAFT/.test(s)) return 'Draft';
  return v;
}

// Solo dígitos, para emparejar el RUC del Excel con companies.ruc de forma
// tolerante a prefijos/espacios (p.ej. " P20452556201 ").
const rucDigits = (v) => String(v == null ? '' : v).replace(/\D/g, '');

// Carga única del batch: resolver RUC → company id para enlazar el contratista.
async function resolveCompanies(rows, client) {
  const wanted = new Set();
  for (const r of rows) {
    const ruc = r && r.extra_data && (r.extra_data.RUC ?? r.extra_data.ruc);
    const d = rucDigits(ruc);
    if (d) wanted.add(d);
  }
  const rucMap = new Map();
  if (wanted.size === 0) return { rucMap };
  const { rows: companies } = await client.query('SELECT id, ruc FROM companies');
  for (const c of companies) {
    const d = rucDigits(c.ruc);
    if (d) rucMap.set(d, c.id);
  }
  return { rucMap };
}

function enrichRow(known, extra, ctx) {
  // Monto oficial: columna SIN IGV de la moneda del contrato (US$ o S/).
  if (known.amount == null || String(known.amount).trim() === '') {
    const cur = normalizeCurrency(known.currency || '');
    let src = null;
    if (cur === 'USD') src = extra['MONTO CONTRATADO US$ (SIN IGV)'];
    else if (cur === 'PEN') src = extra['MONTO CONTRATADO S/ (SIN IGV)'];
    if (src != null && String(src).trim() !== '') known.amount = src;
  }
  // Contratista: por RUC (llave de empresa). Si no existe, queda en extra_data.
  if (!known.contractor_id && ctx && ctx.rucMap) {
    const id = ctx.rucMap.get(rucDigits(extra.RUC ?? extra.ruc));
    if (id) known.contractor_id = id;
  }
}

// Carga masiva por pegado desde Excel
router.post('/bulk', createBulkHandler({
  table: 'contracts',
  columns: ['code', 'title', 'type', 'project_id', 'contractor_id', 'mandante_id',
    'amount', 'currency', 'start_date', 'end_date', 'actual_end_date', 'status', 'description'],
  required: ['code', 'title'],
  numericColumns: ['amount', 'project_id', 'contractor_id', 'mandante_id'],
  dateColumns: ['start_date', 'end_date', 'actual_end_date'],
  transforms: { currency: normalizeCurrency, status: normalizeContractStatus },
  prepare: resolveCompanies,
  rowTransform: enrichRow,
}));

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const params = [];
    const conds = [];
    const oc = orgCond(req, params, 'ct.organization_id');
    if (oc) conds.push(oc);
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(ct.code ILIKE $${params.length} OR ct.title ILIKE $${params.length})`);
    }
    const query = `
      SELECT ct.*,
        p.name AS project_name,
        c1.razon_social AS contractor_name,
        c2.razon_social AS mandante_name
      FROM contracts ct
      LEFT JOIN projects p ON p.id = ct.project_id
      LEFT JOIN companies c1 ON c1.id = ct.contractor_id
      LEFT JOIN companies c2 ON c2.id = ct.mandante_id`
      + (conds.length ? ' WHERE ' + conds.join(' AND ') : '')
      + ' ORDER BY ct.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = `SELECT ct.*,
        p.name AS project_name,
        c1.razon_social AS contractor_name,
        c2.razon_social AS mandante_name
       FROM contracts ct
       LEFT JOIN projects p ON p.id = ct.project_id
       LEFT JOIN companies c1 ON c1.id = ct.contractor_id
       LEFT JOIN companies c2 ON c2.id = ct.mandante_id
       WHERE ct.id = $1`;
    const oc = orgCond(req, params, 'ct.organization_id');
    if (oc) q += ` AND ${oc}`;
    const result = await pool.query(q, params);
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
        amount, currency, start_date, end_date, actual_end_date, status, description, organization_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        code, title, type || 'Work',
        project_id || null, contractor_id || null, mandante_id || null,
        amount || null, currency || 'PEN',
        start_date || null, end_date || null, actual_end_date || null,
        status || 'Draft', description || null, actorOrgId(req)
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
    const params = [
      code, title, type,
      project_id || null, contractor_id || null, mandante_id || null,
      amount || null, currency,
      start_date || null, end_date || null, actual_end_date || null,
      status, description || null, req.params.id
    ];
    let q = `UPDATE contracts SET code=$1, title=$2, type=$3, project_id=$4, contractor_id=$5,
        mandante_id=$6, amount=$7, currency=$8, start_date=$9, end_date=$10,
        actual_end_date=$11, status=$12, description=$13, updated_at=NOW()
       WHERE id=$14`;
    const oc = orgCond(req, params, 'organization_id');
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING *';
    const result = await pool.query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de contrato ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let q = 'DELETE FROM contracts WHERE id = $1';
    const oc = orgCond(req, params);
    if (oc) q += ` AND ${oc}`;
    q += ' RETURNING id';
    const result = await pool.query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json({ message: 'Contrato eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
