-- ============================================================
-- 004_backfill_claim_contract.down.sql
-- No-op rollback.
--
-- The up migration only FILLED claims whose contract was blank by copying a
-- value already present on their linked documents. It did not record which
-- claims were blank beforehand, so there is no safe automatic way to tell an
-- inherited contract apart from one set by hand. Reverting would risk nulling
-- contracts the user wants to keep, so this rollback intentionally does nothing.
--
-- To undo for a specific claim, clear it manually, e.g.:
--   UPDATE claims SET n_contrato = NULL WHERE id = <claim_id>;
-- ============================================================

SELECT 1;
