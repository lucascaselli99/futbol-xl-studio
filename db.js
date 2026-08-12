/**
 * db.js
 * -----------------------------------------------------------------------
 * Capa de acceso a datos. Desde esta versión, toda la persistencia de
 * Fútbol XL Studio vive en Supabase (Postgres), no en IndexedDB.
 *
 * ESTE ARCHIVO ES EL ÚNICO QUE CAMBIÓ para hacer esa migración: expone
 * exactamente la misma API pública que la versión basada en IndexedDB
 * (mismos nombres de función, mismos parámetros, mismos valores de
 * retorno), así que app.js y components.js no necesitaron ningún cambio.
 *
 * Colecciones (antes "object stores" de IndexedDB, ahora tablas de
 * Supabase — ver supabase-schema.sql para el SQL completo):
 *   - videos              (id)   -> registros de video completos
 *   - series              (id)
 *   - formats             (id)
 *   - contentTypes        (id)   -> tabla content_types
 *   - states              (id)   -> definen dinámicamente las columnas del Kanban
 *   - priorities          (id)
 *   - tags                (id)
 *   - checklistTemplates  (id)   -> tabla checklist_templates
 *   - settings            (key)  -> documento único 'app' con preferencias e identidad
 *   - meta                (key)  -> logo (dataURL), versión de esquema, flags internas
 *   - libraryFolders      (id)   -> tabla library_folders
 *   - libraryItems        (id)   -> tabla library_items
 *   - expenseCategories   (id)   -> tabla expense_categories
 *   - expenseTypes        (id)   -> tabla expense_types
 *   - paymentMethods      (id)   -> tabla payment_methods
 *   - currencies          (id)
 *   - recipients          (id)
 *   - expenses            (id)
 *   - subscriptions       (id)
 *
 * Todas las relaciones (video -> serie/formato/estado/etiquetas/plantilla,
 * recurso -> carpeta/etiquetas/videos relacionados, gasto -> categoría/tipo/
 * medio de pago/moneda/proveedor/video o serie asociada) se guardan por ID,
 * nunca por nombre, para que renombrar una serie, un estado, una carpeta o
 * una categoría de gasto no rompa las referencias existentes. Esto no
 * cambió con la migración.
 *
 * DISEÑO DE LAS TABLAS EN SUPABASE
 * ---------------------------------
 * Cada colección es una tabla "documento": clave primaria (`id`, o `key`
 * en settings/meta, igual que el `keyPath` que usaba IndexedDB) + una
 * columna `data jsonb` con el objeto completo. Así el resto de la app
 * puede seguir mandando y recibiendo los mismos objetos JS de siempre,
 * sin tener que mapear campo por campo a columnas SQL. El filtrado, orden
 * y búsqueda se siguen resolviendo en el navegador (como con IndexedDB):
 * esta capa solo necesita poder traer todo, traer uno, guardar, borrar y
 * vaciar cada tabla.
 *
 * DATOS DE EJEMPLO / SEED AUTOMÁTICO
 * ------------------------------------
 * A diferencia de la versión con IndexedDB, esta versión NUNCA crea datos
 * de arranque automáticamente: si la base de Supabase está vacía, la app
 * se muestra vacía. Las funciones `seedIfEmpty`, `seedLibraryIfEmpty`,
 * `seedCostsTaxonomyIfEmpty` y `seedCostsSampleDataIfEmpty` se mantienen
 * (mismo nombre, misma firma, siguen pudiendo llamarse sin romper nada)
 * pero ahora no hacen nada: existen solo para que app.js —que las llama
 * en el arranque— no necesite ningún cambio. Quien quiera datos de
 * ejemplo los pide explícitamente desde Configuración → Datos y respaldo
 * ("Restaurar datos de ejemplo", que sigue funcionando igual que antes).
 *
 * MIGRACIÓN AUTOMÁTICA DESDE INDEXEDDB
 * ---------------------------------------
 * La primera vez que la app corre en un navegador contra esta versión,
 * `open()` revisa si ese navegador tiene datos guardados en la vieja base
 * de IndexedDB (`fxlStudioDB`) y, si los tiene y Supabase todavía está
 * vacío, los sube automáticamente (una sola vez, marcado con una bandera
 * en localStorage para no repetirlo ni duplicar datos). La base de
 * IndexedDB original NO se borra: queda intacta como copia local, aunque
 * la app ya no la vuelva a usar después de migrar.
 * -----------------------------------------------------------------------
 */

