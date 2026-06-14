# ROADMAP.md — Control Doc SaaS

## Visión del Producto

SaaS de gestión contractual y documental para empresas del sector minería y construcción en Latinoamérica. Permite administrar contratos, correspondencia y documentación técnica vinculada a proyectos, con trazabilidad completa y acceso multi-empresa.

---

## Fase 0 — Base Operativa *(actual)*

**Estado:** En producción parcial  
**Objetivo:** Tener la infraestructura funcional con el módulo más simple (Documentos)

| Ítem | Estado |
|---|---|
| Stack Node.js + Express + React + Vite | ✅ Completado |
| Deploy en Railway + BD Neon (PostgreSQL) | ✅ Completado |
| CRUD de Documentos (código, título, versión, estado) | ✅ Completado |
| Búsqueda básica por código y título | ✅ Completado |
| Configuración `.env` y variables de entorno | ⚠️ Pendiente en local |

**Limitaciones conocidas:**
- Sin autenticación (acceso abierto)
- Documentos sin relación a proyectos ni contratos
- Sin paginación
- Sin adjunto de archivos

---

## Fase 1 — MVP Contractual *(próxima)*

**Duración estimada:** 6–8 semanas  
**Objetivo:** Sistema funcional con los 5 módulos core, relaciones entre entidades y autenticación básica

### 1.1 — Modelo de Datos y Backend (Semanas 1–3)

- [ ] Migración del esquema: tablas `companies`, `projects`, `contracts`, `correspondence`
- [ ] Extensión de `documents` con FKs a proyecto, contrato y correspondencia
- [ ] Rutas REST para cada módulo (CRUD completo)
- [ ] Validaciones de negocio en backend (fechas, estados, campos obligatorios)
- [ ] Sistema de migraciones ordenado (reemplazar `init.sql` monolítico)

### 1.2 — Autenticación y Multitenancy (Semana 3–4)

- [ ] Autenticación con JWT (login / logout / token refresh)
- [ ] Tabla `users` con roles: Admin / Gestor / Visualizador
- [ ] Middleware de autenticación en todas las rutas API
- [ ] Asociación de usuarios a una organización (tenant)
- [ ] Registro de organización (onboarding básico)

### 1.3 — Frontend por Módulo (Semanas 3–6)

- [ ] Navegación lateral con acceso a los 5 módulos
- [ ] Módulo Empresas: listado, creación, edición, detalle
- [ ] Módulo Proyectos: listado con estado, ficha de proyecto
- [ ] Módulo Contratos: listado con monto y plazo, ficha de contrato
- [ ] Módulo Correspondencia: listado con dirección (entrante/saliente) y estado
- [ ] Módulo Documentos: vinculación a proyecto/contrato, filtros por tipo
- [ ] Relaciones cruzadas en UI: ver documentos de un contrato, contratos de un proyecto

### 1.4 — Calidad y Producción (Semanas 6–8)

- [ ] Paginación en todos los listados
- [ ] Filtros avanzados por estado, fecha, empresa
- [ ] Manejo de errores unificado en frontend (toasts / mensajes)
- [ ] Variables de entorno documentadas en `.env.example`
- [ ] Health check y logs básicos

**Entregable Fase 1:** Sistema usable por un equipo real en un proyecto activo

---

## Fase 2 — Funcionalidades Avanzadas

**Duración estimada:** 8–10 semanas  
**Objetivo:** Completar la propuesta de valor diferencial del sector

### 2.1 — Módulo Claims (Reclamaciones)

- [ ] Diseño de entidades: `claims`, `claim_events`, `claim_documents`
- [ ] Tipos de claim: Ampliación de Plazo / Adicional de Obra / Disputa / Reserva
- [ ] Flujo de estados: Borrador → Presentado → En Evaluación → Aceptado / Rechazado
- [ ] Vinculación a contrato y correspondencia de soporte
- [ ] Cálculo de impacto en monto y plazo contractual
- [ ] Historial de eventos y trazabilidad completa

### 2.2 — Almacenamiento de Archivos

- [ ] Integración con S3 / Cloudflare R2 para adjuntos
- [ ] Carga de archivos desde correspondencia, documentos y claims
- [ ] Visor de PDF embebido
- [ ] Control de versiones de documentos (historial de revisiones)

### 2.3 — Dashboard y Reportes

- [ ] Dashboard por proyecto: contratos activos, correspondencia pendiente, claims abiertos
- [ ] Alertas de vencimiento de contratos y correspondencia
- [ ] Exportación a Excel / PDF por módulo
- [ ] KPIs: monto comprometido, días restantes, tasa de respuesta de correspondencia

### 2.4 — Notificaciones

- [ ] Notificaciones en app (vencimientos, asignaciones)
- [ ] Notificaciones por email (resumen diario, alertas críticas)

---

## Fase 3 — SaaS Multiempresa y Escala

**Duración estimada:** 8–12 semanas  
**Objetivo:** Producto listo para comercialización con múltiples clientes independientes

### 3.1 — Multitenancy Real

- [ ] Aislamiento de datos por organización (tenant)
- [ ] Plan de suscripción: usuarios, proyectos y almacenamiento por tier
- [ ] Invitación de usuarios por email con roles personalizables

### 3.2 — Integraciones

- [ ] API pública documentada (Swagger / OpenAPI)
- [ ] Webhooks para eventos críticos (contrato vencido, claim presentado)
- [ ] Integración con sistemas ERP / contabilidad (via API)

### 3.3 — Auditoría y Seguridad

- [ ] Log de auditoría por acción de usuario (quién, qué, cuándo)
- [ ] 2FA opcional para usuarios
- [ ] Backups automáticos y política de retención de datos

---

## Resumen de Fases

| Fase | Foco | Duración estimada |
|---|---|---|
| Fase 0 | Base operativa | Completada |
| Fase 1 | MVP 5 módulos + auth | 6–8 semanas |
| Fase 2 | Claims + archivos + reportes | 8–10 semanas |
| Fase 3 | SaaS multiempresa + escala | 8–12 semanas |
