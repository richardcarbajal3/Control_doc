const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword, normalizeEmail } = require('../lib/auth');

// Only the app owner manages organizations (the clients/tenants) and their admins.
router.use(requireAuth, requireRole('superadmin'));

// List organizations with their member and admin counts.
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*,
        COUNT(u.id) AS member_count,
        COUNT(u.id) FILTER (WHERE u.role = 'admin') AS admin_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, plan, status } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO organizations (name, plan, status) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), plan || null, status || 'active']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, plan, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE organizations SET name = COALESCE($1, name), plan = $2, status = COALESCE($3, status),
         updated_at = NOW() WHERE id = $4 RETURNING *`,
      [name || null, plan || null, status || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Members of an organization.
router.get('/:id/members', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, is_active FROM users
       WHERE organization_id = $1 ORDER BY role, email`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign (or promote) a user as the admin of this organization. This is what
// the owner does after a client subscribes. Creates the user if needed.
router.post('/:id/admin', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Correo inválido' });
    const hash = req.body.password ? hashPassword(req.body.password) : null;
    const { rows } = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, organization_id, is_active)
         VALUES ($1, $2, $3, 'admin', $4, TRUE)
       ON CONFLICT (email) DO UPDATE
         SET role = 'admin', organization_id = $4, is_active = TRUE,
             full_name = COALESCE(EXCLUDED.full_name, users.full_name),
             password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
             updated_at = NOW()
       RETURNING id, email, full_name, role, organization_id`,
      [email, req.body.full_name || null, hash, req.params.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM organizations WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ message: 'Organización eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
