> Este documento es el contrato de integración entre backend y frontend.
> Debe actualizarse en el mismo cambio que modifique rutas, payloads,
> respuestas, validaciones, códigos de error o reglas de negocio.

# Inscripciones a eventos — Contrato de API

Documento de integración para implementar el frontend de inscripciones **sin leer el backend**. Las rutas no tienen prefijo `/api`: el servidor Express monta los routers en `/` (por ejemplo `POST /events/:eventId/registrations`).

---

## 1. Objetivo funcional

Una **inscripción** (`event_registrations`) vincula a un usuario autenticado (`profiles.id`) con un evento (`events.id`). El usuario queda en uno de dos estados operativos:

| `status_code` | Significado |
| ------------- | ----------- |
| `confirmed` | Tiene un lugar confirmado. `waitlist_position` es siempre `null`. |
| `waitlisted` | Está en lista de espera. `waitlist_position` es un entero `>= 1` (1 = primero). |

El catálogo SQL también incluye `cancelled` (“Cancelada”). **Ningún endpoint de escritura lo asigna.** La baja es un `DELETE` físico de la fila, no un cambio a `cancelled`. Un `PATCH` admin con `status_code: "cancelled"` se rechaza en validación.

### Qué puede hacer un usuario autenticado

- Inscribirse a un evento (`POST`).
- Consultar **su** inscripción en ese evento (`GET .../me`).
- Darse de baja (`DELETE .../me`).

No puede listar inscripciones ajenas, ni enviar `user_id` para inscribirse a nombre de otro.

### Qué puede hacer un administrador (`profiles.role = admin`)

- Listar las inscripciones de un evento, con perfil, paginación y cupos.
- Ver una inscripción por id.
- Inscribir a otra persona enviando su `user_id`.
- Cambiar `status_code` y/o `waitlist_position`.
- Eliminar cualquier inscripción.

### Alta solo si el evento está `open`

`register_for_event` y `admin_register_for_event` (y el `PATCH` admin) exigen `events.status_code = 'open'`. Cualquier otro estado de evento (`draft`, `closed`, `cancelled`, `completed`) produce `409` / `event_not_open`.

Si `registration_deadline` no es `null` y `registration_deadline <= now()`, el alta (y el `PATCH` admin) se rechaza con `409` / `registration_deadline_expired`. `null` significa “sin fecha límite”.

La **baja** (usuario o admin) **no** exige evento `open` ni deadline vigente.

### Cómo se aplica la capacidad

En el alta (usuario o admin) el RPC cuenta filas `confirmed` del evento, con lock `FOR UPDATE` sobre el evento:

- Si `confirmed_count < events.capacity` → crea `confirmed` con `waitlist_position: null`.
- Si no hay cupo → crea `waitlisted` con `waitlist_position = max(posición existente) + 1` (o `1` si la lista está vacía).

Un usuario **nunca** recibe `event_capacity_full` al anotarse: si no hay lugar, entra a lista de espera. `event_capacity_full` solo aparece cuando un **admin** intenta pasar una inscripción a `confirmed` y ya no hay cupo.

`GET /events` y `GET /events/:id` exponen `capacity`, pero **no** los ocupados. Los conteos `confirmed_count` y `waitlisted_count` solo vienen en `meta` de `GET /admin/events/:eventId/registrations`.

### Promoción desde lista de espera

Cuando se elimina una inscripción `confirmed` (`DELETE .../me` o `DELETE` admin):

1. Se promueve al primer `waitlisted` del evento (`ORDER BY waitlist_position ASC, id ASC`).
2. Ese registro pasa a `confirmed` y `waitlist_position = null`.
3. Se recompacta la lista restante a `1..n`.

Si la baja era `waitlisted`, no hay promoción: solo se recompacta. Un `PATCH` admin que **degrada** `confirmed` → `waitlisted` **no** promueve a otra persona.

La respuesta de la baja es la fila **eliminada**. **No** incluye al promovido.

---

## 2. Autenticación

El frontend debe enviar el access token de la sesión de Supabase:

```http
Authorization: Bearer <supabase_access_token>
```

Reglas:

