# CLAIMS_DESIGN.md — Diseño del Módulo Claims

> Revisión de arquitectura preparatoria. No implica implementación inmediata.
> Fecha: 2026-06-14

---

## 1. Visión del Módulo

Un **claim** (reclamación contractual) es una notificación formal mediante la cual una parte del contrato (típicamente el contratista) comunica a la otra parte (mandante) su intención de reclamar compensación económica, extensión de plazo, o ambas, debido a causas que considera ajenas a su responsabilidad.

En minería y construcción, los claims son el mecanismo contractual estándar para gestionar:

- **Adicionales de obra** — trabajos no contemplados en el contrato original.
- **Ampliaciones de plazo** — extensiones justificadas por eventos externos.
- **Disputas de pago** — pagos rechazados o retenidos por el mandante.
- **Interferencias** — daños causados por terceros o por el propio mandante.
- **Fuerza mayor** — eventos climáticos, actos de gobierno, pandemias.

El claim **no es una factura ni un litigio**. Es una notificación que inicia un proceso de evaluación y negociación, regulado por el contrato y/o las normas locales (FIDIC, NEC, contratos de concesión, etc.).

---

## 2. Estado Actual de los Módulos Base

### Lo que ya existe y es sólido

| Módulo | Estado | Relevancia para Claims |
|---|---|---|
| `companies` | ✅ CRUD completo | Identifica las partes del claim (contratista, mandante) |
| `projects` | ✅ CRUD completo | Contexto del proyecto donde ocurre el claim |
| `contracts` | ✅ CRUD + validaciones | **Ancla principal** del claim: monto, fechas, partes |
| `correspondence` | ✅ CRUD completo | Canal formal de notificación del claim |
| `documents` | ✅ CRUD básico | Sin FKs extendidos aún (ver Riesgos) |

### Limitaciones actuales que afectan Claims

| Limitación | Impacto |
|---|---|
| `documents` no tiene `contract_id`, `correspondence_id` ni `claim_id` | Los respaldos documentales del claim no se pueden vincular |
| `contracts.fecha_fin` y `fecha_fin_real` sin validación de consistencia resuelta (OBS-04 aplicada) | Las fechas contractuales son el ancla del plazo del claim |
| `correspondence` no tiene campo `referencia_code` implementado (sí en ARCHITECTURE.md) | No se puede trazar el hilo de notificaciones de un mismo claim |
| Sin autenticación | No hay registro de quién registró/modificó el claim |

---

## 3. Diseño de Tablas

### 3.1 Tabla principal: `claims`

