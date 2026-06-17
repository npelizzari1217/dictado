// =============================================================
//  Dictado por voz — Prueba de concepto
//  Web Speech API + motor de comandos de voz extensible.
//  Sección 4 conectada al backend Express (Node + SQLite).
// =============================================================

"use strict";

// ----- Referencias al DOM -----
const $texto           = document.getElementById("texto");
const $interino        = document.getElementById("interino");
const $btnEscuchar     = document.getElementById("btnEscuchar");
const $btnGenerar      = document.getElementById("btnGenerar");
const $listaComandos   = document.getElementById("listaComandos");
const $aviso           = document.getElementById("aviso");
const $salida          = document.getElementById("salida");
const $salidaContenido = document.getElementById("salidaContenido");
const $config          = document.getElementById("config");
const $configEstado    = document.getElementById("configEstado");

// ----- Referencias al ABM de modelos -----
const $formModelo        = document.getElementById("formModelo");
const $fmId              = document.getElementById("fmId");
const $fmNombre          = document.getElementById("fmNombre");
const $fmProveedor       = document.getElementById("fmProveedor");
const $fmEndpoint        = document.getElementById("fmEndpoint");
const $fmModelo          = document.getElementById("fmModelo");
const $fmApiKey          = document.getElementById("fmApiKey");
const $fmApiKeyNota      = document.getElementById("fmApiKeyNota");
const $btnGuardarModelo  = document.getElementById("btnGuardarModelo");
const $btnCancelarEditar = document.getElementById("btnCancelarEditar");
const $listaModelos      = document.getElementById("listaModelos");

// =============================================================
//  1. MOTOR DE COMANDOS
//  Fuente única de verdad. Para agregar un comando nuevo,
//  sumá una entrada acá: la clave es la frase a decir y
//  "accion" es la función que modifica el texto.
//
//  Cada acción recibe el texto actual del textarea y debe
//  DEVOLVER el nuevo texto. Así el motor queda desacoplado
//  del DOM y es fácil de testear.
// =============================================================
const comandos = {
  "renglón abajo": {
    descripcion: "Inserta un salto de línea",
    accion: (texto) => texto + "\n",
  },
  "punto seguido": {
    descripcion: "Inserta un punto y un espacio",
    accion: (texto) => texto.trimEnd() + ". ",
  },
  "borra palabra": {
    descripcion: "Elimina la última palabra",
    accion: (texto) => texto.trimEnd().split(/\s+/).slice(0, -1).join(" "),
  },
  "borrar todo": {
    descripcion: "Limpia toda el área de edición",
    accion: () => "",
  },
  enviar: {
    descripcion: "Prepara y envía el mensaje",
    accion: (texto) => {
      enviarTexto(texto);
      return texto; // No modifica el buffer, solo dispara la acción.
    },
  },
};

function contarPalabras(frase) {
  return frase.trim().split(/\s+/).length;
}