- El usuario tiene que haber iniciado sesión con Google / Supabase **antes** de llamar endpoints protegidos. El backend valida el token con `supabase.auth.getUser(token)`.
- El `user_id` de la inscripción propia lo obtiene el backend desde el token (`auth.uid()` en el RPC; `req.authUser.id` en `GET .../me`).
- El frontend **nunca** debe enviar `user_id` al `POST /events/:eventId/registrations`. Un body con `user_id` (u otro campo) se rechaza con `400` / `VALIDATION_FAILED`.
- Las rutas de usuario también exigen que exista fila en `profiles` (`loadProfile`). Sin perfil: `404` / `profile_not_found`.

### Si no hay sesión, el token venció o faltan permisos

| Situación | HTTP | `errorCode` | `description` |
| --------- | ---: | ----------- | ------------- |
| Header ausente, vacío o no `Bearer` | 401 | `AUTH_USER_REQUIRED` | `Authentication required` |
| Token inválido o vencido | 401 | `AUTH_INVALID_TOKEN` | `Invalid or expired access token` |
| Usuario autenticado sin fila en `profiles` (rutas de usuario) | 404 | `profile_not_found` | `Profile not found` |
| Usuario con `role !== admin` en ruta `/admin/...` | 403 | `AUTH_INSUFFICIENT_PERMISSIONS` | `Administrator role required` |

El RPC puede emitir el token SQL `authentication_required` (se mapea a `AUTH_USER_REQUIRED`) o `admin_required` (el `errorCode` HTTP sigue siendo `admin_required`, HTTP 403). En la API HTTP el caso habitual de “no admin” lo corta el middleware y responde `AUTH_INSUFFICIENT_PERMISSIONS`, no `admin_required`.

Envelope de error (todas las respuestas de error):

```json
{
  "status": "error",
  "statusCode": 401,
  "description": "Authentication required",
  "errorCode": "AUTH_USER_REQUIRED",
  "data": null
}
```

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

`statusCode` es `201` en altas (`POST` usuario y `POST` admin). `pagination` y `meta` solo aparecen en el listado admin.

### Inscripción (usuario y mutaciones admin)

Campos reales que devuelven `POST`/`GET .../me`/`DELETE .../me` y `POST`/`PATCH`/`DELETE` admin:

```json
{
  "id": 15,
  "event_id": 4,
  "user_id": "11111111-1111-4111-8111-111111111111",
  "status_code": "confirmed",
  "waitlist_position": null,
  "created_at": "2026-09-04T18:00:00.000Z",
  "updated_at": "2026-09-04T18:00:00.000Z"
}
```

| Campo | Tipo | Descripción |
| ----- | ---- | ----------- |
| `id` | number | Identidad de la inscripción (`bigint`). |
| `event_id` | number | Evento. |
| `user_id` | string (uuid) | Dueño. En altas propias lo setea el backend. |
| `status_code` | string | Estado de la inscripción. |
| `waitlist_position` | number \| null | Posición en espera; solo existe (entero `> 0`) si el estado es `waitlisted`. En `confirmed` es `null`. |
| `created_at` | string (ISO 8601) | Alta. |
| `updated_at` | string (ISO 8601) | Última modificación. |

### Lecturas admin (listado y detalle)

Además de los campos anteriores, `GET /admin/events/:eventId/registrations` y `GET /admin/event-registrations/:registrationId` embeden el perfil:

```json
{
  "id": 12,
  "event_id": 4,
  "user_id": "11111111-1111-4111-8111-111111111111",
  "status_code": "confirmed",
  "waitlist_position": null,
  "created_at": "2026-09-04T18:00:00.000Z",
  "updated_at": "2026-09-04T18:00:00.000Z",
  "profile": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Ana Gomez",
    "avatar_url": null,
    "role": "user"
  }
}
```

| Campo de `profile` | Tipo | Descripción |
| ------------------ | ---- | ----------- |
| `id` | string (uuid) | Igual a `user_id`. |
| `name` | string | Nombre en `profiles`. |
| `avatar_url` | string \| null | Avatar. |
| `role` | string | `user` o `admin`. |

Las mutaciones admin **no** devuelven `profile`.

### Estados reales en `registration_statuses`

