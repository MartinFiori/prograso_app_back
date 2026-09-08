# Spec: 001 — Documentación y contexto para agente frontend
Revisión: 1. Estado: APPROVED.

## Problema y resultado esperado
Un agente o desarrollador de frontend no puede inferir de forma segura el contrato de esta API ni el modelo de negocio leyendo solo README/SDD: el README de raíz describe el orquestador SDD (si existe), `sdd/PROJECT.md` estaba vacío, y solo había contratos HTTP para inscripciones y estados de evento.

Esta feature entrega documentación en español, basada exclusivamente en comportamiento implementado y schemas locales, para que un agente frontend pueda integrar el backend sin leer el código.

Éxito: un lector que solo vea `docs/` (y `sdd/PROJECT.md` actualizado) conoce actores, autenticación, envelopes, todos los endpoints montados, reglas de visibilidad/cupo/inscripción, el modelo de datos local con divergencias, y qué no existe (login, profiles HTTP, gimnasio, etc.).

## Alcance y exclusiones
Incluye:
- Un documento de contexto de proyecto/negocio para frontend.
- Contratos o secciones para los huecos: overview (auth, envelopes, health, CORS, variables de entorno por nombre), eventos, categorías; mención explícita de `exercises` y `/health`.
- Referencias a los contratos ya existentes `docs/api/event-registrations.md` y `docs/api/event-statuses.md` (no duplicar su contenido salvo un índice).
- Actualizar `sdd/PROJECT.md` con stack, módulos y evidencia reales.
- Advertir la divergencia `schemas/event_statuses.sql` (`name`/`is_active`) vs código/contrato (`label`).
- Marcar hipótesis (p. ej. login Google) como hipótesis, no como hecho.

Excluye:
- Cambiar rutas, validaciones, SQL desplegado, RLS, tests de producto o dependencias.
- Inventar producto (gimnasio, clases, pagos, membresías).
- Afirmar el esquema remoto de Supabase.
- Copiar secretos, valores de `.env` o el email de `schemas/user_to_admin.sql`.
- Implementar búsqueda de usuarios, `GET /admin/events/:id` u otros endpoints faltantes.
- Actualizar `schemas/event_statuses.sql` salvo que el usuario lo pida en la aprobación.

## Evidencia del repositorio
Hechos (rutas):
- Stack: `package.json`, `package-lock.json` (npm lockfileVersion 3), `app.js`, `index.js`, `.eslintrc.js`, `jest.config.js`.
- Montaje: `routes/index.js` en `/` (sin prefijo `/api`). Health en `app.js`.
- Auth: `middleware/authenticate.js`, `require-admin.js`, `load-profile.js`.
- Clientes: `supabase/index.js` (publishable), `supabase/admin.js` (service_role), `supabase/user-client.js` (JWT usuario + RPC).
- Constantes: `constants/event-statuses.js`, `registration-statuses.js`, `error-codes.js`.
- Contratos: `docs/api/event-registrations.md`, `docs/api/event-statuses.md`.
- Schemas: todos los `.sql` y `orden.md` bajo `schemas/`.
- Tests: mocks Jest/supertest; DB real solo opcional y skippeada (`RUN_REGISTRATION_DB_TESTS`).

Hipótesis:
- El frontend usa Supabase Auth (Google u otro) fuera de este repo.
- La tabla remota `event_statuses` coincide con el código (`label`) y no con el SQL local.
- El nombre comercial es “Progreso”; los ejemplos de test (“Cancha abierta”) no definen el dominio legal.

## Requisitos funcionales
- FR-001: Existe un documento de contexto de proyecto, en español, que describe qué es esta API (backend HTTP de eventos, categorías e inscripciones), el stack real, cómo se arranca (`npm start` / `PORT`), y el modelo de negocio observable (actores, estados, cupos, lista de espera) sin inventar dominio no evidenciado.
- FR-002: El contexto o documentos enlazados enumeran **todos** los endpoints montados en `app.js` y `routes/index.js` (incluido `/health` y `/exercises`) con método, autenticación, payload/query, forma de respuesta y errores.
- FR-003: La documentación de autenticación describe Bearer + `getUser`, roles `user`/`admin` vía `profiles.role`, que el login no vive en Express, y que lecturas de catálogo/eventos usan service_role (el frontend no debe llamar a tablas con la service_role).
- FR-004: Se documentan envelopes de éxito/error reales (`ApiSuccess` / `ApiError`) y se indica que `/health` y el 400 de `/exercises` no siguen el mismo patrón.
- FR-005: Los huecos de contrato (eventos, categorías) quedan cubiertos al mismo nivel de utilidad que los contratos existentes, o con un overview más un contrato por recurso; los contratos existentes se referencian, no se reescriben salvo para el índice.
- FR-006: Se documenta el modelo de datos **local** (tablas, FK, constraints, RLS presentes en `schemas/`) y se declara explícitamente la divergencia `event_statuses` código/contrato vs SQL, y la ausencia de SQL de `exercises`.
- FR-007: Se documentan reglas de visibilidad pública de eventos, soft-delete de eventos/categorías, cupo/waitlist, y que GET público no expone ocupados ni `created_by`.
- FR-008: Se listan limitaciones de integración: no hay `GET /admin/events/:id`, no hay catálogo HTTP de `registration_statuses`, no hay CRUD/búsqueda de `profiles`/usuarios, CORS está abierto (`cors()` sin origen), no hay prefijo `/api`.
- FR-009: `sdd/PROJECT.md` deja de decir “PENDIENTE DE INSPECCIÓN” y refleja stack, auth, schemas y módulos de referencia con rutas de evidencia.
- FR-010: La documentación no incluye secretos ni afirma haber validado el schema desplegado.

