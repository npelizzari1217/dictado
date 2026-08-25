# AGENTS.md — estándares de revisión de `dictado`

> Este archivo lo consume la revisión automática de código. Señalá solo lo accionable y
> apoyado en el diff que estás revisando. Antes de rechazar un cambio, leé
> "Ruido conocido, no lo reportes".

## Estructura

_(Procedencia: el propio código del repo)_

- `index.html`, `styles.css`, `app.js` — el front en el navegador. JS vanilla, sin framework
  y sin build. Usa la Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) para
  el dictado por voz.
- `server/server.js` — Express 4. Sirve el front como archivos estáticos desde la raíz del
  proyecto (mismo origen, sin CORS) y expone la API JSON bajo `/api`.
- `server/db.js` — capa de datos sobre `better-sqlite3` (síncrono). Es dueña del esquema, de
  las sentencias preparadas y de la tabla `modelos`.
- `server/dictado.db` — archivo SQLite. **Contiene las API keys en texto plano.** Está
  gitignoreado y tiene que seguir así.

Los comentarios y los strings de UI de este repo están en español. Es la convención: no
pidas que se reescriban al inglés.

## Secretos — la invariante que sostiene el proyecto

_(Procedencia: el diseño del propio `server.js`)_

Todo el diseño server-side existe para que las API keys de los proveedores nunca lleguen al
navegador. Cualquier cambio que debilite esto es hallazgo bloqueante.

- La `api_key` nunca sale del servidor sin enmascarar. Toda respuesta que lleve un modelo
  pasa por `enmascararKey()`. Señalá cualquier handler que devuelva una fila de
  `db.listar()` / `db.obtener()` sin enmascarar.
- Las llamadas a los proveedores de IA ocurren en el servidor, dentro de `llamarIA()`.
  Señalá cualquier intento de mover una llamada, un endpoint o una key a `app.js`.
- Nunca se commitea `server/dictado.db` ni ningún archivo `*.db*`. Señalá los cambios al
  `.gitignore` que dejen de excluirlos.
- Sin keys, endpoints con tokens embebidos ni credenciales hardcodeadas en el código.

## Backend (Express + better-sqlite3)

- Todo el SQL vive en `server/db.js` como sentencias preparadas. Señalá cualquier query
  armada por concatenación de strings, y cualquier SQL que se filtre a `server.js`.
- Los valores que vienen del usuario siempre van como parámetros (`?` o `@nombre`), nunca
  interpolados en el texto de la sentencia.
- Los handlers validan su entrada antes de tocar la DB: campos requeridos presentes, `:id`
  numérico, `proveedor` dentro de los valores conocidos. Señalá los handlers que pasan
  `req.body` derecho a una sentencia.
- Todo handler devuelve un status code correcto y un body JSON de error cuando falla. Los
  handlers `async` (`POST /api/generar`) envuelven su trabajo en `try/catch`: un rejection
  sin manejar ahí te tira la respuesta en silencio.
- `better-sqlite3` es síncrono. Señalá el `await` aplicado a llamadas de `db.js`: esconde
  que la llamada ya retornó.
- La regla de "exactamente cero o un modelo activo" la impone la transacción `txActivar`.
  Señalá cualquier código que toque `activo` por fuera de ella.

## Frontend (JS vanilla)

- No interpoles en `innerHTML` valores que vengan de la base o de un formulario. Los nombres
  de modelo, los proveedores y las descripciones de comandos los controla el usuario: usá
  `textContent`, construí nodos, o escapá explícitamente. `$listaModelos.innerHTML` y
  `$listaComandos.innerHTML` son los puntos que ya siguen ese patrón — los nuevos son
  hallazgo.
- Todo `fetch` a `/api/*` chequea `resp.ok` y le muestra el fallo al usuario. Un `catch`
  silencioso que solo loguea es hallazgo.
- El acceso a la Speech API se hace con feature detection (`if (!SpeechRecognition)`).
  Mantené esa guarda en cualquier entrada nueva.
- Los listeners se registran una sola vez, en el camino de inicialización. Señalá los
  listeners montados dentro de una función de render que corre en cada update.

## Universal

_(Procedencia: reglas globales del autor)_

- Comentarios de código en español. Los identificadores, nombres de archivo, mensajes de
  error y copy de UI siguen en inglés. No reportes comentarios en inglés preexistentes:
  solo los nuevos.
- Una responsabilidad por función. Señalá las funciones que mezclan manejo de HTTP, reglas
  de negocio y persistencia.
- Sin lógica duplicada entre `app.js` y `server.js`. Los presets de proveedores tienen una
  única fuente de verdad: `PROVEEDORES_PRESETS` en el servidor, que el cliente consume por
  `GET /api/proveedores`.
- Nombres descriptivos en inglés para identificadores y archivos.
- Las funciones exportadas y los helpers no obvios llevan JSDoc: propósito, parámetros y
  retorno. Comentá el *porqué*, nunca el *qué*.
- Toda dependencia, variable de entorno o comando de ejecución nuevo se refleja en el README.

## Tests

Este proyecto no tiene test runner configurado: `package.json` solo define `start`. Mientras
eso siga así, **no bloquees un cambio por falta de tests**. En cambio:

- Si el cambio mete lógica no trivial (un formato de proveedor nuevo, reglas de validación,
  la transacción de activación), decilo y proponé configurar un runner.
- Cuando haya tests, aplica el estándar: todo bugfix va con un test de regresión que falla
  antes del fix, y se cubren los caminos críticos y los edge cases.
- Borrar o comentar tests para pasar en verde es hallazgo bloqueante.

## Ruido conocido, no lo reportes

- Estilo y formato que el proyecto no impone: acá no hay config de ESLint ni de Prettier.
- La falta de tipos de TypeScript. Esto es JavaScript plano por decisión; pedí JSDoc.
- Los comentarios y los strings de UI en español. Es la convención.
- La ausencia de tests, según la sección de arriba.
- Sugerencias de adoptar un framework, un bundler o un ORM. Fuera del alcance de revisar
  el diff que tenés adelante.
