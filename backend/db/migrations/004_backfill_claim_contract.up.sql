-- ============================================================
-- 004_backfill_claim_contract.up.sql
-- One-off backfill: claims without a N° de contrato inherit it from the
-- documents already linked to them (via claim_documents).
--
-- Mirrors the runtime behavior added to the linking endpoints, but applied
-- retroactively to claims created BEFORE that behavior existed.
--
-- SAFE / IDEMPOTENT:
--   * Only touches claims whose n_contrato is NULL or blank.
--   * Never overwrites a contract already set on a claim.
--   * Re-running it changes nothing once claims are filled.
--
-- When a claim's documents reference more than one contract, the most
-- frequent non-blank contract wins (ties broken alphabetically), so the
-- claim adopts the contract shared by most of its supporting documents.
-- ============================================================

BEGIN;

WITH doc_contract AS (
  SELECT cd.claim_id,
         TRIM(d.n_contrato) AS n_contrato,
         COUNT(*)           AS cnt
  FROM claim_documents cd
  JOIN documents d ON d.id = cd.document_id
  WHERE COALESCE(TRIM(d.n_contrato), '') <> ''
  GROUP BY cd.claim_id, TRIM(d.n_contrato)
),
ranked AS (
  SELECT claim_id,
         n_contrato,
         ROW_NUMBER() OVER (
           PARTITION BY claim_id
           ORDER BY cnt DESC, n_contrato
         ) AS rn
  FROM doc_contract
)
UPDATE claims c
   SET n_contrato = r.n_contrato,
       updated_at = NOW()
  FROM ranked r
 WHERE c.id = r.claim_id
   AND r.rn = 1
   AND COALESCE(TRIM(c.n_contrato), '') = '';

COMMIT;

-- VERIFY (run after applying): these claims should now show a contract.
--   SELECT id, code, title, n_contrato FROM claims ORDER BY id;
