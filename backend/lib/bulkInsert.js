// Shared helper for bulk "paste from Excel" imports.
//
// Each resource exposes POST /bulk with a body of { rows: [ {field: value, ...,
// extra_data: {...}} ] }. Recognized fields go into real table columns; anything
// else is preserved in the JSONB `extra_data` column so nothing pasted is lost.
//
// Rows are inserted best-effort inside a single transaction using per-row
// SAVEPOINTs: a bad row is reported but does not abort the whole batch.

const { pool } = require('../db');

const EXCEL_EPOCH = Date.UTC(1899, 11, 30); // Excel day 0 == 1899-12-30 (UTC)
const MS_PER_DAY = 86400000;

// Accepts ISO strings, dd/mm/yyyy, dd-mm-yyyy, and bare Excel serial numbers.
// Returns 'YYYY-MM-DD' or null when it cannot be parsed.
function parseDateValue(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  if (/^\d{4,6}$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) {
      return new Date(EXCEL_EPOCH + n * MS_PER_DAY).toISOString().slice(0, 10);
    }
  }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d));
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

// Strips currency symbols / thousands separators. Returns a number or null.
function parseNumberValue(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(/,/g, '.');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function createBulkHandler({
  table,
  columns,
  required = [],
  dateColumns = [],
  numericColumns = [],
  transforms = {},
  rowTransform = null,
  maxRows = 5000,
}) {
  return async (req, res) => {
    const rows = req.body && Array.isArray(req.body.rows) ? req.body.rows : null;
    if (!rows) return res.status(400).json({ error: 'Formato inválido: se espera { rows: [...] }' });
    if (rows.length === 0) return res.status(400).json({ error: 'No hay filas para importar' });
    if (rows.length > maxRows) return res.status(400).json({ error: `Máximo ${maxRows} filas por carga` });

    const client = await pool.connect();
    const result = { inserted: 0, failed: 0, errors: [] };
    try {
      await client.query('BEGIN');
      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i] && typeof rows[i] === 'object' ? rows[i] : {};
        const known = {};
        const extra = {};
        for (const [k, v] of Object.entries(raw)) {
          if (k === 'extra_data') continue;
          if (columns.includes(k)) known[k] = v;
          else if (v !== '' && v != null) extra[k] = v;
        }
        if (raw.extra_data && typeof raw.extra_data === 'object') {
          for (const [k, v] of Object.entries(raw.extra_data)) {
            if (v !== '' && v != null) extra[k] = v;
          }
        }

        // Row-level hook: may derive/adjust `known` columns from `extra` values
        // (e.g. pick the contract amount from the matching currency column).
        if (rowTransform) rowTransform(known, extra);

        const missing = required.filter((c) => known[c] == null || String(known[c]).trim() === '');
        if (missing.length) {
          result.failed++;
          result.errors.push({ row: i + 1, error: `Faltan campos requeridos: ${missing.join(', ')}` });
          continue;
        }

        const cols = [];
        const placeholders = [];
        const values = [];
        let p = 1;
        for (const c of columns) {
          if (!(c in known)) continue;
          let v = known[c];
          if (typeof v === 'string') v = v.trim();
          if (v === '') v = null;
          if (v != null && transforms[c]) v = transforms[c](v);
          if (v != null && numericColumns.includes(c)) v = parseNumberValue(v);
          if (v != null && dateColumns.includes(c)) v = parseDateValue(v);
          cols.push(c);
          placeholders.push(`$${p++}`);
          values.push(v);
        }
        cols.push('extra_data');
        placeholders.push(`$${p++}`);
        values.push(JSON.stringify(extra));

        try {
          await client.query('SAVEPOINT row_sp');
          await client.query(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          await client.query('RELEASE SAVEPOINT row_sp');
          result.inserted++;
        } catch (e) {
          await client.query('ROLLBACK TO SAVEPOINT row_sp');
          result.failed++;
          const msg = e.code === '23505' ? 'Registro duplicado (clave única ya existe)' : e.message;
          result.errors.push({ row: i + 1, error: msg });
        }
      }
      await client.query('COMMIT');
      if (result.errors.length > 200) result.errors = result.errors.slice(0, 200);
      res.json(result);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  };
}

module.exports = { createBulkHandler, parseDateValue, parseNumberValue };
