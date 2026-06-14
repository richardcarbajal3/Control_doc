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
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'Obra',
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  contratista_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  mandante_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  monto_original NUMERIC(18,2),
  moneda VARCHAR(10) NOT NULL DEFAULT 'PEN',
  fecha_firma DATE,
  fecha_inicio DATE,
  fecha_fin DATE,
  fecha_fin_real DATE,
  estado VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  status VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
