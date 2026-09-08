> Este documento es el contrato de integración entre backend y frontend.
> Debe actualizarse en el mismo cambio que modifique rutas, payloads,
> respuestas, validaciones, códigos de error o reglas de negocio.

# Contexto de proyecto para un agente frontend

Entrada de lectura para integrar este backend **sin abrir** `routes/` ni `services/`. Contratos HTTP por recurso: [docs/api/README.md](./api/README.md).

Este archivo describe solo comportamiento **implementado**. Las hipótesis están etiquetadas. El schema **remoto** de Supabase no fue verificado en esta documentación.

---

## 1. Propósito

API HTTP de **eventos**, **categorías de eventos** e **inscripciones** (cupo + lista de espera). Vocabulario del producto en esta API: **evento**.

El dominio implementado es eventos, categorías e inscripciones. El nombre de carpeta **Progreso** es una **hipótesis** de marca si se menciona; no define el contrato.

Login, búsqueda de usuarios y catálogo HTTP de `registration_statuses` **no** existen en este Express.

---

## 2. Stack y arranque

| Dato | Valor |
| ---- | ----- |
| Runtime | Node.js, módulo CommonJS (`"type": "commonjs"` en `package.json`) |
| HTTP | Express 5 (`^5.2.1`) |
| Validación | Zod `^4.5.4` (`strict()` en query/body de recursos con schema) |
| Datos / Auth | `@supabase/supabase-js` `^2.113.0` |
| Tests | Jest `^30.5.1` (`npm test` = `jest --runInBand`) |
| Gestor | npm (`package-lock.json` lockfileVersion 3) |

Arranque: `npm start` (`nodemon index.js`). Puerto: `PORT` o **8080**. Si `NODE_ENV !== 'test'`, hay log `morgan('dev')`.

No hay prefijo `/api`. CORS: `cors()` **sin** origen restringido (abierto).

---

## 3. Actores

Actores: anónimo, autenticado (con perfil) y admin.

| Actor | Qué puede hacer en HTTP |
| ----- | ----------------------- |
| Anónimo | `GET /health`, `GET /exercises`, catálogos públicos (estados, categorías activas), listado y detalle **públicos** de eventos. |
| Autenticado + perfil | Inscribirse, ver y borrar **su** inscripción (`loadProfile`). Rol `user` o `admin`. |
| Admin (`profiles.role = admin`) | ABM de eventos y categorías; listado admin de eventos; ABM de inscripciones ajenas. |

Sin perfil: las rutas de inscripción de **usuario** responden `404` / `profile_not_found`. Las rutas **admin** responden `403` / `AUTH_INSUFFICIENT_PERMISSIONS` incluso si no hay fila en `profiles`.

---

## 4. Autenticación

Header:

```http
Authorization: Bearer <supabase_access_token>
```

El login **no** vive en Express. El backend llama `supabase.auth.getUser(token)`.

**Hipótesis:** el frontend obtiene el access token con Supabase Auth. El contrato de inscripciones menciona inicio de sesión con Google; aquí se trata como hipótesis de proveedor, no como un endpoint de este repo.

| Situación | HTTP | `errorCode` |
| --------- | ---: | ----------- |
| Sin Bearer | 401 | `AUTH_USER_REQUIRED` |
| Token inválido o vencido | 401 | `AUTH_INVALID_TOKEN` |
| Ruta admin y no es admin (o no hay perfil) | 403 | `AUTH_INSUFFICIENT_PERMISSIONS` |
| Inscripción de usuario sin fila en `profiles` | 404 | `profile_not_found` |

`profile_not_found` en rutas de **usuario** de inscripciones (`loadProfile`). No aplica al ABM de eventos/categorías.

Defensa RPC: si un procedimiento SQL rechaza por no-admin, el `errorCode` HTTP puede ser `admin_required` (403). En las rutas `/admin/...` el middleware suele cortar antes con `AUTH_INSUFFICIENT_PERMISSIONS`.

El frontend **no** debe usar `SUPABASE_SERVICE_ROLE_KEY`. Express usa internamente la service_role para catálogo y eventos (`supabase/admin.js`). `GET /exercises` usa la clave publishable. Las mutaciones de inscripción van con el JWT del usuario + RPC.

---

## 5. Envelopes