```sql
CREATE TABLE IF NOT EXISTS claims (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(50) UNIQUE NOT NULL,      -- Número/código del claim (ej: CLM-2024-001)
  titulo              VARCHAR(255) NOT NULL,             -- Descripción corta de la reclamación
  tipo                VARCHAR(50) NOT NULL,              -- Ver sección 4.1
  contract_id         INTEGER NOT NULL                   -- Contrato al que pertenece
                        REFERENCES contracts(id) ON DELETE RESTRICT,
  claimante_id        INTEGER NOT NULL                   -- Empresa que presenta el claim
                        REFERENCES companies(id) ON DELETE RESTRICT,
  demandado_id        INTEGER NOT NULL                   -- Empresa que recibe el claim
                        REFERENCES companies(id) ON DELETE RESTRICT,
  monto_reclamado     NUMERIC(18,2),                     -- Monto económico reclamado (nullable si es solo plazo)
  moneda              VARCHAR(10) NOT NULL DEFAULT 'PEN',
  dias_plazo_reclamados INTEGER,                         -- Días de extensión solicitados (nullable si es solo monto)
  fecha_notificacion  DATE NOT NULL,                     -- Fecha en que se notificó formalmente el claim
  fecha_limite_respuesta DATE,                           -- Plazo contractual de respuesta del mandante
  fecha_resolucion    DATE,                              -- Fecha en que se cerró el claim
  estado              VARCHAR(30) NOT NULL DEFAULT 'Notificado',  -- Ver sección 4.2
  monto_aprobado      NUMERIC(18,2),                     -- Monto acordado en resolución (nullable hasta cierre)
  dias_plazo_aprobados INTEGER,                          -- Días acordados en resolución
  causa               TEXT NOT NULL,                     -- Descripción de la causa que origina el claim
  descripcion         TEXT,                              -- Alcance y detalle del reclamo
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

**Restricción de negocio crítica (a nivel de aplicación):**
- `claimante_id` debe ser el `contratista_id` del contrato referenciado, o excepcionalmente el `mandante_id` (contra-claim).
- `demandado_id` debe ser la parte opuesta.
- `claimante_id != demandado_id` (análogo a OBS-03 de Contracts).

---

### 3.2 Tabla de eventos: `claim_events`

Registra cada hito del proceso del claim (notificaciones, reuniones, respuestas, acuerdos parciales). Es el log inmutable del ciclo de vida.

```sql
CREATE TABLE IF NOT EXISTS claim_events (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  tipo_evento  VARCHAR(50) NOT NULL,    -- Ver sección 6.3
  fecha        DATE NOT NULL,
  descripcion  TEXT NOT NULL,
  estado_nuevo VARCHAR(30),             -- Estado al que transicionó el claim tras este evento
  created_at   TIMESTAMP DEFAULT NOW()
  -- Sin updated_at: los eventos son inmutables una vez creados
);
```

**Nota de diseño:** Los eventos no se editan ni eliminan. Son el trazado de auditoría del proceso.

---

### 3.3 Tabla de vínculos: `claim_correspondence`

Relaciona un claim con las correspondencias que lo notifican, sustentan o responden. Es una tabla de unión M:N.

```sql
CREATE TABLE IF NOT EXISTS claim_correspondence (
  claim_id          INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  correspondence_id INTEGER NOT NULL REFERENCES correspondence(id) ON DELETE CASCADE,
  rol               VARCHAR(50) NOT NULL DEFAULT 'Sustento',
  -- 'Notificación' | 'Sustento' | 'Respuesta mandante' | 'Contra-oferta' | 'Acuerdo'
  PRIMARY KEY (claim_id, correspondence_id)
);
```

---

### 3.4 Tabla de vínculos: `claim_documents`

Relaciona un claim con sus documentos de respaldo (planos, cronogramas, informes técnicos, fotografías).

```sql
CREATE TABLE IF NOT EXISTS claim_documents (
  claim_id    INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  descripcion VARCHAR(255),
  PRIMARY KEY (claim_id, document_id)
);
```

**Dependencia:** Requiere que `documents` tenga su estructura extendida (OBS-16 del análisis previo).

---

## 4. Tipos y Estados

### 4.1 Tipos de Claim (`claims.tipo`)

| Tipo | Descripción | Implica monto | Implica plazo |
|---|---|---|---|
| `Adicional de Obra` | Trabajo no contemplado en contrato | ✅ | Opcional |
| `Ampliación de Plazo` | Extensión de fecha fin contractual | Opcional | ✅ |
| `Adicional + Plazo` | Combinación de ambos | ✅ | ✅ |
| `Disputa de Pago` | Rechazo o retención de valorización | ✅ | ❌ |
| `Interferencia` | Daño por acción/omisión del mandante | ✅ | Opcional |
| `Fuerza Mayor` | Evento externo no imputable a las partes | Opcional | ✅ |
| `Contra-Claim` | Reclamación del mandante al contratista | ✅ | Opcional |

---

### 4.2 Estados del Claim y Transiciones

```
                    ┌─────────────┐
                    │  Borrador   │  (registro previo a notificación formal)
                    └──────┬──────┘
                           │ notificar()
                    ┌──────▼──────┐
                    │ Notificado  │  (carta formal enviada, plazo corre)
                    └──────┬──────┘
              ┌────────────┼────────────┐
        evaluar()    rechazar()    vencer_plazo()
    ┌──────▼──────┐ ┌────▼────┐  ┌─────▼──────┐
    │ En Evaluación│ │Rechazado│  │  Vencido   │
    └──────┬──────┘ └────┬────┘  └─────┬──────┘
           │             │             │
     negociar()    apelar()      escalar()
    ┌──────▼──────┐      │       ┌─────▼──────┐
    │En Negociación│     │       │  En Disputa │
    └──────┬──────┘      │       └─────┬──────┘
     ┌─────┴──────┐      │             │
  acordar()   escalar()  │        resolver()
