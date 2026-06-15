-- ============================================================
-- 002_migrate_to_contracts_v1.down.sql
-- ROLLBACK for Phase 1 of the migration to CONTRACT_MODEL_V1.
--
-- Drops ONLY the new V1 columns added by the .up.sql script. The legacy
-- Spanish columns are never touched, so rolling back fully restores the
-- pre-migration state with zero data loss (legacy columns held the source data
-- the whole time).
--
-- Safe to run only while the application still reads/writes the legacy columns
-- (i.e. before any Phase 2 cutover). Do NOT run this after Phase 2.
-- ============================================================

BEGIN;

ALTER TABLE contracts DROP COLUMN IF EXISTS title;
ALTER TABLE contracts DROP COLUMN IF EXISTS type;
ALTER TABLE contracts DROP COLUMN IF EXISTS contractor_id;
ALTER TABLE contracts DROP COLUMN IF EXISTS amount;
ALTER TABLE contracts DROP COLUMN IF EXISTS currency;
ALTER TABLE contracts DROP COLUMN IF EXISTS start_date;
ALTER TABLE contracts DROP COLUMN IF EXISTS end_date;
ALTER TABLE contracts DROP COLUMN IF EXISTS actual_end_date;
ALTER TABLE contracts DROP COLUMN IF EXISTS status;
ALTER TABLE contracts DROP COLUMN IF EXISTS description;

COMMIT;
