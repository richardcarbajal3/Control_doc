// Rutas de la autosincronización de documentos. Las gestiona el admin desde la
// web (no requieren token externo: usan el login de la app).
//
//   GET  /api/sync/config  -> configuración actual (enlace, hoja, org, activa)
//   PUT  /api/sync/config  -> guarda la configuración
//   POST /api/sync         -> "Sincronizar ahora" (se salta los 15 min)
//   GET  /api/sync/status  -> resultado de la última corrida
//
// Solo admin/superadmin. Un admin de organización solo puede apuntar la
// sincronización a SU propia organización; el superadmin (owner) puede elegir
// cualquiera (o dejarla global/null).

const { Router } = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { runOnce, getLastResult } = require('../lib/scheduler');
const { downloadSharePointFile } = require('../lib/sharepoint');

const router = Router();
// Todas las rutas exigen sesión. La gestión de la configuración es solo para
// admin/superadmin; la descarga del archivo de Análisis la puede pedir cualquier
// usuario autenticado (es solo lectura, para alimentar el módulo en su navegador).
router.use(requireAuth);
const adminOnly = requireRole('admin', 'superadmin');

router.get('/config', adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sync_share_url, sync_sheet, sync_org_id, sync_enabled, sync_last_run,
              analysis_share_url, analysis_enabled, analysis_last_run, updated_at
         FROM app_settings WHERE id = 1`
    );
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', adminOnly, async (req, res) => {
  const { sync_share_url, sync_sheet, sync_org_id, sync_enabled,
          analysis_share_url, analysis_enabled } = req.body || {};
  // Un admin de organización queda confinado a su propia organización.
  const orgId = req.user.role === 'superadmin'
    ? (sync_org_id === '' || sync_org_id == null ? null : parseInt(sync_org_id, 10))
    : req.user.organization_id;
  try {
    const { rows } = await pool.query(
      `UPDATE app_settings
         SET sync_share_url = $1,
             sync_sheet = COALESCE(NULLIF($2, ''), 'Documentos'),
             sync_org_id = $3,
             sync_enabled = COALESCE($4, TRUE),
             analysis_share_url = $5,
             analysis_enabled = COALESCE($6, TRUE),
             updated_at = NOW()
       WHERE id = 1
       RETURNING sync_share_url, sync_sheet, sync_org_id, sync_enabled, sync_last_run,
                 analysis_share_url, analysis_enabled, analysis_last_run, updated_at`,
      [sync_share_url || null, sync_sheet, orgId, sync_enabled,
       analysis_share_url || null, analysis_enabled]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disparo manual: corre aunque la sincronización automática esté en pausa.
router.post('/', adminOnly, async (req, res) => {
  const result = await runOnce('manual', { ignoreEnabled: true });
  res.status(result.ok === false ? 500 : 200).json(result);
});

router.get('/status', adminOnly, async (req, res) => {
  const mem = getLastResult();
  if (mem) return res.json(mem);
  try {
    const { rows } = await pool.query('SELECT sync_last_run FROM app_settings WHERE id = 1');
    res.json((rows[0] && rows[0].sync_last_run) || { message: 'Aún no se ha ejecutado ninguna sincronización' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Descarga el Excel de Análisis configurado en SharePoint y lo entrega como
// binario. El navegador (módulo de Análisis) lo procesa con su propio parser
// —que entiende las hojas Contratos, Pago, SAP, Av&Provision, etc.—, igual que
// si el usuario lo hubiera arrastrado a mano, pero tomándolo siempre del enlace
// central. Hacerlo desde el servidor evita el bloqueo CORS de SharePoint.
router.get('/analysis/file', async (req, res) => {
  let url;
  try {
    const { rows } = await pool.query(
      'SELECT analysis_share_url, analysis_enabled FROM app_settings WHERE id = 1'
    );
    const cfg = rows[0] || {};
    url = cfg.analysis_share_url || process.env.ANALYSIS_SHARE_URL;
    if (!url) return res.status(404).json({ error: 'No hay enlace de SharePoint configurado para Análisis' });
    if (cfg.analysis_enabled === false) {
      return res.status(409).json({ error: 'La sincronización de Análisis está desactivada' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    const { buffer, contentType } = await downloadSharePointFile(url);
    await pool.query(
      'UPDATE app_settings SET analysis_last_run = $1 WHERE id = 1',
      [JSON.stringify({ ok: true, at: new Date().toISOString(), bytes: buffer.length })]
    ).catch(() => {});
    res.setHeader('Content-Type', contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="analisis.xlsx"');
    res.send(buffer);
  } catch (err) {
    await pool.query(
      'UPDATE app_settings SET analysis_last_run = $1 WHERE id = 1',
      [JSON.stringify({ ok: false, at: new Date().toISOString(), error: err.message })]
    ).catch(() => {});
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