┌────▼─────┐ ┌───▼────┐  │       ┌─────▼──────┐
│  Cerrado │ │En      │◄─┘       │  Resuelto  │
│(Acuerdo) │ │Disputa │          │(Arbitraje) │
└──────────┘ └────────┘          └────────────┘
```

**Estados válidos:**

| Estado | Descripción |
|---|---|
| `Borrador` | Registrado pero no notificado formalmente |
| `Notificado` | Carta de claim enviada, plazo de respuesta corriendo |
| `En Evaluación` | Mandante está analizando la reclamación |
| `En Negociación` | Partes en proceso de acuerdo |
| `Rechazado` | Mandante rechazó el claim; puede derivar en disputa |
| `Vencido` | El mandante no respondió dentro del plazo contractual |
| `En Disputa` | Derivado a arbitraje, conciliación o proceso legal |
| `Cerrado (Acuerdo)` | Resuelto con acuerdo entre partes |
| `Resuelto (Arbitraje)` | Resuelto por tercero (árbitro, juez, conciliador) |
| `Retirado` | El claimante desistió del reclamo |

**Estado terminal:** `Cerrado (Acuerdo)`, `Resuelto (Arbitraje)`, `Retirado`. No se pueden modificar los datos principales una vez en estado terminal.

---

## 5. Campos Obligatorios

### Al crear (estado `Borrador`)

| Campo | Obligatorio | Regla |
|---|---|---|
| `code` | ✅ | Único en el sistema |
| `titulo` | ✅ | Min 10 caracteres |
| `tipo` | ✅ | Valor del enum sección 4.1 |
| `contract_id` | ✅ | Contrato debe estar en estado `Vigente` o `En Liquidación` |
| `claimante_id` | ✅ | Debe ser `contratista_id` o `mandante_id` del contrato |
| `demandado_id` | ✅ | Debe ser la parte opuesta al claimante |
| `causa` | ✅ | Descripción mínima de la causa |
| Al menos uno de: `monto_reclamado` o `dias_plazo_reclamados` | ✅ | No puede haber claim sin objeto |

### Al notificar (transición a `Notificado`)

| Campo | Obligatorio |
|---|---|
| `fecha_notificacion` | ✅ |
| Al menos una `claim_correspondence` con `rol = 'Notificación'` | ✅ |
| `fecha_limite_respuesta` | Recomendado (según contrato) |

### Al cerrar (estados terminales)

| Campo | Obligatorio |
|---|---|
| `fecha_resolucion` | ✅ |
| `monto_aprobado` | ✅ si el tipo implicaba monto |
| `dias_plazo_aprobados` | ✅ si el tipo implicaba plazo |
| Al menos un `claim_event` con `tipo_evento = 'Cierre'` | ✅ |

---

## 6. Relaciones con Contracts y Correspondence

### 6.1 Relación con `contracts`

```
contracts (1) ──────────────────────── (N) claims
    │
    ├── claims heredan: contract.contratista_id → claimante o demandado
    ├── claims heredan: contract.mandante_id    → demandado o claimante
    ├── claims heredan: contract.fecha_fin      → valida si claim es oportuno
    ├── claims heredan: contract.monto_original → referencia para % del adicional
    └── claims heredan: contract.moneda         → moneda del monto reclamado
