-- ============================================================
-- 003_cleanup_legacy_contracts.up.sql
-- PHASE 2 (cleanup + enforce) of the migration to CONTRACT_MODEL_V1.
--
-- PRECONDITIONS (must ALL be true before running):
--   * Phase 1 (002) already applied — English columns exist.
--   * The deployed application already uses the English columns
--     (this commit's contracts route/frontend cutover is live).
--   * No data depends on the legacy Spanish columns.
--
-- This DROPS the legacy Spanish columns and enforces basic V1 constraints.
-- DESTRUCTIVE: dropping columns is irreversible. The contracts table was
-- empty (0 rows) at cutover time, so no business data is lost. Take a Neon
-- branch/snapshot before running anyway.
-- ============================================================

BEGIN;

-- 1) Enforce basic V1 constraints (safe on an empty / English-populated table).
ALTER TABLE contracts ALTER COLUMN title SET NOT NULL;
ALTER TABLE contracts ALTER COLUMN type SET DEFAULT 'Work';
ALTER TABLE contracts ALTER COLUMN currency SET DEFAULT 'PEN';
ALTER TABLE contracts ALTER COLUMN status SET DEFAULT 'Draft';

-- Re-establish the contractor foreign key on the new column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contracts_contractor_id_fkey'
      AND table_name = 'contracts'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_contractor_id_fkey
      FOREIGN KEY (contractor_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Drop legacy Spanish columns (no longer referenced by the application).
ALTER TABLE contracts DROP COLUMN IF EXISTS titulo;
ALTER TABLE contracts DROP COLUMN IF EXISTS tipo;
ALTER TABLE contracts DROP COLUMN IF EXISTS contratista_id;
ALTER TABLE contracts DROP COLUMN IF EXISTS monto_original;
ALTER TABLE contracts DROP COLUMN IF EXISTS moneda;
ALTER TABLE contracts DROP COLUMN IF EXISTS fecha_firma;
ALTER TABLE contracts DROP COLUMN IF EXISTS fecha_inicio;
ALTER TABLE contracts DROP COLUMN IF EXISTS fecha_fin;
ALTER TABLE contracts DROP COLUMN IF EXISTS fecha_fin_real;
ALTER TABLE contracts DROP COLUMN IF EXISTS estado;
ALTER TABLE contracts DROP COLUMN IF EXISTS descripcion;

COMMIT;

-- VERIFY (run after applying): expect ONLY V1 columns to remain.
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='contracts' ORDER BY ordinal_position;
