const express = require('express');
const router = express.Router({ mergeParams: true });
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { normalizeEmail, CONTRACT_ROLES } = require('../lib/auth');

// Only admins/superadmins manage who is assigned to a contract and with what role.
router.use(requireAuth, requireRole('admin', 'superadmin'));

// Find a user by email, creating a pending account (no password) if needed so
// an admin can assign roles before the person has logged in. The user is
// attached to the acting admin's organization.
async function ensureUser(email, full_name, orgId) {
  const safeEmail = normalizeEmail(email);
  if (!safeEmail || !safeEmail.includes('@')) throw new Error(`Correo inválido: ${email}`);
  const { rows } = await pool.query(
    `INSERT INTO users (email, full_name, role, organization_id)
       VALUES ($1, $2, 'member', $3)
     ON CONFLICT (email) DO UPDATE
       SET full_name = COALESCE(users.full_name, EXCLUDED.full_name),
           organization_id = COALESCE(users.organization_id, EXCLUDED.organization_id)
     RETURNING id`,
    [safeEmail, full_name || null, orgId || null]
  );
  return rows[0].id;
}

async function assignMember(contractId, { email, role, full_name }, actor) {
  const safeRole = CONTRACT_ROLES.includes(role) ? role : 'lector';
  const userId = await ensureUser(email, full_name, actor.organization_id);
  await pool.query(
    `INSERT INTO contract_members (contract_id, user_id, role)
       VALUES ($1, $2, $3)
     ON CONFLICT (contract_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [contractId, userId, safeRole]
  );
}

// GET /api/contracts/:contractId/members
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cm.user_id, cm.role, u.email, u.full_name, u.is_active
       FROM contract_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.contract_id = $1
       ORDER BY cm.role, u.email`,
      [req.params.contractId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts/:contractId/members  { email, role, full_name? }
router.post('/', async (req, res) => {
  try {
    await assignMember(req.params.contractId, req.body, req.user);
    res.status(201).json({ message: 'Miembro asignado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/contracts/:contractId/members/bulk  { rows: [{ email, role, full_name }] }
router.post('/bulk', async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  let inserted = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    try { await assignMember(req.params.contractId, rows[i], req.user); inserted++; }
    catch (err) { errors.push({ row: i + 1, error: err.message }); }
  }
  res.json({ inserted, failed: errors.length, errors });
});

// DELETE /api/contracts/:contractId/members/:userId
router.delete('/:userId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM contract_members WHERE contract_id = $1 AND user_id = $2 RETURNING id',
      [req.params.contractId, req.params.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Miembro no encontrado' });
    res.json({ message: 'Miembro removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