```

**Validación crítica de temporalidad:**

Un claim de tipo `Adicional de Obra` o `Disputa de Pago` solo es válido si:
- `fecha_notificacion <= contract.fecha_fin_real` (si existe)
- O `fecha_notificacion <= contract.fecha_fin + margen_contractual`

Un claim de tipo `Ampliación de Plazo` requiere:
- `fecha_notificacion` dentro del plazo de notificación especificado en el contrato (usualmente 28 días del evento en FIDIC).

**Regla de estado del contrato:**
- No se puede crear un claim sobre un contrato en estado `Cerrado` o `Rescindido`.
- Al rescindirse un contrato, los claims en estado `Borrador` deben notificarse o cancelarse.

---

### 6.2 Relación con `correspondence`

La correspondencia es el **sustento probatorio** del claim. Un claim sin correspondencia no tiene soporte formal.

```
claims (1) ─── claim_correspondence (M:N) ─── (N) correspondence
```

**Roles de la correspondencia en el claim:**

| Rol | Quién la genera | Cuándo |
|---|---|---|
| `Notificación` | Contratista → Mandante | Al notificar el claim formalmente |
| `Sustento` | Contratista → Mandante | Envío de respaldos técnicos/económicos |
| `Respuesta mandante` | Mandante → Contratista | Respuesta formal al claim |
| `Contra-oferta` | Mandante → Contratista | Propuesta de acuerdo parcial |
| `Acuerdo` | Ambas partes | Confirmación del cierre |

**Regla de consistencia:**
- La `correspondence` vinculada como `Notificación` debe tener `contract_id = claims.contract_id`.
- La `correspondence.issue_date` debe ser ≤ `claims.fecha_notificacion`.

---

### 6.3 Tipos de eventos (`claim_events.tipo_evento`)

| Tipo | Descripción |
|---|---|
| `Creación` | Registro inicial del claim en el sistema |
| `Notificación formal` | Envío de carta de claim al mandante |
| `Sustento adicional` | Envío de documentación de soporte |
| `Respuesta mandante` | Recepción de respuesta formal |
| `Reunión de negociación` | Sesión de negociación entre partes |
| `Oferta parcial` | Propuesta de acuerdo parcial |
| `Rechazo` | Mandante rechaza el claim |
| `Derivación a arbitraje` | Escalamiento a proceso formal |
| `Acuerdo parcial` | Cierre parcial del claim |
| `Cierre` | Resolución final del claim |
| `Retiro` | Desistimiento del claimante |

---

## 7. Validaciones Críticas

### Nivel de base de datos

| Restricción | Implementación |
|---|---|
| `claimante_id != demandado_id` | CHECK en SQL o validación en backend |
| `contract_id` NOT NULL + RESTRICT | FK estricta, no nullable |
| `code` UNIQUE | UNIQUE constraint |
| Al menos uno de monto o plazo | CHECK: `monto_reclamado IS NOT NULL OR dias_plazo_reclamados IS NOT NULL` |

### Nivel de aplicación (backend)

| Validación | Regla |
|---|---|
| Contrato vigente | `contract.estado IN ('Vigente', 'En Liquidación')` al crear |
| Partes correctas | `claimante_id IN (contract.contratista_id, contract.mandante_id)` |
| Temporalidad | `fecha_notificacion <= MAX(contract.fecha_fin, contract.fecha_fin_real)` |
| Monto razonable | `monto_reclamado <= contract.monto_original * 2` (umbral configurable, alerta no bloqueo) |
| Estado terminal inmutable | No permitir edición de campos principales si `estado IN ('Cerrado (Acuerdo)', 'Resuelto (Arbitraje)', 'Retirado')` |
| Transiciones válidas | Solo permitir transiciones del grafo de la sección 4.2 |
| Notificación con correspondencia | Al transicionar a `Notificado`, verificar que exista al menos una `claim_correspondence` con `rol = 'Notificación'` |

### Nivel de UI (frontend)

| Validación | Comportamiento |
|---|---|
| Tipo de claim vs. campos de monto/plazo | Si tipo = `Ampliación de Plazo`, el campo monto es opcional; si tipo = `Adicional de Obra`, es requerido |
| Selector de contrato | Mostrar solo contratos `Vigente` o `En Liquidación` |
| Selector de claimante | Mostrar solo `contratista` y `mandante` del contrato seleccionado |
| Transiciones de estado | Botones de acción contextuales según estado actual (no dropdown libre) |

---

## 8. Flujo de Negocio para Minería / Construcción

### Flujo estándar FIDIC / contratos de obra

```
1. EVENTO GATILLANTE
   Ocurre un hecho que genera un potencial claim:
   - Orden de cambio del mandante
   - Condiciones del sitio imprevistas
   - Retraso en entrega de información
   - Interferencia de otro contratista
   - Evento de fuerza mayor

2. NOTIFICACIÓN OPORTUNA (plazo contractual, típico: 28 días FIDIC)
   Contratista envía carta formal notificando el claim.
   → correspondence [tipo=Carta, direction=Saliente, rol=Notificación]
   → claims [estado: Borrador → Notificado]

3. SUSTENTO TÉCNICO-ECONÓMICO (plazo contractual, típico: 84 días FIDIC)
   Contratista presenta la cuantificación detallada del claim:
   - Informe técnico de causas y efectos
   - Cronograma impactado (análisis de ruta crítica)
   - Valorización de adicionales
   → correspondence [tipo=Informe, direction=Saliente, rol=Sustento]
   → documents [informes, planos, cronogramas]
   → claims [estado: Notificado → En Evaluación]

