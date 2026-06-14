# ARCHITECTURE.md — Control Doc SaaS

## Visión General

**Control Doc** es un SaaS de gestión contractual y documental orientado a empresas del sector minería y construcción. Permite administrar el ciclo de vida completo de contratos, correspondencia y documentos técnicos vinculados a proyectos y empresas contratistas.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL (Neon) |
| Deploy | Railway |
| ORM / Query | `pg` (queries SQL directas) |

---

## Estructura del Proyecto

```
control_doc/
├── backend/
│   ├── db/
│   │   ├── index.js          # Pool de conexión PostgreSQL
│   │   └── init.sql          # DDL inicial (esquema)
│   ├── routes/               # Rutas REST por módulo
│   └── server.js             # Entry point Express
├── frontend/
│   └── src/
│       ├── api/              # Clientes fetch por módulo
│       ├── components/       # Componentes React
│       └── App.jsx
├── railway.toml
└── package.json              # Scripts raíz (build, dev, start)
```

---

## Módulos MVP — Fase 1

### 1. Empresas

**Objetivo:** Registrar y gestionar las empresas involucradas en los proyectos (contratistas, subcontratistas, mandantes, consultoras).

**Entidad principal:** `companies`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | Identificador interno |
| `ruc` | VARCHAR(20) UNIQUE | RUC / identificador tributario |
| `razon_social` | VARCHAR(255) | Razón social legal |
| `nombre_comercial` | VARCHAR(255) | Nombre comercial |
| `tipo` | VARCHAR(50) | Contratista / Subcontratista / Mandante / Consultora |
| `pais` | VARCHAR(100) | País de origen |
| `email_contacto` | VARCHAR(255) | Email principal de contacto |
| `telefono` | VARCHAR(50) | Teléfono de contacto |
| `estado` | VARCHAR(30) | Activa / Inactiva |
| `created_at` | TIMESTAMP | Fecha de registro |
| `updated_at` | TIMESTAMP | Última modificación |

**Relaciones:**
- Una empresa puede participar en múltiples proyectos (como mandante o contratista)
- Una empresa puede ser parte de múltiples contratos

---

### 2. Proyectos

**Objetivo:** Centralizar la información de cada proyecto de minería o construcción, agrupando contratos y documentos bajo una unidad operativa.

**Entidad principal:** `projects`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | Identificador interno |
| `code` | VARCHAR(50) UNIQUE | Código único del proyecto |
| `name` | VARCHAR(255) | Nombre del proyecto |
| `descripcion` | TEXT | Descripción general |
| `tipo` | VARCHAR(50) | Minería / Construcción / EPC / Mixto |
| `ubicacion` | VARCHAR(255) | Región / Zona geográfica |
| `fecha_inicio` | DATE | Fecha de inicio planificada |
| `fecha_fin` | DATE | Fecha de cierre planificada |
| `estado` | VARCHAR(30) | Planificación / En Ejecución / Cerrado / Suspendido |
| `company_id` | INTEGER FK | Empresa mandante (owner) |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Relaciones:**
- Pertenece a una empresa mandante (`company_id`)
- Tiene múltiples contratos asociados
- Tiene múltiples documentos asociados
- Tiene múltiples registros de correspondencia

---

### 3. Contratos

**Objetivo:** Gestionar el ciclo de vida contractual: registro, monitoreo de montos, estados, plazos y partes involucradas. Es el eje central del sistema: Correspondencia, Documentos y Claims se articulan alrededor de este módulo.

> Diseño detallado en [`docs/modules/CONTRACTS.md`](./modules/CONTRACTS.md)

**Entidad principal:** `contracts`

**Campos obligatorios**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | Identificador interno |
| `code` | VARCHAR(50) UNIQUE | Código / número oficial del contrato |
| `titulo` | VARCHAR(255) | Descripción corta del objeto del contrato |
| `tipo` | VARCHAR(50) | Ver catálogo de tipos abajo |
| `project_id` | INTEGER FK | Proyecto al que pertenece |
| `contratista_id` | INTEGER FK | Empresa que ejecuta |
| `mandante_id` | INTEGER FK | Empresa que encarga |
| `monto_original` | NUMERIC(18,2) | Monto contractual pactado en la firma |
| `moneda` | VARCHAR(10) | `PEN` / `USD` / `EUR` |
| `fecha_firma` | DATE | Fecha de suscripción |
| `fecha_inicio` | DATE | Fecha de inicio de actividades |
| `fecha_fin` | DATE | Fecha de término contractual pactada |
| `estado` | VARCHAR(30) | Ver catálogo de estados abajo |

**Campos opcionales destacados**

| Campo | Tipo | Descripción |
|---|---|---|
| `monto_actualizado` | NUMERIC(18,2) | Monto vigente tras adicionales o deducciones |
| `fecha_fin_real` | DATE | Término real (puede diferir por ampliaciones) |
| `plazo_dias` | INTEGER | Duración en días calendario |
| `retencion_garantia` | NUMERIC(5,2) | % retenido como garantía de correcta ejecución |
| `permite_adicionales` | BOOLEAN | Si el contrato admite adicionales de obra |
| `limite_adicionales_pct` | NUMERIC(5,2) | % máximo permitido como adicionales |
| `tiene_penalidad_mora` | BOOLEAN | Si hay penalidad por retraso |
| `penalidad_diaria_pct` | NUMERIC(5,2) | % del monto por día de retraso |
| `descripcion` | TEXT | Alcance detallado |

