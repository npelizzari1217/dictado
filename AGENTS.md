# AGENTS.md — estándares de revisión de `dictado`

> Este archivo lo consume la revisión automática de código (GGA), que lee **solo este
> archivo**: no puede abrir el `AGENTS.md` global. Por eso las reglas universales están
> copiadas acá abajo, entre los marcadores `BEGIN:global` / `END:global`, y las mantiene
> sincronizadas `sync-agents.py`. **No edites ese bloque a mano.**
>
> Lo que va **después** del bloque es lo propio de este proyecto: amplía al global, y ante
> conflicto **gana lo local**.
>
> Señalá solo lo accionable y apoyado en el diff. Esta revisión corre en `pre-commit`, sobre
> un commit suelto, antes de que exista el PR y sin conocer el resto de la rama: no reportes
> nada sobre el PR ni sobre el tamaño de la rama, porque no los podés ver.

<!-- BEGIN:global -->
<!-- Generado por sync-agents.py desde ~/proyectos/AGENTS.md (v05ed8761).
     NO EDITAR A MANO: el proximo sync pisa los cambios.
     Para cambiar una regla universal, edita el global y volve a correr el script.
     Para que este proyecto se aparte, usa la seccion [Anulaciones] de mas abajo. -->

## Lenguaje y tipos

- **Todo lo que lee una persona va en español neutro**: comentarios, prosa, copy de UI y
  **mensajes de error**. Solo quedan en inglés los **identificadores y nombres de archivo**
  (variables, funciones, clases, tipos, claves, rutas). El corte: si lo lee una persona,
  español; si lo lee el compilador, inglés.
- **Neutro, no rioplatense.** El voseo y el modismo regional van en la conversación, no en
  un artefacto. Un `// fijate que acá se rompe` es hallazgo; `// verificar el límite acá`
  no. No es retroactivo: rige para las líneas que el diff agrega o reescribe.
- **Las descripciones de test (`describe`/`it`) son la EXCEPCIÓN: no tienen idioma fijo.**
  Se sigue el idioma de los `it()` **del archivo que se toca**, no el de la regla de arriba.
  **Un `it()` nuevo en inglés NO es un hallazgo** si sus vecinos del archivo están en
  inglés, y viceversa. Los comentarios DENTRO del cuerpo del test sí van en español
  siempre. Si el repo tiene un censo medido, vive en su sección propia, no acá.
- **La regla NO es retroactiva.** No reportes copy, mensajes de error ni comentarios en
  inglés preexistentes: **solo los nuevos**, y solo en las líneas que el diff agrega o
  reescribe. Un archivo con copy viejo en inglés no es un hallazgo.
- **Prohibido `any`**, los casts sin chequear y los `!` usados para callar al compilador.
  Para lo desconocido: `unknown` + validación.
- Los miembros exportados llevan tipos explícitos de parámetros y retorno.
- Sin variables ni parámetros declarados y no usados.

---

## Responsabilidad y duplicación

- Una responsabilidad por función. Señalá las funciones que mezclan transporte, reglas de
  negocio y persistencia en el mismo cuerpo.
- Sin lógica duplicada entre módulos. Señalá el copy-paste que debería estar en un lugar
  compartido.
- Los controllers se mantienen finos: parsean la entrada, delegan y mapean la respuesta. Las
  reglas de negocio y la persistencia viven en los services o casos de uso.

---

## Errores y seguridad

- Todo bloque asíncrono, query a la DB o llamada a API externa lleva manejo de errores.
  **Cero `catch` vacíos o que se tragan el error.** Un `catch` que solo loguea y sigue
  esconde el fallo hasta que se manifiesta en otro lado.
- Operaciones que tocan múltiples tablas relacionadas corren dentro de una transacción con
  rollback real.
- **Sin secrets, connection strings, tokens ni credenciales en el código.** Van en variables
  de entorno. Señalá cualquier línea de log que pueda imprimir un token o una respuesta
  completa de API que lo contenga.
- La autorización se decide en el backend. Ocultar una acción en la UI no es un control de
  acceso.
- Los valores que vienen del usuario se validan antes de usarlos. Un payload que entra a la
  lógica sin pasar por un schema o DTO es un hallazgo.

---

## Commits y Git

- Commits en **Conventional Commits, en español**.
- **`work-unit-commits`:** cada commit es un comportamiento entregable con sus tests adentro,
  reversible solo. Señalá un commit que mezcle implementación de features distintas o que
  deje la suite en rojo.
- Sin atribución de IA ni `Co-Authored-By` en los mensajes.

---

## Tests y TDD

Este proyecto trabaja con **TDD obligatorio**: el test se escribe antes que la
implementación, y `work-unit-commits` exige que ambos viajen en el mismo commit.

**Qué SÍ podés verificar desde acá.** Corrés en `pre-commit`, sobre un commit suelto, y
el commit **tiene que traer sus tests adentro**. Entonces:

- Un commit que agrega o cambia conducta y **no trae ningún test** es hallazgo.
- Un test cuyos asserts **describen la implementación** en vez de la conducta esperada
  (repite la fórmula del código, mockea justo lo que debía probar, afirma sobre detalles
  internos) es la firma de un test escrito *después*. Es hallazgo.
- Un test de regresión que **no podría haber fallado antes del fix** — porque su assert
  pasa por construcción, o el fixture no contiene el caso — es hallazgo.

**Qué NO podés verificar, y por lo tanto no reportes.** No viste correr la suite ni el
orden en que se escribieron los archivos. **No afirmes que el RED no se verificó**: no
tenés cómo saberlo. Limitate a lo que el diff muestra.

