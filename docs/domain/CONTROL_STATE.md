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

### Immediate Task
- **Fix and regenerate**: `002_migrate_to_contracts_v1.sql`
- **Scope**: Phase 1 only
- **Validation**: Must align with CONTRACT_MODEL_V1
- **Approval**: Required before execution

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
- **Last Updated**: 2026-06-14
- **Current Status**: Phase 1 migration generation in progress
- **Approvals Required**: Before `002_migrate_to_contracts_v1.sql` execution
