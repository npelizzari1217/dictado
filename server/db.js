// =============================================================
//  dictado — capa de base de datos
//  Usa better-sqlite3 (síncrono). Abre/crea dictado.db en la
//  misma carpeta server/ y exporta funciones de acceso a datos.
// =============================================================

"use strict";

const Database = require("better-sqlite3");
const path     = require("path");

// El archivo .db vive junto a este módulo, en server/
const db = new Database(path.join(__dirname, "dictado.db"));

// WAL mejora la concurrencia de lecturas; foreign_keys por buena práctica.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ----- Esquema -----
db.exec(`
  CREATE TABLE IF NOT EXISTS modelos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT    NOT NULL,
    proveedor  TEXT    NOT NULL,
    endpoint   TEXT    NOT NULL,
    modelo     TEXT    NOT NULL,
    api_key    TEXT    NOT NULL,
    activo     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL
  )
`);

// ----- Sentencias preparadas -----
const stmts = {
  listar:           db.prepare("SELECT * FROM modelos ORDER BY created_at DESC"),
  obtener:          db.prepare("SELECT * FROM modelos WHERE id = ?"),
  insertar:         db.prepare(`
    INSERT INTO modelos (nombre, proveedor, endpoint, modelo, api_key, activo, created_at)
    VALUES (@nombre, @proveedor, @endpoint, @modelo, @api_key, @activo, @created_at)
  `),
  actualizar:       db.prepare(`
    UPDATE modelos
    SET nombre    = @nombre,
        proveedor = @proveedor,
        endpoint  = @endpoint,
        modelo    = @modelo,
        api_key   = @api_key
    WHERE id = @id
  `),
  eliminar:         db.prepare("DELETE FROM modelos WHERE id = ?"),
  contarTotal:      db.prepare("SELECT COUNT(*) AS cnt FROM modelos"),
  desactivarTodos:  db.prepare("UPDATE modelos SET activo = 0"),
  activarUno:       db.prepare("UPDATE modelos SET activo = 1 WHERE id = ?"),
  obtenerActivo:    db.prepare("SELECT * FROM modelos WHERE activo = 1 LIMIT 1"),
  obtenerMasReciente: db.prepare("SELECT * FROM modelos ORDER BY created_at DESC LIMIT 1"),
};

// Activa un modelo y desactiva todos los demás, dentro de una transacción.
// Garantiza que siempre haya exactamente cero o uno activo.
const txActivar = db.transaction((id) => {
  stmts.desactivarTodos.run();
  return stmts.activarUno.run(id).changes; // 0 si el id no existe
});

module.exports = {
  listar:             ()      => stmts.listar.all(),
  obtener:            (id)    => stmts.obtener.get(id),
  insertar:           (datos) => stmts.insertar.run(datos).lastInsertRowid,
  actualizar:         (datos) => stmts.actualizar.run(datos).changes,
  eliminar:           (id)    => stmts.eliminar.run(id).changes,
  contarTotal:        ()      => stmts.contarTotal.get().cnt,
  activar:            (id)    => txActivar(id),
  obtenerActivo:      ()      => stmts.obtenerActivo.get(),
  obtenerMasReciente: ()      => stmts.obtenerMasReciente.get(),
};