- Las features no triviales y todo bugfix van con tests. Un bugfix necesita un test de
  regresión que **falle antes del fix por la razón correcta** y pase después.
- Se cubren los caminos críticos y los edge cases (errores, límites, entradas inválidas),
  no solo el happy path.
- **Borrar o comentar tests para pasar en verde es hallazgo bloqueante.**
- Un test que consagra el comportamiento actual en vez del esperado no es cobertura: es un
  candado sobre el bug.
- No exigir tests exhaustivos ni combinatorios. Los getters triviales, los CRUD de paso y la
  validación que ya hace el framework no necesitan test propio.

---

## Documentación

- Las funciones exportadas, los métodos públicos y los componentes exportados llevan JSDoc
  o docstring con propósito, parámetros y retorno.
- Comentá el *porqué* de la lógica no obvia, nunca el *qué*.
- Toda dependencia, variable de entorno o comando de ejecución nuevo se refleja en el README
  y en el `.env.example` correspondiente en el mismo commit.

---

## Ruido conocido — no reportar

No rechaces un cambio por estas razones:

- **Formato, orden de imports, estilo de comillas, largo de línea.** De eso se encargan
  Prettier, ESLint o Biome según el proyecto. Si el proyecto no tiene linter configurado,
  no hay herramienta que decida el estilo: un hallazgo de formato sin herramienta detrás es
  una opinión.
- **Problemas preexistentes en código que el diff no toca.** Mencionarlos como nota a lo
  sumo, nunca como bloqueante.
- **Reescrituras arquitectónicas** de código que funciona cuando el diff es un fix acotado.
- **La falta de tests** en cambios que son puramente de configuración, comentarios o docs.
- **Preferencias subjetivas de nombres** cuando el nombre existente ya es claro.
- **Ceremonias de equipo** que no aplican a un proyecto de una sola persona: issue-first,
  labels de PR, aprobación de maintainer externo.

<!-- END:global -->

---

## Estructura

- `index.html`, `styles.css`, `app.js` — front en el navegador. JS vanilla, sin framework
  y sin build. Usa la Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- `server/server.js` — Express 4. Sirve el front como archivos estáticos y expone la API
  JSON bajo `/api`.
- `server/db.js` — capa de datos sobre `better-sqlite3` (síncrono). Dueña del esquema,
  las sentencias preparadas y la tabla `modelos`.
- `server/dictado.db` — SQLite con las API keys en texto plano. Gitignoreado. Tiene que
  seguir así.

Comentarios y strings de UI en español. Es la convención: no pidas que se reescriban al
inglés.

## Secretos — la invariante que sostiene el proyecto

Todo el diseño server-side existe para que las API keys nunca lleguen al navegador.
Cualquier cambio que debilite esto es hallazgo bloqueante.

- La `api_key` nunca sale del servidor sin enmascarar. Toda respuesta con un modelo pasa
  por `enmascararKey()`. Señalá cualquier handler que devuelva una fila de `db.listar()` /
  `db.obtener()` sin enmascarar.
- Las llamadas a proveedores de IA ocurren en el servidor, dentro de `llamarIA()`. Señalá
  cualquier intento de mover una llamada, un endpoint o una key a `app.js`.
- Nunca se commitea `server/dictado.db` ni ningún `*.db*`. Señalá cambios al `.gitignore`
  que dejen de excluirlos.
- Sin keys, tokens ni credenciales hardcodeadas en el código.

## Backend (Express + better-sqlite3)

- Todo el SQL vive en `server/db.js` como sentencias preparadas. SQL armado por
  concatenación de strings, y SQL filtrado a `server.js`, son hallazgo.
- Los valores del usuario siempre van como parámetros (`?` o `@nombre`), nunca interpolados.
- Los handlers validan su entrada antes de tocar la DB: campos requeridos, `:id` numérico,
  `proveedor` dentro de los valores conocidos. Señalá los que pasan `req.body` directo.
- Todo handler devuelve status correcto y body JSON de error al fallar. Los handlers `async`
  envuelven en `try/catch`: un rejection sin manejar tira la respuesta en silencio.
- `better-sqlite3` es síncrono. Señalá `await` aplicado a llamadas de `db.js`: esconde que
  la llamada ya retornó.
- La regla "exactamente cero o un modelo activo" la impone `txActivar`. Señalá código que
  toque `activo` por fuera de esa transacción.

## Frontend (JS vanilla)

- No interpoles en `innerHTML` valores de la base o de formularios. Usá `textContent`,
  construí nodos, o escapá explícitamente. `$listaModelos.innerHTML` y
  `$listaComandos.innerHTML` ya siguen ese patrón — los nuevos son hallazgo.
- Todo `fetch` a `/api/*` chequea `resp.ok` y muestra el fallo al usuario.
- El acceso a la Speech API usa feature detection (`if (!SpeechRecognition)`). Mantené esa
  guarda en cualquier entrada nueva.
- Los listeners se registran una sola vez, en el camino de inicialización. Señalá los
  montados dentro de una función de render.

## Tests — específico de este proyecto

Sin test runner configurado. **No bloquees un cambio por falta de tests.** Si el cambio
mete lógica no trivial (formato de proveedor nuevo, reglas de validación, transacción de
activación), decilo y proponé configurar un runner. Cuando haya tests, aplica el estándar
global.

## Ruido conocido de ESTE proyecto — no reportar

- Estilo y formato: no hay ESLint ni Prettier configurados.
- Falta de tipos TypeScript: JavaScript plano por decisión; pedí JSDoc en su lugar.
- Comentarios y strings de UI en español: es la convención.
- Ausencia de tests: ver sección Tests.
- Sugerencias de framework, bundler u ORM: fuera del alcance.
