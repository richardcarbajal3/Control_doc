-- ============================================================
-- 002_migrate_to_contracts_v1.up.sql
-- PHASE 1 of the dual-phase migration to CONTRACT_MODEL_V1.
--
-- STRATEGY (per docs/domain/CONTROL_STATE.md):
--   Phase 1 = ADD new English columns + COPY data. NO constraints.
--   Phase 2 = enforce NOT NULL / FK + drop legacy columns (FUTURE, separate file).
--
-- SAFETY GUARANTEES of this script:
--   * Purely ADDITIVE. It never drops or renames anything.
--   * IDEMPOTENT. Safe to run multiple times (IF NOT EXISTS + COALESCE).
--   * Legacy Spanish columns remain fully functional. The running app keeps
--     working against them, so this can be applied with zero downtime.
--
-- DOES NOT translate enum VALUES (e.g. 'Borrador' -> 'Draft'). Raw values are
-- copied as-is. Value translation requires a data inventory and is deferred to
-- a reviewed follow-up step (see migrations/README.md).
-- ============================================================

BEGIN;

-- 1) ADD new V1 (English) columns. Nullable, no constraints (Phase 1).
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS title           VARCHAR(255);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS type            VARCHAR(50);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contractor_id   INTEGER;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS amount          NUMERIC(18,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency        VARCHAR(10);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS start_date      DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS end_date        DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS actual_end_date DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS status          VARCHAR(30);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS description     TEXT;

-- 2) COPY data from legacy (Spanish) columns into the new ones.
--    COALESCE keeps the script idempotent: a second run will not overwrite
--    values that have already diverged from the legacy column.
UPDATE contracts SET
  title           = COALESCE(title,           titulo),
  type            = COALESCE(type,            tipo),
  contractor_id   = COALESCE(contractor_id,   contratista_id),
  amount          = COALESCE(amount,          monto_original),
  currency        = COALESCE(currency,        moneda),
  start_date      = COALESCE(start_date,      fecha_inicio),
  end_date        = COALESCE(end_date,        fecha_fin),
  actual_end_date = COALESCE(actual_end_date, fecha_fin_real),
  status          = COALESCE(status,          estado),
  description      = COALESCE(description,    descripcion);

-- NOTE: legacy column `fecha_firma` has no V1 counterpart and is intentionally
-- left untouched. `mandante_id`, `project_id`, `code`, `id`, `created_at`,
-- `updated_at` are already aligned and require no change.

COMMIT;

-- VERIFY (run manually after applying):
--   SELECT id, titulo, title, estado, status, monto_original, amount
--     FROM contracts ORDER BY id LIMIT 20;