| `code` | `name` | Uso actual en la API |
| ------ | ------ | -------------------- |
| `confirmed` | Confirmada | Alta con cupo; promoción desde espera; `PATCH` admin. |
| `waitlisted` | En lista de espera | Alta sin cupo; `PATCH` admin. |
| `cancelled` | Cancelada | Solo catálogo. No escribible. El filtro admin `status_code` acepta cualquier string, así que se puede consultar, pero los writes no lo generan. |

No existen otros estados.

---

## 4. Endpoints para usuario autenticado

Middleware común: `authenticate` + `loadProfile` + validación Zod.

`:eventId` debe ser un entero positivo (`/^\d+$/` y `> 0`). Si no: `400` / `VALIDATION_FAILED`.

Errores de auth/perfil comunes a los tres: `AUTH_USER_REQUIRED`, `AUTH_INVALID_TOKEN`, `profile_not_found`.

### 4.1 `POST /events/:eventId/registrations`

Inscribe al usuario del token.

| | |
| --- | --- |
| Método / URL | `POST /events/:eventId/registrations` |
| Autenticación | Sí. Rol `user` o `admin`. |
| Body | Vacío: enviar `{}`. Schema `strict()`: cualquier clave extra (incluido `user_id`) → `400` / `VALIDATION_FAILED` (`Unrecognized key: "user_id"`). |
| Parámetros | `eventId` (path, entero positivo). |
| Éxito | `201`. `data` = inscripción creada. |

Comportamiento:

- Con cupo → `status_code: "confirmed"`, `waitlist_position: null`.
- Sin cupo → `status_code: "waitlisted"` y la siguiente posición.
- Evento no `open` → `409` / `event_not_open`.
- Deadline vencida (`<= now()`) → `409` / `registration_deadline_expired`.
- Ya inscripto (único `(event_id, user_id)`) → `409` / `registration_already_exists`. **No es idempotente.**
- Evento inexistente → `404` / `event_not_found`.

Errores de negocio: `event_not_found`, `event_not_open`, `registration_deadline_expired`, `registration_already_exists`, `VALIDATION_FAILED`.

**Request**

```http
POST /events/4/registrations
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{}
```

**Response `201` (con cupo)**

```json
{
  "status": "success",
  "statusCode": 201,
  "description": "OK",
  "data": {
    "id": 12,
    "event_id": 4,
    "user_id": "11111111-1111-4111-8111-111111111111",
    "status_code": "confirmed",
    "waitlist_position": null,
    "created_at": "2026-09-04T18:00:00.000Z",
    "updated_at": "2026-09-04T18:00:00.000Z"
  }
}
```

**Frontend:** deshabilitar el botón mientras la request está en vuelo. Si `data.status_code === "confirmed"`, mostrar “Inscripto”. Si `waitlisted`, mostrar la posición. Si `409` / `registration_already_exists`, llamar `GET .../me` y pintar el estado real; no reenviar el `POST` como si hubiera creado otra fila.

### 4.2 `GET /events/:eventId/registrations/me`

Devuelve solo la inscripción del usuario del token. Query `user_id` (u otra) se ignora.

| | |
| --- | --- |
| Método / URL | `GET /events/:eventId/registrations/me` |
| Autenticación | Sí. |
| Body | No. |
| Parámetros | `eventId` (path). |
| Éxito | `200`. `data` = inscripción propia (sin `profile`). |

- Evento inexistente → `404` / `event_not_found` (el service verifica el evento antes de leer la fila).
- Evento existe pero el usuario no está inscripto → `404` / `registration_not_found`.

**Request**

```http
GET /events/4/registrations/me
Authorization: Bearer <supabase_access_token>
```

