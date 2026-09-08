> Este documento es el contrato de integración entre backend y frontend.
> Debe actualizarse en el mismo cambio que modifique rutas, payloads,
> respuestas, validaciones, códigos de error o reglas de negocio.

# Categorías de eventos — Contrato de API

Documento de integración para consultar y administrar `public.event_categories` **sin leer el backend**. Las rutas no tienen prefijo `/api`: el servidor Express monta los routers en `/` (por ejemplo `GET /event-categories`).

Las mutaciones viven en `/event-categories` (no bajo `/admin`). **No hay** listado admin de categorías inactivas: `GET /event-categories` solo devuelve `is_active = true`.

`ENTITY_NOT_FOUND` es el 404 de **este** recurso (categoría inactiva o inexistente). No confundir con `event_category_not_found`, que usa el ABM de **eventos** cuando el `category_id` no existe.

---

## 1. Objetivo funcional

Una **categoría** agrupa eventos (`events.category_id`). El frontend la usa para filtros y para el ABM admin.

Listado público: solo activas, **sin paginación**, orden `name` ascendente. Tabla vacía → `200` con `data: []` (nunca `404`).

`GET /event-categories/:id` exige categoría **activa**. Inactiva o inexistente → `404` / `ENTITY_NOT_FOUND`.

Soft-delete: `DELETE` pone `is_active = false`. El unique de `name` **sobrevive** al soft-delete: no se puede crear otra categoría con el mismo nombre mientras la fila inactiva conserve ese `name` → `409` / `event_category_name_already_exists`.

Un admin que conoce el `id` puede reactivar con `PATCH` `{ "is_active": true }`. No hay GET de inactivas.

---

## 2. Autenticación

| Ruta | Acceso |
| ---- | ------ |
| `GET /event-categories` | Público. Sin `Authorization`. |
| `GET /event-categories/:id` | Público. Sin `Authorization`. Solo activa. |
| `POST /event-categories` | Admin. `Authorization: Bearer <supabase_access_token>`. |
| `PATCH /event-categories/:id` | Admin. Bearer. |
| `DELETE /event-categories/:id` | Admin. Bearer. |

Login **no** vive en este Express. Validación: `getUser` + `profiles.role === 'admin'`. Sin perfil o rol no admin → `403` / `AUTH_INSUFFICIENT_PERMISSIONS` (no `profile_not_found`).

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

`statusCode` es `201` en el alta. El listado **no** incluye `pagination`. `DELETE` exitoso es `204` **sin cuerpo**.

### Categoría (listado, detalle y mutaciones)

