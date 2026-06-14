# TASKS.md — Lista Priorizada de Tareas

Tareas ordenadas por prioridad para el desarrollo de Fase 1 (MVP).  
Cada tarea es atómica, estimable y asignable a un desarrollador.

---

## Prioridad CRÍTICA — Bloquean todo lo demás

### T-01 · Sistema de migraciones de base de datos
- Reemplazar `init.sql` monolítico por archivos de migración numerados (`001_init.sql`, `002_companies.sql`, etc.)
- Crear función `runMigrations()` que ejecute solo las migraciones pendientes
- **Depende de:** nada
- **Bloquea:** T-02, T-03, T-04, T-05, T-06

### T-02 · Crear tabla `companies`
- Campos: `id`, `ruc`, `razon_social`, `nombre_comercial`, `tipo`, `pais`, `email_contacto`, `telefono`, `estado`, `created_at`, `updated_at`
- Index único en `ruc`
- **Depende de:** T-01

### T-03 · Crear tabla `projects`
- Campos: `id`, `code`, `name`, `descripcion`, `tipo`, `ubicacion`, `fecha_inicio`, `fecha_fin`, `estado`, `company_id` (FK a companies), `created_at`, `updated_at`
- **Depende de:** T-01, T-02

### T-04 · Crear tabla `contracts`
- Campos: `id`, `code`, `titulo`, `tipo`, `project_id`, `contratista_id`, `mandante_id`, `monto_original`, `moneda`, `fecha_firma`, `fecha_inicio`, `fecha_fin`, `fecha_fin_real`, `estado`, `descripcion`, `created_at`, `updated_at`
- FKs a `projects` y dos FKs a `companies`
- **Depende de:** T-01, T-02, T-03

### T-05 · Crear tabla `correspondence`
- Campos: `id`, `code`, `asunto`, `tipo`, `direccion`, `project_id`, `contract_id`, `empresa_origen_id`, `empresa_destino_id`, `fecha_emision`, `fecha_recepcion`, `fecha_vencimiento`, `estado`, `referencia_code`, `descripcion`, `created_at`, `updated_at`
- **Depende de:** T-01, T-02, T-03, T-04

### T-06 · Extender tabla `documents`
- Agregar columnas: `tipo`, `project_id`, `contract_id`, `correspondence_id`, `descripcion`, `file_url`
- Migración sin romper datos existentes (columnas nullable)
- **Depende de:** T-01, T-03, T-04, T-05

---

## Prioridad ALTA — Backend API

### T-07 · CRUD REST para Empresas
- `GET /api/companies` con búsqueda por razón social y RUC
- `GET /api/companies/:id`
- `POST /api/companies`
- `PUT /api/companies/:id`
- `DELETE /api/companies/:id` (soft delete: cambiar estado a Inactiva)
- **Depende de:** T-02