4. EVALUACIÓN POR EL MANDANTE
   El mandante (con su área técnica o supervisor) evalúa el claim.
   → claims [estado: En Evaluación]
   → claim_events [tipo=Reunión de negociación]

5A. ACEPTACIÓN / NEGOCIACIÓN
   Mandante acepta total o parcialmente.
   → correspondence [tipo=Carta, direction=Entrante, rol=Respuesta mandante]
   → claims [estado: En Evaluación → En Negociación]
   Se define monto_aprobado y dias_plazo_aprobados.
   → claims [estado: En Negociación → Cerrado (Acuerdo)]
   → claim_events [tipo=Cierre]

5B. RECHAZO
   Mandante rechaza el claim.
   → correspondence [tipo=Carta, direction=Entrante, rol=Respuesta mandante]
   → claims [estado: En Evaluación → Rechazado]

   Opciones del contratista:
   a) Apelar → claims [estado: Rechazado → En Negociación]
   b) Escalar → claims [estado: Rechazado → En Disputa]
   c) Retirar → claims [estado: Rechazado → Retirado]

5C. VENCIMIENTO DE PLAZO SIN RESPUESTA
   Mandante no responde dentro del plazo contractual.
   → claims [estado: Notificado → Vencido]
   El claim vencido puede derivar automáticamente a disputa.

6. DISPUTA / ARBITRAJE
   Si no hay acuerdo:
   → claims [estado: En Disputa]
   → claim_events [tipo=Derivación a arbitraje]
   El resultado del arbitraje se registra:
   → claims [monto_aprobado, dias_plazo_aprobados, fecha_resolucion]
   → claims [estado: En Disputa → Resuelto (Arbitraje)]