**Response `200`**

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": {
    "id": 12,
    "event_id": 4,
    "user_id": "11111111-1111-4111-8111-111111111111",
    "status_code": "confirmed",
    "waitlist_position": null,
    "created_at": "2026-09-04T18:00:00.000Z",
    "updated_at": "2026-09-04T18:00:00.000Z"
  }
}
```

**Frontend:** usar este endpoint para hidratar el botón (Anotarme / Inscripto / En espera). `404` / `registration_not_found` = no inscripto. No usar `404` / `event_not_found` como “no inscripto”.

### 4.3 `DELETE /events/:eventId/registrations/me`

Da de baja al usuario del token.

| | |
| --- | --- |
| Método / URL | `DELETE /events/:eventId/registrations/me` |
| Autenticación | Sí. |
| Body | No. |
| Parámetros | `eventId` (path). |
| Éxito | `200`. `data` = **la fila eliminada** (misma forma que el alta). No es `204` ni `data: null`. |

No exige evento `open` ni deadline. Evento inexistente → `404` / `event_not_found`. Si no había inscripción → `404` / `registration_not_found`. Si la fila era `confirmed`, el backend promueve al primero de la espera; esa promoción **no** viaja en la respuesta.

**Request**

```http
DELETE /events/4/registrations/me
Authorization: Bearer <supabase_access_token>
```

**Response `200`**

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": {
    "id": 12,
    "event_id": 4,
    "user_id": "11111111-1111-4111-8111-111111111111",
    "status_code": "confirmed",
    "waitlist_position": null,
    "created_at": "2026-09-04T18:00:00.000Z",
    "updated_at": "2026-09-04T18:00:00.000Z"
  }
}
```

**Frontend:** tras `200`, mostrar “Anotarme” y refrescar evento + `GET .../me` (debe pasar a `404`). No inferir quién fue promovido a partir de `data`.

---

## 5. Endpoints de administración

Todas las rutas `/admin/...` de este módulo usan `authenticate` + `requireAdmin`. El caller debe tener `profiles.role = 'admin'`.

Usuario común → `403` / `AUTH_INSUFFICIENT_PERMISSIONS`. Sin token o token inválido → mismos `401` que en la sección 2.

### 5.1 `GET /admin/events/:eventId/registrations`

Lista inscripciones del evento, ordenadas por `created_at` ascendente.

| | |
| --- | --- |
| Autenticación | Sí, rol `admin`. |
| Query | Ver tabla. Schema `strict()`: query extra → `VALIDATION_FAILED`. |
| Éxito | `200` con `data` (array con `profile`), `pagination` y `meta`. |

| Query | Tipo | Default | Notas |
| ----- | ---- | ------- | ----- |
| `status_code` | string | — | Filtro exacto. No está enumerado en Zod (puede ser `confirmed`, `waitlisted` o `cancelled`). |
| `search` | string | — | `ILIKE` sobre `profiles.name`. Vacío se ignora. |
| `page` | integer `>= 1` | `1` | |
| `limit` | integer `1..100` | `20` | |

Evento inexistente → `404` / `event_not_found`.

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": [
    {
      "id": 12,
      "event_id": 4,
      "user_id": "11111111-1111-4111-8111-111111111111",
      "status_code": "confirmed",
      "waitlist_position": null,
      "created_at": "2026-09-04T18:00:00.000Z",
      "updated_at": "2026-09-04T18:00:00.000Z",
      "profile": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Ana Gomez",
        "avatar_url": null,
        "role": "user"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  },
  "meta": {
    "capacity": 16,
    "confirmed_count": 1,
    "waitlisted_count": 1
  }
}
```

`meta.capacity` sale del evento; los conteos se calculan en el momento (todas las filas `confirmed` / `waitlisted` del evento, no solo la página).

### 5.2 `GET /admin/event-registrations/:registrationId`

| | |
| --- | --- |
| Autenticación | Sí, rol `admin`. |
| Parámetros | `registrationId` entero positivo. |
| Éxito | `200`. `data` = inscripción + `profile`. |
| No existe | `404` / `registration_not_found`. |

### 5.3 `POST /admin/events/:eventId/registrations`

Inscribe a **otra** persona. Usa el mismo RPC de cupo/`open`/deadline que el alta de usuario (`admin_register_for_event` → `register_user_for_event`).

| | |
| --- | --- |
| Autenticación | Sí, rol `admin`. |
| Body permitido | `{ "user_id": "<uuid>" }` únicamente (`strict()`). |
| Éxito | `201`. `data` = inscripción creada **sin** `profile`. |

Campos que el frontend **no** puede enviar: `status_code`, `waitlist_position`, `id`, `event_id`, `created_at`, `updated_at`. El cupo lo decide el backend (confirmado o espera).

Errores: mismos de alta de usuario (`event_not_found`, `event_not_open`, `registration_deadline_expired`, `registration_already_exists`) más `profile_not_found` si el `user_id` no existe en `profiles`, y `VALIDATION_FAILED` si el UUID es inválido o faltan/sobran campos.

```http
POST /admin/events/4/registrations
Authorization: Bearer <admin_supabase_access_token>
Content-Type: application/json