## Restricciones no funcionales
- NFR-001: Idioma español en los documentos de producto/frontend (código de `errorCode` y campos JSON se citan tal cual en inglés/snake_case).
- NFR-002: Solo comportamiento implementado; toda hipótesis se etiqueta como tal.
- NFR-003: No publicar `SUPABASE_SERVICE_ROLE_KEY`, tokens, ni PII de scripts SQL.
- NFR-004: Un agente frontend debe poder seguir los docs sin abrir `routes/` ni `services/`.
- NFR-005: Los documentos de contrato HTTP deben indicar que se actualizan si cambia el código (misma convención que los contratos existentes).

## Criterios de aceptación
- AC-001 [FR-001]: Dado un agente frontend con acceso solo a la documentación de esta feature, cuando lee el contexto de proyecto, entonces obtiene propósito (API de eventos/inscripciones), stack (Express 5 CommonJS + Supabase + Zod + Jest) y actores (anónimo, autenticado, admin), y no se presenta gimnasio/clases/pagos como hecho.
- AC-002 [FR-002]: Dado el mapa de endpoints documentado, cuando se compara con `routes/index.js` y `app.js`, entonces no falta ningún router montado y cada fila indica método, auth y código de éxito (200/201/204 según el caso).
- AC-003 [FR-003]: Dado un llamado a una ruta protegida, cuando el documento describe auth, entonces indica header `Authorization: Bearer`, `401 AUTH_USER_REQUIRED` / `AUTH_INVALID_TOKEN`, `403 AUTH_INSUFFICIENT_PERMISSIONS` en admin, y `404 profile_not_found` en rutas de inscripción de usuario.
- AC-004 [FR-004]: Dado un éxito de listado (`GET /events`) y un error de validación, cuando el frontend lee los docs, entonces distingue envelope `status: success` con `pagination` vs `status: error` con `errorCode` y `data` de Zod, y sabe que `/health` no usa ese envelope.
- AC-005 [FR-005]: Dado el índice de contratos, cuando el agente necesita inscripciones o estados, entonces es dirigido a `docs/api/event-registrations.md` y `docs/api/event-statuses.md` sin un tercer documento que los contradiga.
- AC-006 [FR-005]: Dado `GET /events` y el ABM admin de eventos/categorías, cuando el agente lee los huecos cubiertos, entonces conoce filtros, campos públicos vs admin, default `draft`, 204 de DELETE, y que las mutaciones de eventos/categorías viven en `/events` y `/event-categories` (no bajo `/admin`, salvo el listado admin de eventos).
- AC-007 [FR-006]: Dado `schemas/event_statuses.sql` y `GET /event-statuses`, cuando el agente lee el modelo de datos, entonces se le informa que el SQL local declara `name`/`is_active` y que el HTTP implementado expone `code`/`label`/`description`, y que el remoto no fue verificado en esta feature.
- AC-008 [FR-007]: Dado un evento `draft` o `cancelled`, cuando el frontend consulta `GET /events` o `GET /events/:id`, entonces la documentación indica que no aparece en el listado público y el detalle responde `404 event_not_found`.
- AC-009 [FR-007]: Dado un alta de inscripción, cuando no hay cupo, entonces la documentación indica `201` + `waitlisted` (no `event_capacity_full`), y que `event_capacity_full` solo aplica al PATCH admin a `confirmed`.
- AC-010 [FR-008]: Dado un admin que quiere editar un borrador o inscribir a un tercero, cuando lee limitaciones, entonces sabe que no hay GET admin por id de evento y que debe conocer el UUID de `profiles.id`.
- AC-011 [FR-009]: Dado `sdd/PROJECT.md` tras la implementación, cuando se lee la tabla de contexto, entonces deja de estar “Pendiente” en objetivo, stack, lockfile, comandos, módulos, auth y schemas, y cita archivos reales.
- AC-012 [FR-010]: Dado el conjunto de documentos nuevos, cuando se buscan secretos, entonces no aparecen valores de claves ni el email de `user_to_admin.sql`; solo nombres de variables (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `NODE_ENV`).

## Errores, permisos y casos límite
La documentación **debe** mencionar:
- Códigos de auth anteriores y `admin_required` (RPC, defensa).
- `VALIDATION_FAILED` (Zod strict: keys extra, body vacío, ids no numéricos, `user_id` en POST propio).
- Eventos: `event_not_found`, `event_category_not_found`, `event_category_inactive`, `event_status_not_found`, `invalid_event_dates`, `event_category_name_already_exists`.
- Inscripciones: los de `docs/api/event-registrations.md` (incl. `event_not_open`, deadline, already_exists, waitlist conflict, capacity full solo admin PATCH).
- Baja de inscripción = 200 + fila borrada, no 204; DELETE evento/categoría = 204.
- POST inscripción no idempotente.
- `/exercises`: 400 con posible filtrado del error de Supabase; comportamiento de doble respuesta.
- Filtro público `status_code=draft` → 200 lista vacía.
- Seed texts de labels/descriptions pueden diferir entre SQL, tests y contrato; el API devuelve la tabla.
- Tests de esta API no demuestran RLS ni schema remoto (mocks).

## Dudas pendientes
Resueltas por defaults del plan aprobado (usuario «si», 2026-09-08):
1. Artefactos: `docs/frontend-context.md` + contratos en `docs/api/`.
2. No se actualiza `schemas/event_statuses.sql`.
3. Login Google = hipótesis.
4. Vocabulario: `evento`.
5. Esta API no busca usuarios.
