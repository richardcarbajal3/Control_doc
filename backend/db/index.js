const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { checkContractsSchema } = require('./schemaGuard');

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

module.exports = { pool, initDB, verifyContractsSchema };
