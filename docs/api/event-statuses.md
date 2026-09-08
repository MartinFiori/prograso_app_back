> Este documento es el contrato de integración entre backend y frontend.
> Debe actualizarse en el mismo cambio que modifique rutas, payloads,
> respuestas, validaciones, códigos de error o reglas de negocio.

# Estados de eventos — Contrato de API

Documento de integración para consultar el catálogo `public.event_statuses` **sin leer el backend**. Las rutas no tienen prefijo `/api`: el servidor Express monta los routers en `/` (por ejemplo `GET /event-statuses`).

Este módulo es de **solo lectura**. No hay `POST`, `PUT`, `PATCH` ni `DELETE`.

---

## 1. Objetivo funcional

`event_statuses` es el catálogo de estados que usa `events.status_code`. El frontend lo necesita para mostrar y filtrar eventos.

El único endpoint lista todos los estados. Cada ítem expone:

| Campo | Tipo | Descripción |
| ----- | ---- | ----------- |
| `code` | string | Clave primaria. Valor que se guarda en `events.status_code`. |
| `label` | string | Nombre para mostrar. |
| `description` | string \| null | Texto explicativo del estado. |

No hay paginación ni filtros. El orden es estable: `label` ascendente.

Valores seed habituales (el API devuelve lo que haya en la tabla, no una lista hardcodeada):

| `code` | `label` | `description` |
| ------ | ------- | ------------- |
| `draft` | Borrador | El evento todavía no es visible ni acepta inscripciones. |
| `open` | Inscripciones abiertas | El evento acepta inscripciones. |
| `closed` | Inscripciones cerradas | El evento ya no acepta nuevas inscripciones. |
| `cancelled` | Cancelado | El evento fue cancelado. |
| `completed` | Finalizado | El evento ya ocurrió. |

---

## 2. Autenticación

`GET /event-statuses` es **público**. No requiere `Authorization`. No exige rol `admin`.

---

## 3. Endpoint

### `GET /event-statuses`

Lista todos los estados.

**Acceso:** público.

**Respuesta 200** — envelope de éxito. `data` es un array. Una tabla vacía también es `200` con `data: []` (nunca `404`).

```json
{
  "status": "success",
  "statusCode": 200,
  "description": "OK",
  "data": [
    {
      "code": "draft",
      "label": "Borrador",
      "description": "El evento todavía no es visible ni acepta inscripciones."
    },
    {
      "code": "cancelled",
      "label": "Cancelado",
      "description": "El evento fue cancelado."
    },
    {
      "code": "completed",
      "label": "Finalizado",
      "description": "El evento ya ocurrió."
    },
    {
      "code": "open",
      "label": "Inscripciones abiertas",
      "description": "El evento acepta inscripciones."
    },
    {
      "code": "closed",
      "label": "Inscripciones cerradas",
      "description": "El evento ya no acepta nuevas inscripciones."
    }
  ]
}
```

Cada objeto de `data` incluye `code`, `label` y `description`.

### Error interno

Si Supabase falla, el backend usa el manejador centralizado. No se exponen mensajes de Postgres, stack traces ni secretos.

```json
{
  "status": "error",
  "statusCode": 500,
  "description": "An unexpected error occurred",
  "errorCode": "UNEXPECTED_ERROR",
  "data": null
}
```

---

## 4. Ejemplo de consumo

```javascript
const response = await fetch(`${API_URL}/event-statuses`)

if (!response.ok) {
  throw new Error('No se pudieron obtener los estados de eventos')
}

const body = await response.json()
const eventStatuses = body.data
```