{ "user_id": "11111111-1111-4111-8111-111111111111" }
```

### 5.4 `PATCH /admin/event-registrations/:registrationId`

| | |
| --- | --- |
| Autenticación | Sí, rol `admin`. |
| Body permitido | Al menos uno de: `status_code`, `waitlist_position`. `strict()`. Body vacío → `VALIDATION_FAILED` (`Request body must not be empty`). |
| `status_code` | Solo `confirmed` o `waitlisted`. `cancelled` u otro → `400` / `VALIDATION_FAILED`. |
| `waitlist_position` | Entero `> 0` o `null`. |
| Éxito | `200`. `data` = fila actualizada **sin** `profile`. |

Campos **no editables** (rechazados por Zod si se envían): `id`, `event_id`, `user_id`, `created_at`, `updated_at`, o cualquier otra clave.

Reglas de negocio del RPC (`admin_update_registration`):

- El evento debe estar `open` y con deadline vigente. Si no: `event_not_open` o `registration_deadline_expired`.
- Pasar a `confirmed` con `waitlist_position` no nulo → `invalid_waitlist_position`.
- Pasar a `confirmed` desde otro estado sin cupo → `409` / `event_capacity_full`.
- Pasar a `confirmed` pone `waitlist_position` en `null` y recompacta la espera.
- Pasar a `waitlisted` sin posición: si ya era `waitlisted` conserva la suya; si venía de `confirmed`, se asigna `max + 1`. **No** promueve a nadie más.
- Posición ya usada por otro `waitlisted` del mismo evento → `409` / `waitlist_position_conflict`.
- Inscripción inexistente → `404` / `registration_not_found`.

```http
PATCH /admin/event-registrations/12
Authorization: Bearer <admin_supabase_access_token>
Content-Type: application/json