### T-08 · CRUD REST para Proyectos
- `GET /api/projects` con filtro por estado y empresa
- `GET /api/projects/:id` con empresas y contratos asociados
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id` (solo si no tiene contratos activos)
- **Depende de:** T-03

### T-09 · CRUD REST para Contratos
- `GET /api/contracts` con filtro por proyecto, estado, empresa
- `GET /api/contracts/:id` con datos de proyecto y empresas
- `POST /api/contracts`
- `PUT /api/contracts/:id`
- `GET /api/projects/:id/contracts` — contratos de un proyecto
- **Depende de:** T-04

### T-10 · CRUD REST para Correspondencia
- `GET /api/correspondence` con filtro por proyecto, dirección, estado
- `GET /api/correspondence/:id`
- `POST /api/correspondence`
- `PUT /api/correspondence/:id`
- `GET /api/contracts/:id/correspondence` — correspondencia de un contrato
- **Depende de:** T-05

### T-11 · Actualizar rutas de Documentos
- Añadir filtros por `project_id`, `contract_id`, `tipo`
- Soporte para los nuevos campos de T-06
- **Depende de:** T-06

### T-12 · Autenticación JWT
- Tabla `users`: `id`, `email`, `password_hash`, `nombre`, `rol`, `org_id`, `created_at`
- Tabla `organizations`: `id`, `nombre`, `plan`, `created_at`
- `POST /api/auth/register` — registro de organización + usuario admin
- `POST /api/auth/login` — retorna JWT
- `POST /api/auth/refresh` — renueva token
- Middleware `requireAuth` para proteger todas las rutas `/api/*`
- **Depende de:** T-01

### T-13 · Middleware de roles
- Roles: `admin`, `gestor`, `visualizador`
- Middleware `requireRole(roles[])` aplicado por ruta
- Visualizadores solo pueden leer (GET)
- **Depende de:** T-12

---

## Prioridad ALTA — Frontend

### T-14 · Layout con navegación lateral
- Sidebar con links a: Empresas, Proyectos, Contratos, Correspondencia, Documentos
- Header con nombre de usuario y botón de logout
- Routing con React Router (`/empresas`, `/proyectos`, `/contratos`, `/correspondencia`, `/documentos`)
- **Depende de:** T-12 (para mostrar usuario)

### T-15 · Pantalla de Login
- Formulario email + contraseña
- Manejo de errores (credenciales inválidas)
- Guardar JWT en `localStorage` y redirigir al app
- Protección de rutas privadas (redirect a login si no autenticado)
- **Depende de:** T-12, T-14

### T-16 · Módulo Empresas — Frontend
- Listado con columnas: RUC, Razón Social, Tipo, Estado
- Búsqueda por razón social o RUC
- Formulario de creación y edición (modal o página)
- Confirmación de desactivación
- **Depende de:** T-07, T-14

### T-17 · Módulo Proyectos — Frontend
- Listado con columnas: Código, Nombre, Tipo, Estado, Empresa Mandante, Fechas
- Ficha de proyecto con tabs: Info General / Contratos / Documentos
- Formulario de creación y edición con selector de empresa
- **Depende de:** T-08, T-14, T-16

### T-18 · Módulo Contratos — Frontend
- Listado con columnas: Código, Título, Proyecto, Contratista, Monto, Estado, Fecha Fin
- Ficha de contrato con tabs: Info General / Correspondencia / Documentos
- Formulario con selección de proyecto, contratista y mandante
- Indicador visual de contratos próximos a vencer (< 30 días)
- **Depende de:** T-09, T-14, T-16, T-17

### T-19 · Módulo Correspondencia — Frontend
- Listado con indicador visual de dirección (entrante/saliente) y estado
- Filtros por: proyecto, contrato, dirección, estado
- Formulario con selector de proyecto, contrato y empresas
- Alerta visual para correspondencia vencida o próxima a vencer
- **Depende de:** T-10, T-14, T-16, T-17, T-18

### T-20 · Módulo Documentos — Frontend (actualización)
- Añadir selector de proyecto y contrato al formulario existente
- Añadir campo tipo de documento
- Filtro por proyecto, contrato y tipo en el listado
- **Depende de:** T-11, T-14, T-17, T-18

---

## Prioridad MEDIA — Calidad y UX

### T-21 · Paginación en todos los listados
- Backend: soporte para `?page=1&limit=20` en todas las rutas GET de colecciones
- Frontend: componente de paginación reutilizable
- **Depende de:** T-07 al T-11

### T-22 · Manejo de errores unificado en frontend
- Componente `Toast` para notificaciones de éxito y error
- Reemplazar `console.error` y `window.confirm` por UI consistente
- Manejo de errores 401 (redirigir a login) y 500 (mensaje genérico)
- **Depende de:** T-15

### T-23 · Archivo `.env.example`
- Documentar todas las variables necesarias: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`
- Instrucciones de configuración para desarrollo local
- **Depende de:** T-12

### T-24 · Validaciones en formularios frontend
- Campos obligatorios marcados visualmente
- Validación de formato de RUC, email, fechas
- Prevenir submit con datos inválidos antes de llamar a la API
- **Depende de:** T-16 al T-20

### T-25 · Filtros avanzados por fechas
- Filtro de rango de fechas en Contratos (por fecha de fin) y Correspondencia (por fecha de vencimiento)
- Componente de date-range picker reutilizable
- **Depende de:** T-18, T-19

---

## Prioridad BAJA — Mejoras post-MVP

### T-26 · Dashboard resumen por proyecto
- Cards: N° de contratos activos, correspondencia pendiente, documentos vigentes
- Acceso desde la ficha de proyecto
- **Depende de:** T-17, T-18, T-19, T-20

### T-27 · Exportación a Excel
- Exportar listado de contratos y correspondencia a `.xlsx`
- Librería `exceljs` en backend
- **Depende de:** T-09, T-10

### T-28 · Alertas de vencimiento por email
- Job diario que detecta contratos y correspondencia con vencimiento en los próximos 7 días
- Envío de email con listado al usuario responsable
- Servicio de email: Resend / SendGrid
- **Depende de:** T-12, T-18, T-19

---

## Orden de ejecución sugerido

```
T-01 → T-02 → T-03 → T-04 → T-05 → T-06
                                        ↓
T-12 → T-13 → T-15 → T-14
                        ↓
         T-07 → T-16
         T-08 → T-17
         T-09 → T-18
         T-10 → T-19
         T-11 → T-20
                  ↓
         T-21, T-22, T-23, T-24, T-25
                  ↓
         T-26, T-27, T-28
```

---

## Estado del backlog

| ID | Tarea | Prioridad | Estado |
|---|---|---|---|
| T-01 | Sistema de migraciones | Crítica | Pendiente |
| T-02 | Tabla companies | Crítica | Pendiente |
| T-03 | Tabla projects | Crítica | Pendiente |
| T-04 | Tabla contracts | Crítica | Pendiente |
| T-05 | Tabla correspondence | Crítica | Pendiente |
| T-06 | Extender documents | Crítica | Pendiente |
| T-07 | API Empresas | Alta | Pendiente |
| T-08 | API Proyectos | Alta | Pendiente |
| T-09 | API Contratos | Alta | Pendiente |
| T-10 | API Correspondencia | Alta | Pendiente |
| T-11 | API Documentos (update) | Alta | Pendiente |
| T-12 | Autenticación JWT | Alta | Pendiente |
| T-13 | Middleware roles | Alta | Pendiente |
| T-14 | Layout navegación | Alta | Pendiente |
| T-15 | Pantalla Login | Alta | Pendiente |
| T-16 | Frontend Empresas | Alta | Pendiente |
| T-17 | Frontend Proyectos | Alta | Pendiente |
| T-18 | Frontend Contratos | Alta | Pendiente |
| T-19 | Frontend Correspondencia | Alta | Pendiente |
| T-20 | Frontend Documentos (update) | Alta | Pendiente |
| T-21 | Paginación | Media | Pendiente |
| T-22 | Manejo de errores UI | Media | Pendiente |
| T-23 | `.env.example` | Media | Pendiente |
| T-24 | Validaciones frontend | Media | Pendiente |
| T-25 | Filtros por fecha | Media | Pendiente |
| T-26 | Dashboard por proyecto | Baja | Pendiente |
| T-27 | Exportación Excel | Baja | Pendiente |
| T-28 | Alertas por email | Baja | Pendiente |
