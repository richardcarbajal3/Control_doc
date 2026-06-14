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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(50)    UNIQUE NOT NULL,
  title          VARCHAR(255)   NOT NULL,
  type           VARCHAR(50)    NOT NULL DEFAULT 'Obra',
  project_id     INTEGER        REFERENCES projects(id)  ON DELETE SET NULL,
  contratista_id INTEGER        REFERENCES companies(id) ON DELETE SET NULL,
  mandante_id    INTEGER        REFERENCES companies(id) ON DELETE SET NULL,
  amount         NUMERIC(18,2),
  currency       VARCHAR(10)    NOT NULL DEFAULT 'PEN',
  start_date     DATE,
  end_date       DATE,
  status         VARCHAR(30)    NOT NULL DEFAULT 'Draft',
  description    TEXT,
  created_at     TIMESTAMP      DEFAULT NOW(),
  updated_at     TIMESTAMP      DEFAULT NOW()
);

-- Migración: renombrar columnas si la tabla fue creada con el esquema anterior (en español)
DO $$
BEGIN
  -- titulo → title
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='titulo') THEN
    ALTER TABLE contracts RENAME COLUMN titulo TO title;
  END IF;
  -- tipo → type
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='tipo') THEN
    ALTER TABLE contracts RENAME COLUMN tipo TO type;
  END IF;
  -- monto_original → amount
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='monto_original') THEN
    ALTER TABLE contracts RENAME COLUMN monto_original TO amount;
  END IF;
  -- moneda → currency
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='moneda') THEN
    ALTER TABLE contracts RENAME COLUMN moneda TO currency;
  END IF;
  -- fecha_inicio → start_date
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='fecha_inicio') THEN
    ALTER TABLE contracts RENAME COLUMN fecha_inicio TO start_date;
  END IF;
  -- fecha_fin → end_date
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='fecha_fin') THEN
    ALTER TABLE contracts RENAME COLUMN fecha_fin TO end_date;
  END IF;
  -- descripcion → description
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='descripcion') THEN
    ALTER TABLE contracts RENAME COLUMN descripcion TO description;
  END IF;
  -- Migrar valores de estado de español a inglés
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='status') THEN
    UPDATE contracts SET status = 'Draft'         WHERE status = 'Borrador';
    UPDATE contracts SET status = 'Active'        WHERE status = 'Vigente';
    UPDATE contracts SET status = 'In Settlement' WHERE status = 'En Liquidación';
    UPDATE contracts SET status = 'Closed'        WHERE status = 'Cerrado';
    UPDATE contracts SET status = 'Terminated'    WHERE status = 'Rescindido';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'Documento',
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  status VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  correspondence_id INTEGER REFERENCES correspondence(id) ON DELETE SET NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Extensión de documentos existentes: agregar columnas si la tabla ya fue creada sin ellas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='tipo') THEN
    ALTER TABLE documents ADD COLUMN tipo VARCHAR(50) NOT NULL DEFAULT 'Documento';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='project_id') THEN
    ALTER TABLE documents ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='contract_id') THEN
    ALTER TABLE documents ADD COLUMN contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='correspondence_id') THEN
    ALTER TABLE documents ADD COLUMN correspondence_id INTEGER REFERENCES correspondence(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='descripcion') THEN
    ALTER TABLE documents ADD COLUMN descripcion TEXT;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS correspondence (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  correspondence_type VARCHAR(50) NOT NULL DEFAULT 'Carta',
  direction VARCHAR(20) NOT NULL DEFAULT 'Saliente',
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  sender_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  receiver_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  issue_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