### ApiSuccess (la mayoría de rutas)

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": {}
}
```

`GET /events` y `GET /admin/events` agregan `pagination` (`page`, `limit`, `total`, `total_pages`). El listado admin de inscripciones también trae `pagination` y `meta`. Altas: `statusCode` 201. `DELETE` de evento o categoría: **204 vacío**, sin envelope. Baja de inscripción: **200** con la fila borrada (no 204).

### ApiError

```json
{
  "status": "error",
  "statusCode": 400,
  "description": "Validation failed",
  "errorCode": "VALIDATION_FAILED",
  "data": [
    { "path": "title", "message": "title is required" }
  ]
}
```

Zod `strict()`: claves extra, body vacío donde aplica, ids no numéricos. En `POST` de inscripción propia, `user_id` en el body → `VALIDATION_FAILED`.

### Excepciones (no usan el mismo patrón)

**`GET /health`** — `200`:

```json
{ "success": true, "msg": "hola mundo" }
```

No tiene `status: success`, ni `statusCode`, ni `data`.

**`GET /exercises`** — éxito `200` con `ApiSuccess`. Si Supabase falla, responde `400` **no estándar** (`description` = mensaje de Supabase, `data` = objeto de error; puede filtrar detalle de Postgres). El handler **no hace `return`** tras el 400 y luego intenta enviar también `ApiSuccess`: posible **doble respuesta**.

---

## 6. Variables de entorno (solo nombres)

| Nombre | Quién la usa |
| ------ | ------------ |
| `SUPABASE_URL` | Express (clientes Supabase). |
| `SUPABASE_PUBLISHABLE_KEY` | Express: `getUser`, `GET /exercises`, cliente de usuario para RPC. El frontend de app puede usar la publishable contra Auth de Supabase; no es un secreto de servidor equivalente a service_role. |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Express (admin). **Nunca el frontend.** |
| `PORT` | Express; default 8080. |
| `NODE_ENV` | Omite morgan si vale `test`. |

No hay otras variables de producto documentadas aquí. No copiar valores.

---

## 7. Mapa de endpoints montados

Montaje: `app.use('/', routes)` + `GET /health` en `app.js`.

| Método | Ruta | Auth | Éxito |
| ------ | ---- | ---- | ----: |
| GET | `/health` | público | 200 `{ success, msg }` |
| GET | `/exercises` | público | 200 `ApiSuccess` **o** 400 no estándar |
| GET | `/event-statuses` | público | 200 |
| GET | `/event-categories` | público (solo `is_active`) | 200 |
| GET | `/event-categories/:id` | público (solo activa) | 200; 404 `ENTITY_NOT_FOUND` |
| POST | `/event-categories` | admin Bearer | 201 |
| PATCH | `/event-categories/:id` | admin Bearer | 200 |
| DELETE | `/event-categories/:id` | admin Bearer | 204 vacío |
| GET | `/events` | público | 200 + `pagination` |
| GET | `/events/:id` | público | 200; draft/cancelled → 404 `event_not_found` |
| POST | `/events` | admin Bearer | 201; default `status_code=draft` |
| PATCH | `/events/:id` | admin Bearer | 200 |
| DELETE | `/events/:id` | admin Bearer | 204; soft-delete `cancelled` |
| GET | `/admin/events` | admin Bearer | 200 + `pagination` |
| POST | `/events/:eventId/registrations` | user+profile | 201 |
| GET | `/events/:eventId/registrations/me` | user+profile | 200 |
| DELETE | `/events/:eventId/registrations/me` | user+profile | 200 (no 204) |
| GET | `/admin/events/:eventId/registrations` | admin Bearer | 200 + pagination + meta |
| POST | `/admin/events/:eventId/registrations` | admin Bearer | 201 |
| GET | `/admin/event-registrations/:registrationId` | admin Bearer | 200 |
| PATCH | `/admin/event-registrations/:registrationId` | admin Bearer | 200 |
| DELETE | `/admin/event-registrations/:registrationId` | admin Bearer | 200 |

Detalle de query, campos y errores: contratos en [docs/api/README.md](./api/README.md).

---

## 8. Limitaciones de integración

- **No existe** `GET /admin/events/:id`. Para un borrador: `GET /admin/events` (filtro `status_code`) o el `id` del `POST`/`PATCH`.
- **No hay** catálogo HTTP de `registration_statuses`. Los códigos de inscripción están en [event-registrations.md](./api/event-registrations.md).
- **No hay** CRUD ni búsqueda HTTP de `profiles` / usuarios. Un admin que inscribe a un tercero debe conocer el UUID `profiles.id`.
- Sin prefijo `/api`. CORS abierto.
- POST de inscripción **no** es idempotente (`409` / `registration_already_exists`).
- Baja de inscripción = 200 + fila; DELETE evento/categoría = 204.

---

## 9. Negocio observable

**Visibilidad pública de eventos:** solo `open`, `closed`, `completed`. `draft` y `cancelled` no listan en `GET /events`; `GET /events/:id` → `404` / `event_not_found`. Filtro público `status_code=draft` o `cancelled` → `200` lista vacía.

**Soft-delete:** evento → `cancelled`. Categoría → `is_active=false`. Unique de `name` de categoría sobrevive al soft-delete.

**Cupo / waitlist (resumen):** el alta (usuario o admin) con cupo lleno crea `waitlisted` y responde **201** (nunca `event_capacity_full` en el POST). `event_capacity_full` solo aplica al **PATCH admin** que intenta pasar a `confirmed` sin cupo. Detalle, promoción y errores: [event-registrations.md](./api/event-registrations.md).

GET público de eventos expone `capacity`, no ocupados ni `created_by`.

---

## 10. Modelo de datos local (`schemas/`)

Definiciones **locales**. No hay migraciones formales versionadas tipo Flyway. **Remoto no verificado.**

Tablas de negocio (orden aproximado en `schemas/orden.md`):

| Tabla | Rol |
| ----- | --- |
| `profiles` | Extiende `auth.users`. `id` uuid PK, `role` `user` \| `admin`, `name`, `avatar_url`. Trigger local `handle_new_user` inserta perfil al alta en `auth.users`. |
| `event_statuses` | Catálogo de estado de evento. |
| `registration_statuses` | Catálogo de estado de inscripción (`confirmed`, `waitlisted`, `cancelled` en seed). |
| `event_categories` | Categorías. Unique `name`. `is_active`. |
| `events` | Eventos. FK categoría y `status_code`. `created_by` → `profiles`. `capacity > 0`. `registration_deadline` null o `<= starts_at`. Default `status_code = draft`. |
| `event_registrations` | Unique `(event_id, user_id)`. Check de `waitlist_position` según estado. |

**Divergencia `event_statuses`:** el SQL local declara columnas `name` e `is_active`. El HTTP implementado selecciona `code`, `label`, `description` y ordena por `label`. Los textos seed de labels/descriptions pueden diferir entre SQL, tests y contrato; **el API devuelve la tabla**. Remoto no verificado.

**Sin SQL de `exercises`.** Esa tabla se lee con el cliente publishable.

**RLS:** `schemas/activate_rls.sql` hace `ENABLE ROW LEVEL SECURITY` en las tablas de negocio. Policies versionadas en este repo cubren **solo** `event_registrations` (select own / select admin; mutaciones vía RPC). No afirmar policies remotas del resto ni GRANT de catálogo a `anon`/`authenticated`.

**Waitlist unique:** índice parcial `event_waitlist_position_unique_idx` en `schemas/indexes.sql` (`(event_id, waitlist_position) WHERE status_code = 'waitlisted'`). No es constraint del `CREATE TABLE`.

Los tests de esta API usan mocks Jest: **no** demuestran RLS ni el schema remoto.

---

## 11. Errores que el frontend debe conocer (índice)

Auth: `AUTH_USER_REQUIRED`, `AUTH_INVALID_TOKEN`, `AUTH_INSUFFICIENT_PERMISSIONS`, `admin_required` (RPC).

Validación: `VALIDATION_FAILED`.

Eventos: `event_not_found`, `event_category_not_found`, `event_category_inactive`, `event_status_not_found`, `invalid_event_dates`.

Categorías: `ENTITY_NOT_FOUND`, `event_category_name_already_exists`.

Inscripciones: ver contrato existente (`event_not_open`, deadline, `registration_already_exists`, waitlist conflict, `event_capacity_full` solo PATCH admin, etc.).

---

## 12. Mantenimiento

Actualizar este archivo **en el mismo cambio** que altere montaje de rutas, auth, envelopes, CORS, env o el modelo local documentado. Los contratos de recurso se actualizan con su código.
