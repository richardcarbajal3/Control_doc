const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDB() {
  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Base de datos inicializada correctamente');
}

module.exports = { pool, initDB };
