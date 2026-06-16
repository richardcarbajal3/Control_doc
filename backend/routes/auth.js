const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { verifyPassword, signToken, normalizeEmail } = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');

const publicUser = (u) => ({
  id: u.id, email: u.email, full_name: u.full_name, role: u.role, company_id: u.company_id,
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
router.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

module.exports = router;
