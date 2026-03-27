const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
}

module.exports = { pool, initDB };
