const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { verifyPassword, signToken, normalizeEmail, hashPassword } = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');

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
