# Plan de implementación
Revisión: 1 (corrección AC-012: Jest/grep solo sobre docs nuevos + `sdd/PROJECT.md`). Spec: revisión 1. Aprobado 2026-09-08.

## Solución propuesta y justificación
Documentación en español para un agente frontend, sin cambiar código de producto, tests de producto, dependencias ni SQL.

Estructura (alternativa B):
- `docs/frontend-context.md`
- `docs/api/events.md` y `docs/api/event-categories.md`
- `docs/api/README.md` (índice; no copia inscripciones/statuses)
- `sdd/PROJECT.md` actualizado
- `tests/docs-frontend-context.test.js` (fs only)

## Flujo de usuario y datos
El agente abre `docs/frontend-context.md` → `docs/api/README.md` → contrato del recurso.

## Alternativas y decisiones
Elegida B (no monolito, no `.cursor/` como interfaz). Vocabulario evento. Google = hipótesis. No actualizar `event_statuses.sql`.

## Archivos y módulos afectados
Crear: los cuatro Markdown de `docs/` listados + el Jest. Modificar: `sdd/PROJECT.md`. No tocar Express, schemas, ni contratos preexistentes.

## Modelo de datos y contratos
N/A como cambio de schema. Documentar divergencia `event_statuses`, RLS ENABLE sin policies de catálogo, índice parcial de waitlist, sin SQL de `exercises`. Remoto no verificado.

## Estrategia de pruebas
Jest de presencia + checklist humano vs routers/repositorios + grep de secretos acotado a artefactos nuevos.

## Riesgos y reversión
Drift docs vs código; `sdd/` se borró del working tree durante el cierre y se restauró desde HEAD. Reversión: borrar Markdown nuevos y el Jest.

## Dependencias y secuencia
T-001→T-002→T-003→T-004; T-005 en paralelo; T-006/T-007 después.
