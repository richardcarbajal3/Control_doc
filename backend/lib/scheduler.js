// Programador de la autosincronización. Corre cada 15 min en la ventana
// 08:00–18:00 (hora de Lima), de lunes a sábado. Se ejecuta dentro del propio
// proceso web (no requiere cron externo). La sincronización es idempotente
// (upsert), así que un reinicio o una corrida doble no causan daño.

const cron = require('node-cron');
const { syncDocuments } = require('./syncDocuments');

const TIMEZONE = process.env.SYNC_TZ || 'America/Lima';
// *:00/:15/:30/:45 de 08 a 17, más 18:00 en punto -> última corrida 18:00.
const EXPRESSIONS = ['*/15 8-17 * * 1-6', '0 18 * * 1-6'];

let running = false; // evita solapamiento si una corrida se demora
let lastResult = null; // último resultado, expuesto en GET /api/sync/status

async function runOnce(trigger = 'cron') {
  if (running) {
    return { skipped: true, reason: 'Ya hay una sincronización en curso' };
  }
  running = true;
  try {
    const stats = await syncDocuments();
    lastResult = { ok: true, trigger, at: new Date().toISOString(), ...stats };
    console.log(`[sync] ${trigger}: ${stats.inserted} nuevos, ${stats.updated} actualizados, ${stats.skipped} omitidos`);
    return lastResult;
  } catch (e) {
    lastResult = { ok: false, trigger, at: new Date().toISOString(), error: e.message };
    console.error(`[sync] ${trigger} ERROR:`, e.message);
    return lastResult;
  } finally {
    running = false;
  }
}

function startScheduler() {
  if (!process.env.SYNC_SHARE_URL) {
    console.log('[sync] SYNC_SHARE_URL no configurado: autosincronización deshabilitada');
    return;
  }
  for (const expr of EXPRESSIONS) {
    cron.schedule(expr, () => { runOnce('cron'); }, { timezone: TIMEZONE });
  }
  console.log(`[sync] Programado cada 15 min, 08:00–18:00 ${TIMEZONE}, lun–sáb`);
}

function getLastResult() {
  return lastResult;
}

module.exports = { startScheduler, runOnce, getLastResult };
