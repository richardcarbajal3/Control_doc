# DOCUMENT MODEL V2 (Control Doc)

## 1. Entidad principal
Document es la unidad central del sistema de Control Doc.

Representa cualquier artefacto documental: planos, contratos, informes, cartas, certificados, etc.

---

## 2. Campos base
- id
- type (Documento, Plano, Especificación, Contrato, Carta, Informe, Certificado)
- description
- created_at
- updated_at

---

## 3. Relaciones permitidas (IMPORTANTE)

Un documento puede vincularse opcionalmente a:

- Project (0..1)
- Contract (0..1)
- Correspondence (0..1)

Reglas:
- Todas las relaciones son opcionales
- Un documento puede existir sin vínculos
- No se valida consistencia cruzada en V1 (temporal)

---

## 4. Regla crítica temporal

Por ahora se permite:
- documentos sin proyecto
- documentos sin contrato
- documentos sin correspondencia

Esto es temporal hasta migración a modelo de relaciones (V2.1)

---

## 5. Restricción futura (NO IMPLEMENTADA AÚN)

Se evaluará migrar a:

document_links (tabla de relaciones genérica)

pero aún NO implementar.

---

## 6. Principio del sistema

Documents es el nodo central del sistema de trazabilidad documental.
Todos los módulos futuros (Contracts, Claims, etc.) dependen de Documents, no al revés.
