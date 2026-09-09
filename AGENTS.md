# Backend instructions

- Express 5, Node.js CommonJS. Do not migrate to TypeScript.
- Source lives in `src/`. Tests live in `tests/`.
- Start from this directory: `npm start` → `nodemon src/index.js` (PORT or 8080).
- Layers: `src/routes` → `src/controllers` → `src/services` → `src/repositories`.
- Local SQL is at `../schemas/`. HTTP contracts are at `../docs/api/`.
- Do not apply SQL to the remote database unless the user asks.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `IMGBB_API_KEY` to the frontend.
- Auth: `Authorization: Bearer` + `supabase.auth.getUser`. Admin gate is `profiles.role`.
- Routes have no `/api` prefix.
- Use npm (`package-lock.json`). `npm test` → Jest `--runInBand`. `npm run lint` → eslint.
