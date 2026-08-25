# Code Review Rules — Dictado

Review rules for this project. Flag only what is actionable and grounded in the
diff under review. See "What not to block on" before rejecting a change.

## Layout

- `index.html`, `styles.css`, `app.js` — browser front end. Vanilla JS, no
  framework, no build step. Uses the Web Speech API
  (`SpeechRecognition` / `webkitSpeechRecognition`) for voice dictation.
- `server/server.js` — Express 4. Serves the front end as static files from the
  project root (same origin, no CORS) and exposes the JSON API under `/api`.
- `server/db.js` — data layer over `better-sqlite3` (synchronous). Owns the
  schema, the prepared statements, and the `modelos` table.
- `server/dictado.db` — SQLite file. **Contains API keys in plain text.** It is
  gitignored and must stay that way.

Comments and user-facing strings in this codebase are written in Spanish. Keep
that convention; do not rewrite existing Spanish comments into English.

## Secrets — the core invariant of this project

The whole server-side design exists so that provider API keys never reach the
browser. Any change that weakens this is a blocking finding.

- `api_key` never leaves the server unmasked. Every response that carries a
  model must run it through `enmascararKey()`. Flag any handler that returns a
  row from `db.listar()` / `db.obtener()` without masking.
- Calls to AI providers happen server-side in `llamarIA()`. Flag any attempt to
  move a provider call, an endpoint, or a key into `app.js`.
- Never commit `server/dictado.db` or any `*.db*` file. Flag changes to
  `.gitignore` that would stop excluding them.
- No keys, endpoints with embedded tokens, or credentials hardcoded in source.

## Backend (Express + better-sqlite3)

- All SQL lives in `server/db.js` as prepared statements. Flag any query built
  by string concatenation, and any SQL that leaks into `server.js`.
- User-supplied values are always bound as parameters (`?` or `@named`), never
  interpolated into the statement text.
- Route handlers validate their input before touching the DB: required fields
  present, `:id` is a number, `proveedor` is one of the known values. Flag
  handlers that pass `req.body` straight through to a statement.
- Every handler returns a proper status code and a JSON error body on failure.
  `async` handlers (`POST /api/generar`) wrap their work in `try/catch` — an
  unhandled rejection there takes the response down silently.
- `better-sqlite3` is synchronous. Flag `await` applied to `db.js` calls; it
  hides the fact that the call already returned.
- The "exactly zero or one active model" rule is enforced by the `txActivar`
  transaction. Flag any code that sets `activo` outside it.

## Frontend (vanilla JS)

- Do not interpolate values that come from the database or from a form into
  `innerHTML`. Model names, provider strings, and command descriptions are
  user-controlled; use `textContent`, or build nodes, or escape explicitly.
  `$listaModelos.innerHTML` and `$listaComandos.innerHTML` are the existing
  spots that follow this pattern — new ones are a finding.
- Every `fetch` to `/api/*` checks `resp.ok` and surfaces the failure to the
  user. A silent `catch` that only logs is a finding.
- Speech API access is feature-detected before use (`if (!SpeechRecognition)`).
  Keep that guard on any new entry point.
- Event listeners are registered once, in the init path. Flag listeners bound
  inside a render function that runs on every update.

## Universal

- One responsibility per function. Flag functions that mix HTTP handling,
  business rules, and persistence.
- No duplicated logic between `app.js` and `server.js`. Provider presets have a
  single source of truth: `PROVEEDORES_PRESETS` on the server, fetched by the
  client via `GET /api/proveedores`.
- Descriptive names in English for identifiers and files.
- Exported functions and non-obvious helpers carry JSDoc: purpose, parameters,
  return value. Comment the *why*, never the *what*.
- New dependencies, environment variables, or run commands must be reflected in
  the README.

## Testing

This project has no test runner configured — `package.json` only defines
`start`. Do not block a change for missing tests while that is true. Instead:

- If a change introduces non-trivial logic (a new provider format, validation
  rules, the activation transaction), say so and propose setting up a runner.
- Once tests exist, the standard applies: bugfixes ship with a regression test
  that fails before the fix, and critical paths plus edge cases are covered.
- Deleting or commenting out tests to get a green run is a blocking finding.

## What not to block on

- Style and formatting the project does not enforce — there is no ESLint or
  Prettier config here.
- Missing TypeScript types. This is plain JavaScript by choice; ask for JSDoc
  instead.
- Spanish comments and Spanish UI strings. That is the convention.
- Absence of tests, per the section above.
- Suggestions to adopt a framework, a bundler, or an ORM. Out of scope for a
  code review of the diff at hand.
