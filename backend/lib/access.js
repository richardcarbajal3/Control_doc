const { pool } = require('../db');
const { emailDomain } = require('./auth');

// True if the email's domain is in allowed_domains. If no domains are
// configured at all, access is open (and a warning is the operator's job).
async function isEmailAllowed(email) {
  const domain = emailDomain(email);
  if (!domain) return false;
  const { rows } = await pool.query('SELECT 1 FROM allowed_domains LIMIT 1');
  if (rows.length === 0) return true; // no restriction configured
  const hit = await pool.query('SELECT 1 FROM allowed_domains WHERE domain = $1', [domain]);
  return hit.rows.length > 0;
}

module.exports = { isEmailAllowed };
