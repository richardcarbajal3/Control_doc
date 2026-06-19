const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/settings — returns the current org's settings (including onedrive_base_url).
// Available to any authenticated user who belongs to an organization.
router.get('/', requireAuth, async (req, res) => {
  const orgId = req.user.organization_id;
  if (!orgId) return res.json({ onedrive_base_url: null });
  try {
    const { rows } = await pool.query(
      'SELECT onedrive_base_url FROM organizations WHERE id = $1',
      [orgId]
    );
    res.json(rows[0] || { onedrive_base_url: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update the current org's settings.
// Only admins can update their own org's settings (superadmin uses /organizations).
router.put('/', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const orgId = req.user.organization_id;
  if (!orgId) return res.status(400).json({ error: 'No tienes una organización asignada' });
  const { onedrive_base_url } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE organizations SET onedrive_base_url = $1, updated_at = NOW() WHERE id = $2 RETURNING onedrive_base_url',
      [onedrive_base_url || null, orgId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