**Tipos de contrato:** `Obra` / `Suministro` / `Servicios` / `Consultoría` / `EPC` / `Mixto` / `Marco`

**Estados y flujo:**
```
Borrador → Vigente → En Ejecución → En Liquidación → Cerrado
                   ↘                               ↗
                    Suspendido → (reactivable)
                   ↘
                    Rescindido (terminal)
```

**Relaciones:**
- Pertenece a exactamente un proyecto (`project_id`)
- Vincula dos empresas distintas: `contratista_id` y `mandante_id` (no pueden ser la misma)
- Puede tener múltiples documentos adjuntos (`contract_id` en `documents`)
- Puede tener múltiples registros de correspondencia (`contract_id` en `correspondence`)
- Claims (Fase 2) se vincularán a este módulo; los campos de monto, plazo y penalidad son su base de cálculo

---

### 4. Correspondencia

**Objetivo:** Registrar y rastrear toda la comunicación formal entre las partes: cartas, notas, solicitudes, respuestas, dentro de un proyecto o contrato.

**Entidad principal:** `correspondence`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | Identificador interno |
| `code` | VARCHAR(50) UNIQUE | Número / código de la comunicación |
| `asunto` | VARCHAR(255) | Asunto de la comunicación |
| `tipo` | VARCHAR(50) | Carta / Nota Interna / Solicitud / Respuesta / Informe |
| `direccion` | VARCHAR(20) | Entrante / Saliente |
| `project_id` | INTEGER FK | Proyecto relacionado |
| `contract_id` | INTEGER FK (nullable) | Contrato relacionado (opcional) |
| `empresa_origen_id` | INTEGER FK | Empresa remitente |
| `empresa_destino_id` | INTEGER FK | Empresa destinataria |
| `fecha_emision` | DATE | Fecha de emisión del documento |
| `fecha_recepcion` | DATE | Fecha de recepción (si es entrante) |
| `fecha_vencimiento` | DATE | Fecha límite de respuesta (si aplica) |
| `estado` | VARCHAR(30) | Pendiente / Respondida / Archivada / Vencida |
| `referencia_code` | VARCHAR(50) | Código de correspondencia a la que responde |
| `descripcion` | TEXT | Resumen o cuerpo de la comunicación |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Relaciones:**
- Pertenece a un proyecto
- Puede estar vinculada a un contrato específico
- Puede estar relacionada con otro registro de correspondencia (hilo de respuestas)
- Puede tener documentos adjuntos

---

### 5. Documentos

**Objetivo:** Gestionar el repositorio de documentos técnicos, legales y administrativos vinculados a proyectos y contratos, con control de versiones y estado.

**Entidad principal:** `documents` *(ya existe, se extiende)*

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | Identificador interno |
| `code` | VARCHAR(50) UNIQUE | Código del documento |
| `title` | VARCHAR(255) | Título del documento |
| `tipo` | VARCHAR(50) | Plano / Especificación / Contrato / Carta / Informe / Certificado |
| `version` | VARCHAR(20) | Versión actual (ej: 1.0, Rev.B) |
| `status` | VARCHAR(30) | Borrador / En Revisión / Vigente / Obsoleto |
| `project_id` | INTEGER FK (nullable) | Proyecto al que pertenece |
| `contract_id` | INTEGER FK (nullable) | Contrato al que pertenece |
| `correspondence_id` | INTEGER FK (nullable) | Correspondencia adjunta |
| `descripcion` | TEXT | Descripción del contenido |
| `file_url` | VARCHAR(500) | URL del archivo almacenado (Fase 2) |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Relaciones:**
- Puede estar vinculado a un proyecto, contrato o correspondencia
- Es el módulo base actual del sistema (ya operativo)

---

## Módulos Fase 2 (fuera de MVP)

### Claims (Reclamaciones)

**Objetivo:** Registrar y gestionar reclamaciones contractuales formales (ampliaciones de plazo, adicionales de obra, disputas) vinculadas a contratos vigentes.

**Nota:** Depende de que el módulo Contratos esté maduro y en producción. Se diseñará en detalle al inicio de Fase 2.

**Entidades previstas:** `claims`, `claim_events`, `claim_documents`

---

## Modelo de Relaciones (resumen)

```
companies ──┬── projects ──┬── contracts ──── correspondence
            │              │                       │
            │              └── documents ◄─────────┘
            │
            ├── contracts (como contratista)
            └── contracts (como mandante)
```

---

## Decisiones de Diseño

| Decisión | Justificación |
|---|---|
| Queries SQL directas (`pg`) | Control total sobre el esquema, sin overhead de ORM para un esquema relacional estable |
| Un único servidor Express | Simplicidad de deploy en Railway; suficiente para MVP |
| `init.sql` ejecutado al arranque | Facilita migraciones simples sin herramienta externa en Fase 1 |
| Frontend en React + Vite | Build rápido, compatible con Railway static serving desde Express |
| Variables de entorno vía `.env` | Separa configuración de código; `DATABASE_URL` apunta a Neon |
| Sin autenticación en MVP inicial | Se añade en Fase 1 tardía (ver Roadmap); prioridad es el modelo de datos |
