const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { verifyPassword, signToken, normalizeEmail, hashPassword } = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora
const RESET_GENERIC_MSG =
  'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Base pública para construir el enlace del correo. Usa APP_URL si está
// definida; si no, la deriva del propio request (host + protocolo).
function appBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

const publicUser = (u) => ({
  id: u.id, email: u.email, full_name: u.full_name, role: u.role,
  organization_id: u.organization_id, company_id: u.company_id,
});

// POST /api/auth/register  { email, password, full_name }
// Open self-registration: anyone can create an account. They sign in but have
// no organization yet, so the data routes stay closed until the app owner (or
// an org admin) assigns them a client/role.
router.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Correo inválido' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Ese correo ya está registrado' });

    const { rows } = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'member', TRUE) RETURNING *`,
      [email, req.body.full_name || null, hashPassword(password)]
    );
    const user = rows[0];
    const token = signToken({ sub: user.id, role: user.role });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña requeridos' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = signToken({ sub: user.id, role: user.role });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot  { email }
// Genera un token de recuperación y envía el enlace por correo. Responde SIEMPRE
// con el mismo mensaje (no revela si el correo existe) para evitar enumeración.
router.post('/forgot', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Correo inválido' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, full_name, is_active FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];

    if (user && user.is_active) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, sha256(token), expiresAt]
      );

      const link = `${appBaseUrl(req)}/reset-password?token=${token}`;
      const text =
        `Hola${user.full_name ? ' ' + user.full_name : ''},\n\n` +
        `Recibimos una solicitud para restablecer tu contraseña en Control Doc.\n` +
        `Abre este enlace para crear una nueva (válido por 1 hora):\n\n${link}\n\n` +
        `Si no fuiste tú, ignora este correo: tu contraseña no cambiará.`;
      const html =
        `<p>Hola${user.full_name ? ' ' + user.full_name : ''},</p>` +
        `<p>Recibimos una solicitud para restablecer tu contraseña en <strong>Control Doc</strong>.</p>` +
        `<p><a href="${link}">Crear una nueva contraseña</a> (el enlace vence en 1 hora).</p>` +
        `<p>Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p>`;

      try {
        await sendMail({ to: user.email, subject: 'Restablecer tu contraseña — Control Doc', html, text });
      } catch (mailErr) {
        console.error('No se pudo enviar el correo de recuperación:', mailErr.message);
      }
    }

    res.json({ message: RESET_GENERIC_MSG });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset  { token, password }
// Valida el token (existe, no usado, no expirado) y cambia la contraseña.
router.post('/reset', async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const password = req.body.password || '';
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const { rows } = await pool.query(
      `SELECT id, user_id, expires_at, used_at
         FROM password_reset_tokens
        WHERE token_hash = $1`,
      [sha256(token)]
    );
    const record = rows[0];
    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El enlace es inválido o expiró. Solicita uno nuevo.' });
    }

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashPassword(password), record.user_id]
    );
    // Marca este token como usado e invalida cualquier otro pendiente del usuario.
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL`,
      [record.user_id]
    );

    res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const u = publicUser(req.user);
  if (u.organization_id) {
    try {
      const { rows } = await pool.query(
        'SELECT onedrive_base_url FROM organizations WHERE id = $1',
        [u.organization_id]
      );
      u.onedrive_base_url = rows[0]?.onedrive_base_url || null;
    } catch { /* no-op */ }
  }
  res.json(u);
});

module.exports = router;
