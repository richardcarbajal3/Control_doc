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

-- Many-to-many entre claims y documentos. Un mismo documento (p. ej. una carta
-- que notifica un procedimiento) puede dar SOPORTE o servir de REFERENCIA a
-- VARIOS claims, y un claim agrupa varios documentos (cartas, reportes, planos,
-- enviados y recibidos). Esta tabla es la fuente de verdad de la pertenencia;
-- el enlace legado documents.claim_id (1 claim por doc) se conserva solo por
-- compatibilidad y se vuelca aquí en el backfill de abajo.
CREATE TABLE IF NOT EXISTS claim_documents (
  claim_id    INTEGER NOT NULL REFERENCES claims(id)    ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relacion    VARCHAR(20) NOT NULL DEFAULT 'soporte', -- 'soporte' | 'referencia'
  created_at  TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (claim_id, document_id)
);

-- Backfill idempotente desde el enlace legado documents.claim_id. Se ejecuta en
-- cada arranque pero ON CONFLICT lo hace inocuo una vez aplicado.
INSERT INTO claim_documents (claim_id, document_id)
SELECT claim_id, id FROM documents WHERE claim_id IS NOT NULL
ON CONFLICT (claim_id, document_id) DO NOTHING;
