# Orquestador SDD para Cursor

Paquete de instrucciones de orquestación con siete subagentes, reglas de proyecto y plantillas. El Agent principal coordina y conversa con vos. Los subagentes entregan análisis y evidencia. No es un servicio independiente ni un motor ejecutable fuera del editor: requiere Cursor y sus herramientas de agentes.

## Instalación
1. Extraé el ZIP. Copiá `.cursor/` y `sdd/` desde la carpeta `orquestador-sdd` a la raíz del proyecto que vas a trabajar. No las dejes dentro de una subcarpeta adicional.
2. Si ya existen archivos con los mismos nombres, comparalos y fusioná su contenido; no reemplaces configuraciones ni features previas sin revisión. No necesitás modificar un AGENTS.md existente.
3. Abrí el proyecto en Cursor. Iniciá una conversación con el Agent principal y pegá el pedido de `INICIAR.md`. La regla `.cursor/rules/sdd-orchestrator.mdc` activa el protocolo para trabajos de código.
4. Revisá la propuesta. Respondé, por ejemplo, «Sí, apruebo la spec y el plan de la revisión 1». El orquestador registra tu respuesta y continúa. Si ajustás el alcance, primero revisa el plan.
5. Los resultados quedan en `sdd/features/NNN-slug/`. Para otro chat o bot, indicá esa carpeta y `sdd/ORCHESTRATOR.md`.

Si Cursor no ofrece delegación de subagentes en tu configuración, el principal tiene instrucciones para ejecutar los roles secuencialmente y decirlo. Podés referenciar `sdd/ORCHESTRATOR.md` explícitamente si la regla no se adjunta. La aprobación está implementada como una instrucción del agente y un registro, no como un bloqueo de seguridad externo.

## Responsabilidades
| Componente | Función |
| --- | --- |
| Principal + ORCHESTRATOR.md | Coordina, mantiene estado y consulta al usuario |
| sdd-analyst | Requisitos y análisis del código existente |
| sdd-planner | Flujo, arquitectura mínima y tareas |
| sdd-developer | Código aprobado |
| sdd-tester | Tests y ejecución con evidencia |
| sdd-schema-verifier | Coherencia de consultas y definiciones de datos |
| sdd-reviewer | Revisión independiente de spec y código |
| sdd-documenter | Contexto duradero y contratos para otros bots |

## Flujo SDD
Descubrimiento → spec → plan y tareas → revisión previa → consulta al usuario → aprobación → implementación → tests y revisión → correcciones → documentación → cierre con evidencia.

La spec define qué función debe cumplir. El plan define cómo implementarla. Las tareas enlazan requisitos y pruebas. Un cambio material vuelve a spec/plan y aprobación; un bug dentro del alcance vuelve a implementación y verificación.

## Qué se entrega y qué falta validar
Se incluye configuración lista para copiar, protocolo, siete roles y ocho plantillas por feature. No se implementó ninguna función de tu aplicación, no se inspeccionó tu repositorio ni se ejecutó Cursor desde este entorno. Se validó la estructura local del paquete y su archivo ZIP. La primera ejecución descubrirá las convenciones, scripts y schemas reales.

Las menciones a Supabase y JavaScript en PROJECT.md son orientación a confirmar. No se incluyen credenciales, migraciones de tu proyecto ni endpoints inventados. El contexto registra diferencias entre schema local y estado remoto no consultado.

## Fuentes de formato y metodología
Documentación oficial consultada el 8 de septiembre de 2026:
- Cursor Subagents: https://cursor.com/docs/subagents
- Cursor Rules: https://cursor.com/docs/rules
- GitHub Spec Kit: https://github.com/github/spec-kit

Es un flujo SDD propio inspirado en la separación spec/plan/tasks; no instala ni emula los comandos de Spec Kit. No requiere crear ni instalar skills nuevas.
