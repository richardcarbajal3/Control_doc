# CONTRACT MODEL V1 (Control Doc)

## 1. Entity definition
Contract is a lifecycle-controlled agreement between two companies within a project context.

It is not a simple CRUD record. It is a domain entity with state transitions and business rules.

---

## 2. Fields (final schema)

- id
- code (unique)
- title
- type
- project_id (nullable)
- contractor_id (company)
- mandante_id (company)
- amount (numeric, >= 0)
- currency (PEN | USD | EUR)
- start_date
- end_date
- actual_end_date
- status
- description
- created_at
- updated_at

---

## 3. Enums

### type
- Work
- Service
- Supply
- Maintenance

### currency
- PEN
- USD
- EUR

### status
- Draft
- Active
- In Settlement
- Closed
- Terminated

---

## 4. Business rules

- contractor_id must not equal mandante_id
- amount must be >= 0
- start_date must be <= end_date (if both exist)
- project_id is optional
- contract can exist without project (standalone contract allowed)

---

## 5. Lifecycle rules (future enforcement)

Allowed transitions:

- Draft → Active
- Active → In Settlement
- Active → Closed
- Active → Terminated
- In Settlement → Closed

Terminal states:
- Closed
- Terminated

No transitions allowed out of terminal states.

---

## 6. Relationship rules

- Contract belongs optionally to a Project
- Contract belongs to two Companies:
  - contractor
  - mandante

- Documents may reference Contract (many-to-one optional)
- Correspondence may reference Contract (optional)

---

## 7. Data integrity principle

Database must enforce:
- basic constraints (CHECKs where possible)
Application must enforce:
- lifecycle transitions
- business validation not enforceable in SQL

---

## 8. Design principle

This model is the single source of truth for:
- database schema
- API validation
- frontend contract forms
- future Claims system
