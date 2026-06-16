const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { checkContractsSchema } = require('./schemaGuard');
const { hashPassword, normalizeEmail } = require('../lib/auth');

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

async function initDB() {
  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Base de datos inicializada correctamente');

  // Non-blocking schema observability check. This NEVER alters the schema and
  // NEVER crashes the app — it only reports whether the live `contracts` table
  // matches the expected Contract V1 model (see docs/domain/CONTRACT_MODEL_V1.md).
  await verifyContractsSchema();

  await seedAuth();
}

/**
 * Seed the allowed corporate domains and the bootstrap superadmin account.
 * Idempotent: existing rows are left untouched. Never blocks startup.
 */
async function seedAuth() {
  try {
    const domains = (process.env.AUTH_ALLOWED_DOMAINS || 'shouxin.com.pe,cognify.institute')
      .split(',').map((d) => d.toLowerCase().trim()).filter(Boolean);
    for (const domain of domains) {
      await pool.query(
        'INSERT INTO allowed_domains (domain) VALUES ($1) ON CONFLICT (domain) DO NOTHING',
        [domain]
      );
    }

    const email = normalizeEmail(process.env.SUPERADMIN_EMAIL || 'soporte@cognify.institute');
    const { rows } = await pool.query("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1");
    if (rows.length === 0) {
      const password = process.env.SUPERADMIN_PASSWORD || 'ChangeMe123!';
      await pool.query(
        `INSERT INTO users (email, full_name, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'superadmin', TRUE)
         ON CONFLICT (email) DO UPDATE SET role = 'superadmin'`,
        [email, 'Administrador', hashPassword(password)]
      );
      console.log(`Superadmin sembrado: ${email}`);
      if (!process.env.SUPERADMIN_PASSWORD) {
        console.warn('⚠️ Usando contraseña por defecto del superadmin. Define SUPERADMIN_PASSWORD.');
      }
    }
  } catch (err) {
    console.warn(`⚠️ No se pudo sembrar auth: ${err.message}`);
  }
}

/**
 * Run the read-only schema guard and log the result.
 *
 * Failures (mismatch or even a query error) are swallowed deliberately: schema
 * drift is informational only and must not block startup.
 */
async function verifyContractsSchema() {
  try {
    const { ok, missing, extra } = await checkContractsSchema(pool);
    if (ok) {
      console.log('Schema OK: contracts table matches Contract V1 model');
    } else {
      console.warn('⚠️ SCHEMA DRIFT DETECTED in contracts table');
      if (missing.length) console.warn(`   Missing columns (expected by V1): ${missing.join(', ')}`);
      if (extra.length) console.warn(`   Extra columns (not in V1): ${extra.join(', ')}`);
    }
  } catch (err) {
    // Never block startup on the schema guard itself.
    console.warn(`⚠️ Schema guard could not inspect contracts table: ${err.message}`);
  }
}

module.exports = { pool, initDB, verifyContractsSchema, seedAuth };