{ "status_code": "waitlisted", "waitlist_position": 1 }
```

### 5.5 `DELETE /admin/event-registrations/:registrationId`

| | |
| --- | --- |
| Autenticación | Sí, rol `admin`. |
| Body | No. |
| Éxito | `200`. `data` = fila eliminada **sin** `profile`. |
| No existe | `404` / `registration_not_found`. |

Misma promoción/recompactación que la baja de usuario. **No** exige evento `open`.

---

## 6. Tabla de comportamiento para frontend

| Situación | Respuesta backend | Qué debe hacer el frontend |
| --------- | ----------------- | -------------------------- |
| Usuario no autenticado / sin Bearer | `401` / `AUTH_USER_REQUIRED` | Pedir inicio de sesión con Google. |
| Token inválido o vencido | `401` / `AUTH_INVALID_TOKEN` | Renovar sesión o volver a login. |
| Usuario autenticado sin perfil | `404` / `profile_not_found` | No ofrecer inscripción; el usuario no está listo en `profiles`. |
| Evento abierto y con cupo | `201` + inscripción `confirmed` | Mostrar “Inscripto”. |
| Evento lleno (alta de usuario o admin) | `201` + inscripción `waitlisted` | Mostrar posición en lista de espera (`waitlist_position`). |
| Evento no `open` (alta o `PATCH` admin) | `409` / `event_not_open` | Deshabilitar inscripción y mostrar que no admite altas. |
| Fecha límite vencida (alta o `PATCH` admin) | `409` / `registration_deadline_expired` | Deshabilitar inscripción y mostrar que venció el plazo. |
| Ya inscripto (`POST` propio o admin) | `409` / `registration_already_exists` | **No es idempotente.** Hacer `GET .../me` (o listado admin) y refrescar UI sin duplicar filas ni reintentar el POST. |
| Consulta propia sin inscripción | `404` / `registration_not_found` | Mostrar “Anotarme” (si el evento admite altas). |
| Baja exitosa | `200` + fila eliminada | Mostrar “Anotarme” y refrescar evento / `GET .../me`. No inferir promoción. |
| Baja sin inscripción | `404` / `registration_not_found` | Tratar como “ya no está inscripto”; refrescar UI. |
| Usuario común en `/admin/...` | `403` / `AUTH_INSUFFICIENT_PERMISSIONS` | No mostrar pantallas admin; no reintentar. |
| Admin promueve a `confirmed` sin cupo | `409` / `event_capacity_full` | Avisar que no hay lugar; no cambiar la UI a confirmado. |
| `eventId` / `registrationId` inválido o body no permitido | `400` / `VALIDATION_FAILED` | Corregir el request; `data` trae `{ path, message }[]`. |

---

## 7. Códigos de error

Valores reales de `errorCode` en el JSON de Express. El mapper convierte tokens SQL a estos códigos: `authentication_required` → `AUTH_USER_REQUIRED`; `admin_required` viaja como `admin_required`. El resto de tokens de negocio (`event_not_open`, `registration_already_exists`, etc.) coinciden con el `errorCode` HTTP.

| Código de negocio | HTTP | Significado | Mensaje recomendado para UI |
| ----------------- | ---: | ----------- | --------------------------- |
| `AUTH_USER_REQUIRED` | 401 | No hay Bearer o el RPC exige sesión | Iniciá sesión con Google para continuar. |
| `AUTH_INVALID_TOKEN` | 401 | Token inválido o vencido | Tu sesión expiró. Volvé a iniciar sesión. |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | El perfil no es `admin` (middleware) | No tenés permisos de administrador. |
| `admin_required` | 403 | El RPC rechazó por no-admin (defensa; el middleware suele responder antes) | No tenés permisos de administrador. |
| `profile_not_found` | 404 | No hay fila en `profiles` (caller o `user_id` admin) | No encontramos tu perfil. Completá el registro e intentá de nuevo. |
| `event_not_found` | 404 | El evento no existe | Ese evento no existe o ya no está disponible. |
| `event_not_open` | 409 | El evento no está `open` | Las inscripciones de este evento no están abiertas. |
| `registration_deadline_expired` | 409 | `registration_deadline <= now()` | El plazo de inscripción ya venció. |
| `registration_already_exists` | 409 | Ya existe `(event_id, user_id)` | Ya estás inscripto en este evento. |
| `registration_not_found` | 404 | No hay inscripción (propia, por id, o al borrar) | No tenés una inscripción en este evento. |
| `event_capacity_full` | 409 | `PATCH` admin a `confirmed` sin cupo | No hay lugares confirmados disponibles. |
| `invalid_registration_status` | 422 | Transición de estado inválida en el RPC | No se puede aplicar ese estado a la inscripción. |
| `invalid_waitlist_position` | 400 | Posición nula/≤0 en espera, o no nula en `confirmed` | La posición en lista de espera no es válida. |
| `waitlist_position_conflict` | 409 | Esa posición ya la ocupa otro `waitlisted` | Esa posición en la lista de espera ya está ocupada. |
| `VALIDATION_FAILED` | 400 | Zod: params, query o body | Revisá los datos enviados. `data` detalla el campo. |
| `UNEXPECTED_ERROR` | 500 | Error no mapeado | Ocurrió un error inesperado. Probá de nuevo. |

Validación (`data` no es `null`):

```json
{
  "status": "error",
  "statusCode": 400,
  "description": "Validation failed",
  "errorCode": "VALIDATION_FAILED",
  "data": [
    { "path": "user_id", "message": "Invalid UUID" }
  ]
}
```

Mensajes Zod frecuentes: `eventId must be a positive integer`, `registrationId must be a positive integer`, `Request body must not be empty`, `must be a positive integer` (`waitlist_position`).

---

## 8. Reglas de integración para el frontend

- Leer esta documentación antes de implementar llamadas al backend.
- No duplicar en frontend las reglas de seguridad o cupo: el backend siempre es la fuente de verdad.
- Deshabilitar botones mientras una request está pendiente para evitar doble envío.
- Tras alta, baja o cambio administrativo, refrescar el estado del evento y de la inscripción (`GET /events/:id` + `GET .../me`, o el listado admin).
- No asumir que un lugar sigue disponible aunque la pantalla lo hubiera mostrado antes: dos altas concurrentes pueden dejar a uno en `waitlisted`.
- No enviar `user_id` para acciones propias.
- En acciones administrativas, enviar solamente los campos autorizados por el contrato.
- Usar los `errorCode` de esta sección 7 (no los tokens SQL) para mostrar mensajes de negocio claros.
- No calcular ocupados restando a ojo desde `GET /events`: ese recurso no devuelve `confirmed_count`. Los conteos viven en `meta` del listado admin.
- No inferir quién fue promovido a partir del body de un `DELETE`.
- Tratar `POST` de alta como **no idempotente**: un `409` / `registration_already_exists` se resuelve con `GET .../me`, no reintentando el POST.
- `cancelled` no es un estado que el frontend deba enviar ni esperar tras una baja.

---

## 9. Ejemplos completos de integración

### 9.1 Usuario inscribiéndose con cupo

```http
POST /events/4/registrations HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "status": "success",
  "statusCode": 201,
  "description": "OK",
  "data": {
    "id": 12,
    "event_id": 4,
    "user_id": "11111111-1111-4111-8111-111111111111",
    "status_code": "confirmed",
    "waitlist_position": null,
    "created_at": "2026-09-04T18:00:00.000Z",
    "updated_at": "2026-09-04T18:00:00.000Z"
  }
}
```

### 9.2 Usuario entrando a lista de espera

Mismo request. Respuesta cuando no hay cupo:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "status": "success",
  "statusCode": 201,
  "description": "OK",
  "data": {
    "id": 13,
    "event_id": 4,
    "user_id": "11111111-1111-4111-8111-111111111111",
    "status_code": "waitlisted",
    "waitlist_position": 1,
    "created_at": "2026-09-04T18:00:00.000Z",
    "updated_at": "2026-09-04T18:00:00.000Z"
  }
}
```

