/**
 * schemaGuard.js
 *
 * READ-ONLY schema observability layer.
 *
 * This module inspects the live `contracts` table via information_schema and
 * compares it against the expected Contract V1 (English) model documented in
 * docs/domain/CONTRACT_MODEL_V1.md.
 *
 * IMPORTANT: This module NEVER alters the database. It only reads metadata
 * from information_schema and reports the difference. It does not run
 * migrations, rename columns, create tables, or modify any structure.
 *
 * Its sole purpose is to make schema drift *observable* at runtime.
 */

// Expected columns for the `contracts` table, per CONTRACT_MODEL_V1.
// This is the single source of truth the live schema is compared against.
const EXPECTED_CONTRACTS_COLUMNS = [
  'id',
  'code',
  'title',
  'type',
  'project_id',
  'contractor_id',
  'mandante_id',
  'amount',
  'currency',
  'start_date',
  'end_date',
  'actual_end_date',
  'status',
  'description',
  'onedrive_url',
  'extra_data',
  'organization_id',
  'created_at',
  'updated_at',
];

/**
 * Inspect a table's columns using information_schema (read-only).
 *
 * @param {import('pg').Pool} pool - active pg pool
 * @param {string} tableName - table to inspect
 * @returns {Promise<string[]>} list of column names actually present
 */
async function getActualColumns(pool, tableName) {
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
}

/**
 * Compare the live `contracts` table against the expected V1 schema.
 *
 * @param {import('pg').Pool} pool - active pg pool
 * @returns {Promise<{ ok: boolean, missing: string[], extra: string[] }>}
 *   - missing: expected columns not present in the live table
 *   - extra:   live columns not part of the expected V1 model
 *   - ok:      true when there are no missing and no extra columns
 */
async function checkContractsSchema(pool) {
  const actual = await getActualColumns(pool, 'contracts');
  const actualSet = new Set(actual);
  const expectedSet = new Set(EXPECTED_CONTRACTS_COLUMNS);

  const missing = EXPECTED_CONTRACTS_COLUMNS.filter((col) => !actualSet.has(col));
  const extra = actual.filter((col) => !expectedSet.has(col));

  return {
    ok: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

module.exports = {
  EXPECTED_CONTRACTS_COLUMNS,
  getActualColumns,
  checkContractsSchema,
};
