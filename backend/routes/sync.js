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
const { runOnce, getLastResult, runContractsOnce } = require('../lib/scheduler');
const { getStoredContractsFile } = require('../lib/syncContracts');

const router = Router();
router.use(requireAuth, requireRole('admin', 'superadmin'));

router.get('/config', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sync_share_url, sync_sheet, sync_org_id, sync_enabled, sync_last_run,
              sync_contracts_share_url, sync_contracts_enabled, sync_contracts_last_run, sync_contracts_synced_at,
              updated_at
         FROM app_settings WHERE id = 1`
    );
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', async (req, res) => {
  const {
    sync_share_url, sync_sheet, sync_org_id, sync_enabled,
    sync_contracts_share_url, sync_contracts_enabled,
  } = req.body || {};
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
             sync_contracts_share_url = $5,
             sync_contracts_enabled = COALESCE($6, TRUE),
             updated_at = NOW()
       WHERE id = 1
       RETURNING sync_share_url, sync_sheet, sync_org_id, sync_enabled, sync_last_run,
                 sync_contracts_share_url, sync_contracts_enabled, sync_contracts_last_run, sync_contracts_synced_at,
                 updated_at`,
      [sync_share_url || null, sync_sheet, orgId, sync_enabled,
       sync_contracts_share_url || null, sync_contracts_enabled]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disparo manual: corre aunque la sincronización automática esté en pausa.
router.post('/', async (req, res) => {
  const result = await runOnce('manual', { ignoreEnabled: true });
  res.status(result.ok === false ? 500 : 200).json(result);
});

// Disparo manual de la sync de CONTRATOS (descarga y guarda el .xlsx).
router.post('/contracts', async (req, res) => {
  const result = await runContractsOnce('manual', { ignoreEnabled: true });
  res.status(result.ok === false ? 500 : 200).json(result);
});

// Devuelve el .xlsx de contratos guardado, en base64, para que el módulo de
// Análisis del frontend lo procese con su propio motor. 204 si aún no hay copia.
router.get('/contracts-file', async (req, res) => {
  try {
    const file = await getStoredContractsFile();
    if (!file) return res.status(204).end();
    res.json({
      synced_at: file.syncedAt,
      filename: file.filename,
      file_base64: file.buffer.toString('base64'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  const mem = getLastResult();
  if (mem) return res.json(mem);
  try {
    const { rows } = await pool.query('SELECT sync_last_run FROM app_settings WHERE id = 1');
    res.json((rows[0] && rows[0].sync_last_run) || { message: 'Aún no se ha ejecutado ninguna sincronización' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
