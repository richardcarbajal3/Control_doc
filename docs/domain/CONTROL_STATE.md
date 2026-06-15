# CONTROL_STATE.md

## System Control & AI Work Tracking

---

## 1. SYSTEM STATE

### Schema Status
- **Current Model**: CONTRACT_MODEL_V1 (active migration target)
- **Migration Status**: Phase 1 design approved (dual-phase migration)
- **Target State**: Full alignment with CONTRACT_MODEL_V1

### Migration System
- **Strategy**: Dual-phase migration with explicit sequencing
  - **Phase 1**: Add columns + copy data (no constraints)
  - **Phase 2**: Enforce constraints + NOT NULL
- **Execution**: Safe, non-destructive approach

### Active Model
- **SOURCE OF TRUTH**: CONTRACT_MODEL_V1
- **Validation**: All schema changes must validate against this model

---

## 2. AI WORK DISTRIBUTION

### Claude
- **Work**: Designed CONTRACT_MODEL_V1 and initial schema strategy
- **Status**: Stopped due to credit limit
- **Contribution**: Model foundation and migration approach

### Copilot (ACTIVE)
- **Work**: Generating migration system and SQL migrations
- **Current Focus**: Phase 1 migration SQL generation
- **Constraints**: Must validate against CONTRACT_MODEL_V1

### Codex
- **Work**: Backend implementation and integration
- **Status**: Partial / Ongoing
- **Constraints**: Must follow approved migration phases

---

## 3. CURRENT ACTIVE DECISION

### Dual-Phase Migration Approach
**Approved Migration Path:**

```
Phase 1: ADD & COPY
├─ Add new columns to existing table
├─ Copy data from old columns to new columns
├─ No constraints enforced
└─ Preserve existing system functionality

Phase 2: ENFORCE & CLEANUP (Future)
├─ Add NOT NULL constraints
├─ Add foreign key relationships
├─ Remove old columns
└─ Full validation enforcement
```

**Current Focus**: Phase 1 only

---

## 4. NEXT ACTION

### Done in code (this session)
- **Schema guard**: `backend/db/schemaGuard.js` — read-only, runtime drift detection
  against CONTRACT_MODEL_V1. Integrated non-blockingly into `initDB()`.
- **Phase 1 migration authored** (NOT yet executed):
  - `backend/db/migrations/002_migrate_to_contracts_v1.up.sql` (ADD + COPY, additive/idempotent)
  - `backend/db/migrations/002_migrate_to_contracts_v1.down.sql` (rollback)
  - `backend/db/migrations/README.md` (runbook)

### Phase 1 — DONE ✅
- Applied `002_..._v1.up.sql` in Neon. 10 English columns created, types verified.
- Table was empty (0 rows), so no enum value translation was needed.
- Backup branch `backup-before-002-migration` retained.

### Phase 2 cutover — DONE in code ✅
- `backend/routes/contracts.js` now reads/writes English columns.
- `backend/db/init.sql` contracts table redefined in English V1 (fresh DBs).
- Frontend (`ContractForm`, `ContractList`, `App`) uses English fields + V1
  enum values (English stored, Spanish labels). Removed `fecha_firma` (not in V1).
- App runs on production using Phase-1 columns. NO further DB action required to run.

### Optional cleanup — Phase 2 enforce (requires NEON, not required for app)
- `003_cleanup_legacy_contracts.up.sql`: NOT NULL/FK + drop legacy Spanish columns.
- After running, schemaGuard logs full "Schema OK".

### Railway
- App auto-deploys from the deploy branch. The contracts cutover ships with this
  commit; redeploy to publish. No DB env change needed.

---

## 5. RULES

### Source of Truth
- **CONTRACT_MODEL_V1** is the ONLY authoritative schema definition
- All migrations must validate against this model
- No deviations without explicit documented approval

### AI Constraints
- No AI may directly modify schema without validation against CONTRACT_MODEL_V1
- All generated SQL must be reviewed before execution
- No merge or deploy without explicit approval

### Process Requirements
- All schema changes require documentation update
- Migration sequencing must be preserved
- Rollback procedures must be available for each phase
- No migration combines phases

---

## Tracking & Audit
- **Last Updated**: 2026-06-15
- **Current Status**: Schema guard live; Phase 1 migration authored, awaiting Neon execution
- **Approvals Required**: Before running `002_migrate_to_contracts_v1.up.sql` in Neon
