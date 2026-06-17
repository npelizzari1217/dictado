// =============================================================
//  dictado — servidor Express
//  Sirve el front como archivos estáticos (mismo origen, sin CORS)
//  y expone una API JSON para el ABM de modelos y la generación
//  con IA desde el servidor (sin exponer las API keys al cliente).
// =============================================================

"use strict";

const express = require("express");
const path    = require("path");
const db      = require("./db.js");

const app  = express();
const PORT = process.env.PORT || 3000;

// ----- Middleware -----
app.use(express.json());
// La raíz del proyecto está un nivel arriba de server/
app.use(express.static(path.join(__dirname, "..")));

// =============================================================
//  Utilidades
// =============================================================

/**
 * Enmascara la api_key para que nunca salga completa al cliente.
 * Muestra los primeros 3 caracteres + "…" + los últimos 4.
 */
function enmascararKey(key) {
  if (!key || key.length <= 7) return "••••";
  return key.slice(0, 3) + "…" + key.slice(-4);
}

/**
 * Deriva el formato de llamada a partir del proveedor.
 * openai / deepseek / minimax / custom → "openai" (mismo adaptador)
 * anthropic → "anthropic"
 * gemini    → "gemini"
 */
function formatoDe(proveedor) {
  if (["openai", "deepseek", "minimax", "custom"].includes(proveedor)) return "openai";
  return proveedor;
}

/**
 * Llama al proveedor de IA con el texto dado y devuelve el contenido generado.
 * Node 18+ tiene fetch nativo; no hace falta ninguna dependencia extra.
 */
