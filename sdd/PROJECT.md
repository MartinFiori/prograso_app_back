# Contexto del proyecto

Backend HTTP de eventos, categorías e inscripciones. Documentación de producto para frontend: `docs/frontend-context.md` e índice `docs/api/README.md`.

| Dato | Valor / evidencia |
| --- | --- |
| Objetivo de producto | API HTTP de eventos, categorías de eventos e inscripciones (cupo + waitlist). Vocabulario: **evento**. Evidencia: `app.js`, `routes/index.js`, `docs/api/`. |
| Stack, lenguaje y versiones | Node.js CommonJS (`"type": "commonjs"`). Express 5 (`^5.2.1`), Zod `^4.5.4`, `@supabase/supabase-js` `^2.113.0`, Jest `^30.5.1`. Evidencia: `package.json`. No migrar a TypeScript. |
| Gestor de paquetes | npm. Lockfile `package-lock.json` `lockfileVersion` 3. |
| Comandos de desarrollo, test, lint y build | `npm start` → `nodemon index.js` (`PORT` default 8080 en `index.js`). `npm test` → `jest --runInBand`. `npm run lint` → `eslint .`. No hay script `build`. `NODE_ENV=test` omite morgan (`app.js`). |
| Módulos de referencia | `routes/`, `controllers/`, `services/`, `repositories/`, `middleware/`, `validations/`, `supabase/`, `docs/api/`. Arranque: `index.js` + `app.js`. |
| Definiciones de datos | Schemas **locales** en `schemas/` (`.sql` + `orden.md` + `indexes.sql`). No hay migraciones formales. Divergencia: SQL `event_statuses` usa `name` / `is_active`; HTTP implementado expone `code` / `label` / `description`. Schema **remoto no verificado**. Sin SQL de `exercises`. |
| Autenticación y autorización | `Authorization: Bearer` + `supabase.auth.getUser` (`middleware/authenticate.js`). Roles `profiles.role` `user` \| `admin` (`middleware/require-admin.js`, `middleware/load-profile.js`). Login no vive en Express. |
| Skills instaladas aplicables | `.agents/skills/nodejs-backend-patterns`, `.agents/skills/supabase`, `.agents/skills/supabase-postgres-best-practices`. |

## Orientación

El usuario trabaja con Cursor, Supabase y definiciones en `schemas/`, y pide backend JavaScript sin TypeScript. No migrar stack como efecto colateral.

Para `event_statuses`, leer el DDL actual: no asumir que existe `name` donde el HTTP usa `label`, ni al revés. Cualquier discrepancia se reporta; no “corregir” el SQL remoto sin evidencia ni pedido.