```json
{
  "id": 2,
  "name": "Encuentro abierto",
  "description": "Encuentros abiertos a inscripción.",
  "image_url": "https://example.com/category.jpg",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

| Campo | Tipo | Descripción |
| ----- | ---- | ----------- |
| `id` | number | Identidad (`bigint`). |
| `name` | string | Nombre único (constraint `event_categories_name_unique`). |
| `description` | string \| null | Texto opcional. |
| `image_url` | string \| null | URL absoluta, o `null`. |
| `is_active` | boolean | Soft-delete = `false`. El listado GET solo trae `true`. |
| `created_at` | string (ISO 8601) | Alta. |
| `updated_at` | string (ISO 8601) | Última modificación. |

El embed `category` dentro de un **evento** es más chico (`id`, `name`, `image_url` solamente). Ver [Eventos](./events.md).

`:id` debe ser entero positivo. Si no: `400` / `VALIDATION_FAILED` (`id must be a positive integer`).

---

## 4. Endpoints públicos

### 4.1 `GET /event-categories`

Lista categorías activas. Sin query schema: no hay filtros ni paginación.

**Acceso:** público.

**Éxito:** `200`. `data` es un array. Orden `name` asc.

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": [
    {
      "id": 2,
      "name": "Encuentro abierto",
      "description": "Encuentros abiertos a inscripción.",
      "image_url": "https://example.com/category.jpg",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### 4.2 `GET /event-categories/:id`

Detalle de una categoría **activa**.

**Acceso:** público.

**Éxito:** `200`. `data` = la categoría.

Inactiva o inexistente → `404` / `ENTITY_NOT_FOUND`.

```http
GET /event-categories/2
```

---

## 5. Endpoints de administración

### 5.1 `POST /event-categories`

| | |
| --- | --- |
| Autenticación | Admin. |
| Body permitido | `name` (requerido, trim, no vacío); opcionales: `description` (string o `null`), `image_url` (URL, `null`, o string vacío → `null`). `strict()`. |
| Éxito | `201`. `data` = categoría creada (`is_active` default `true` en base). |

No enviar `id`, `is_active`, `created_at`, `updated_at`.

Nombre duplicado (incluida una inactiva que conserve el nombre) → `409` / `event_category_name_already_exists`.

**Request**

```http
POST /event-categories
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{
  "name": "Encuentro abierto",
  "description": "Encuentros abiertos a inscripción.",
  "image_url": "https://example.com/category.jpg"
}
```

### 5.2 `PATCH /event-categories/:id`

Body no vacío. `strict()`. Campos opcionales: `name`, `description` (string o `null`), `image_url`, `is_active` (boolean).

**Éxito:** `200`. `data` = categoría actualizada.

Inexistente → `404` / `ENTITY_NOT_FOUND`. El PATCH **sí** encuentra filas inactivas (a diferencia del GET público): sirve para reactivar.

Nombre duplicado → `409` / `event_category_name_already_exists`.

```http
PATCH /event-categories/2
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{ "is_active": true }
```

### 5.3 `DELETE /event-categories/:id`

Soft-delete: `is_active = false`.

| | |
| --- | --- |
| Autenticación | Admin. |
| Body | No. |
| Éxito | `204` vacío. Sin envelope. |
| Ya inactiva | `204` (idempotente). |
| No existe | `404` / `ENTITY_NOT_FOUND`. |

Tras el `204`, `GET /event-categories/:id` pasa a `404` / `ENTITY_NOT_FOUND` y deja de aparecer en el listado.

```http
DELETE /event-categories/2
Authorization: Bearer <supabase_access_token>
```

```http
HTTP/1.1 204 No Content
```

---

## 6. Códigos de error

```json
{
  "status": "error",
  "statusCode": 404,
  "description": "Event category not found",
  "errorCode": "ENTITY_NOT_FOUND",
  "data": null
}
```

| `errorCode` | HTTP | Significado |
| ----------- | ---: | ----------- |
| `AUTH_USER_REQUIRED` | 401 | Sin Bearer. |
| `AUTH_INVALID_TOKEN` | 401 | Token inválido o vencido. |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | No admin. |
| `VALIDATION_FAILED` | 400 | Zod `strict`: params/body. `data` es `{ path, message }[]`. |
| `ENTITY_NOT_FOUND` | 404 | Categoría inexistente, o GET de inactiva. |
| `event_category_name_already_exists` | 409 | Unique `name` (también si una inactiva conserva el nombre). |
| `UNEXPECTED_ERROR` | 500 | Error no mapeado. |

`event_category_not_found` y `event_category_inactive` **no** salen de este módulo: salen del ABM de eventos. Ver [Eventos](./events.md).

Validación:

```json
{
  "status": "error",
  "statusCode": 400,
  "description": "Validation failed",
  "errorCode": "VALIDATION_FAILED",
  "data": [
    { "path": "name", "message": "name is required" }
  ]
}
```

Mensajes Zod frecuentes: `id must be a positive integer`, `name is required`, `image_url must be a valid URL`, `Request body must not be empty`, `Unrecognized key: "..."`.

---

## 7. Mantenimiento del contrato

Este archivo es el contrato de integración. Actualizarlo **en el mismo cambio** si se modifica cualquiera de:

- Rutas o métodos HTTP de categorías.
- Payloads, campos, unique de nombre o soft-delete.
- Validaciones Zod.
- `errorCode` o HTTP status.

No documentar comportamiento supuesto. Si el código y este archivo discrepan, manda la implementación y este archivo debe corregirse en ese mismo cambio.