const DB = (() => {
  const DB_NAME = 'fxlStudioDB';
  const DB_VERSION = 3;

  const STORE_NAMES = [
    'videos',
    'series',
    'formats',
    'contentTypes',
    'states',
    'priorities',
    'tags',
    'checklistTemplates',
    'settings',
    'meta',
    'libraryFolders',
    'libraryItems',
    'expenseCategories',
    'expenseTypes',
    'paymentMethods',
    'currencies',
    'recipients',
    'expenses',
    'subscriptions',
    'employees',
    'quickNotes',
    'seriesPlanner',
    'notifications',
  ];

  // Nombre de tabla en Supabase para cada colección (snake_case, como es
  // convención en SQL). Ver supabase-schema.sql.
  const STORE_TABLE = {
    videos: 'videos',
    series: 'series',
    formats: 'formats',
    contentTypes: 'content_types',
    states: 'states',
    priorities: 'priorities',
    tags: 'tags',
    checklistTemplates: 'checklist_templates',
    settings: 'settings',
    meta: 'meta',
    libraryFolders: 'library_folders',
    libraryItems: 'library_items',
    expenseCategories: 'expense_categories',
    expenseTypes: 'expense_types',
    paymentMethods: 'payment_methods',
    currencies: 'currencies',
    recipients: 'recipients',
    expenses: 'expenses',
    subscriptions: 'subscriptions',
    employees: 'employees',
    quickNotes: 'quick_notes',
    seriesPlanner: 'series_planner',
    notifications: 'notifications',
  };

  // Columna que actúa de clave primaria en cada tabla (equivalente al
  // `keyPath` de IndexedDB). Todo lo que no está acá usa 'id'.
  const KEY_COLUMN = { settings: 'key', meta: 'key' };

  function tableNameFor(storeName) {
    const t = STORE_TABLE[storeName];
    if (!t) throw new Error(`db.js: colección desconocida "${storeName}".`);
    return t;
  }

  function keyColumnFor(storeName) {
    return KEY_COLUMN[storeName] || 'id';
  }

  /** Devuelve el cliente de Supabase ya creado por supabase-client.js, o lanza un error claro si falta configurar algo. */
  function ensureClient() {
    if (typeof Supa === 'undefined' || !Supa.client) {
      const reason = (typeof Supa !== 'undefined' && Supa.configError) || 'Supabase no está configurado.';
      throw new Error(reason);
    }
    return Supa.client;
  }

  /* ------------------------------------------------------------------ */
  /* Migración automática, una sola vez, desde la vieja base IndexedDB   */
  /* ------------------------------------------------------------------ */

  const MIGRATION_FLAG_KEY = 'fxlStudio_migratedToSupabase_v1';
  const LEGACY_DB_NAME = DB_NAME; // misma base que usaban las versiones anteriores

  function migrationAlreadyMarkedDone() {
    try {
      return localStorage.getItem(MIGRATION_FLAG_KEY) === '1';
    } catch (e) {
      return false; // sin localStorage (ej. modo privado estricto): se reintenta cada vez, sin romper nada.
    }
  }

  function markMigrationDone() {
    try {
      localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    } catch (e) {
      /* no crítico */
    }
  }

  /** Abre la vieja base de IndexedDB SOLO para leerla, sin crear ni tocar ningún esquema. */
  function openLegacyIndexedDBReadOnly() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      let settled = false;
      let req;
      try {
        req = indexedDB.open(LEGACY_DB_NAME);
      } catch (e) {
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        // Si dispara onupgradeneeded es porque la base no existía todavía en
        // este navegador: se está creando una nueva y vacía. No hay nada
        // que migrar, así que no se define ningún object store nuevo acá.
      };
      req.onsuccess = () => {
        settled = true;
        resolve(req.result);
      };
      req.onerror = () => {
        if (!settled) resolve(null);
      };
      req.onblocked = () => {
        if (!settled) resolve(null);
      };
    });
  }

  /** Lee todas las colecciones existentes en la vieja base de IndexedDB (si la hay). */
  async function readAllFromLegacyIndexedDB() {
    const idb = await openLegacyIndexedDBReadOnly();
    if (!idb) return null;
    try {
      const existingStores = Array.from(idb.objectStoreNames || []);
      if (!existingStores.length) {
        idb.close();
        return null;
      }
      const result = {};
      for (const storeName of STORE_NAMES) {
        if (!existingStores.includes(storeName)) {
          result[storeName] = [];
          continue;
        }
        result[storeName] = await new Promise((resolve, reject) => {
          const t = idb.transaction(storeName, 'readonly');
          const req = t.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      }
      idb.close();
      return result;
    } catch (e) {
      console.warn('[Fútbol XL Studio] No se pudo leer la base local de IndexedDB para migrar a Supabase:', e);
      try {
        idb.close();
      } catch (_) {
        /* noop */
      }
      return null;
    }
  }

  function legacyDataIsEffectivelyEmpty(data) {
    if (!data) return true;
    return STORE_NAMES.every((name) => !(data[name] && data[name].length));
  }

  /** true si Supabase ya tiene contenido en ALGUNA colección (para no pisar datos reales con la migración automática). */
  async function supabaseAlreadyHasData() {
    const supa = ensureClient();
    for (const storeName of STORE_NAMES) {
      try {
        const { count, error } = await supa.from(tableNameFor(storeName)).select('*', { count: 'exact', head: true });
        if (!error && (count || 0) > 0) return true;
      } catch (e) {
        // si falla el chequeo de una tabla puntual, se sigue revisando el resto
      }
    }
    return false;
  }

  async function recordMigrationStatus(migrated, source) {
    try {
      const supa = ensureClient();
      await supa.from('fxl_migration_status').upsert(
        {
          id: 'default',
          migrated,
          migrated_at: migrated ? new Date().toISOString() : null,
          source: source || null,
        },
        { onConflict: 'id' }
      );
    } catch (e) {
      // No crítico: la bandera que realmente evita repetir la migración vive en localStorage.
    }
  }

  /**
   * Si este navegador tiene datos guardados en la vieja base de IndexedDB
   * y Supabase todavía no tiene nada, los sube una sola vez. Se ejecuta
   * automáticamente dentro de open(), así que no requiere ningún cambio
   * en app.js.
   */
  async function migrateFromIndexedDBIfNeeded() {
    if (migrationAlreadyMarkedDone()) return;

    const legacyData = await readAllFromLegacyIndexedDB();
    if (legacyDataIsEffectivelyEmpty(legacyData)) {
      markMigrationDone();
      return;
    }

    const alreadyHasRemoteData = await supabaseAlreadyHasData();
    if (alreadyHasRemoteData) {
      // Ya hay datos reales en Supabase (por ejemplo, se cargaron a mano o
      // desde otro navegador): no se sobreescribe nada automáticamente.
      markMigrationDone();
      return;
    }

    console.info('[Fútbol XL Studio] Migrando datos locales de IndexedDB a Supabase (una sola vez)...');
    try {
      for (const storeName of STORE_NAMES) {
        const records = legacyData[storeName];
        if (records && records.length) {
          await bulkPut(storeName, records);
        }
      }
      markMigrationDone();
      await recordMigrationStatus(true, 'indexeddb-auto');
      console.info('[Fútbol XL Studio] Migración a Supabase completada.');
    } catch (e) {
      // Si algo falla a mitad de camino, NO se marca como completa para
      // poder reintentar en la próxima carga; los datos locales de
      // IndexedDB no se tocan en ningún momento de este proceso.
      console.error('[Fútbol XL Studio] Falló la migración automática a Supabase, se reintentará en el próximo arranque:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  let openPromise = null;

  /**
   * Antes abría (o creaba) la base de IndexedDB. Ahora valida que el
   * cliente de Supabase esté configurado y dispara, si corresponde, la
   * migración automática de datos locales. Se mantiene el mismo nombre y
   * contrato (una función que devuelve una promesa) para que app.js siga
   * llamando `await DB.open()` sin cambios.
   */
  function open() {
    if (openPromise) return openPromise;
    openPromise = (async () => {
      const supa = ensureClient();
      await migrateFromIndexedDBIfNeeded();
      return supa;
    })();
    return openPromise;
  }

  /* ------------------------------------------------------------------ */
  /* CRUD genérico (ahora contra Supabase)                               */
  /* ------------------------------------------------------------------ */

  async function getAll(storeName) {
    const supa = ensureClient();
    const { data, error } = await supa.from(tableNameFor(storeName)).select('data');
    if (error) throw new Error(`No se pudo leer "${storeName}" desde Supabase: ${error.message}`);
    return (data || []).map((row) => row.data);
  }

  async function get(storeName, key) {
    const supa = ensureClient();
    const kc = keyColumnFor(storeName);
    const { data, error } = await supa.from(tableNameFor(storeName)).select('data').eq(kc, key).maybeSingle();
    if (error) throw new Error(`No se pudo leer "${storeName}/${key}" desde Supabase: ${error.message}`);
    return data ? data.data : undefined;
  }

  async function put(storeName, value) {
    const supa = ensureClient();
    const kc = keyColumnFor(storeName);
    const row = { [kc]: value[kc], data: value };
    const { error } = await supa.from(tableNameFor(storeName)).upsert(row, { onConflict: kc });
    if (error) throw new Error(`No se pudo guardar en "${storeName}": ${error.message}`);
    return value;
  }

  async function bulkPut(storeName, values) {
    if (!values || !values.length) return values || [];
    const supa = ensureClient();
    const kc = keyColumnFor(storeName);
    const rows = values.map((v) => ({ [kc]: v[kc], data: v }));
    const { error } = await supa.from(tableNameFor(storeName)).upsert(rows, { onConflict: kc });
    if (error) throw new Error(`No se pudo guardar en lote en "${storeName}": ${error.message}`);
    return values;
  }

  async function remove(storeName, key) {
    const supa = ensureClient();
    const kc = keyColumnFor(storeName);
    const { error } = await supa.from(tableNameFor(storeName)).delete().eq(kc, key);
    if (error) throw new Error(`No se pudo eliminar "${storeName}/${key}": ${error.message}`);
    return true;
  }

  async function clear(storeName) {
    const supa = ensureClient();
    const kc = keyColumnFor(storeName);
    // .not(kc, 'is', null) es un filtro siempre verdadero (la clave primaria
    // nunca es null): equivale a "borrar todas las filas de la tabla".
    const { error } = await supa.from(tableNameFor(storeName)).delete().not(kc, 'is', null);
    if (error) throw new Error(`No se pudo vaciar "${storeName}": ${error.message}`);
    return true;
  }

  /** Elimina todo el contenido de todas las tablas (usado por "Eliminar todos los datos"). */
  async function wipeAll() {
    for (const name of STORE_NAMES) {
      await clear(name);
    }
  }

  /**
   * Estima el uso de almacenamiento del NAVEGADOR (para la pantalla "Ver
   * uso de almacenamiento"). Se mantiene igual que en la versión con
   * IndexedDB a propósito: ahora que los datos viven en Supabase, este
   * número va a ser chico o cero (ya no hay un dataset grande guardado
   * localmente), lo cual es información correcta, no un error. El texto
   * de la interfaz ya aclara "estimado por el navegador".
   */
  async function estimateUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        return { usage: est.usage || 0, quota: est.quota || 0 };
      } catch (e) {
        return { usage: 0, quota: 0 };
      }
    }
    return { usage: 0, quota: 0 };
  }

  /* ------------------------------------------------------------------ */
  /* Datos iniciales (seed)                                              */
  /* ------------------------------------------------------------------ */
  /* Las funciones seedStates/seedFormats/.../seedVideos de acá abajo se   */
  /* mantienen tal cual porque las sigue usando reseedSampleVideos()      */
  /* ("Restaurar datos de ejemplo" en Configuración, una acción explícita */
  /* del usuario). Lo que cambió es que YA NO se llaman solas al arrancar */
  /* la app: ver seedIfEmpty() más abajo.                                 */
  /* ------------------------------------------------------------------ */

  function seedStates() {
    const base = [
      { name: 'Ideas', color: '#8b8b8b', icon: '💡', isInitial: true },
      { name: 'Investigación', color: '#6b7280', icon: '🔎' },
      { name: 'Guion', color: '#64748b', icon: '📝' },
      { name: 'Grabación', color: '#57534e', icon: '🎥' },
      { name: 'Edición', color: '#525252', icon: '✂️' },
      { name: 'Miniatura', color: '#44403c', icon: '🖼️' },
      { name: 'Programado', color: '#3f3f46', icon: '📅' },
      { name: 'Publicado', color: '#16a34a', icon: '✅', isFinal: true },
    ];
    return base.map((s, i) => ({
      id: Utils.uuid(),
      name: s.name,
      color: s.color,
      icon: s.icon,
      order: i,
      isInitial: !!s.isInitial,
      isFinal: !!s.isFinal,
      showInKanban: true,
      archived: false,
    }));
  }

  function seedFormats() {
    const base = [
      { name: 'Video largo', aspectRatio: '16:9', durationHint: '8-15 min', exportNotes: '1920x1080' },
      { name: 'Reel', aspectRatio: '9:16', durationHint: '60-90 seg', exportNotes: '1080x1920' },
      { name: 'Short', aspectRatio: '9:16', durationHint: '30-60 seg', exportNotes: '1080x1920' },
      { name: 'Podcast', aspectRatio: '16:9', durationHint: '30-60 min', exportNotes: '1920x1080 / audio 48kHz' },
      { name: 'Entrevista', aspectRatio: '16:9', durationHint: '10-20 min', exportNotes: '1920x1080' },
      { name: 'Directo', aspectRatio: '16:9', durationHint: 'Variable', exportNotes: 'Streaming 1080p' },
    ];
    const colors = ['#737373', '#525252', '#a3a3a3', '#78716c', '#57534e', '#404040'];
    return base.map((f, i) => ({
      id: Utils.uuid(),
      name: f.name,
      color: colors[i % colors.length],
      icon: '🎬',
      aspectRatio: f.aspectRatio,
      durationHint: f.durationHint,
      exportNotes: f.exportNotes,
      defaultChecklistTemplateId: null,
      suggestedStateIds: [],
      order: i,
      archived: false,
    }));
  }

  function seedSeries() {
    const base = [
      { name: 'El fútbol y el cine', desc: 'Cruces entre el mundo del fútbol y el cine.' },
      { name: 'Historias de camisetas', desc: 'El origen y la historia detrás de camisetas icónicas.' },
      { name: 'Fichajes frustrados', desc: 'Pases que casi ocurren y cambiaron la historia.' },
      { name: 'Escuela de DT', desc: 'Análisis táctico y de dirección técnica.' },
      { name: 'Entrevistas', desc: 'Charlas con protagonistas del mundo del fútbol.' },
    ];
    const colors = ['#a3a3a3', '#737373', '#8a8a8a', '#6b6b6b', '#9c9c9c'];
    return base.map((s, i) => ({
      id: Utils.uuid(),
      name: s.name,
      description: s.desc,
      color: colors[i % colors.length],
      icon: '⚽',
      image: null,
      defaultChecklistTemplateId: null,
      defaultFormatId: null,
      order: i,
      archived: false,
    }));
  }

  function seedContentTypes() {
    const base = ['Análisis', 'Historia', 'Entrevista', 'Noticia', 'Opinión', 'Tutorial', 'Top', 'Reacción', 'Documental'];
    return base.map((name, i) => ({
      id: Utils.uuid(),
      name,
      color: '#71717a',
      icon: '🏷️',
      order: i,
      archived: false,
    }));
  }

  function seedPriorities() {
    const base = [
      { name: 'Baja', color: '#737373' },
      { name: 'Media', color: '#a1a1aa' },
      { name: 'Alta', color: '#d4a017' },
      { name: 'Urgente', color: '#dc2626' },
    ];
    return base.map((p, i) => ({ id: Utils.uuid(), name: p.name, color: p.color, order: i }));
  }

  function seedTags() {
    const base = ['Messi', 'FIFA', 'Mundial 2026', 'Camisetas', 'Mercado de pases', 'Historia', 'Entrevista'];
    const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#c084fc', '#38bdf8', '#f87171'];
    return base.map((name, i) => ({ id: Utils.uuid(), name, color: colors[i % colors.length] }));
  }

  function seedChecklistTemplates(formatIds) {
    const items = (labels) => labels.map((text) => ({ id: Utils.uuid(), text, done: false, subtasks: [] }));
    return [
      {
        id: Utils.uuid(),
        name: 'Video largo (completo)',
        items: items([
          'Investigación terminada',
          'Guion terminado',
          'Grabación terminada',
          'Edición terminada',
          'Miniatura realizada',
          'Descripción completada',
          'Video subido',
          'Video programado',
          'Video publicado',
        ]),
        linkedFormatIds: [],
        linkedSeriesIds: [],
      },
      {
        id: Utils.uuid(),
        name: 'Short / Reel rápido',
        items: items(['Idea definida', 'Grabación', 'Edición', 'Miniatura', 'Publicado']),
        linkedFormatIds: [],
        linkedSeriesIds: [],
      },
    ];
  }

  function defaultSettings() {
    return {
      key: 'app',
      appName: 'Fútbol XL Studio',
      logoDisplay: 'both', // 'logo' | 'name' | 'both'
      showLogoInSidebar: true,
      theme: 'dark',
      accentColor: '#3b82f6',
      dynamicBackgroundMode: 'stadiums', // 'stadiums' | 'minimal'
      weeklyContentPlan: {}, // { 'YYYY-MM-DD': { shirtsVideoId, footballVideoId } }
      defaultView: 'kanban',
      cardsPerColumnLimit: 0,
      cardSize: 'normal',
      showThumbnails: true,
      dateFormat: 'dd/mm/yyyy',
      weekStart: 'monday',
      confirmBeforeDelete: true,
      fileSizeLimitMB: 2,
      autosave: true,
      autosaveIntervalSec: 5,
      showFutureModules: true,

      // --- Preferencias del módulo Biblioteca (agregadas en v1.1.0) ---
      libraryDefaultView: 'grid', // 'grid' | 'list'
      libraryCardSize: 'normal', // 'compact' | 'normal'
      libraryShowThumbnails: true,
      libraryFileSizeLimitMB: 3,
      librarySortBy: 'name-asc', // ver LIBRARY_SORT_OPTIONS en components.js
      libraryConfirmBeforeDelete: true,
      libraryDeleteBehavior: 'archive', // 'archive' | 'delete' | 'ask'
      libraryCompressThumbnails: true,
      libraryThumbnailQuality: 0.72,
      libraryDefaultFolderId: null,
      libraryShowArchived: false,
      libraryPageSize: 60,

      // --- Preferencias del módulo Costos (agregadas en v1.2.0) ---
      costsDefaultCurrencyCode: 'ARS', // moneda preseleccionada en formularios nuevos
      costsUpcomingDaysThreshold: 7, // a partir de cuántos días se considera "vence pronto"
      costsConfirmBeforeDelete: true,
      costsDefaultExpenseTab: 'summary', // 'summary' | 'expenses' | 'subscriptions' | 'settings'
    };
  }

  function makeHistoryEntry(type, message) {
    return { id: Utils.uuid(), type, message, date: Utils.nowISO() };
  }

  function seedVideos(refs) {
    const { states, series, formats, contentTypes, priorities, tags } = refs;
    const byName = (arr) => Object.fromEntries(arr.map((x) => [x.name, x]));
    const S = byName(states);
    const SER = byName(series);
    const F = byName(formats);
    const CT = byName(contentTypes);
    const P = byName(priorities);
    const T = byName(tags);

    const emptyDrive = () => ({
      mainFolder: { url: '', label: 'Carpeta principal' },
      script: { url: '', label: 'Guion' },
      premiere: { url: '', label: 'Premiere' },
      raw: { url: '', label: 'Brutos' },
      inserts: { url: '', label: 'Inserts' },
      thumbnail: { url: '', label: 'Miniatura' },
      finalExport: { url: '', label: 'Exportación final' },
      published: { url: '', label: 'Video publicado' },
    });

    const base = (over) => ({
      id: Utils.uuid(),
      title: '',
      altTitle: '',
      description: '',
      stateId: (S['Ideas'] || states[0]).id,
      seriesId: null,
      formatId: null,
      contentTypeId: null,
      priorityId: (P['Media'] || priorities[0]).id,
      targetDate: null,
      publishDate: null,
      estimatedDuration: '',
      finalDuration: '',
      owner: '',
      favorite: false,
      archived: false,
      tagIds: [],
      driveLinks: emptyDrive(),
      additionalLinks: [],
      idea: '',
      hook: '',
      script: '',
      researchNotes: '',
      editNotes: '',
      thumbnailNotes: '',
      descriptionText: '',
      titleIdeas: '',
      thumbnailIdeas: '',
      checklist: [],
      thumbnail: null,
      images: [],
      comments: [],
      history: [makeHistoryEntry('created', 'Video de ejemplo creado')],
      createdAt: Utils.nowISO(),
      updatedAt: Utils.nowISO(),
      isSample: true,
      ...over,
    });

    const today = new Date();
    const plusDays = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    // Fallbacks defensivos: si el usuario renombró/eliminó un estado o
    // prioridad "de fábrica", se usa el primero disponible en su lugar.
    const sid = (name) => (S[name] || states[0]).id;
    const pid = (name) => (P[name] || priorities[0]).id;

    return [
      base({
        title: 'Por qué Zidane nunca dirigió a la Selección Francesa',
        seriesId: SER['Escuela de DT']?.id,
        formatId: F['Video largo']?.id,
        contentTypeId: CT['Análisis']?.id,
        stateId: sid('Guion'),
        priorityId: pid('Alta'),
        targetDate: plusDays(5),
        tagIds: [T['Historia']?.id].filter(Boolean),
        idea: 'Explorar los motivos tácticos y políticos detrás de la ausencia de Zidane en Les Bleus.',
      }),
      base({
        title: 'La camiseta que Independiente nunca usó',
        seriesId: SER['Historias de camisetas']?.id,
        formatId: F['Short']?.id,
        contentTypeId: CT['Historia']?.id,
        stateId: sid('Ideas'),
        priorityId: pid('Media'),
        targetDate: plusDays(12),
        tagIds: [T['Historia']?.id, T['Camisetas']?.id].filter(Boolean),
      }),
      base({
        title: 'El fichaje que Boca rechazó por $2M',
        seriesId: SER['Fichajes frustrados']?.id,
        formatId: F['Video largo']?.id,
        contentTypeId: CT['Historia']?.id,
        stateId: sid('Edición'),
        priorityId: pid('Urgente'),
        targetDate: plusDays(-2),
        tagIds: [T['Mercado de pases']?.id].filter(Boolean),
      }),
      base({
        title: 'Entrevista con un ex-utilero de la Selección',
        seriesId: SER['Entrevistas']?.id,
        formatId: F['Entrevista']?.id,
        contentTypeId: CT['Entrevista']?.id,
        stateId: sid('Programado'),
        priorityId: pid('Media'),
        targetDate: plusDays(3),
        publishDate: plusDays(7),
        tagIds: [T['Entrevista']?.id].filter(Boolean),
        favorite: true,
      }),
      base({
        title: '5 películas que todo fanático del fútbol debe ver',
        seriesId: SER['El fútbol y el cine']?.id,
        formatId: F['Reel']?.id,
        contentTypeId: CT['Top']?.id,
        stateId: sid('Publicado'),
        priorityId: pid('Baja'),
        targetDate: plusDays(-20),
        publishDate: plusDays(-18),
        tagIds: [T['Mundial 2026']?.id].filter(Boolean),
      }),
    ];
  }

  /**
   * ANTES poblaba la base con datos iniciales (estados, formatos, series,
   * etc.) la primera vez que la app se abría con la base vacía. Desde la
   * migración a Supabase esto ya NO ocurre: si no hay estados configurados,
   * el Kanban se muestra vacío con un botón para ir a Configuración (esa
   * pantalla vacía ya estaba implementada). Se mantiene la función, su
   * nombre y su firma para que app.js no necesite ningún cambio; solo deja
   * de escribir datos.
   */
  async function seedIfEmpty() {
    return false;
  }

  /**
   * Devuelve la configuración de la app, creando el valor por defecto si no
   * existe. Además, si el documento ya existía (por ejemplo, un usuario que
   * viene de una versión anterior) pero le faltan claves nuevas agregadas
   * en una versión posterior (como las de Biblioteca o Costos), se
   * completan con su valor por defecto SIN pisar ninguna preferencia que
   * el usuario ya haya guardado. Esta es la migración "suave" de
   * preferencias, y sigue funcionando igual contra Supabase.
   */
  async function getSettings() {
    let s = await get('settings', 'app');
    const defaults = defaultSettings();
    if (!s) {
      s = defaults;
      await put('settings', s);
      return s;
    }
    const missingKeys = Object.keys(defaults).filter((k) => !(k in s));
    if (missingKeys.length) {
      s = { ...defaults, ...s, key: 'app' };
      await put('settings', s);
    }
    return s;
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const merged = { ...current, ...partial, key: 'app' };
    await put('settings', merged);
    return merged;
  }

  async function getLogo() {
    const m = await get('meta', 'logo');
    return m ? m.dataUrl : null;
  }

  async function setLogo(dataUrl) {
    await put('meta', { key: 'logo', dataUrl });
  }

  /* ------------------------------------------------------------------ */
  /* Exportar / Importar respaldo completo                              */
  /* ------------------------------------------------------------------ */

  async function exportBackup() {
    const [
      videos,
      series,
      formats,
      contentTypes,
      states,
      priorities,
      tags,
      checklistTemplates,
      settings,
      meta,
      libraryFolders,
      libraryItems,
      expenseCategories,
      expenseTypes,
      paymentMethods,
      currencies,
      recipients,
      expenses,
      subscriptions,
      employees,
      quickNotes,
      seriesPlanner,
      notifications,
    ] = await Promise.all([
      getAll('videos'),
      getAll('series'),
      getAll('formats'),
      getAll('contentTypes'),
      getAll('states'),
      getAll('priorities'),
      getAll('tags'),
      getAll('checklistTemplates'),
      getAll('settings'),
      getAll('meta'),
      getAll('libraryFolders'),
      getAll('libraryItems'),
      getAll('expenseCategories'),
      getAll('expenseTypes'),
      getAll('paymentMethods'),
      getAll('currencies'),
      getAll('recipients'),
      getAll('expenses'),
      getAll('subscriptions'),
      getAll('employees'),
      getAll('quickNotes'),
      getAll('seriesPlanner'),
      getAll('notifications'),
    ]);
    return {
      appName: 'Fútbol XL Studio',
      backupVersion: 3,
      schemaVersion: DB_VERSION,
      exportedAt: Utils.nowISO(),
      data: {
        videos,
        series,
        formats,
        contentTypes,
        states,
        priorities,
        tags,
        checklistTemplates,
        settings,
        meta,
        libraryFolders,
        libraryItems,
        expenseCategories,
        expenseTypes,
        paymentMethods,
        currencies,
        recipients,
        expenses,
        subscriptions,
        employees,
        quickNotes,
        seriesPlanner,
        notifications,
      },
    };
  }

  function validateBackup(obj) {
    if (!obj || typeof obj !== 'object') return 'El archivo no contiene un JSON válido.';
    if (!obj.data || typeof obj.data !== 'object') return 'El archivo no tiene el formato esperado (falta "data").';
    const required = ['videos', 'series', 'formats', 'states', 'priorities'];
    for (const key of required) {
      if (!Array.isArray(obj.data[key])) return `Falta o es inválida la colección "${key}".`;
    }
    // Las colecciones agregadas después de la v1.0.0 son opcionales: un
    // respaldo viejo puede no tenerlas y se importa igual, solo que sin
    // ese módulo (Biblioteca y/o Costos, según qué versión lo generó).
    const optional = ['libraryFolders', 'libraryItems', 'expenseCategories', 'expenseTypes', 'paymentMethods', 'currencies', 'recipients', 'expenses', 'subscriptions', 'employees', 'quickNotes', 'seriesPlanner', 'notifications'];
    for (const key of optional) {
      if (obj.data[key] !== undefined && !Array.isArray(obj.data[key])) {
        return `La colección "${key}" del respaldo es inválida.`;
      }
    }
    return null; // sin errores
  }

  /**
   * Importa un respaldo. mode: 'replace' | 'merge'.
   *
   * Sobre colisiones de ID en modo "merge": como todos los IDs son UUID v4
   * generados al azar, una colisión accidental entre un respaldo externo y
   * los datos actuales es prácticamente imposible. Si se importa el MISMO
   * respaldo dos veces, `put()` simplemente sobrescribe el registro con el
   * mismo id por la versión importada (operación idempotente vía upsert en
   * Supabase), no genera duplicados ni corrompe relaciones.
   */
  async function importBackup(obj, mode = 'replace') {
    const err = validateBackup(obj);
    if (err) throw new Error(err);
    const { data } = obj;

    if (mode === 'replace') {
      await wipeAll();
    }

    const collections = [
      'series',
      'formats',
      'contentTypes',
      'states',
      'priorities',
      'tags',
      'checklistTemplates',
      'videos',
      'libraryFolders',
      'libraryItems',
      'expenseCategories',
      'expenseTypes',
      'paymentMethods',
      'currencies',
      'recipients',
      'expenses',
      'subscriptions',
      'employees',
      'quickNotes',
      'seriesPlanner',
      'notifications',
    ];
    for (const col of collections) {
      if (Array.isArray(data[col]) && data[col].length) {
        await bulkPut(col, data[col]);
      }
    }
    if (Array.isArray(data.settings) && data.settings.length) {
      await bulkPut('settings', data.settings);
    }
    if (Array.isArray(data.meta) && data.meta.length) {
      await bulkPut('meta', data.meta);
    }
    return true;
  }

  /**
   * Vuelve a agregar los videos de ejemplo usando las series/formatos/
   * estados/prioridades/etiquetas ACTUALES (respeta cambios de nombre que
   * haya hecho el usuario, matcheando por nombre solo en este momento de
   * restauración puntual). Útil para "Restaurar datos de ejemplo". Sigue
   * funcionando igual que antes: es una acción explícita del usuario, no
   * un auto-seed al arrancar, así que no entra en conflicto con "si la
   * base está vacía, mostrar todo vacío".
   */
  async function reseedSampleVideos() {
    const [states, series, formats, contentTypes, priorities, tags] = await Promise.all([
      getAll('states'),
      getAll('series'),
      getAll('formats'),
      getAll('contentTypes'),
      getAll('priorities'),
      getAll('tags'),
    ]);
    if (!states.length || !priorities.length) {
      throw new Error('No hay estados o prioridades configurados; no se pueden crear videos de ejemplo.');
    }
    const videos = seedVideos({ states, series, formats, contentTypes, priorities, tags });
    await bulkPut('videos', videos);
    return videos;
  }

  /** Elimina solo los registros marcados como isSample (datos de ejemplo). */
  async function removeSampleData() {
    const videos = await getAll('videos');
    const samples = videos.filter((v) => v.isSample);
    for (const v of samples) {
      await remove('videos', v.id);
    }
    const folders = await getAll('libraryFolders');
    const items = await getAll('libraryItems');
    const sampleFolders = folders.filter((f) => f.isSample);
    const sampleItems = items.filter((i) => i.isSample);
    for (const f of sampleFolders) await remove('libraryFolders', f.id);
    for (const i of sampleItems) await remove('libraryItems', i.id);

    // Costos: solo se quitan los gastos/suscripciones/proveedores marcados
    // como isSample. Las categorías, tipos, medios de pago y monedas NO se
    // tocan acá porque son la taxonomía base configurable del módulo (igual
    // que estados/prioridades para videos), no "datos de ejemplo".
    const expenses = await getAll('expenses');
    const subscriptions = await getAll('subscriptions');
    const recipients = await getAll('recipients');
    const sampleExpenses = expenses.filter((e) => e.isSample);
    const sampleSubscriptions = subscriptions.filter((s) => s.isSample);
    const sampleRecipients = recipients.filter((r) => r.isSample);
    for (const e of sampleExpenses) await remove('expenses', e.id);
    for (const s of sampleSubscriptions) await remove('subscriptions', s.id);
    for (const r of sampleRecipients) await remove('recipients', r.id);

    return samples.length + sampleFolders.length + sampleItems.length + sampleExpenses.length + sampleSubscriptions.length + sampleRecipients.length;
  }

  /* ------------------------------------------------------------------ */
  /* Biblioteca: generadores de datos de ejemplo (ya no se auto-ejecutan) */
  /* ------------------------------------------------------------------ */

  // Imagen de muestra muy liviana (SVG en base64) para no inflar el
  // respaldo ni el almacenamiento con archivos pesados de ejemplo.
  const SAMPLE_LOGO_SVG =
    'data:image/svg+xml;base64,' +
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#1f2023"/><circle cx="120" cy="120" r="70" fill="none" stroke="#f2f2f2" stroke-width="8"/><text x="120" y="132" font-size="28" fill="#f2f2f2" font-family="Arial" text-anchor="middle">FXL</text></svg>'
    );

  function seedLibraryFolders() {
    const now = Utils.nowISO();
    const mk = (over, i) => ({
      id: Utils.uuid(),
      name: 'Carpeta',
      parentId: null,
      description: '',
      icon: '📁',
      color: '#8a8a8a',
      favorite: false,
      archived: false,
      isSample: true,
      createdAt: now,
      updatedAt: now,
      position: i,
      ...over,
    });
    const inserts = mk({ name: 'Inserts Messi', icon: '⚽', color: '#60a5fa' }, 0);
    const logos = mk({ name: 'Logos', icon: '🏷️', color: '#a3a3a3' }, 1);
    const documentos = mk({ name: 'Documentos', icon: '📄', color: '#737373' }, 2);
    const mundial = mk({ name: 'Mundial 2026', icon: '🏆', color: '#fbbf24' }, 3);
    const highlights = mk({ name: 'Highlights', icon: '🎬', color: '#fbbf24', parentId: mundial.id }, 0);
    return [inserts, logos, documentos, mundial, highlights];
  }

  function seedLibraryItems(folders) {
    const now = Utils.nowISO();
    const byName = Object.fromEntries(folders.map((f) => [f.name, f]));
    const mk = (over) => ({
      id: Utils.uuid(),
      folderId: null,
      name: '',
      description: '',
      resourceType: 'other',
      storageMode: 'link',
      url: '',
      fileData: null,
      mimeType: null,
      fileSize: 0,
      thumbnailData: null,
      tags: [],
      linkedVideoIds: [],
      favorite: false,
      archived: false,
      isSample: true,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      ...over,
    });
    return [
      mk({
        name: 'Escudo FXL (ejemplo)',
        description: 'Logo de muestra guardado como archivo (base64).',
        resourceType: 'logo',
        storageMode: 'file',
        folderId: byName['Logos']?.id || null,
        fileData: SAMPLE_LOGO_SVG,
        thumbnailData: SAMPLE_LOGO_SVG,
        mimeType: 'image/svg+xml',
        fileSize: SAMPLE_LOGO_SVG.length,
      }),
      mk({
        name: 'Carpeta de Drive — Inserts Messi (ejemplo)',
        description: 'Enlace de ejemplo. Reemplazalo por tu carpeta real de Drive.',
        resourceType: 'driveFolder',
        storageMode: 'link',
        folderId: byName['Inserts Messi']?.id || null,
        url: 'https://drive.google.com/drive/folders/EJEMPLO-CARPETA-MESSI',
      }),
      mk({
        name: 'Estadísticas de Messi (ejemplo)',
        description: 'Enlace de ejemplo a un sitio web externo.',
        resourceType: 'link',
        storageMode: 'link',
        folderId: byName['Documentos']?.id || null,
        url: 'https://example.com/estadisticas-messi',
      }),
    ];
  }

  /**
   * ANTES poblaba carpetas y recursos de ejemplo en la Biblioteca la
   * primera vez que se abría la app sin datos de ese módulo. Igual que
   * `seedIfEmpty`, se mantiene la función para que app.js no cambie, pero
   * ya no escribe nada: una base de Supabase vacía se muestra vacía.
   */
  async function seedLibraryIfEmpty() {
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Costos: generadores de taxonomía y datos de ejemplo (ya no se        */
  /* auto-ejecutan; ver seedCostsTaxonomyIfEmpty / seedCostsSampleData... */
  /* ------------------------------------------------------------------ */

  /**
   * Categorías de gasto sugeridas. Quedan disponibles como referencia y
   * para un eventual restablecimiento manual, pero ya no se cargan solas.
   */
  function seedExpenseCategories() {
    const now = Utils.nowISO();
    const base = [
      { name: 'Editores', icon: '✂️' },
      { name: 'Diseño y miniaturas', icon: '🖼️' },
      { name: 'Suscripciones', icon: '🔁' },
      { name: 'Equipamiento', icon: '🎥' },
      { name: 'Publicidad', icon: '📣' },
      { name: 'Producción', icon: '🎬' },
      { name: 'Transporte', icon: '🚗' },
      { name: 'Hosting y dominios', icon: '🌐' },
      { name: 'Herramientas de IA', icon: '🤖' },
      { name: 'Otros', icon: '📦' },
    ];
    return base.map((c, i) => ({
      id: Utils.uuid(),
      name: c.name,
      icon: c.icon,
      active: true,
      order: i,
      createdAt: now,
      updatedAt: now,
    }));
  }

  function seedExpenseTypes() {
    const now = Utils.nowISO();
    const base = ['Gasto único', 'Gasto recurrente', 'Compra', 'Servicio', 'Honorario'];
    return base.map((name, i) => ({ id: Utils.uuid(), name, active: true, order: i, createdAt: now, updatedAt: now }));
  }

  function seedPaymentMethods() {
    const now = Utils.nowISO();
    const base = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta de crédito', 'Tarjeta de débito', 'PayPal', 'Otro'];
    return base.map((name, i) => ({ id: Utils.uuid(), name, active: true, order: i, createdAt: now, updatedAt: now }));
  }

  function seedCurrencies() {
    const now = Utils.nowISO();
    const base = [
      { code: 'ARS', name: 'Peso argentino', symbol: '$', decimalPlaces: 2 },
      { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', decimalPlaces: 2 },
    ];
    return base.map((c, i) => ({ id: Utils.uuid(), ...c, active: true, order: i, createdAt: now, updatedAt: now }));
  }

  /**
   * ANTES poblaba la taxonomía base de Costos (categorías, tipos, medios
   * de pago, monedas) la primera vez que no había ninguna categoría. Se
   * mantiene la función y su firma para que app.js no cambie, pero ya no
   * escribe nada: si Costos está vacío, se muestra vacío y el usuario crea
   * su propia taxonomía desde Configuración → Costos (igual que ya podía
   * hacer antes; ahora simplemente no viene precargada).
   */
  async function seedCostsTaxonomyIfEmpty() {
    return false;
  }

  /**
   * ANTES agregaba un par de gastos, una suscripción y algunos proveedores
   * de ejemplo. Se mantiene la función y su firma; ya no escribe nada.
   */
  async function seedCostsSampleDataIfEmpty() {
    return false;
  }

  return {
    DB_NAME,
    DB_VERSION,
    STORE_NAMES,
    open,
    getAll,
    get,
    put,
    bulkPut,
    remove,
    clear,
    wipeAll,
    estimateUsage,
    seedIfEmpty,
    seedLibraryIfEmpty,
    seedCostsTaxonomyIfEmpty,
    seedCostsSampleDataIfEmpty,
    getSettings,
    saveSettings,
    getLogo,
    setLogo,
    exportBackup,
    validateBackup,
    importBackup,
    removeSampleData,
    reseedSampleVideos,
    makeHistoryEntry,
    defaultSettings,
  };
})();
