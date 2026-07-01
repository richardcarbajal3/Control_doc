// Autosincronización del Excel de CONTRATOS (módulo Análisis).
//
// A diferencia de la sync de Documentos —que parsea filas y hace upsert en la
// tabla `documents`— aquí solo DESCARGAMOS el .xlsx desde SharePoint y lo
// guardamos crudo en `app_settings` (columna BYTEA). El motor de análisis del
// frontend (frontend/src/contratos/lib/excel-processor) lo procesa igual que
// una carga manual, por lo que las cifras (llave CONTRATO+ADENDA, pagos, SAP,
// provisiones, garantías, hojas E_*) salen idénticas a lo que el usuario ya ve.
//
// Ventaja: es automático (mismo cron que Documentos) y durable (el archivo vive
// en Postgres), sin reimplementar el motor de cálculo en el servidor.

const { pool } = require('../db');
const { downloadSharePointFile } = require('./sharepoint');

// Lee la configuración de la sync de contratos (tabla app_settings, fila 1).
async function getContractsConfig() {
  const { rows } = await pool.query(
    `SELECT sync_contracts_share_url, sync_contracts_enabled, sync_contracts_last_run, sync_contracts_synced_at
       FROM app_settings WHERE id = 1`
  );
  return rows[0] || {
    sync_contracts_share_url: null,
    sync_contracts_enabled: true,
    sync_contracts_last_run: null,
    sync_contracts_synced_at: null,
  };
}

// Descarga el Excel de contratos y lo guarda crudo. Idempotente: siempre pisa
// la copia anterior con la más reciente. Devuelve un resumen para la UI.
async function syncContractsFromConfig({ ignoreEnabled = false } = {}) {
  const cfg = await getContractsConfig();
  const url = cfg.sync_contracts_share_url || process.env.SYNC_CONTRACTS_SHARE_URL;
  if (!url) return { skipped: true, reason: 'No hay enlace de SharePoint de contratos configurado' };
  if (!cfg.sync_contracts_enabled && !ignoreEnabled) {
    return { skipped: true, reason: 'Sincronización de contratos desactivada' };
  }

  const { buffer, contentType } = await downloadSharePointFile(url);
  const syncedAt = new Date();
  await pool.query(
    `UPDATE app_settings
        SET sync_contracts_file = $1,
            sync_contracts_synced_at = $2,
            updated_at = NOW()
      WHERE id = 1`,
    [buffer, syncedAt]
  );

  const summary = {
    ok: true,
    at: syncedAt.toISOString(),
    size: buffer.length,
    contentType: contentType || '',
  };
  await saveContractsLastRun(summary);
  return summary;
}

// Persiste el resultado (o error) de la última corrida para mostrarlo en la UI.
async function saveContractsLastRun(summary) {
  try {
    await pool.query(
      'UPDATE app_settings SET sync_contracts_last_run = $1 WHERE id = 1',
      [JSON.stringify(summary)]
    );
  } catch (e) {
    console.error('[sync-contracts] no se pudo guardar sync_contracts_last_run:', e.message);
  }
}

// Devuelve el .xlsx crudo guardado (o null si aún no se ha sincronizado).
async function getStoredContractsFile() {
  const { rows } = await pool.query(
    `SELECT sync_contracts_file, sync_contracts_filename, sync_contracts_synced_at
       FROM app_settings WHERE id = 1`
  );
  const row = rows[0];
  if (!row || !row.sync_contracts_file) return null;
  return {
    buffer: row.sync_contracts_file,               // Buffer (BYTEA)
    filename: row.sync_contracts_filename || 'contratos.xlsx',
    syncedAt: row.sync_contracts_synced_at || null,
  };
}

module.exports = { getContractsConfig, syncContractsFromConfig, saveContractsLastRun, getStoredContractsFile };