async function llamarIA(modelo, texto) {
  const { proveedor, endpoint, modelo: modeloId, api_key } = modelo;
  const formato = formatoDe(proveedor);

  let url, headers, body;

  if (formato === "openai") {
    url     = endpoint;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api_key}`,
    };
    body = {
      model:    modeloId,
      messages: [{ role: "user", content: texto }],
    };

  } else if (formato === "anthropic") {
    url     = endpoint;
    headers = {
      "Content-Type":      "application/json",
      "x-api-key":         api_key,
      "anthropic-version": "2023-06-01",
      // Llamada server-side: no necesitamos el header de acceso directo del navegador.
    };
    body = {
      model:      modeloId,
      max_tokens: 1024,
      messages:   [{ role: "user", content: texto }],
    };

  } else if (formato === "gemini") {
    // Gemini lleva el modelo dentro de la URL.
    url     = endpoint.replace("{model}", modeloId);
    headers = {
      "Content-Type":   "application/json",
      "x-goog-api-key": api_key,
    };
    body = { contents: [{ parts: [{ text: texto }] }] };

  } else {
    throw new Error(`Formato de proveedor desconocido: ${formato}`);
  }

  const respuesta = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`HTTP ${respuesta.status} — ${detalle.slice(0, 400)}`);
  }

  const datos = await respuesta.json();

  // Extrae el texto de la respuesta según el formato del proveedor.
  if (formato === "openai")    return datos?.choices?.[0]?.message?.content;
  if (formato === "anthropic") return datos?.content?.[0]?.text;
  if (formato === "gemini")    return datos?.candidates?.[0]?.content?.parts?.[0]?.text;
}

// =============================================================
//  GET /api/proveedores — presets de endpoint + modelo por proveedor
//  El front los usa para autocompletar el formulario.
// =============================================================
const PROVEEDORES_PRESETS = {
  openai:    { endpoint: "https://api.openai.com/v1/chat/completions",                                       modelo: "gpt-4o-mini"       },
  deepseek:  { endpoint: "https://api.deepseek.com/v1/chat/completions",                                     modelo: "deepseek-chat"     },
  minimax:   { endpoint: "https://api.minimax.io/v1/text/chatcompletion_v2",                                 modelo: "MiniMax-Text-01"   },
  anthropic: { endpoint: "https://api.anthropic.com/v1/messages",                                            modelo: "claude-sonnet-4-6" },
  gemini:    { endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",  modelo: "gemini-3.1-flash-lite" },
  custom:    { endpoint: "http://localhost:1234/v1/chat/completions",                                         modelo: "local-model"       },
};

app.get("/api/proveedores", (_req, res) => {
  res.json(PROVEEDORES_PRESETS);
});

// =============================================================
//  GET /api/modelos — lista todos los modelos (key enmascarada)
// =============================================================
app.get("/api/modelos", (_req, res) => {
  const modelos = db.listar().map((m) => ({
    ...m,
    api_key: enmascararKey(m.api_key),
  }));
  res.json(modelos);
});

// =============================================================
//  POST /api/modelos — crea un nuevo modelo
// =============================================================
app.post("/api/modelos", (req, res) => {
  const { nombre, proveedor, endpoint, modelo, api_key } = req.body || {};

  const faltantes = ["nombre", "proveedor", "endpoint", "modelo", "api_key"]
    .filter((campo) => !req.body?.[campo]?.trim?.());

  if (faltantes.length) {
    return res.status(400).json({
      error: `Campos requeridos faltantes: ${faltantes.join(", ")}`,
    });
  }

  // Si es el primer modelo, queda activo automáticamente.
  const total  = db.contarTotal();
  const activo = total === 0 ? 1 : 0;

  const id = db.insertar({
    nombre:     nombre.trim(),
    proveedor:  proveedor.trim(),
    endpoint:   endpoint.trim(),
    modelo:     modelo.trim(),
    api_key:    api_key.trim(),
    activo,
    created_at: new Date().toISOString(),
  });

  const creado = db.obtener(id);
  res.status(201).json({ ...creado, api_key: enmascararKey(creado.api_key) });
});

// =============================================================
//  PUT /api/modelos/:id — actualiza un modelo
//  Si api_key viene vacía o ausente, conserva la guardada.
// =============================================================
app.put("/api/modelos/:id", (req, res) => {
  const id = Number(req.params.id);
  const existente = db.obtener(id);
  if (!existente) return res.status(404).json({ error: "Modelo no encontrado" });

  const { nombre, proveedor, endpoint, modelo, api_key } = req.body || {};

  // api_key vacía o ausente → conservamos la que ya estaba guardada.
  const keyFinal = api_key?.trim() || existente.api_key;

  db.actualizar({
    id,
    nombre:    (nombre    != null ? nombre    : existente.nombre).trim(),
    proveedor: (proveedor != null ? proveedor : existente.proveedor).trim(),
    endpoint:  (endpoint  != null ? endpoint  : existente.endpoint).trim(),
    modelo:    (modelo    != null ? modelo    : existente.modelo).trim(),
    api_key:   keyFinal,
  });

  const actualizado = db.obtener(id);
  res.json({ ...actualizado, api_key: enmascararKey(actualizado.api_key) });
});

// =============================================================
//  DELETE /api/modelos/:id — elimina un modelo
//  Si era el activo y quedan otros, activa el más reciente.
// =============================================================
app.delete("/api/modelos/:id", (req, res) => {
  const id = Number(req.params.id);
  const existente = db.obtener(id);
  if (!existente) return res.status(404).json({ error: "Modelo no encontrado" });

  db.eliminar(id);

  // Después del borrado, si el eliminado era el activo y quedan otros,
  // activamos el más reciente automáticamente.
  if (existente.activo) {
    const masReciente = db.obtenerMasReciente();
    if (masReciente) db.activar(masReciente.id);
  }

  res.json({ ok: true });
});

// =============================================================
//  PUT /api/modelos/:id/activar — activa uno, desactiva el resto
//  La exclusividad se garantiza con una transacción en db.activar().
// =============================================================
app.put("/api/modelos/:id/activar", (req, res) => {
  const id = Number(req.params.id);
  const existente = db.obtener(id);
  if (!existente) return res.status(404).json({ error: "Modelo no encontrado" });

  db.activar(id);
  res.json({ ok: true });
});

// =============================================================
//  POST /api/generar — genera texto usando el modelo activo
// =============================================================
app.post("/api/generar", async (req, res) => {
  const { texto } = req.body || {};
  if (!texto?.trim()) {
    return res.status(400).json({ error: "Falta el campo 'texto'" });
  }

  const activo = db.obtenerActivo();
  if (!activo) {
    return res.status(400).json({
      error: "No hay ningún modelo activo. Configurá uno en el panel de modelos.",
    });
  }

  try {
    const resultado = await llamarIA(activo, texto.trim());
    res.json({ resultado: resultado ?? "(sin respuesta del proveedor)" });
  } catch (err) {
    console.error("[/api/generar] error upstream:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// =============================================================
//  Arranque
// =============================================================
app.listen(PORT, () => {
  console.log(`[dictado] servidor en http://localhost:${PORT}`);
});
