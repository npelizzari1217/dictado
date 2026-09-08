## Stack

JS vanilla (sin framework, sin build, sin TypeScript) · Express 4 · better-sqlite3
(síncrono) · SQLite (`server/dictado.db`) · Node ≥ 24

Verificación con herramientas nativas de Node: sin dependencias de desarrollo.

## Invariante de seguridad — no negociable

Todo el diseño server-side existe para que las API keys nunca lleguen al navegador. Toda
decisión de código se subordina a esto. `server/dictado.db` contiene las keys en texto
plano y está gitignoreado — tiene que seguir así.

## Sin frameworks

JavaScript plano, sin framework, sin bundler y sin build por decisión. No sugerir
adoptarlos: está fuera del alcance.

Esta decisión alcanza también al herramental de verificación: nada de ESLint, Prettier,
Jest o Vitest. Las compuertas de abajo usan solo lo que Node 24 ya trae, y por eso
`package.json` no tiene `devDependencies`. Mantenerlo así.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Levanta el servidor (`node server/server.js`) |
| `npm run lint` | Chequeo de sintaxis con `node --check` sobre todos los `.js` del repo |
| `npm test` | Test runner nativo de Node (`node --test`) |
| `npm run verify` | Las dos compuertas en orden: `lint` y luego `test` |

`npm run verify` es la compuerta previa a cualquier commit. Corre en WSL.

## Compuertas de calidad

Este proyecto cumple dos de las tres compuertas que exigen las reglas globales de
`proyectos/CLAUDE.md`:

| Compuerta | Estado |
|---|---|
| Lint / formato | `npm run lint` — `node --check` sobre cada `.js`. Un error de sintaxis corta con exit 1. |
| Tests | `npm test` — `node --test`. Hoy no hay archivos de test: el runner sale 0. Todo test nuevo va en `*.test.js` y lo levanta solo. |
| Compilación / tipos | **No aplica.** Excepción declarada. |

**Excepción a las reglas globales, sección 0.** No hay compuerta de compilación ni de
tipos porque el proyecto es JavaScript plano sin build ni TypeScript, por la decisión
de arquitectura documentada arriba. `node --check` cubre el único error que un build
detectaría acá: la sintaxis inválida. No es una compuerta pendiente de configurar; es
una compuerta que no corresponde.

Nota sobre `npm run lint`: el script usa `find` y no `fd` a propósito. `find` es POSIX y
está en cualquier máquina donde corra el repo; depender de `fd` agregaría una
dependencia de sistema no declarada.