```

---

## 9. Reportes que Debería Soportar

### Reportes operativos

| Reporte | Descripción | Filtros |
|---|---|---|
| **Resumen de Claims por Contrato** | Listado de todos los claims de un contrato con estado y montos | `contract_id`, `estado` |
| **Claims Pendientes de Respuesta** | Claims en estado `Notificado` con `fecha_limite_respuesta` próxima o vencida | `project_id`, días restantes |
| **Trazabilidad de un Claim** | Línea de tiempo de eventos de un claim específico | `claim_id` |
| **Claims por Estado** | Dashboard de claims agrupados por estado | `project_id`, `contract_id` |

### Reportes gerenciales

| Reporte | Descripción | Filtros |
|---|---|---|
| **Exposición económica por proyecto** | Suma de `monto_reclamado` vs `monto_aprobado` por proyecto | `project_id`, rango de fechas |
| **Tasa de éxito de claims** | % de claims cerrados con acuerdo vs rechazados | `project_id`, `tipo` |
| **Impacto en plazo** | Suma de `dias_plazo_reclamados` vs `dias_plazo_aprobados` por contrato | `contract_id` |
| **Antigüedad de claims abiertos** | Claims sin resolver con días transcurridos desde `fecha_notificacion` | `project_id`, `estado` |
| **Claims por tipo** | Distribución de claims por tipo (adicional, plazo, disputa, etc.) | `project_id` |

### Reporte crítico para contratos con FIDIC

| Reporte | Por qué importa |
|---|---|
| **Claims notificados fuera de plazo** | Identifica claims que podrían ser rechazados por extemporáneos (riesgo legal) |
| **Mandantes sin respuesta dentro de plazo** | El silencio del mandante puede equivaler a aceptación según FIDIC Sub-Clause 3.5 |

---

## 10. Riesgos de Implementación

### Riesgo 1 — `documents` sin estructura extendida ⚠️ ALTO
**Descripción:** La tabla `documents` actual solo tiene `code`, `title`, `version`, `status`. No tiene `contract_id`, `claim_id` ni `correspondence_id`. Sin esta extensión, `claim_documents` quedará incompleta funcionalmente.
**Mitigación:** Extender `documents` antes de implementar Claims (tarea T-06 del TASKS.md). Requiere ALTER TABLE en producción o recrear con init.sql.

---

### Riesgo 2 — Complejidad de las transiciones de estado ⚠️ ALTO
**Descripción:** El grafo de transiciones de Claims tiene 9 estados y múltiples caminos. Implementar un dropdown libre de estado permitiría transiciones inválidas (ej: pasar de `Borrador` a `Resuelto (Arbitraje)` directamente).
**Mitigación:** Implementar en el backend una función `validateTransition(estadoActual, estadoNuevo)` que rechace transiciones no permitidas. En el frontend, reemplazar el selector de estado por botones de acción contextuales (ej: "Notificar", "Derivar a Disputa").

---

### Riesgo 3 — Consistencia de partes con el contrato ⚠️ ALTO
**Descripción:** Al seleccionar `claimante_id` y `demandado_id`, el frontend debe filtrarlos a las dos empresas del contrato. Si el usuario cambia el `contract_id` después de haber elegido las partes, los IDs pueden quedar inconsistentes.
**Mitigación:** En el formulario, hacer que el cambio de `contract_id` reinicie los selectores de claimante y demandado. El backend también debe validar la consistencia en POST/PUT.

---

### Riesgo 4 — `correspondence` sin `referencia_code` implementado ⚠️ MEDIO
**Descripción:** ARCHITECTURE.md define `referencia_code` en correspondencia para trazar hilos de respuesta. La implementación actual no lo tiene. Para Claims, necesitamos trazar qué correspondencia responde a cuál (ej: la respuesta del mandante referencia la notificación del contratista).
**Mitigación:** Implementar `referencia_code` en `correspondence` antes de Claims, o usar la tabla `claim_correspondence` con roles para compensar este rastro parcialmente.

---

### Riesgo 5 — Eliminación de contratos/correspondencia con claims activos ⚠️ MEDIO
**Descripción:** Los `claims` usan `ON DELETE RESTRICT` en `contract_id`, lo que impedirá eliminar contratos con claims. Sin embargo, la correspondencia vinculada via `claim_correspondence` usa `ON DELETE CASCADE` en el lado del claim, lo que podría dejar claims sin sustento si se elimina correspondencia clave.
**Mitigación:** Cambiar `correspondence` a `ON DELETE RESTRICT` en la tabla `claim_correspondence` (no CASCADE). Agregar validación en el backend antes de eliminar correspondencia: verificar que no esté vinculada a un claim activo.

---

### Riesgo 6 — Ausencia de autenticación para auditoría ⚠️ MEDIO
**Descripción:** Los `claim_events` deberían registrar quién realizó cada acción. Sin autenticación, todos los eventos quedan sin responsable identificado, lo que invalida el valor de auditoría del log.
**Mitigación:** Reservar el campo `usuario` en `claim_events` como `VARCHAR(100)` nullable inicialmente, para completarlo cuando se implemente Auth. Documentar como deuda técnica.

---

### Riesgo 7 — Cálculo de temporalidad sin zona horaria ⚠️ BAJO
**Descripción:** Las fechas se almacenan como `DATE` (sin hora). En proyectos internacionales o contratos con plazos en horas (ej: 24h para notificar), esto puede generar ambigüedad.
**Mitigación:** Para el MVP, los claims usan plazos en días, por lo que `DATE` es suficiente. Documentar la limitación para proyectos con plazos en horas.

---

## 11. Modelo de Relaciones Actualizado

```
companies ──┬── projects ──┬── contracts ──┬── correspondence ──┐
            │              │               │                     │
            │              │               └── claims ──────────┤
            │              │                    │               │
            │              └── documents ◄──────┤               │
            │                                   │               │
            ├── contracts (como contratista)     │               │
            └── contracts (como mandante)        │               │
                                                 │               │
                                        claim_events             │
                                        claim_documents ◄────────┘
                                        claim_correspondence ────┘
```

---

## 12. Dependencias para Implementar Claims

En orden estricto:

1. **Extender `documents`** con `contract_id`, `correspondence_id`, `claim_id`, `tipo`, `descripcion` (T-06).
2. **Agregar `referencia_code`** a `correspondence` para trazabilidad de hilos.
3. **Implementar Claims**: tablas `claims`, `claim_events`, `claim_correspondence`, `claim_documents`.
4. **Implementar transiciones de estado** con validación en backend.
5. *(Opcional pero recomendado antes del go-live)* **Autenticación básica** para tener responsable en `claim_events`.

---

*Documento de diseño — solo referencia. No modifica la aplicación.*
