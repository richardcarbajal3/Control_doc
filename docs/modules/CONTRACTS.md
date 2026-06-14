# Módulo: Contratos (Contracts)

## Objetivo

Gestionar el ciclo de vida completo de los contratos suscritos entre empresas dentro de un proyecto. Cubre desde el registro inicial hasta el cierre o rescisión, incluyendo control de montos, plazos, partes y condiciones contractuales. Es el eje central del sistema: Correspondencia, Documentos y Claims (Fase 2) se articulan alrededor de este módulo.

---

## Entidad principal: `contracts`

### Campos obligatorios

Estos campos deben estar presentes para poder crear un contrato. Sin ellos el registro no se guarda.

| Campo | Tipo | Descripción |
|---|---|---|
| `code` | VARCHAR(50) UNIQUE | Código / número oficial del contrato (ej: `CON-2024-001`) |
| `titulo` | VARCHAR(255) | Descripción corta del objeto del contrato |
| `tipo` | VARCHAR(50) | Tipo de contrato (ver catálogo abajo) |
| `project_id` | INTEGER FK | Proyecto al que pertenece |
| `contratista_id` | INTEGER FK | Empresa que ejecuta (contratista) |
| `mandante_id` | INTEGER FK | Empresa que encarga (mandante/owner) |
| `monto_original` | NUMERIC(18,2) | Monto contractual pactado en la firma |
| `moneda` | VARCHAR(10) | Moneda del contrato (`PEN`, `USD`, `EUR`) |
| `fecha_firma` | DATE | Fecha de suscripción del contrato |
| `fecha_inicio` | DATE | Fecha de inicio de actividades |
| `fecha_fin` | DATE | Fecha de término contractual pactada |
| `estado` | VARCHAR(30) | Estado actual del contrato (ver catálogo abajo) |

### Campos opcionales

| Campo | Tipo | Descripción |
|---|---|---|
| `descripcion` | TEXT | Alcance detallado del contrato |
| `fecha_fin_real` | DATE | Fecha de término real (puede diferir si hubo ampliaciones) |
| `monto_actualizado` | NUMERIC(18,2) | Monto vigente tras adicionales o deducciones aprobadas |
| `plazo_dias` | INTEGER | Duración en días calendario (calculable desde fechas) |
| `supervisor_id` | INTEGER FK | Usuario responsable de seguimiento interno |
| `numero_licitacion` | VARCHAR(100) | Número de licitación o proceso de selección de origen |
| `garantia_fiel` | BOOLEAN | Si el contrato exige boleta/carta de garantía de fiel cumplimiento |
| `garantia_anticipo` | BOOLEAN | Si exige garantía de anticipo |
| `porcentaje_anticipo` | NUMERIC(5,2) | Porcentaje del monto otorgado como anticipo |
| `retencion_garantia` | NUMERIC(5,2) | % retenido como garantía de correcta ejecución |
| `notas` | TEXT | Observaciones internas (no visibles en reportes formales) |
| `created_at` | TIMESTAMP | Fecha de registro en el sistema |
| `updated_at` | TIMESTAMP | Última modificación |

---

## Tipos de contrato

Catálogo cerrado. Define la naturaleza del objeto contratado.

| Tipo | Descripción |
|---|---|
| `Obra` | Construcción, montaje o mejoramiento de infraestructura física |
| `Suministro` | Provisión de materiales, equipos o insumos |
| `Servicios` | Prestación de servicios operativos (transporte, vigilancia, limpieza, etc.) |
| `Consultoría` | Servicios profesionales de asesoría, diseño o supervisión técnica |
| `EPC` | Engineering, Procurement & Construction (contrato llave en mano) |
| `Mixto` | Combinación de dos o más tipos anteriores en un único contrato |
| `Marco` | Contrato marco o abierto que da origen a órdenes de compra o contratos específicos |

---

## Estados del contrato

El contrato transita por estados en un flujo definido. No todos los saltos son válidos (ver validaciones).

```
Borrador → Vigente → En Ejecución → En Liquidación → Cerrado
                  ↘                                ↗
                   Suspendido → (puede reactivarse)
                  ↘
                   Rescindido  (terminal)
```

| Estado | Descripción |
|---|---|
| `Borrador` | Registro en preparación; no tiene efecto contractual aún |
| `Vigente` | Firmado y activo, aún no iniciadas las actividades |
| `En Ejecución` | Actividades en curso dentro del plazo contractual |
| `Suspendido` | Ejecución temporalmente detenida (con causa justificada) |
| `En Liquidación` | Actividades terminadas; en proceso de liquidación económica |
| `Cerrado` | Liquidación aprobada y contrato formalmente terminado |
| `Rescindido` | Contrato terminado anticipadamente por incumplimiento o acuerdo |

### Transiciones válidas

| Desde | Puede pasar a |
|---|---|
| `Borrador` | `Vigente` |
| `Vigente` | `En Ejecución`, `Rescindido` |
| `En Ejecución` | `Suspendido`, `En Liquidación`, `Rescindido` |
| `Suspendido` | `En Ejecución`, `Rescindido` |
| `En Liquidación` | `Cerrado`, `Rescindido` |
| `Cerrado` | *(ninguno — estado terminal)* |
| `Rescindido` | *(ninguno — estado terminal)* |

---

## Relaciones con Companies y Projects

### Con Projects

