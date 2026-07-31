#!/usr/bin/env node
/**
 * build-config.js
 * -----------------------------------------------------------------------
 * Fútbol XL Studio sigue siendo un sitio 100% estático (sin framework, sin
 * bundler, sin servidor). Por eso no tiene acceso automático a las
 * variables de entorno de Vercel desde el JavaScript del navegador: hace
 * falta este pequeño paso, que Vercel ejecuta una sola vez en cada deploy
 * ANTES de publicar los archivos ("Build Command").
 *
 * Lo único que hace es generar `config.js` a partir de las variables de
 * entorno configuradas en el proyecto de Vercel, para que
 * supabase-client.js las pueda leer en el navegador como
 * `window.FXL_SUPABASE_URL` / `window.FXL_SUPABASE_ANON_KEY`.
 *
 * Configuración necesaria en Vercel (Project Settings → Environment
 * Variables):
 *   - SUPABASE_URL              -> ej: https://wpugmybtretxcdiowasj.supabase.co
 *   - SUPABASE_PUBLISHABLE_KEY  -> tu clave publicable (anon key) de Supabase
 *
 * Y en Project Settings → Build & Development Settings:
 *   - Framework Preset: Other
 *   - Build Command:    node build-config.js
 *   - Output Directory: . (la raíz del proyecto)
 *
 * No hace falta ningún paquete de npm: este script solo usa el módulo
 * `fs` incluido en Node, que es el runtime que ya usa Vercel para correr
 * el Build Command.
 * -----------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';

if (!url || !anonKey) {
  console.warn(
    '[build-config] Aviso: falta SUPABASE_URL y/o SUPABASE_PUBLISHABLE_KEY en las variables de ' +
      'entorno de Vercel. Se generó config.js igual, pero la app va a mostrar un error de ' +
      'configuración hasta que las completes en Project Settings → Environment Variables.'
  );
}

const contents = `/**
 * config.js — generado automáticamente por build-config.js en cada deploy.
 * NO editar a mano en producción: los valores salen de las variables de
 * entorno de Vercel (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY).
 */
window.FXL_SUPABASE_URL = ${JSON.stringify(url)};
window.FXL_SUPABASE_ANON_KEY = ${JSON.stringify(anonKey)};
`;

fs.writeFileSync(path.join(__dirname, 'config.js'), contents, 'utf8');
console.log('[build-config] config.js generado correctamente.');
