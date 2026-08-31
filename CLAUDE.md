# CLAUDE.md — dictado

> Las reglas universales (SDD, tabla de modelos, persistencia, commits, rama+PR, TDD,
> delegación, estándares de código) están en `~/proyectos/CLAUDE.md`. Este archivo contiene
> solo lo específico de este proyecto.

---

## [Overrides]

Este proyecto se aparta del global en dos puntos, y los dos salen de la misma causa: es
JavaScript plano y no tiene test runner.

- **ANULA:** "Prohibido `any` en TypeScript" y "los miembros exportados llevan tipos
  explícitos" — **Motivo:** este proyecto es JavaScript plano por decisión. No hay
  compilador de tipos que sostenga la regla, así que exigirla es pedir algo que no se
  puede verificar.
  **REEMPLAZA POR:** JSDoc con `@param` y `@returns` tipados en toda función exportada y
  en todo helper no obvio. Es el sustituto verificable por lectura.

- **ANULA:** TDD como bloqueante — **Motivo:** no hay test runner configurado
  (`package.json` solo define `start`), así que no existe el paso RED.
  **REEMPLAZA POR:** no bloquea el cambio. Pero todo cambio que agregue lógica no trivial
  (un formato de proveedor nuevo, reglas de validación, la transacción de activación)
  obliga a proponer la configuración de Vitest antes de cerrar.
  **Al configurarlo, esta anulación se borra** y rige el TDD global.

---

## Qué es

App de dictado por voz con ABM de modelos de IA. El frontend usa la Web Speech API
(`SpeechRecognition`) en el navegador; el backend resguarda las API keys de los
proveedores de IA para que nunca lleguen al cliente.

## Stack

JS vanilla (sin framework, sin build, sin TypeScript) · Express 4 · better-sqlite3
(síncrono) · SQLite (`server/dictado.db`)

Sin test runner configurado: `package.json` solo define `start`.

## Invariante de seguridad — no negociable

Todo el diseño server-side existe para que las API keys nunca lleguen al navegador. Toda
decisión de código se subordina a esto. `server/dictado.db` contiene las keys en texto
plano y está gitignoreado — tiene que seguir así.

## Sin frameworks

JavaScript plano, sin framework, sin bundler y sin build por decisión. No sugerir
adoptarlos: está fuera del alcance.

## Comandos

`npm start` (= `node server/server.js`)