- Un contrato **pertenece a exactamente un proyecto** (`project_id` obligatorio).
- Un proyecto puede tener **múltiples contratos** (subcontratos, contratos por especialidad, etc.).
- Al eliminar un proyecto, no se permite si tiene contratos en estado `Vigente`, `En Ejecución` o `En Liquidación`.
- Un contrato hereda la `moneda` y el contexto geográfico del proyecto (referencia, no restricción).

### Con Companies (doble relación)

- `contratista_id` → empresa que ejecuta. Obligatorio. Tipo esperado: `Contratista` o `Subcontratista`.
- `mandante_id` → empresa que encarga. Obligatorio. Tipo esperado: `Mandante` o `Consultora`.
- Ambos campos apuntan a la misma tabla `companies` con FKs distintas.
- `contratista_id` ≠ `mandante_id` (validación: una empresa no puede ser ambas partes en el mismo contrato).
- Una empresa puede ser contratista en unos contratos y mandante en otros (dentro de proyectos distintos).

### Con Correspondencia

- Una carta o solicitud puede estar vinculada a un contrato específico (`contract_id` en `correspondence`).
- La correspondencia sin `contract_id` aplica al proyecto general.
- Las cartas de reclamo, aprobación de adicionales y ampliaciones de plazo deben referenciar el contrato.

### Con Documentos

- Documentos tipo `Contrato`, `Adenda`, `Garantía`, `Orden de Cambio` se vinculan a un contrato vía `contract_id`.
- Un contrato puede tener múltiples documentos adjuntos (el contrato original + sus adendas).

---

## Validaciones de negocio

### Al crear

1. `code` único en toda la tabla `contracts`.
2. `contratista_id` ≠ `mandante_id`.
3. `fecha_inicio` ≥ `fecha_firma`.
4. `fecha_fin` > `fecha_inicio`.
5. `monto_original` > 0.
6. `project_id` debe corresponder a un proyecto en estado `En Ejecución` o `Planificación` (no `Cerrado` ni `Suspendido`).
7. `contratista_id` y `mandante_id` deben ser empresas con estado `Activa`.

### Al actualizar estado

8. Solo se permiten las transiciones del flujo definido (ver tabla de transiciones).
9. No se puede editar un contrato en estado `Cerrado` o `Rescindido`.
10. Para pasar a `En Liquidación`, `fecha_fin_real` debe estar registrada o ser obligatoriamente ingresada.

### Al actualizar monto

11. `monto_actualizado` no puede ser negativo.
12. Si `monto_actualizado` difiere de `monto_original` en más de 30%, emitir advertencia (no bloqueo) — indica probable adicional de obra no registrado.

### Al eliminar

13. No se puede eliminar un contrato en estado distinto a `Borrador`.
14. Un contrato con correspondencia o documentos asociados no puede eliminarse; solo rescindirse.

---

## Campos críticos para futuros Claims (Fase 2)

Estos campos en `contracts` son la base de datos que los Claims necesitarán para calcular impactos y validar reclamaciones. Deben registrarse con precisión desde Fase 1.

| Campo | Por qué es crítico para Claims |
|---|---|
| `monto_original` | Base para calcular el monto de adicionales o deducciones reclamadas |
| `monto_actualizado` | Monto vigente al momento del claim (considera adendas ya aprobadas) |
| `fecha_inicio` | Punto de referencia para calcular días de atraso o ampliación |
| `fecha_fin` | Fecha contractual de término; el claim de ampliación de plazo se mide contra este campo |
| `fecha_fin_real` | Registra el término efectivo; diferencia con `fecha_fin` determina días de retraso |
| `plazo_dias` | Duración contractual base para calcular % de avance y días reclamables |
| `tipo` | El tipo de contrato determina qué tipos de claims son aplicables (ej: ampliación de plazo no aplica a Suministro puro) |
| `estado` | Un claim solo puede presentarse contra un contrato `En Ejecución`, `Suspendido` o `En Liquidación` |
| `retencion_garantia` | Determina el monto retenido que puede estar en disputa en claims de liquidación |
| `moneda` | Los claims deben expresarse en la misma moneda del contrato base |
| `contratista_id` | Identifica quién presenta el claim (siempre el contratista contra el mandante) |
| `mandante_id` | Identifica quién recibe y evalúa el claim |
| `project_id` | Los claims se agrupan por proyecto para análisis de riesgo agregado |

### Campos adicionales recomendados para preparar Fase 2

Estos campos no son obligatorios en MVP pero conviene registrarlos desde el inicio para no requerir migración cuando se active Claims:

| Campo | Tipo | Descripción |
|---|---|---|
| `permite_adicionales` | BOOLEAN | Si el contrato admite adicionales de obra formalmente |
| `limite_adicionales_pct` | NUMERIC(5,2) | % máximo del monto original permitido como adicionales (ej: 15%) |
| `permite_ampliacion_plazo` | BOOLEAN | Si admite ampliaciones de plazo |
| `tiene_penalidad_mora` | BOOLEAN | Si hay penalidad por retraso en entrega |
| `penalidad_diaria_pct` | NUMERIC(5,2) | % del monto por día de retraso (para claims de penalidad inversa) |

---

## Índices recomendados en BD

```
contracts(project_id)          -- filtrado por proyecto
contracts(contratista_id)      -- filtrado por empresa
contracts(mandante_id)         -- filtrado por empresa
contracts(estado)              -- filtrado por estado
contracts(fecha_fin)           -- alertas de vencimiento
contracts(code)                -- búsqueda por código (ya cubre UNIQUE)
```