### 9.3 Usuario dándose de baja

```http
DELETE /events/4/registrations/me HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": {
    "id": 12,
    "event_id": 4,
    "user_id": "11111111-1111-4111-8111-111111111111",
    "status_code": "confirmed",
    "waitlist_position": null,
    "created_at": "2026-09-04T18:00:00.000Z",
    "updated_at": "2026-09-04T18:00:00.000Z"
  }
}
```

`data` es la inscripción borrada. Si era `confirmed`, alguien en espera pudo ser promovido fuera de esta respuesta.

### 9.4 Administrador agregando una persona

```http
POST /admin/events/4/registrations HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "user_id": "11111111-1111-4111-8111-111111111111"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "status": "success",
  "statusCode": 201,
  "description": "OK",
  "data": {
    "id": 12,
    "event_id": 4,
    "user_id": "11111111-1111-4111-8111-111111111111",
    "status_code": "confirmed",
    "waitlist_position": null,
    "created_at": "2026-09-04T18:00:00.000Z",
    "updated_at": "2026-09-04T18:00:00.000Z"
  }
}
```

Sin `profile`. El `status_code` lo decide el cupo, no el body.

### 9.5 Intento de inscripción a evento cerrado (u otro no `open`)

```http
POST /events/4/registrations HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{}
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "status": "error",
  "statusCode": 409,
  "description": "Event is not open for registration",
  "errorCode": "event_not_open",
  "data": null
}
```

### 9.6 Intento sin token

```http
POST /events/4/registrations HTTP/1.1
Content-Type: application/json

{}
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "status": "error",
  "statusCode": 401,
  "description": "Authentication required",
  "errorCode": "AUTH_USER_REQUIRED",
  "data": null
}
```

### 9.7 Intento administrativo por un usuario común

```http
GET /admin/events/4/registrations HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "status": "error",
  "statusCode": 403,
  "description": "Administrator role required",
  "errorCode": "AUTH_INSUFFICIENT_PERMISSIONS",
  "data": null
}
```

---

## 10. Mantenimiento del contrato

Este archivo es el contrato de integración. Actualizarlo **en el mismo cambio** (mismo PR / mismo commit de feature) si se modifica cualquiera de:

- Rutas o métodos HTTP de inscripciones.
- Payloads, query params o envelopes (`data`, `pagination`, `meta`, `profile`).
- Validaciones Zod.
- `errorCode`, HTTP status o `description` mapeados.
- Reglas de negocio en RPCs (`register_for_event`, `unregister_from_event`, `admin_register_for_event`, `admin_update_registration`, `admin_delete_registration`) o en `registration_statuses`.

No documentar comportamiento supuesto. Si el código y este archivo discrepan, manda la implementación y este archivo debe corregirse en ese mismo cambio.
