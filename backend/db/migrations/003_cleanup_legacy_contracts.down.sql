-- ============================================================
-- 003_cleanup_legacy_contracts.down.sql
-- ROLLBACK for Phase 2 cleanup.
--
-- Re-adds the legacy Spanish columns (nullable, no constraints) and relaxes the
-- V1 constraints added by the .up.sql. It does NOT restore any data that lived
-- in the dropped columns — at cutover the table was empty, so there is none to
-- restore. If you need data back, restore the Neon backup branch instead.
-- ============================================================

BEGIN;

-- Re-add legacy columns (structure only).
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS titulo          VARCHAR(255);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS tipo            VARCHAR(50);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contratista_id  INTEGER;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS monto_original  NUMERIC(18,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS moneda          VARCHAR(10);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS fecha_firma     DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS fecha_inicio    DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS fecha_fin       DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS fecha_fin_real  DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS estado          VARCHAR(30);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS descripcion     TEXT;

-- Relax V1 constraints.
ALTER TABLE contracts ALTER COLUMN title DROP NOT NULL;
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_contractor_id_fkey;

COMMIT;
