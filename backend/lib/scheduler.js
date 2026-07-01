// Programador de la autosincronización. Corre cada 15 min en la ventana
// 08:00–18:00 (hora de Lima), de lunes a sábado. Se ejecuta dentro del propio
// proceso web (no requiere cron externo). La configuración (enlace, hoja,
// organización, activado) vive en la BD (app_settings) y la edita el admin
// desde la web. La sincronización es idempotente (upsert), así que un reinicio
// o una corrida doble no causan daño.

const cron = require('node-cron');
const { syncFromConfig, saveLastRun } = require('./syncDocuments');
const { syncContractsFromConfig, saveContractsLastRun } = require('./syncContracts');

const TIMEZONE = process.env.SYNC_TZ || 'America/Lima';
// *:00/:15/:30/:45 de 08 a 17, más 18:00 en punto -> última corrida 18:00.
const EXPRESSIONS = ['*/15 8-17 * * 1-6', '0 18 * * 1-6'];

let running = false; // evita solapamiento si una corrida se demora
let lastResult = null; // último resultado en memoria (también se persiste en BD)
let contractsRunning = false; // guarda aparte para la sync de contratos
let lastContractsResult = null;

// trigger: 'cron' | 'manual'. ignoreEnabled fuerza la corrida aunque la
// sincronización automática esté en pausa (lo usa el botón "Sincronizar ahora").
async function runOnce(trigger = 'cron', { ignoreEnabled = false } = {}) {
  if (running) return { skipped: true, reason: 'Ya hay una sincronización en curso' };
  running = true;
  try {
    const stats = await syncFromConfig({ ignoreEnabled });
    lastResult = { trigger, ...stats };
    if (stats.skipped) {
      console.log(`[sync] ${trigger}: omitida (${stats.reason})`);
    } else {
      console.log(`[sync] ${trigger}: ${stats.inserted} nuevos, ${stats.updated} actualizados, ${stats.skipped} omitidos`);
    }
    return lastResult;
  } catch (e) {
    lastResult = { ok: false, trigger, at: new Date().toISOString(), error: e.message };
    console.error(`[sync] ${trigger} ERROR:`, e.message);
    await saveLastRun(lastResult);
    return lastResult;
  } finally {
    running = false;
  }
}

// Sync del Excel de CONTRATOS. Independiente de la de documentos (guarda el
// archivo crudo, no hace upsert de filas). Mismo intervalo/ventana.
async function runContractsOnce(trigger = 'cron', { ignoreEnabled = false } = {}) {
  if (contractsRunning) return { skipped: true, reason: 'Ya hay una sincronización de contratos en curso' };
  contractsRunning = true;
  try {
    const stats = await syncContractsFromConfig({ ignoreEnabled });
    lastContractsResult = { trigger, ...stats };
    if (stats.skipped) {
      console.log(`[sync-contracts] ${trigger}: omitida (${stats.reason})`);
    } else {
      console.log(`[sync-contracts] ${trigger}: archivo guardado (${stats.size} bytes)`);
    }
    return lastContractsResult;
  } catch (e) {
    lastContractsResult = { ok: false, trigger, at: new Date().toISOString(), error: e.message };
    console.error(`[sync-contracts] ${trigger} ERROR:`, e.message);
    await saveContractsLastRun(lastContractsResult);
    return lastContractsResult;
  } finally {
    contractsRunning = false;
  }
}

function startScheduler() {
  for (const expr of EXPRESSIONS) {
    cron.schedule(expr, () => { runOnce('cron'); }, { timezone: TIMEZONE });
    cron.schedule(expr, () => { runContractsOnce('cron'); }, { timezone: TIMEZONE });
  }
  console.log(`[sync] Programado cada 15 min, 08:00–18:00 ${TIMEZONE}, lun–sáb (documentos + contratos, configurable desde la web)`);
}

function getLastResult() {
  return lastResult;
}

function getLastContractsResult() {
  return lastContractsResult;
}

module.exports = { startScheduler, runOnce, getLastResult, runContractsOnce, getLastContractsResult };
