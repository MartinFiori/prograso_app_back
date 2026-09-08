# Contrato de la feature
Estado: FINAL.

## Tipo de interfaz
Documentación Markdown para un agente o desarrollador frontend. **No** es un contrato HTTP nuevo ni un cambio de API.

## Operaciones y consumidores
Consumidor: agente frontend (u humano) **sin** leer `routes/` ni `services/`.

| Artefacto | Rol |
| --- | --- |
| `docs/frontend-context.md` | Entrada: negocio, stack, actores, auth, envelopes, mapa de endpoints, limitaciones, modelo local |
| `docs/api/README.md` | Índice de contratos HTTP |
| `docs/api/events.md` | Contrato de eventos (público + admin list + mutaciones) |
| `docs/api/event-categories.md` | Contrato de categorías |
| `docs/api/event-registrations.md` | Contrato existente (solo indexado) |
| `docs/api/event-statuses.md` | Contrato existente (solo indexado) |
| `sdd/PROJECT.md` | Contexto SDD del repo |

## Autenticación y permisos
N/A para leer los Markdown. El contenido describe Bearer + `profiles.role`; login no vive en Express; frontend no usa `SUPABASE_SERVICE_ROLE_KEY`.

## Entrada y salida
N/A HTTP. Español; JSON/`errorCode` en casing del API. Hipótesis etiquetadas. Banner NFR-005 en contratos.

## Errores
N/A como API de esta feature. Los docs listan códigos reales del Express (auth, validación, eventos, categorías) y remiten inscripciones al contrato existente.

## Ejemplos
Contratos de recurso al estilo de `docs/api/event-statuses.md`. Sin tokens reales ni `eyJ` en artefactos nuevos.

## Reglas de negocio y compatibilidad
- No se reescribieron contratos preexistentes.
- Login Google = hipótesis en el overview.
- Schema: local `schemas/` solamente; divergencia `event_statuses` declarada; remoto no verificado.
- Durante el cierre, `sdd/` fue borrado del working tree y restaurado desde HEAD + reescritura de `PROJECT.md` y esta carpeta de feature.
