const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Account-level roles (the per-contract roles live in contract_members).
const ACCOUNT_ROLES = ['superadmin', 'admin', 'member'];
const CONTRACT_ROLES = ['control_documentario', 'colaborador', 'lector'];

// ---- Password hashing (scrypt, no external deps) ----------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const got = crypto.scryptSync(String(password), salt, expected.length);
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

// ---- JWT (HS256, no external deps) ------------------------------------------
function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signToken(payload, ttl = TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttl }));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')); }
  catch { return null; }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

// ---- Helpers ----------------------------------------------------------------
function emailDomain(email) {
  return String(email || '').toLowerCase().trim().split('@')[1] || '';
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

module.exports = {
  ACCOUNT_ROLES, CONTRACT_ROLES, TOKEN_TTL_SECONDS,
  hashPassword, verifyPassword, signToken, verifyToken,
  emailDomain, normalizeEmail,
};
