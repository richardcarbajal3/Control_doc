const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { orgCond } = require('../lib/scope');

// Módulo Análisis: config de KPIs y snapshot del Excel, una fila por org.
// El superadmin sin organización no persiste nada (mismo contrato que
// /api/settings): GET devuelve vacío y PUT responde 400.
const orgId = (req) => (req.user && req.user.organization_id) || null;

// GET /api/analysis/kpis — KPIs personalizados de la org (null = defaults).
router.get('/kpis', async (req, res) => {
  const org = orgId(req);
  if (!org) return res.json({ kpis: null });
  try {
    const { rows } = await pool.query(
      'SELECT kpis, updated_at FROM analysis_kpi_config WHERE organization_id = $1',
      [org]
    );
    res.json(rows[0] || { kpis: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/analysis/kpis — guarda la lista completa (o null para volver a defaults).
router.put('/kpis', async (req, res) => {
  const org = orgId(req);
  if (!org) return res.status(400).json({ error: 'No tienes una organización asignada' });
  const { kpis } = req.body || {};
  try {
    if (kpis == null) {
      await pool.query('DELETE FROM analysis_kpi_config WHERE organization_id = $1', [org]);
      return res.json({ kpis: null });
    }
    if (!Array.isArray(kpis)) {
      return res.status(400).json({ error: 'kpis debe ser una lista' });
    }
    const { rows } = await pool.query(
      `INSERT INTO analysis_kpi_config (organization_id, kpis, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET kpis = EXCLUDED.kpis, updated_at = NOW()
       RETURNING kpis, updated_at`,
      [org, JSON.stringify(kpis)]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/snapshot — último Excel procesado de la org.
router.get('/snapshot', async (req, res) => {
  const org = orgId(req);
  if (!org) return res.json({ data: null });
  try {
    const { rows } = await pool.query(
      'SELECT file_name, data, updated_at FROM analysis_snapshots WHERE organization_id = $1',
      [org]
    );
    res.json(rows[0] || { data: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/analysis/snapshot — reemplaza el snapshot de la org.
// body: { fileName, data } donde data es el ProcessingResult serializado.
router.put('/snapshot', async (req, res) => {
  const org = orgId(req);
  if (!org) return res.status(400).json({ error: 'No tienes una organización asignada' });
  const { fileName, data } = req.body || {};
  if (data == null || typeof data !== 'object') {
    return res.status(400).json({ error: 'data es obligatorio' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO analysis_snapshots (organization_id, file_name, data, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET file_name = EXCLUDED.file_name, data = EXCLUDED.data, updated_at = NOW()
       RETURNING file_name, updated_at`,
      [org, fileName || null, JSON.stringify(data)]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/analysis/snapshot — borra el snapshot (botón "cargar otro archivo").
router.delete('/snapshot', async (req, res) => {
  const org = orgId(req);
  if (!org) return res.json({ ok: true });
  try {
    await pool.query('DELETE FROM analysis_snapshots WHERE organization_id = $1', [org]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analysis/contract-match — solo lectura sobre contracts/companies.
// body: { codes: string[] } (N° CONTRATO del Excel). Devuelve, por código,
// el contrato registrado en el módulo Contratos si existe en la org.
router.post('/contract-match', async (req, res) => {
  const codes = Array.isArray(req.body && req.body.codes)
    ? [...new Set(req.body.codes.map((c) => String(c).trim()).filter(Boolean))]
    : [];
  if (codes.length === 0) return res.json({ matches: {} });
  try {
    const params = [codes];
    const oc = orgCond(req, params, 'ct.organization_id');
    const { rows } = await pool.query(
      `SELECT ct.id, ct.code, ct.title, ct.status, ct.currency, ct.amount,
              co.name AS contractor_name
         FROM contracts ct
         LEFT JOIN companies co ON co.id = ct.contractor_id
        WHERE ct.code = ANY($1)${oc ? ` AND ${oc}` : ''}`,
      params
    );
    const matches = {};
    for (const r of rows) matches[r.code] = r;
    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
