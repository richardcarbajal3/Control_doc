const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword, normalizeEmail, ACCOUNT_ROLES } = require('../lib/auth');

// All user administration requires an admin or superadmin.
router.use(requireAuth, requireRole('admin', 'superadmin'));

const publicUser = (u) => ({
  id: u.id, email: u.email, full_name: u.full_name, role: u.role,
  organization_id: u.organization_id, is_active: u.is_active, created_at: u.created_at,
});

// An admin may only grant member/admin; only a superadmin may grant superadmin.
function sanitizeRole(requestedRole, actor) {
  const role = ACCOUNT_ROLES.includes(requestedRole) ? requestedRole : 'member';
  if (role === 'superadmin' && actor.role !== 'superadmin') return 'admin';
  return role;
}

// Create or update a user. An org admin authorizes an email into their own
// organization (any domain). A superadmin may target any organization.
async function upsertUser({ email, full_name, role, password, organization_id }, actor) {
  const safeEmail = normalizeEmail(email);
  if (!safeEmail || !safeEmail.includes('@')) throw new Error(`Correo inválido: ${email}`);
  const safeRole = sanitizeRole(role, actor);
  const hash = password ? hashPassword(password) : null;
  const orgId = actor.role === 'admin'
    ? actor.organization_id
    : (organization_id || null);

  const { rows } = await pool.query(
    `INSERT INTO users (email, full_name, role, password_hash, organization_id)
       VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE
       SET full_name = COALESCE(EXCLUDED.full_name, users.full_name),
           role = EXCLUDED.role,
           organization_id = COALESCE(EXCLUDED.organization_id, users.organization_id),
           password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
           updated_at = NOW()
     RETURNING *`,
    [safeEmail, full_name || null, safeRole, hash, orgId]
  );
  return rows[0];
}

router.get('/', async (req, res) => {
  try {
    const params = [];
    let q = 'SELECT * FROM users';
    if (req.user.role === 'admin') {
      q += ' WHERE organization_id = $1';
      params.push(req.user.organization_id);
    }
    q += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows.map(publicUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await upsertUser(req.body, req.user);
    res.status(201).json(publicUser(user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk create from Excel paste: rows of { email, full_name, role, password }.
router.post('/bulk', async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  let inserted = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    try { await upsertUser(rows[i], req.user); inserted++; }
    catch (err) { errors.push({ row: i + 1, error: err.message }); }
  }
  res.json({ inserted, failed: errors.length, errors });
});

router.put('/:id', async (req, res) => {
  try {
    const { full_name, role, is_active, password } = req.body;
    const safeRole = role ? sanitizeRole(role, req.user) : null;
    const hash = password ? hashPassword(password) : null;
    const { rows } = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         role = COALESCE($2, role),
         is_active = COALESCE($3, is_active),
         password_hash = COALESCE($4, password_hash),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [full_name ?? null, safeRole, typeof is_active === 'boolean' ? is_active : null, hash, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(publicUser(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }
    const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
