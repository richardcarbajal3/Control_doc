const { verifyToken } = require('../lib/auth');
const { pool } = require('../db');

// Require a valid Bearer token and load the (active) user onto req.user.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyToken(token);
    if (!payload || !payload.sub) return res.status(401).json({ error: 'No autenticado' });

    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, organization_id, company_id, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ error: 'Usuario inválido o inactivo' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Restrict to one of the given account roles.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'No autorizado' });
    next();
  };
}

// Gate data access: the app owner sees everything; everyone else needs to
// belong to an organization. A freshly self-registered user (no org) can log
// in but cannot reach the data until the owner/admin assigns them a client.
function requireOrgAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role === 'superadmin' || req.user.organization_id != null) return next();
  return res.status(403).json({ error: 'Tu cuenta aún no tiene acceso. El administrador debe asignarte a un cliente.' });
}

module.exports = { requireAuth, requireRole, requireOrgAccess };
