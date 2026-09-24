/**
 * supabase-client.js
 * -----------------------------------------------------------------------
 * Crea el cliente de Supabase que usa db.js para toda la persistencia.
 *
 * La URL y la clave publicable ("publishable key" / anon key) NUNCA se
 * escriben en este archivo. Se leen de `window.FXL_SUPABASE_URL` y
 * `window.FXL_SUPABASE_ANON_KEY`, que a su vez pone `config.js`:
 *
 *   - En Vercel, `config.js` se genera automáticamente en cada deploy a
 *     partir de las variables de entorno del proyecto (ver build-config.js
 *     y las instrucciones de la sección "Vercel" en README.md).
 *   - En desarrollo local, copiá `config.example.js` a `config.js` y
 *     completá tus propios valores (ese archivo no se debe subir a git).
 *
 * Este archivo debe cargarse en index.html DESPUÉS de config.js y del SDK
 * de Supabase (`@supabase/supabase-js`, cargado por CDN), y ANTES de
 * db.js, ya que db.js usa `window.Supa.client`.
 * -----------------------------------------------------------------------
 */

const Supa = (() => {
  const url = (typeof window !== 'undefined' && window.FXL_SUPABASE_URL) || '';
  const anonKey = (typeof window !== 'undefined' && window.FXL_SUPABASE_ANON_KEY) || '';

  let client = null;
  let configError = null;

  if (!url || !anonKey) {
    configError =
      'Falta configurar Supabase: no se encontraron FXL_SUPABASE_URL / FXL_SUPABASE_ANON_KEY. ' +
      'Revisá config.js (en local, copiá config.example.js) o las variables de entorno de Vercel ' +
      '(SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY).';
    console.error('[Fútbol XL Studio] ' + configError);
  } else if (typeof window === 'undefined' || !window.supabase || typeof window.supabase.createClient !== 'function') {
    configError =
      'No se pudo cargar el SDK de Supabase (@supabase/supabase-js). Verificá que el <script> del ' +
      'CDN esté antes de supabase-client.js en index.html y que haya conexión a internet.';
    console.error('[Fútbol XL Studio] ' + configError);
  } else {
    client = window.supabase.createClient(url, anonKey, {
      auth: {
        // Mantiene la sesión iniciada y renueva el token automáticamente.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'fxl-studio-auth',
      },
    });
  }

  return { client, configError, url };
})();
