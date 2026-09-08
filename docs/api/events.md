> Este documento es el contrato de integración entre backend y frontend.
> Debe actualizarse en el mismo cambio que modifique rutas, payloads,
> respuestas, validaciones, códigos de error o reglas de negocio.

# Eventos — Contrato de API

Documento de integración para listar, consultar y administrar `public.events` **sin leer el backend**. Las rutas no tienen prefijo `/api`: el servidor Express monta los routers en `/` (por ejemplo `GET /events`).

Las inscripciones (`/events/:eventId/registrations` y `/admin/events/:eventId/registrations`) no se documentan aquí: ver [Inscripciones](./event-registrations.md). Los códigos de estado de evento (`draft`, `open`, `closed`, `cancelled`, `completed`) se consultan en [Estados de evento](./event-statuses.md).

**No existe** `GET /admin/events/:id`. El detalle público es `GET /events/:id`. Las mutaciones viven en `/events` (no bajo `/admin`), salvo el listado administrativo `GET /admin/events`.

---

## 1. Objetivo funcional

Un **evento** es una fila de `events`. El frontend lo usa para catálogo público y ABM de administrador.

Visibilidad pública (`GET /events` y `GET /events/:id`): solo `status_code` en `open`, `closed` o `completed`. Un evento `draft` o `cancelled` no aparece en el listado público; el detalle público responde `404` / `event_not_found` (no se distingue “no existe” de “no es público”).

Si el listado público se filtra con `status_code=draft` o `status_code=cancelled`, la API responde `200` con `data: []` y `pagination.total: 0` (no es un error).

El listado público **no** expone ocupados (`confirmed_count` / `waitlisted_count`) ni `created_by`. Los conteos de cupo están en `meta` del listado admin de inscripciones (contrato de inscripciones).

Soft-delete: `DELETE /events/:id` pone `status_code` en `cancelled`. No borra la fila.

---

## 2. Autenticación

| Ruta | Acceso |
| ---- | ------ |
| `GET /events` | Público. Sin `Authorization`. |
| `GET /events/:id` | Público. Sin `Authorization`. |
| `POST /events` | Admin. `Authorization: Bearer <supabase_access_token>`. |
| `PATCH /events/:id` | Admin. Bearer. |
| `DELETE /events/:id` | Admin. Bearer. |
| `GET /admin/events` | Admin. Bearer. |

El login **no** vive en este Express. El backend valida el token con `supabase.auth.getUser`. Rol `admin` = `profiles.role === 'admin'` (`requireAdmin`).

Si no hay perfil o el rol no es `admin`, las rutas admin responden `403` / `AUTH_INSUFFICIENT_PERMISSIONS` (no `404` / `profile_not_found`). `profile_not_found` aplica a inscripciones de usuario, no a este recurso.

| Situación | HTTP | `errorCode` | `description` |
| --------- | ---: | ----------- | ------------- |
| Header ausente, vacío o no `Bearer` | 401 | `AUTH_USER_REQUIRED` | `Authentication required` |
| Token inválido o vencido | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired access token` |
| Autenticado sin perfil admin (o sin perfil) | 403 | `AUTH_INSUFFICIENT_PERMISSIONS` | `Administrator role required` |

---

## 3. Modelo de datos expuesto al frontend

### Envelope de éxito

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": {}
}
```

`statusCode` es `201` en el alta. `pagination` solo aparece en `GET /events` y `GET /admin/events`. `DELETE` exitoso es `204` **sin cuerpo**.

### Campos públicos (`GET /events`, `GET /events/:id`)

```json
{
  "id": 1,
  "category_id": 2,
  "title": "Encuentro del viernes",
  "starts_at": "2026-09-04T21:00:00.000Z",
  "registration_deadline": "2026-09-04T18:00:00.000Z",
  "capacity": 16,
  "status_code": "open",
  "category": {
    "id": 2,
    "name": "Encuentro abierto",
    "image_url": "https://example.com/category.jpg"
  }
}
```

| Campo | Tipo | Descripción |
| ----- | ---- | ----------- |
| `id` | number | Identidad (`bigint`). |
| `category_id` | number | FK a `event_categories`. |
| `title` | string | Título. |
| `starts_at` | string (ISO 8601) | Inicio del evento. |
| `registration_deadline` | string (ISO 8601) \| null | Límite de inscripción; `null` = sin fecha límite. |
| `capacity` | number | Cupo de confirmados (`> 0`). No es ocupados. |
| `status_code` | string | Estado; ver catálogo HTTP de estados. |
| `category` | object | Embed `{ id, name, image_url }`. **Sin** `description` ni `is_active`. |

No viajan: `created_by`, `created_at`, `updated_at`, ocupados.

