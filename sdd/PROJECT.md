# Contexto del proyecto
Estado: PENDIENTE DE INSPECCIÓN DEL REPOSITORIO.

Este paquete fue preparado sin acceso al código del proyecto. Completar con evidencia antes del primer plan.

| Dato | Valor / evidencia |
| --- | --- |
| Objetivo de producto | Pendiente |
| Stack, lenguaje y versiones | Leer archivos del proyecto |
| Gestor de paquetes | Leer lockfile |
| Comandos de desarrollo, test, lint y build | Leer scripts/configuración |
| Módulos de referencia | Pendiente |
| Definiciones de datos | Buscar schemas/ y migraciones |
| Autenticación y autorización | Pendiente |
| Skills instaladas aplicables | Descubrir; no asumir instalación |

## Orientación inicial a confirmar
El usuario viene trabajando con Cursor, Supabase y definiciones dentro de `schemas/`, y ha pedido backend JavaScript sin TypeScript. Tratarlo como orientación, no como prueba del estado de este repositorio. Confirmar lenguaje y convenciones leyendo el código; no migrar stack como efecto colateral.
Para `event_statuses`, leer el DDL actual: no asumir que existe `name` donde la definición puede usar `label`. Cualquier discrepancia se reporta antes de implementar.
