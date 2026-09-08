# Tareas

| ID | FR / AC | Trabajo | Archivos | Depende de | Responsable | Estado | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | FR-002, FR-005, FR-007 / AC-002, AC-006, AC-008 | Contrato HTTP de eventos | `docs/api/events.md` | — | sdd-documenter | DONE | Archivo creado; no documenta GET /admin/events/:id como existente. Agent 121038b4 |
| T-002 | FR-002, FR-005 / AC-002, AC-006 | Contrato HTTP de categorías | `docs/api/event-categories.md` | T-001 | sdd-documenter | DONE | Archivo creado. Agent 121038b4 |
| T-003 | FR-005 / AC-005 | Índice de contratos | `docs/api/README.md` | T-001, T-002 | sdd-documenter | DONE | 4 links relativos. Agent 121038b4 |
| T-004 | FR-001–008, FR-010 / AC-001–004, AC-007–010, AC-012 | Contexto frontend | `docs/frontend-context.md` | T-003 | sdd-documenter | DONE | Mapa 22 endpoints, auth, modelo local. Agent 121038b4 |
| T-005 | FR-009 / AC-011 | Reescribir `sdd/PROJECT.md` | `sdd/PROJECT.md` | — | sdd-documenter | DONE | Tabla sin Pendiente. Restaurado 2026-09-08 tras borrado accidental de `sdd/` |
| T-006 | AC-002, AC-011, AC-012 | Jest fs-only de docs | `tests/docs-frontend-context.test.js` | T-003–T-005 | sdd-tester | DONE | Tester: `npm test -- tests/docs-frontend-context.test.js` exit 0 (5/5). Re-run orquestador pendiente de `sdd/PROJECT.md` restaurado |
| T-007 | AC-001–AC-012 | Checklist vs routers/repos/secretos | Lectura | T-006 | sdd-tester | DONE | Mapa 22=22; columnas = PUBLIC/ADMIN/COLUMNS; grep eyJ/email limpio. Agent 41eea081 |

Estados: TODO, IN_PROGRESS, BLOCKED, DONE. No marcar DONE sin evidencia.
