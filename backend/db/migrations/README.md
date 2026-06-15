# Migrations — Control Doc

Manual, review-gated SQL migrations toward `CONTRACT_MODEL_V1`.

These files are **NOT auto-executed** by the app. `initDB()` only runs
`init.sql` (idempotent `CREATE TABLE IF NOT EXISTS`). Migrations are applied
manually against Neon so each step can be reviewed and approved, per
`docs/domain/CONTROL_STATE.md`.

## Strategy: dual-phase, non-destructive

| Phase | File | Effect | Status |
|-------|------|--------|--------|
| 1 | `002_migrate_to_contracts_v1.up.sql` | ADD English columns + COPY data. No constraints, no drops. | APPLIED in Neon ✅ |
| 1 rollback | `002_migrate_to_contracts_v1.down.sql` | DROP only the new columns. Legacy data intact. | Held (do not run) |
| 2 cleanup | `003_cleanup_legacy_contracts.up.sql` | Enforce NOT NULL/FK + DROP legacy Spanish columns. | OPTIONAL — needs Neon execution |
| 2 rollback | `003_cleanup_legacy_contracts.down.sql` | Re-add legacy columns (structure only). | Ready |

App cutover to English columns (backend route + frontend) is DONE in code.
The app works on production right now using the English columns added in
Phase 1 — running `003` is OPTIONAL cleanup, not required for the app to run.

After Phase 1, the table has BOTH Spanish and English columns. The running app
keeps using the Spanish ones, so there is **zero downtime / zero breakage**.
The `schemaGuard` will report drift cleared for the V1 columns it checks.

## How to apply Phase 1 (Neon)

1. Open the **Neon SQL Editor** for the production database (or `psql "$DATABASE_URL"`).
2. **Back up first** (Neon: create a branch/snapshot of the project).
3. Paste and run `002_migrate_to_contracts_v1.up.sql`.
4. Verify:
   ```sql
   SELECT id, titulo, title, estado, status, monto_original, amount
     FROM contracts ORDER BY id LIMIT 20;
   ```
   English columns should mirror the Spanish ones (raw values).
5. If anything looks wrong, run `002_migrate_to_contracts_v1.down.sql` to roll back.

## Railway

No Railway change is required for Phase 1 — the deployed app code is unchanged
and keeps reading the legacy columns. After applying the migration, the next
deploy's startup log should print **`Schema OK`** (or list a smaller drift set)
from the schema guard.

## Important — value translation deferred

Phase 1 copies enum values **as-is**. Spanish values such as `estado='Borrador'`
are copied verbatim into `status`; they are NOT translated to the V1 English
enum (`Draft`, `Active`, `In Settlement`, `Closed`, `Terminated`). Translating
values requires an inventory of the actual values present in production and is a
separate, reviewed Phase 1b/Phase 2 step. Run this to inventory first:

```sql
SELECT DISTINCT estado FROM contracts;
SELECT DISTINCT tipo   FROM contracts;
SELECT DISTINCT moneda FROM contracts;
```