### Campos admin (`GET /admin/events`, `POST /events`, `PATCH /events/:id`)

Los públicos más:

| Campo | Tipo | Descripción |
| ----- | ---- | ----------- |
| `created_by` | string (uuid) | `profiles.id` del admin que creó. Lo setea el backend; el body no puede enviarlo. |
| `created_at` | string (ISO 8601) | Alta. |
| `updated_at` | string (ISO 8601) | Última modificación. |

El embed `category` es el mismo `{ id, name, image_url }`.

---

## 4. Query de listado (`GET /events` y `GET /admin/events`)

Schema Zod `strict()`. Cualquier clave extra → `400` / `VALIDATION_FAILED`.

| Query | Tipo | Default | Notas |
| ----- | ---- | ------- | ----- |
| `category_id` | entero positivo | — | Filtro exacto. |
| `status_code` | string no vacío | — | Filtro exacto. En público, `draft` o `cancelled` → lista vacía `200`. |
| `starts_from` | ISO datetime | — | `starts_at >= starts_from`. |
| `starts_to` | ISO datetime | — | `starts_at <= starts_to`. |
| `page` | entero `>= 1` | `1` | |
| `limit` | entero `1..100` | `20` | |

`starts_from` y `starts_to` juntos exigen `starts_from <= starts_to`; si no → `VALIDATION_FAILED` (`starts_from must be before or equal to starts_to`).

Formato datetime aceptado: `YYYY-MM-DDTHH:mm:ss` con fracción opcional y `Z` u offset `±HH:mm` (por ejemplo `2026-09-04T21:00:00.000Z`).

Orden: `starts_at` ascendente. `pagination`: `{ page, limit, total, total_pages }`.

`:id` en path debe ser entero positivo (`/^\d+$/` y `> 0`). Si no: `400` / `VALIDATION_FAILED` (`id must be a positive integer`).

---

## 5. Endpoints públicos

### 5.1 `GET /events`

Lista eventos visibles (`open` / `closed` / `completed`), con paginación.

**Acceso:** público.

