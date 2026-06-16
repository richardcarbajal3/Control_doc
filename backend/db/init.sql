CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  ruc VARCHAR(20) UNIQUE NOT NULL,
  razon_social VARCHAR(255) NOT NULL,
  nombre_comercial VARCHAR(255),
  tipo VARCHAR(50) NOT NULL DEFAULT 'Contratista',
  pais VARCHAR(100) DEFAULT 'Perú',
  email_contacto VARCHAR(255),
  telefono VARCHAR(50),
  estado VARCHAR(30) NOT NULL DEFAULT 'Activa',
  extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'Construcción',
  ubicacion VARCHAR(255),
  fecha_inicio DATE,
  fecha_fin DATE,
  estado VARCHAR(30) NOT NULL DEFAULT 'Planificación',
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- contracts table follows CONTRACT_MODEL_V1 (English schema).
-- NOTE: on an already-provisioned database this CREATE is a no-op (IF NOT
-- EXISTS); the live columns were aligned via backend/db/migrations.
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Work',
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  contractor_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  mandante_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  amount NUMERIC(18,2),
  currency VARCHAR(10) NOT NULL DEFAULT 'PEN',
  start_date DATE,
  end_date DATE,
  actual_end_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  description TEXT,
  extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Claims (Reclamaciones) — see docs/ROADMAP.md Fase 2.1 and docs/ARCHITECTURE.md.
-- A claim groups the correspondence/documents that support it.
CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Otro',
  n_contrato VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'Abierto',
  description TEXT,
  extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50),
  title VARCHAR(255),
  version VARCHAR(20) DEFAULT '1.0',
  status VARCHAR(60),
  status_g VARCHAR(60),
  n_contrato VARCHAR(120),
  empresa VARCHAR(255),
  contrato VARCHAR(255),
  descripcion_contrato TEXT,
  fecha DATE,
  transmittal VARCHAR(255),
  referencia VARCHAR(255),
  documento_nro VARCHAR(255),
  rev VARCHAR(30),
  descripcion TEXT,
  tipo_doc VARCHAR(60),
  status_contratista VARCHAR(60),
  responsable VARCHAR(120),
  claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
  parent_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Self-healing additive columns. These run on every boot and are no-ops once
-- applied, so an already-provisioned database (e.g. production on Neon) gains
-- the extra_data column on the next deploy WITHOUT a manual migration. Safe:
-- additive only, never drops or rewrites data.
ALTER TABLE companies  ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE projects   ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE contracts  ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE documents  ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Documents register columns (Control Doc transmittal layout). Additive and
-- idempotent so existing databases gain them on the next deploy. Legacy
-- code/title/status lose their NOT NULL so paste-loaded rows are not blocked.
ALTER TABLE documents ALTER COLUMN code   DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN title  DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN status DROP NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status_g VARCHAR(60);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS n_contrato VARCHAR(120);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS empresa VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS contrato VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS descripcion_contrato TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS fecha DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS transmittal VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS referencia VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS documento_nro VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS rev VARCHAR(30);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tipo_doc VARCHAR(60);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status_contratista VARCHAR(60);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS responsable VARCHAR(120);

-- Claims and the links from documents: claim_id groups documents into a claim
-- (claim_documents); parent_id links a letter to the document it answers (thread).
ALTER TABLE claims    ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE claims    ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'Otro';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES documents(id) ON DELETE SET NULL;

-- =========================================================================
-- Authentication & access control (see docs T-12/T-13/T-15)
-- Users sign in with an email + password. The app owner (superadmin) sells
-- subscriptions: each client is an organization, and the superadmin assigns a
-- user as that organization's admin. The org admin then authorizes other
-- emails into the organization (regardless of their domain).
-- =========================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  plan VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  password_hash VARCHAR(255),
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Per-contract role assignment (loaded by an admin, often via Excel paste).
CREATE TABLE IF NOT EXISTS contract_members (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(40) NOT NULL DEFAULT 'lector',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (contract_id, user_id)
);

-- Corporate domains allowed to register/login (e.g. shouxin.com.pe).
CREATE TABLE IF NOT EXISTS allowed_domains (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL UNIQUE,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Self-healing (idempotent) for existing databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;

-- =========================================================================
-- Multi-tenant data isolation (Fase 3): every data table is scoped to an
-- organization. Added via self-healing ALTERs (organizations already exists
-- above). ON DELETE CASCADE so removing a client removes its data.
-- =========================================================================
ALTER TABLE companies  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE projects   ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE contracts  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE claims     ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE documents  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- Uniqueness becomes per-tenant: two organizations may reuse the same RUC or
-- contract/project code. NULL organization_id (legacy/owner data) stays distinct.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_ruc_key;
ALTER TABLE projects  DROP CONSTRAINT IF EXISTS projects_code_key;
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_code_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_org_ruc_key') THEN
    ALTER TABLE companies ADD CONSTRAINT companies_org_ruc_key UNIQUE (organization_id, ruc);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_org_code_key') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_org_code_key UNIQUE (organization_id, code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_org_code_key') THEN
    ALTER TABLE contracts ADD CONSTRAINT contracts_org_code_key UNIQUE (organization_id, code);
  END IF;
END $$;
