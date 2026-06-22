// Rutas de la autosincronización de documentos.
//
//   POST /api/sync         -> dispara una sincronización manual (protegida por token)
//   GET  /api/sync/status  -> devuelve el resultado de la última corrida
//
// El disparo manual NO usa el login de la app (lo invoca un cron externo o un
// administrador con el token). Se protege con SYNC_TOKEN vía cabecera
// Authorization: Bearer <token> (o ?token= en la query).

const { Router } = require('express');
const { runOnce, getLastResult } = require('../lib/scheduler');

const router = Router();

function tokenOk(req) {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) return false; // sin token configurado, el disparo manual queda cerrado
  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const provided = bearer || req.query.token;
  return provided === expected;
}

router.post('/', async (req, res) => {
  if (!tokenOk(req)) return res.status(401).json({ error: 'Token de sincronización inválido o ausente' });
  const result = await runOnce('manual');
  res.status(result.ok === false ? 500 : 200).json(result);
});

router.get('/status', (req, res) => {
  if (!tokenOk(req)) return res.status(401).json({ error: 'Token de sincronización inválido o ausente' });
  res.json(getLastResult() || { message: 'Aún no se ha ejecutado ninguna sincronización' });
});

module.exports = router;