**Éxito:** `200`. `data` es un array de eventos públicos. Lista vacía también es `200`.

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": [
    {
      "id": 1,
      "category_id": 2,
      "title": "Encuentro del viernes",
      "starts_at": "2026-09-04T21:00:00.000Z",
      "registration_deadline": "2026-09-04T18:00:00.000Z",
      "capacity": 16,
      "status_code": "open",
      "category": {
        "id": 2,
        "name": "Encuentro abierto",
        "image_url": "https://example.com/category.jpg"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

### 5.2 `GET /events/:id`

Detalle público.

**Acceso:** público.

**Éxito:** `200`. `data` = un evento público (sin `created_by`).

Inexistente, `draft` o `cancelled` → `404` / `event_not_found`.

```http
GET /events/1
```

---

## 6. Endpoints de administración

Mutaciones en `/events`. Única ruta `/admin/...` de este recurso: el listado.

### 6.1 `GET /admin/events`

Misma query que el listado público, **sin** filtro de visibilidad: incluye `draft` y `cancelled`. Campos admin (`created_by`, `created_at`, `updated_at`).

**Acceso:** admin.

**Éxito:** `200` + `pagination`.

### 6.2 `POST /events`

Crea un evento.

| | |
| --- | --- |
| Autenticación | Admin. |
| Body permitido | `category_id`, `title`, `starts_at`, `capacity`; opcionales: `registration_deadline`, `status_code`. `strict()`. |
| Éxito | `201`. `data` = evento con campos admin. |

Reglas:

- `status_code` omitido → el backend guarda `draft`.
- `created_by` lo pone el backend (`profiles.id` del admin). Enviarlo (u otra clave extra) → `VALIDATION_FAILED`.
- `registration_deadline` omitido → `null`.
- Categoría inexistente → `404` / `event_category_not_found` (no `ENTITY_NOT_FOUND`).
- Categoría inactiva → `409` / `event_category_inactive`.
- `status_code` que no existe en `event_statuses` → `404` / `event_status_not_found`.
- `registration_deadline > starts_at` → `400` / `invalid_event_dates`.

**Request**

```http
POST /events
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{
  "category_id": 2,
  "title": "Encuentro del viernes",
  "starts_at": "2026-09-04T21:00:00.000Z",
  "registration_deadline": "2026-09-04T18:00:00.000Z",
  "capacity": 16
}
```

**Response `201`**

```json
{
  "status": "success",
  "statusCode": 201,
  "description": "OK",
  "data": {
    "id": 1,
    "category_id": 2,
    "title": "Encuentro del viernes",
    "starts_at": "2026-09-04T21:00:00.000Z",
    "registration_deadline": "2026-09-04T18:00:00.000Z",
    "capacity": 16,
    "status_code": "draft",
    "created_by": "11111111-1111-4111-8111-111111111111",
    "created_at": "2026-09-01T12:00:00.000Z",
    "updated_at": "2026-09-01T12:00:00.000Z",
    "category": {
      "id": 2,
      "name": "Encuentro abierto",
      "image_url": "https://example.com/category.jpg"
    }
  }
}
```

### 6.3 `PATCH /events/:id`

Actualización parcial. Body no vacío. Al menos un campo permitido. `strict()`.

Campos permitidos (todos opcionales): `category_id`, `title`, `starts_at`, `registration_deadline` (ISO o `null`), `capacity`, `status_code`.

No editables vía body: `id`, `created_by`, `created_at`, `updated_at` (el backend actualiza `updated_at`).

**Éxito:** `200`. `data` = evento admin.

Inexistente → `404` / `event_not_found`. Cambio de categoría: mismas reglas `event_category_not_found` / `event_category_inactive`. Cambio de estado inexistente → `event_status_not_found`. Fechas resultantes inválidas → `invalid_event_dates`.

Un admin puede editar un `draft` o `cancelled` si conoce el `id` (por el listado admin, el alta o un PATCH previo). No hay GET admin por id.

```http
PATCH /events/1
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{ "status_code": "open" }
```

### 6.4 `DELETE /events/:id`

Soft-delete: `status_code = cancelled`.

| | |
| --- | --- |
| Autenticación | Admin. |
| Body | No. |
| Éxito | `204` vacío. Sin envelope. |
| Ya `cancelled` | `204` (idempotente; no vuelve a escribir). |
| No existe | `404` / `event_not_found`. |

```http
DELETE /events/1
Authorization: Bearer <supabase_access_token>
```

```http
HTTP/1.1 204 No Content
```

---

## 7. Códigos de error

Envelope de error:

```json
{
  "status": "error",
  "statusCode": 404,
  "description": "Event not found",
  "errorCode": "event_not_found",
  "data": null
}
```

| `errorCode` | HTTP | Significado |
| ----------- | ---: | ----------- |
| `AUTH_USER_REQUIRED` | 401 | Sin Bearer. |
| `AUTH_INVALID_TOKEN` | 401 | Token inválido o vencido. |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | No admin (middleware). |
| `VALIDATION_FAILED` | 400 | Zod `strict`: query/body/params. `data` es `{ path, message }[]`. |
| `event_not_found` | 404 | No existe, o detalle público de `draft`/`cancelled`. |
| `event_category_not_found` | 404 | `category_id` inexistente al crear/cambiar evento. **No** es `ENTITY_NOT_FOUND` (ese código es de `GET/PATCH/DELETE` de categorías). |
| `event_category_inactive` | 409 | La categoría existe pero `is_active = false`. |
| `event_status_not_found` | 404 | `status_code` no está en `event_statuses`. |
| `invalid_event_dates` | 400 | `registration_deadline` posterior a `starts_at`. |
| `UNEXPECTED_ERROR` | 500 | Error no mapeado. |

Validación (`data` no es `null`):

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

Mensajes Zod frecuentes: `id must be a positive integer`, `must be a valid ISO datetime`, `Request body must not be empty`, `starts_from must be before or equal to starts_to`, `Unrecognized key: "..."`.

El RPC de inscripciones puede emitir `admin_required` (HTTP 403, `errorCode` `admin_required`) como defensa; en las rutas HTTP de este recurso el middleware responde `AUTH_INSUFFICIENT_PERMISSIONS`.

---

## 8. Reglas de integración

- Vocabulario de este API: **evento**.
- No calcular ocupados desde `capacity` de `GET /events`.
- Para editar un borrador: `GET /admin/events?status_code=draft` (o el `id` del `POST`); no hay `GET /admin/events/:id`.
- Tras `DELETE` 204, el evento deja de listarse en público y el detalle público pasa a `404` / `event_not_found`.
- Distinguir `event_category_not_found` (eventos) de `ENTITY_NOT_FOUND` (categorías).
- Inscripciones y cupo/waitlist: [event-registrations.md](./event-registrations.md).

---

## 9. Mantenimiento del contrato

Este archivo es el contrato de integración. Actualizarlo **en el mismo cambio** si se modifica cualquiera de:

- Rutas o métodos HTTP de eventos (incluido `GET /admin/events`).
- Payloads, query params, campos públicos vs admin, embed `category`.
- Validaciones Zod.
- `errorCode`, HTTP status o reglas de visibilidad / soft-delete.

No documentar comportamiento supuesto. Si el código y este archivo discrepan, manda la implementación y este archivo debe corregirse en ese mismo cambio.