// Normaliza para comparar: minúsculas, sin tildes, sin signos, sin espacios extra.
function normalizar(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (combining marks)
    .replace(/[.,;:!?¿¡]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Índice de comandos -> { clave, largo, norm }, ordenado de más palabras
// a menos para que el match más largo gane. Fuente de verdad del parser.
const INDICE_COMANDOS = Object.keys(comandos)
  .map((clave) => ({
    clave,
    largo: contarPalabras(clave),
    norm: normalizar(clave),
  }))
  .sort((a, b) => b.largo - a.largo);

// =============================================================
//  2. PARSER
//  Recibe el transcript FINAL de un segmento de voz y lo recorre
//  palabra por palabra. Va detectando comandos (de 1 a N palabras)
//  y separando el texto "normal" para insertarlo. Devuelve una
//  lista ordenada de operaciones a aplicar sobre el buffer.
// =============================================================
function parsear(transcript) {
  const palabras = transcript.trim().split(/\s+/).filter(Boolean);
  const operaciones = [];
  let buffer = []; // texto normal acumulado antes de un comando

  let i = 0;
  while (i < palabras.length) {
    const match = matchComandoEnPosicion(palabras, i);

    if (match) {
      // Antes de ejecutar el comando, volcamos el texto acumulado.
      if (buffer.length) {
        operaciones.push({ tipo: "texto", valor: buffer.join(" ") });
        buffer = [];
      }
      operaciones.push({ tipo: "comando", clave: match.clave });
      i += match.largo; // saltamos las palabras que formaban el comando
    } else {
      buffer.push(palabras[i]);
      i += 1;
    }
  }

  if (buffer.length) {
    operaciones.push({ tipo: "texto", valor: buffer.join(" ") });
  }

  return operaciones;
}

// ¿Las palabras a partir de la posición `i` forman un comando conocido?
// Devuelve { clave, largo } o null. Recorre todos los alias, match más largo primero.
function matchComandoEnPosicion(palabras, i) {
  for (const { clave, largo, norm } of INDICE_COMANDOS) {
    const candidato = palabras.slice(i, i + largo).join(" ");
    if (normalizar(candidato) === norm) {
      return { clave, largo };
    }
  }
  return null;
}

// Aplica las operaciones del parser sobre el textarea, en orden.
function aplicarOperaciones(operaciones) {
  for (const op of operaciones) {
    if (op.tipo === "comando") {
      $texto.value = comandos[op.clave].accion($texto.value);
    } else if (op.tipo === "texto") {
      const sep = $texto.value && !$texto.value.endsWith("\n") ? " " : "";
      $texto.value = $texto.value + sep + op.valor;
    }
  }
  $texto.scrollTop = $texto.scrollHeight;
}

// =============================================================
//  3. RECONOCIMIENTO DE VOZ (Web Speech API)
// =============================================================
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let reconocimiento = null;
let escuchando = false; // bandera de intención del usuario

function crearReconocimiento() {
  const r = new SpeechRecognition();
  r.lang = "es-AR";
  r.continuous = true; // pedimos modo continuo…
  r.interimResults = true; // …y resultados provisionales para el feedback en vivo

  // Llega texto: separamos lo FINAL (confirmado) de lo INTERINO (en vivo).
  r.onresult = (evento) => {
    let interino = "";
    for (let i = evento.resultIndex; i < evento.results.length; i++) {
      const resultado = evento.results[i];
      const transcript = resultado[0].transcript;

      if (resultado.isFinal) {
        // Solo el texto confirmado pasa por el parser de comandos.
        aplicarOperaciones(parsear(transcript));
      } else {
        interino += transcript;
      }
    }
    $interino.textContent = interino;
  };

  // EL TRUCO DE LA CONTINUIDAD:
  // `continuous = true` NO garantiza escucha infinita; el motor se corta
  // tras silencios. Si el usuario no apretó "Detener" (escuchando === true),
  // lo reiniciamos automáticamente.
  r.onend = () => {
    if (escuchando) {
      r.start();
    } else {
      actualizarBotonEscuchar();
    }
  };

  r.onerror = (evento) => {
    console.error("[SpeechRecognition error]", evento.error, evento);

    // "no-speech" y "aborted" son normales; no rompen la sesión.
    if (evento.error === "no-speech" || evento.error === "aborted") return;

    // Mensajes específicos según el código real del error.
    const mensajes = {
      "not-allowed":
        "❌ not-allowed: el navegador o el sistema bloquean el micrófono.",
      "service-not-allowed":
        "❌ service-not-allowed: el servicio de reconocimiento de Google no está disponible (revisá conexión a internet / políticas del navegador).",
      network: "❌ network: sin conexión al servicio de reconocimiento de Google.",
      "audio-capture":
        "❌ audio-capture: no se detecta ningún micrófono en el sistema.",
    };

    escuchando = false;
    mostrarAviso(mensajes[evento.error] || `❌ Error de reconocimiento: ${evento.error}`);
    actualizarBotonEscuchar();
  };

  return r;
}

function alternarEscucha() {
  if (!escuchando) {
    escuchando = true;
    reconocimiento = reconocimiento || crearReconocimiento();
    reconocimiento.start();
  } else {
    escuchando = false;
    reconocimiento && reconocimiento.stop();
    $interino.textContent = "";
  }
  actualizarBotonEscuchar();
}

function actualizarBotonEscuchar() {
  $btnEscuchar.classList.toggle("activo", escuchando);
  $btnEscuchar.querySelector(".btn__texto").textContent = escuchando
    ? "Detener"
    : "Escuchar";
}

// =============================================================
//  4. INTEGRACIÓN CON IA — ABM de modelos + generación
//  La lógica de AI (adaptadores, keys) vive en el backend.
//  El front solo hace fetch a /api/modelos y /api/generar.
// =============================================================

// Presets por proveedor (endpoint + modelo). Fuente única: server/server.js vía GET /api/proveedores.
let proveedoresPresets = {};

// Caché local de modelos (se recarga desde el servidor después de cada operación).
let modelosCache = [];

/** Aplica el preset de endpoint + modelo al elegir un proveedor en el formulario. */
function aplicarPreset(proveedor) {
  const preset = proveedoresPresets[proveedor];
  if (!preset) return;
  $fmEndpoint.value = preset.endpoint;
  $fmModelo.value   = preset.modelo;
}

/** Carga la lista de modelos desde el backend y actualiza el DOM. */
async function cargarModelos() {
  try {
    const resp = await fetch("/api/modelos");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    modelosCache = await resp.json();
    renderizarModelos();
    actualizarEstadoBadge();
  } catch (err) {
    console.error("[cargarModelos] error:", err);
  }
}

/** Carga los presets de proveedores desde el backend (fuente única) y aplica el inicial. */
async function cargarProveedoresPresets() {
  try {
    const resp = await fetch("/api/proveedores");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    proveedoresPresets = await resp.json();
    aplicarPreset($fmProveedor.value); // autofill inicial, ahora que ya hay datos
  } catch (err) {
    console.error("[cargarProveedoresPresets] error:", err);
  }
}

/** Escapa caracteres HTML para evitar XSS al insertar datos del servidor en el DOM. */
function escapar(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Renderiza la lista de modelos en el DOM. */
function renderizarModelos() {
  if (modelosCache.length === 0) {
    $listaModelos.innerHTML =
      '<p class="modelos-vacio">No hay modelos guardados aún. Agregá el primero arriba.</p>';
    return;
  }

  $listaModelos.innerHTML = modelosCache
    .map(
      (m) => `
      <div class="modelo ${m.activo ? "modelo--activo" : ""}" data-id="${m.id}">
        <div class="modelo__info">
          <span class="modelo__nombre">${escapar(m.nombre)}</span>
          <span class="modelo__detalle">${escapar(m.proveedor)} · ${escapar(m.modelo)}</span>
          <span class="modelo__key">${escapar(m.api_key)}</span>
        </div>
        <div class="modelo__acciones">
          ${
            m.activo
              ? '<span class="modelo__badge-activo">✓ activo</span>'
              : `<button class="btn btn--sm btn--activar" data-accion="activar" data-id="${m.id}">Activar</button>`
          }
          <button class="btn btn--sm btn--editar"      data-accion="editar"  data-id="${m.id}" title="Editar">✏️</button>
          <button class="btn btn--sm btn--borrar-item" data-accion="borrar"  data-id="${m.id}" title="Borrar">🗑️</button>
        </div>
      </div>
    `
    )
    .join("");
}

/** Actualiza el badge de estado en el summary del panel. */
function actualizarEstadoBadge() {
  const activo = modelosCache.find((m) => m.activo);
  if (activo) {
    $configEstado.textContent = activo.nombre;
    $configEstado.className   = "config__estado config__estado--ok";
    $btnGenerar.disabled      = false;
  } else {
    $configEstado.textContent = modelosCache.length ? "ninguno activo" : "sin modelos";
    $configEstado.className   = "config__estado config__estado--falta";
    $btnGenerar.disabled      = true;
  }
}

/** Pone el formulario en modo edición con los datos del modelo a modificar. */
function modoEdicion(modelo) {
  $fmId.value            = modelo.id;
  $fmNombre.value        = modelo.nombre;
  $fmProveedor.value     = modelo.proveedor;
  $fmEndpoint.value      = modelo.endpoint;
  $fmModelo.value        = modelo.modelo;
  $fmApiKey.value        = "";            // nunca mostramos la key real (viene enmascarada)
  $fmApiKeyNota.hidden   = false;         // aviso: "dejá vacío para conservar la key"
  $btnGuardarModelo.textContent = "💾 Actualizar";
  $btnCancelarEditar.hidden     = false;
  $config.open = true;                    // abrimos el panel si estaba cerrado
  $fmNombre.focus();
}

/** Vuelve el formulario al estado de alta de nuevo modelo. */
function modoCarga() {
  $fmId.value            = "";
  $fmNombre.value        = "";
  $fmApiKey.value        = "";
  $fmApiKeyNota.hidden   = true;
  $btnGuardarModelo.textContent = "💾 Guardar";
  $btnCancelarEditar.hidden     = true;
  aplicarPreset($fmProveedor.value); // restaura endpoint/modelo del preset actual
}

/** Maneja el submit del formulario: crea o actualiza según haya id o no. */
async function guardarModelo(evento) {
  evento.preventDefault();
  const id = $fmId.value;

  const payload = {
    nombre:    $fmNombre.value.trim(),
    proveedor: $fmProveedor.value,
    endpoint:  $fmEndpoint.value.trim(),
    modelo:    $fmModelo.value.trim(),
    api_key:   $fmApiKey.value.trim(),
  };

  $btnGuardarModelo.disabled = true;

  try {
    const url    = id ? `/api/modelos/${id}` : "/api/modelos";
    const method = id ? "PUT" : "POST";

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.json();
      mostrarSalida("❌ " + (err.error || "Error al guardar el modelo."));
      return;
    }

    modoCarga();
    await cargarModelos();
  } catch (err) {
    mostrarSalida("❌ Error de red: " + err.message);
  } finally {
    $btnGuardarModelo.disabled = false;
  }
}

/** Activa el modelo con el id dado (desactiva el resto vía backend). */
async function activarModelo(id) {
  try {
    const resp = await fetch(`/api/modelos/${id}/activar`, { method: "PUT" });
    if (!resp.ok) {
      const err = await resp.json();
      mostrarSalida("❌ " + (err.error || "Error al activar el modelo."));
      return;
    }
    await cargarModelos();
  } catch (err) {
    mostrarSalida("❌ Error de red: " + err.message);
  }
}

/** Elimina el modelo con el id dado, pidiendo confirmación primero. */
async function borrarModelo(id) {
  const modelo = modelosCache.find((m) => m.id === id);
  if (!modelo) return;
  if (!confirm(`¿Borrar el modelo "${modelo.nombre}"?`)) return;

  try {
    const resp = await fetch(`/api/modelos/${id}`, { method: "DELETE" });
    if (!resp.ok) {
      const err = await resp.json();
      mostrarSalida("❌ " + (err.error || "Error al borrar el modelo."));
      return;
    }
    await cargarModelos();
  } catch (err) {
    mostrarSalida("❌ Error de red: " + err.message);
  }
}

/**
 * Maneja los clics en la lista de modelos usando delegación de eventos.
 * Un solo listener cubre los botones Activar, Editar y Borrar.
 */
function alClickListaModelos(evento) {
  const btn = evento.target.closest("[data-accion]");
  if (!btn) return;

  const id     = Number(btn.dataset.id);
  const accion = btn.dataset.accion;

  if (accion === "activar") activarModelo(id);
  if (accion === "borrar")  borrarModelo(id);
  if (accion === "editar") {
    const modelo = modelosCache.find((m) => m.id === id);
    if (modelo) modoEdicion(modelo);
  }
}

// Disparado por el comando de voz "enviar".
function enviarTexto(texto) {
  console.log("[enviarTexto] mensaje preparado:", texto);
  mostrarSalida("📨 Mensaje preparado para enviar:\n\n" + texto);
}

// Disparado por el botón "Generar con IA".
// Delega toda la lógica de IA al backend; nunca sale la key al navegador.
async function generarConIA() {
  const texto = $texto.value.trim();
  if (!texto) return;

  $btnGenerar.disabled = true;
  mostrarSalida("Generando…");

  try {
    const resp = await fetch("/api/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });

    const datos = await resp.json();

    if (!resp.ok) {
      mostrarSalida("❌ Error: " + (datos.error || `HTTP ${resp.status}`));
      return;
    }

    mostrarSalida(datos.resultado ?? "(sin respuesta del proveedor)");
  } catch (err) {
    mostrarSalida("❌ Error de red: " + err.message);
  } finally {
    // Re-habilita el botón solo si sigue habiendo un modelo activo.
    const activo = modelosCache.find((m) => m.activo);
    $btnGenerar.disabled = !activo;
  }
}

/** Inicializa el ABM de modelos y conecta los eventos del formulario. */
function iniciarABM() {
  // Carga inicial de la lista desde el backend.
  cargarModelos();
  // Carga los presets de proveedores (fuente única) y dispara el autofill inicial.
  cargarProveedoresPresets();

  // Autofill al cambiar proveedor en el formulario.
  $fmProveedor.addEventListener("change", () => aplicarPreset($fmProveedor.value));

  // Submit del formulario (alta o edición).
  $formModelo.addEventListener("submit", guardarModelo);

  // Cancelar modo edición.
  $btnCancelarEditar.addEventListener("click", modoCarga);

  // Delegación de eventos en la lista (Activar / Editar / Borrar).
  $listaModelos.addEventListener("click", alClickListaModelos);
}

// =============================================================
//  5. UI / arranque
// =============================================================
function mostrarSalida(contenido) {
  $salida.hidden = false;
  $salidaContenido.textContent = contenido;
}

function mostrarAviso(mensaje) {
  $aviso.hidden = false;
  $aviso.textContent = mensaje;
}

function pintarListaComandos() {
  $listaComandos.innerHTML = "";
  for (const [frase, { descripcion }] of Object.entries(comandos)) {
    const li = document.createElement("li");
    li.innerHTML = `<code>${frase}</code> — ${descripcion}`;
    $listaComandos.appendChild(li);
  }
}

function init() {
  pintarListaComandos();

  if (!SpeechRecognition) {
    mostrarAviso(
      "Tu navegador no soporta la Web Speech API. Usá Chrome o Edge de escritorio."
    );
    $btnEscuchar.disabled = true;
  }

  $btnEscuchar.addEventListener("click", alternarEscucha);
  $btnGenerar.addEventListener("click", generarConIA);

  // ABM de modelos de IA (sección 4).
  iniciarABM();
}

init();
