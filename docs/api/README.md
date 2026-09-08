> Este documento es el contrato de integración entre backend y frontend.
> Debe actualizarse en el mismo cambio que modifique rutas, payloads,
> respuestas, validaciones, códigos de error o reglas de negocio.

# Contratos HTTP

Índice de contratos de esta API. El servidor Express monta las rutas en `/` (sin prefijo `/api`).

Entrada de negocio, stack, auth, envelopes, mapa de endpoints y modelo de datos local: [Contexto frontend](../frontend-context.md).

No copiar aquí las reglas de inscripciones ni de estados: usar los archivos enlazados.

| Recurso | Contrato |
| ------- | -------- |
| Eventos | [events.md](./events.md) |
| Categorías de eventos | [event-categories.md](./event-categories.md) |
| Estados de evento | [event-statuses.md](./event-statuses.md) |
| Inscripciones | [event-registrations.md](./event-registrations.md) |
