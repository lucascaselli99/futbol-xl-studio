/**
 * app.js
 * -----------------------------------------------------------------------
 * Orquestación general de Fútbol XL Studio: estado en memoria (espejo de
 * IndexedDB), routing entre vistas, renderizado y delegación de eventos.
 *
 * Estrategia de renderizado (importante para no perder el foco al tipear):
 *   - renderAll()      -> repinta sidebar + topbar + contenido principal.
 *   - renderMain()      -> repinta solo el contenido principal (#main-content).
 *   - renderEditorBody()-> repinta solo el cuerpo del panel de edición.
 *   - Los campos de texto libres (inputs/textareas) NUNCA disparan un
 *     re-render en el evento "input": solo actualizan el modelo en memoria
 *     y programan un guardado con debounce. Así el usuario nunca pierde el
 *     cursor mientras escribe.
 * -----------------------------------------------------------------------
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Estado global en memoria                                            */
  /* ------------------------------------------------------------------ */

  const state = {
    settings: {},
    logo: null,
    videos: [],
    series: [],
    formats: [],
    contentTypes: [],
    states: [],
    priorities: [],
    tags: [],
    templates: [],
    libraryFolders: [],
    libraryItems: [],
    // --- Colecciones del módulo Costos (v1.2.0) ---
    expenseCategories: [],
    expenseTypes: [],
    paymentMethods: [],
    currencies: [],
    recipients: [],
    expenses: [],
    subscriptions: [],
    employees: [],
    quickNotes: [],
    seriesPlanner: [],
    authUser: null,
    currentEmployee: null,
    undo: [], // pila simple de acciones destructivas para Ctrl/Cmd+Z
    ui: {
      route: 'home',
      videosView: 'kanban',
      settingsSection: 'identity',
      search: '',
      filters: {},
      sort: { key: 'updatedAt', dir: 'desc' },
      selectedIds: [],
      editingVideoId: null,
      editorTab: 'general',
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      collapsedColumns: [],
      calendarMonth: { year: new Date().getFullYear(), month: new Date().getMonth() },
      showFilters: false,
      saveState: 'idle',
      usage: { usage: 0, quota: 0 },
      tagMergeSelection: [],
      // --- Estado del módulo Biblioteca (v1.1.0) ---
      library: {
        currentFolderId: null, // null = raíz de Biblioteca
        view: 'grid',
        search: '',
        sort: 'name-asc',
        quickFilter: 'all',
        filterTagIds: [],
        showFilters: false,
        selectedIds: [],
        historyBack: [],
        historyForward: [],
        detailItemId: null,
        showNewMenu: false,
      },
      // --- Estado del módulo Costos (v1.2.0) ---
      costsTab: 'summary', // 'summary' | 'expenses' | 'subscriptions' | 'settings'
      costSettingsSection: 'categories',
      costExpenseSearch: '',
      costExpenseFilters: {},
      showCostFilters: false,
      thumbnailLab: { title: '', image: '', device: 'desktop' },
      selectedSeriesPlannerId: null,
      // Estado visual por sesión: temporadas desplegadas en el módulo Formatos.
      plannerExpandedSeasons: {},
    },
  };

  let saveIndicatorTimer = null;
  let draggedLibraryId = null;
  let draggedLibraryKind = null; // 'folder' | 'item'
  let pendingUpload = null; // { file, folderId } usado por el flujo de "archivo pesado"
  const pendingSubscriptionPayments = new Set(); // ids de suscripciones con un pago en curso (evita doble click)

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  async function init() {
    const authRoot = document.getElementById('auth-root');
    const appRoot = document.getElementById('app');
    // ===== MODO INVITADO =====
if (localStorage.getItem('guestMode') === 'true') {
  state.authUser = {
    email: 'Invitado',
    guest: true,
  };

  await bootAuthenticatedApp();
  return;
}

    if (!Supa.client) {
      showLogin('No se pudo conectar con Supabase. Revisá la configuración de la aplicación.');
      return;
    }

    const { data, error } = await Supa.client.auth.getSession();
    if (error) {
      console.error('[Fútbol XL Studio] No se pudo recuperar la sesión:', error);
      showLogin('No se pudo verificar la sesión. Intentá nuevamente.');
      return;
    }

    const session = data?.session || null;
    if (!session) {
      showLogin();
      return;
    }

    state.authUser = session.user;
    await bootAuthenticatedApp();
  }

  async function bootAuthenticatedApp() {
    document.getElementById('auth-root').hidden = true;
    document.getElementById('app').hidden = false;

    await DB.open();
    await DB.seedIfEmpty();
    await DB.seedLibraryIfEmpty();
    await DB.seedCostsTaxonomyIfEmpty();
    await DB.seedCostsSampleDataIfEmpty();
    await migrateLocalPlanningDataToSupabase();
    await loadAllFromDB();

    state.ui.videosView = state.settings.defaultView || 'kanban';
    state.ui.library.view = state.settings.libraryDefaultView || 'grid';
    state.ui.library.sort = state.settings.librarySortBy || 'name-asc';
    state.ui.costsTab = state.settings.costsDefaultExpenseTab || 'summary';

    applyTheme();
    wireGlobalEvents();
    renderAll();
  }

  function showLogin(message = '') {
    const authRoot = document.getElementById('auth-root');
    const appRoot = document.getElementById('app');

    appRoot.hidden = true;
    authRoot.hidden = false;
    authRoot.innerHTML = `
      <main class="auth-page">
        <section class="auth-card" aria-labelledby="auth-title">
          <div class="auth-brand">
            <div class="auth-brand__logo">FXL</div>
            <div>
              <h1 id="auth-title">Fútbol XL Studio</h1>
              <p>Ingresá con tu cuenta del equipo.</p>
            </div>
          </div>

          <form id="login-form" class="auth-form">
            <label class="field">
              <span>Email</span>
              <input id="login-email" type="email" autocomplete="email" required />
            </label>

            <label class="field">
              <span>Contraseña</span>
              <input id="login-password" type="password" autocomplete="current-password" required />
            </label>

            <p id="login-error" class="auth-error" ${message ? '' : 'hidden'}>${Utils.escapeHtml(message)}</p>

            <button id="login-submit" class="btn btn--primary btn--block auth-submit" type="submit">
              Iniciar sesión
            </button>
            <button
  id="guest-login"
  type="button"
  class="btn btn--secondary btn--block"
  style="margin-top:12px;"
>
  Continuar como invitado
</button>
          </form>
        </section>
      </main>`;

    document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
    document.getElementById('guest-login').addEventListener('click', () => {
    localStorage.setItem('guestMode', 'true');
    location.reload();
});
    setTimeout(() => document.getElementById('login-email')?.focus(), 0);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const submitButton = document.getElementById('login-submit');
    const errorElement = document.getElementById('login-error');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    submitButton.disabled = true;
    submitButton.textContent = 'Ingresando…';
    errorElement.hidden = true;

    const { data, error } = await Supa.client.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      errorElement.textContent = 'Email o contraseña incorrectos.';
      errorElement.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Iniciar sesión';
      passwordInput.select();
      return;
    }

    state.authUser = data.user;
    await bootAuthenticatedApp();
  }

  async function logout() {
    const { error } = await Supa.client.auth.signOut();
    if (error) {
      Utils.toast('No se pudo cerrar la sesión: ' + error.message, 'error');
      return;
    }

    state.authUser = null;
    window.location.reload();
  }

  async function loadAllFromDB() {
    const [
      videos,
      series,
      formats,
      contentTypes,
      states_,
      priorities,
      tags,
      templates,
      settings,
      logo,
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
    ] = await Promise.all([
      DB.getAll('videos'),
      DB.getAll('series'),
      DB.getAll('formats'),
      DB.getAll('contentTypes'),
      DB.getAll('states'),
      DB.getAll('priorities'),
      DB.getAll('tags'),
      DB.getAll('checklistTemplates'),
      DB.getSettings(),
      DB.getLogo(),
      DB.getAll('libraryFolders'),
      DB.getAll('libraryItems'),
      DB.getAll('expenseCategories'),
      DB.getAll('expenseTypes'),
      DB.getAll('paymentMethods'),
      DB.getAll('currencies'),
      DB.getAll('recipients'),
      DB.getAll('expenses'),
      DB.getAll('subscriptions'),
      DB.getAll('employees'),
      DB.getAll('quickNotes'),
      DB.getAll('seriesPlanner'),
    ]);
    state.videos = videos;
    state.series = series;
    state.formats = formats;
    state.contentTypes = contentTypes;
    state.states = states_;
    state.priorities = priorities;
    state.tags = tags;
    state.templates = templates;
    state.settings = settings;
    state.logo = logo;
    state.libraryFolders = libraryFolders;
    state.libraryItems = libraryItems;
    state.expenseCategories = expenseCategories;
    state.expenseTypes = expenseTypes;
    state.paymentMethods = paymentMethods;
    state.currencies = currencies;
    state.recipients = recipients;
    state.expenses = expenses;
    state.subscriptions = subscriptions;
    state.employees = employees;
    state.quickNotes = quickNotes;
    state.seriesPlanner = seriesPlanner;
    state.ui.selectedSeriesPlannerId = state.seriesPlanner[0]?.id || null;
    linkCurrentUserToEmployee();
  }

  async function migrateLocalPlanningDataToSupabase() {
    let localQuickNotes = [];
    let localSeriesPlanner = [];

    try {
      const parsedNotes = JSON.parse(localStorage.getItem('fxlQuickNotes') || '[]');
      if (Array.isArray(parsedNotes)) localQuickNotes = parsedNotes;
    } catch (error) {
      console.warn('[Fútbol XL Studio] No se pudieron leer las notas rápidas locales para migrarlas:', error);
    }

    try {
      const parsedPlanner = JSON.parse(localStorage.getItem('fxlSeriesPlanner') || '[]');
      if (Array.isArray(parsedPlanner)) localSeriesPlanner = parsedPlanner;
    } catch (error) {
      console.warn('[Fútbol XL Studio] No se pudo leer la planificación local para migrarla:', error);
    }

    try {
      if (localQuickNotes.length) await DB.bulkPut('quickNotes', localQuickNotes);
      if (localSeriesPlanner.length) await DB.bulkPut('seriesPlanner', localSeriesPlanner);

      // Una vez confirmada la copia en Supabase, eliminamos los datos de trabajo locales.
      localStorage.removeItem('fxlQuickNotes');
      localStorage.removeItem('fxlSeriesPlanner');
    } catch (error) {
      console.error('[Fútbol XL Studio] No se pudieron migrar Notas rápidas o Formatos a Supabase:', error);
      Utils.toast('No se pudieron migrar los datos locales a Supabase. No se eliminaron del navegador.', 'error');
    }
  }

  // Las escrituras se encadenan para evitar que dos guardados simultáneos
  // lleguen a Supabase fuera de orden y un estado viejo pise al más reciente.
  let quickNotesSaveQueue = Promise.resolve();
  let seriesPlannerSaveQueue = Promise.resolve();

  function cloneForSave(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveQuickNotes() {
    const snapshot = cloneForSave(state.quickNotes);
    quickNotesSaveQueue = quickNotesSaveQueue
      .then(() => DB.bulkPut('quickNotes', snapshot))
      .catch((error) => {
        console.error('[Fútbol XL Studio] No se pudieron guardar las notas rápidas:', error);
        Utils.toast('No se pudieron guardar las notas rápidas en Supabase.', 'error');
        throw error;
      });
    return quickNotesSaveQueue;
  }

  function saveSeriesPlanner() {
    const snapshot = cloneForSave(state.seriesPlanner);
    seriesPlannerSaveQueue = seriesPlannerSaveQueue
      .then(() => DB.bulkPut('seriesPlanner', snapshot))
      .catch((error) => {
        console.error('[Fútbol XL Studio] No se pudo guardar Formatos:', error);
        Utils.toast('No se pudo guardar Formatos en Supabase.', 'error');
        throw error;
      });
    return seriesPlannerSaveQueue;
  }

  function currentSeriesPlanner() {
    return state.seriesPlanner.find((item) => item.id === state.ui.selectedSeriesPlannerId) || state.seriesPlanner[0] || null;
  }

  function createSeriesPlanner() {
    const name = window.prompt('Nombre de la serie o formato');
    if (!name || !name.trim()) return;
    const item = {
      id: Utils.uuid(),
      name: name.trim(),
      description: '',
      notes: '',
      seasons: [],
      createdAt: Utils.nowISO(),
      updatedAt: Utils.nowISO(),
    };
    state.seriesPlanner.unshift(item);
    state.ui.selectedSeriesPlannerId = item.id;
    saveSeriesPlanner();
    renderMain();
  }

  function deleteSeriesPlanner(id) {
    const item = state.seriesPlanner.find((x) => x.id === id);
    if (!item || !window.confirm(`¿Eliminar “${item.name}” y toda su planificación?`)) return;
    state.seriesPlanner = state.seriesPlanner.filter((x) => x.id !== id);
    state.ui.selectedSeriesPlannerId = state.seriesPlanner[0]?.id || null;
    DB.remove('seriesPlanner', id).catch((error) => {
      console.error('[Fútbol XL Studio] No se pudo eliminar el formato de Supabase:', error);
      Utils.toast('No se pudo eliminar el formato de Supabase.', 'error');
    });
    saveSeriesPlanner();
    renderMain();
  }

  function addPlannerSeason() {
    const item = currentSeriesPlanner();
    if (!item) return;
    const nextNumber = item.seasons.length ? Math.max(...item.seasons.map((s) => Number(s.number) || 0)) + 1 : 1;
    item.seasons.push({ id: Utils.uuid(), number: nextNumber, title: `Temporada ${nextNumber}`, notes: '', episodes: [] });
    item.updatedAt = Utils.nowISO();
    saveSeriesPlanner();
    renderMain();
  }

  function addPlannerEpisode(seasonId) {
    const item = currentSeriesPlanner();
    const season = item?.seasons.find((x) => x.id === seasonId);
    if (!season) return;
    const title = window.prompt('Título del capítulo');
    if (!title || !title.trim()) return;
    season.episodes.push({
      id: Utils.uuid(),
      number: season.episodes.length + 1,
      title: title.trim(),
      status: 'pending',
      notes: '',
      videoId: null,
    });
    item.updatedAt = Utils.nowISO();
    saveSeriesPlanner();
    renderMain();
  }

  function deletePlannerEpisode(seasonId, episodeId) {
    const item = currentSeriesPlanner();
    const season = item?.seasons.find((x) => x.id === seasonId);
    if (!season) return;
    season.episodes = season.episodes.filter((x) => x.id !== episodeId);
    season.episodes.forEach((episode, index) => { episode.number = index + 1; });
    item.updatedAt = Utils.nowISO();
    saveSeriesPlanner();
    renderMain();
  }

  async function createVideoFromPlanner(seasonId, episodeId) {
    const planner = currentSeriesPlanner();
    const season = planner?.seasons.find((x) => x.id === seasonId);
    const episode = season?.episodes.find((x) => x.id === episodeId);
    if (!planner || !season || !episode) return;
    if (episode.videoId && state.videos.some((v) => v.id === episode.videoId)) {
      openVideoEditor(episode.videoId, 'general');
      return;
    }
    const video = blankVideo();
    video.title = episode.title;
    video.description = `${planner.name} · Temporada ${season.number} · Episodio ${episode.number}`;
    const linkedSeries = state.series.find((x) => String(x.name || '').trim().toLowerCase() === planner.name.trim().toLowerCase());
    if (linkedSeries) video.seriesId = linkedSeries.id;
    state.videos.unshift(video);
    await DB.put('videos', video);
    episode.videoId = video.id;
    episode.status = 'in_progress';
    planner.updatedAt = Utils.nowISO();
    saveSeriesPlanner();
    Utils.toast('Proyecto creado desde Formatos', 'success');
    openVideoEditor(video.id, 'general');
  }

  function getExpandedPlannerSeasonIds(planner) {
    if (!planner) return [];
    const key = planner.id;
    const stored = state.ui.plannerExpandedSeasons[key];
    if (Array.isArray(stored)) return stored;

    // Primera visita: solo la primera temporada comienza desplegada.
    const initial = planner.seasons?.[0]?.id ? [planner.seasons[0].id] : [];
    state.ui.plannerExpandedSeasons[key] = initial;
    return initial;
  }

  function togglePlannerSeason(seasonId) {
    const planner = currentSeriesPlanner();
    if (!planner || !seasonId) return;
    const current = getExpandedPlannerSeasonIds(planner);
    state.ui.plannerExpandedSeasons[planner.id] = current.includes(seasonId)
      ? current.filter((id) => id !== seasonId)
      : [...current, seasonId];
    renderMain();
  }

  function renderSeriesPlannerRoute(ctx) {
    const planner = currentSeriesPlanner();
    return Components.renderSeriesPlanner({
      ...ctx,
      plannerItems: state.seriesPlanner,
      selectedPlannerId: state.ui.selectedSeriesPlannerId,
      selectedPlanner: planner,
      expandedSeasonIds: getExpandedPlannerSeasonIds(planner),
    });
  }

  function addQuickNote() {
    const input = document.getElementById('quick-note-input');
    const text = input?.value.trim();
    if (!text) return;
    state.quickNotes.unshift({ id: Utils.uuid(), text, createdAt: Utils.nowISO() });
    saveQuickNotes();
    renderMain();
    setTimeout(() => document.getElementById('quick-note-input')?.focus(), 0);
  }

  function deleteQuickNote(id) {
    state.quickNotes = state.quickNotes.filter((note) => note.id !== id);
    DB.remove('quickNotes', id).catch((error) => {
      console.error('[Fútbol XL Studio] No se pudo eliminar la nota rápida:', error);
      Utils.toast('No se pudo eliminar la nota rápida de Supabase.', 'error');
    });
    saveQuickNotes();
    renderMain();
  }

  function editQuickNote(id) {
    const note = state.quickNotes.find((item) => item.id === id);
    if (!note) return;
    const nextText = window.prompt('Editar nota rápida', note.text);
    if (nextText === null) return;
    const clean = nextText.trim();
    if (!clean) return;
    note.text = clean;
    saveQuickNotes();
    renderMain();
  }

  async function quickNoteToProject(id) {
    const note = state.quickNotes.find((item) => item.id === id);
    if (!note) return;
    const video = blankVideo();
    video.title = note.text;
    video.idea = note.text;
    state.videos.unshift(video);
    await DB.put('videos', video);
    state.quickNotes = state.quickNotes.filter((item) => item.id !== id);
    await DB.remove('quickNotes', id);
    saveQuickNotes();
    Utils.toast('Idea convertida en proyecto', 'success');
    openVideoEditor(video.id, 'general');
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function linkCurrentUserToEmployee() {
    const userEmail = normalizeEmail(state.authUser?.email);
    state.currentEmployee = userEmail
      ? state.employees.find((employee) => normalizeEmail(employee.email) === userEmail) || null
      : null;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme || 'dark');
    document.documentElement.style.setProperty('--accent', state.settings.accentColor || '#3b82f6');
  }

  /* ------------------------------------------------------------------ */
  /* Contexto para los componentes de render                             */
  /* ------------------------------------------------------------------ */

  function buildBaseCtx() {
    return {
      settings: state.settings,
      logo: state.logo,
      videos: state.videos,
      series: state.series,
      formats: state.formats,
      contentTypes: state.contentTypes,
      states: state.states,
      priorities: state.priorities,
      tags: state.tags,
      templates: state.templates,
      libraryFolders: state.libraryFolders,
      libraryItems: state.libraryItems,
      // Alias usados por los componentes de Biblioteca (renderLibraryDetailPanel,
      // tarjetas, etc.) para no depender del nombre exacto de la propiedad.
      allFolders: state.libraryFolders,
      allItems: state.libraryItems,
      // Colecciones del módulo Costos (v1.2.0)
      expenseCategories: state.expenseCategories,
      expenseTypes: state.expenseTypes,
      paymentMethods: state.paymentMethods,
      currencies: state.currencies,
      recipients: state.recipients,
      expenses: state.expenses,
      subscriptions: state.subscriptions,
      employees: state.employees,
      quickNotes: state.quickNotes,
      thumbnailLab: state.ui.thumbnailLab,
      authUser: state.authUser,
      currentEmployee: state.currentEmployee,
      route: state.ui.route,
      videosView: state.ui.videosView,
      search: state.ui.search,
      saveState: state.ui.saveState,
      sidebarCollapsed: state.ui.sidebarCollapsed,
      mobileSidebarOpen: state.ui.mobileSidebarOpen,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Filtros / búsqueda / orden                                          */
  /* ------------------------------------------------------------------ */

  function matchesSearch(v, qRaw) {
    const q = (qRaw || '').trim().toLowerCase();
    if (!q) return true;
    const textBlob = [
      v.title, v.altTitle, v.description, v.idea, v.hook, v.script,
      v.researchNotes, v.editNotes, v.thumbnailNotes, v.descriptionText,
      v.titleIdeas, v.thumbnailIdeas,
    ].filter(Boolean).join(' ').toLowerCase();
    if (textBlob.includes(q)) return true;

    const series = Components.byId(state.series, v.seriesId);
    const format = Components.byId(state.formats, v.formatId);
    if (series && series.name.toLowerCase().includes(q)) return true;
    if (format && format.name.toLowerCase().includes(q)) return true;

    const tagNames = (v.tagIds || []).map((id) => Components.byId(state.tags, id)?.name || '').join(' ').toLowerCase();
    if (tagNames.includes(q)) return true;

    const linksBlob = (JSON.stringify(v.driveLinks || {}) + JSON.stringify(v.additionalLinks || [])).toLowerCase();
    if (linksBlob.includes(q)) return true;

    const commentsBlob = (v.comments || []).map((c) => c.text).join(' ').toLowerCase();
    if (commentsBlob.includes(q)) return true;

    return false;
  }

  function matchesFilters(v, f) {
    if (f.stateId && v.stateId !== f.stateId) return false;
    if (f.seriesId && v.seriesId !== f.seriesId) return false;
    if (f.formatId && v.formatId !== f.formatId) return false;
    if (f.contentTypeId && v.contentTypeId !== f.contentTypeId) return false;
    if (f.priorityId && v.priorityId !== f.priorityId) return false;
    if (f.tagIds && f.tagIds.length && !f.tagIds.every((t) => (v.tagIds || []).includes(t))) return false;
    if (f.favorite === 'yes' && !v.favorite) return false;
    if (f.hasThumbnail === 'yes' && !v.thumbnail) return false;
    if (f.hasThumbnail === 'no' && v.thumbnail) return false;
    const hasDrive =
      (v.driveLinks && Object.values(v.driveLinks).some((l) => l && l.url)) ||
      (v.additionalLinks || []).some((l) => l.url);
    if (f.hasDrive === 'yes' && !hasDrive) return false;
    if (f.hasDrive === 'no' && hasDrive) return false;
    if (f.overdue === 'yes') {
      const st = Components.byId(state.states, v.stateId);
      if (!Utils.isOverdue(v.targetDate, st && st.isFinal)) return false;
    }
    return true;
  }

  function activeFilterCount() {
    const f = state.ui.filters;
    let n = 0;
    ['stateId', 'seriesId', 'formatId', 'contentTypeId', 'priorityId', 'favorite', 'hasThumbnail', 'hasDrive', 'overdue'].forEach((k) => {
      if (f[k]) n++;
    });
    if (f.tagIds && f.tagIds.length) n += f.tagIds.length;
    return n;
  }

  function computeVideosForKanban() {
    return state.videos.filter((v) => !v.archived && matchesFilters(v, state.ui.filters) && matchesSearch(v, state.ui.search));
  }

  function computeVideosForList() {
    const f = state.ui.filters;
    let list = state.videos.filter((v) => matchesFilters(v, f) && matchesSearch(v, state.ui.search));
    if (f.archived === 'only') list = list.filter((v) => v.archived);
    else if (f.archived === 'all') {
      /* no adicional */
    } else list = list.filter((v) => !v.archived);

    const { key, dir } = state.ui.sort;
    const mul = dir === 'asc' ? 1 : -1;
    list = list.slice().sort((a, b) => {
      let av;
      let bv;
      if (key === 'state') {
        av = Components.byId(state.states, a.stateId)?.name || '';
        bv = Components.byId(state.states, b.stateId)?.name || '';
      } else if (key === 'series') {
        av = Components.byId(state.series, a.seriesId)?.name || '';
        bv = Components.byId(state.series, b.seriesId)?.name || '';
      } else if (key === 'format') {
        av = Components.byId(state.formats, a.formatId)?.name || '';
        bv = Components.byId(state.formats, b.formatId)?.name || '';
      } else if (key === 'priority') {
        av = Components.byId(state.priorities, a.priorityId)?.order ?? 0;
        bv = Components.byId(state.priorities, b.priorityId)?.order ?? 0;
      } else if (key === 'progress') {
        av = Components.checklistProgress(a.checklist).pct;
        bv = Components.checklistProgress(b.checklist).pct;
      } else {
        av = a[key] || '';
        bv = b[key] || '';
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return list;
  }

  /* ------------------------------------------------------------------ */
  /* Render principal                                                    */
  /* ------------------------------------------------------------------ */

  function renderAll() {
    renderSidebarAndTopbar();
    renderMain();
    renderEditorOverlay();
  }

  function renderSidebarAndTopbar() {
    const ctx = buildBaseCtx();
    document.getElementById('sidebar-root').innerHTML = Components.renderSidebar(ctx);
    document.getElementById('topbar-root').innerHTML = Components.renderTopbar(ctx);
    document.getElementById('mobile-nav-root').innerHTML = Components.renderMobileNav(ctx.route);
  }

  function renderMain() {
    const ctx = buildBaseCtx();
    document.getElementById('main-content').innerHTML = renderRoute(ctx);
  }

  function renderRoute(ctx) {
    switch (state.ui.route) {
      case 'home':
        return Components.renderDashboard(ctx);
      case 'videos':
        return renderVideosRoute(ctx);
      case 'library':
        return renderLibraryRoute(ctx);
      case 'costs':
        return renderCostsRoute(ctx);
      case 'series-planner':
        return renderSeriesPlannerRoute(ctx);
      case 'team':
        return Components.renderTeam(ctx);
      case 'thumbnail-lab':
        return Components.renderThumbnailLab(ctx);
      case 'calendar-module':
        return Components.renderComingSoon('Calendario avanzado', 'Un calendario completo con publicaciones, grabaciones, entrevistas, fechas límite y recordatorios llegará en una próxima versión.');
      case 'analytics':
        return Components.renderComingSoon('Analytics', 'Visualizaciones, rendimiento por serie y por formato, historial de publicaciones y métricas cargadas manualmente llegarán en una próxima versión.');
      case 'settings':
        return renderSettingsRoute(ctx);
      default:
        return Components.renderDashboard(ctx);
    }
  }

  function renderVideosRoute(ctx) {
    const fullCtx = { ...ctx, filters: state.ui.filters, activeFilterCount: activeFilterCount() };
    let body = '';
    if (state.ui.videosView === 'kanban') {
      const videos = computeVideosForKanban();
      const videosByState = {};
      videos.forEach((v) => {
        (videosByState[v.stateId] = videosByState[v.stateId] || []).push(v);
      });
      body = Components.renderKanban({ ...fullCtx, videosByState, collapsedColumns: state.ui.collapsedColumns });
    } else if (state.ui.videosView === 'list') {
      const videos = computeVideosForList();
      body = Components.renderListView({ ...fullCtx, videos, sort: state.ui.sort, selectedIds: state.ui.selectedIds });
    } else {
      const videos = computeVideosForKanban();
      body = Components.renderCalendarView({ ...fullCtx, videos, calendarMonth: state.ui.calendarMonth });
    }
    return `
      <div class="view view--videos">
        ${Components.renderVideosToolbar(fullCtx)}
        ${state.ui.showFilters ? Components.renderFilterPanel(fullCtx) : ''}
        ${body}
      </div>`;
  }

  function renderSettingsRoute(ctx) {
    const section = state.ui.settingsSection;
    let body = '';
    switch (section) {
      case 'identity':
        body = Components.renderIdentitySettings(ctx);
        break;
      case 'series':
        body = Components.renderSeriesSettings(ctx);
        break;
      case 'formats':
        body = Components.renderFormatsSettings(ctx);
        break;
      case 'contentTypes':
        body = Components.renderContentTypesSettings(ctx);
        break;
      case 'states':
        body = Components.renderStatesSettings(ctx);
        break;
      case 'priorities':
        body = Components.renderPrioritiesSettings(ctx);
        break;
      case 'tags':
        body = Components.renderTagsSettings(ctx);
        break;
      case 'templates':
        body = Components.renderTemplatesSettings(ctx);
        break;
      case 'library':
        body = Components.renderLibrarySettings(ctx);
        break;
      case 'preferences':
        body = Components.renderPreferencesSettings(ctx);
        break;
      case 'backup':
        body = Components.renderBackupSettings({ ...ctx, usage: state.ui.usage });
        break;
      default:
        body = Components.renderIdentitySettings(ctx);
    }
    return Components.renderSettingsShell(section, body);
  }

  function renderSettingsBody() {
    // Repinta solo el body de configuración (mantiene la nav intacta visualmente,
    // aunque el costo de rehacer todo #main-content es igualmente bajo).
    renderMain();
  }

  /* ====================================================================
   * MÓDULO BIBLIOTECA (v1.1.0)
   * ====================================================================
   * Explorador de recursos con carpetas/subcarpetas ilimitadas (por
   * parentId) y recursos (archivos locales en IndexedDB o enlaces). Todo
   * lo que sigue es aditivo: no modifica ni reemplaza ninguna función de
   * Videos/Configuración ya existente.
   * ==================================================================== */

  function libFolder(id) {
    return state.libraryFolders.find((f) => f.id === id) || null;
  }
  function libItem(id) {
    return state.libraryItems.find((i) => i.id === id) || null;
  }

  /** Ruta (breadcrumb) desde la raíz hasta una carpeta, como lista de {id,name}. */
  function libraryFolderPath(folderId) {
    const path = [];
    const visited = new Set();
    let current = folderId ? libFolder(folderId) : null;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift({ id: current.id, name: current.name });
      current = current.parentId ? libFolder(current.parentId) : null;
    }
    return path;
  }

  function annotateItemPaths(items) {
    items.forEach((it) => {
      const path = libraryFolderPath(it.folderId);
      it._pathLabel = 'Biblioteca' + (path.length ? ' / ' + path.map((p) => p.name).join(' / ') : '');
    });
    return items;
  }

  function sortLibraryFolders(folders) {
    return folders.slice().sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  function sortLibraryItems(items) {
    const [key, dir] = (state.ui.library.sort || 'name-asc').split('-');
    const mul = dir === 'asc' ? 1 : -1;
    return items.slice().sort((a, b) => {
      let av;
      let bv;
      if (key === 'name') {
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
      } else if (key === 'fileSize') {
        av = a.fileSize || 0;
        bv = b.fileSize || 0;
      } else {
        av = new Date(a[key] || 0).getTime();
        bv = new Date(b[key] || 0).getTime();
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
  }

  function matchesLibrarySearch(item, q) {
    const meta = Components.resourceTypeMeta(item.resourceType);
    const hay = [item.name, item.description, meta.label, item.url].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(q)) return true;
    const tagNames = (item.tags || []).map((id) => Components.byId(state.tags, id)?.name || '').join(' ').toLowerCase();
    if (tagNames.includes(q)) return true;
    const folder = libFolder(item.folderId);
    if (folder && folder.name.toLowerCase().includes(q)) return true;
    const linkedNames = (item.linkedVideoIds || []).map((id) => Components.byId(state.videos, id)?.title || '').join(' ').toLowerCase();
    if (linkedNames.includes(q)) return true;
    return false;
  }

  function matchesLibraryTagFilter(tagIds) {
    const filter = state.ui.library.filterTagIds;
    if (!filter.length) return true;
    return filter.every((t) => (tagIds || []).includes(t));
  }

  const LIBRARY_QUICK_LABELS = {
    all: 'Todos',
    recent: 'Recientes',
    favorites: 'Favoritos',
    images: 'Imágenes',
    videos: 'Videos',
    links: 'Enlaces',
    drive: 'Drive',
    noFolder: 'Sin carpeta',
    archived: 'Archivados',
  };

  /** Calcula qué carpetas/recursos deben mostrarse según modo (navegación, búsqueda o filtro rápido). */
  function computeLibraryVisible() {
    const ui = state.ui.library;
    const showArchived = state.settings.libraryShowArchived;
    const nav = { canGoBack: ui.historyBack.length > 0, canGoForward: ui.historyForward.length > 0 };

    if (ui.search && ui.search.trim()) {
      const q = ui.search.trim().toLowerCase();
      let items = state.libraryItems.filter((it) => (showArchived || !it.archived) && matchesLibrarySearch(it, q) && matchesLibraryTagFilter(it.tags));
      const folders = state.libraryFolders.filter((f) => (showArchived || !f.archived) && f.name.toLowerCase().includes(q));
      annotateItemPaths(items);
      return { mode: 'search', modeLabel: `Resultados para "${ui.search}"`, visibleFolders: sortLibraryFolders(folders), visibleItems: sortLibraryItems(items), breadcrumb: [], ...nav };
    }

    if (ui.quickFilter && ui.quickFilter !== 'all') {
      let items = state.libraryItems.filter((it) => showArchived || !it.archived || ui.quickFilter === 'archived');
      if (ui.quickFilter === 'archived') items = state.libraryItems.filter((it) => it.archived);
      else if (ui.quickFilter === 'recent') items = items.filter((it) => !it.archived);
      else if (ui.quickFilter === 'favorites') items = items.filter((it) => it.favorite && !it.archived);
      else if (ui.quickFilter === 'images') items = items.filter((it) => !it.archived && (it.resourceType === 'image' || it.resourceType === 'logo'));
      else if (ui.quickFilter === 'videos') items = items.filter((it) => !it.archived && it.resourceType === 'video');
      else if (ui.quickFilter === 'links') items = items.filter((it) => !it.archived && it.storageMode === 'link' && !['drive', 'driveFolder'].includes(it.resourceType));
      else if (ui.quickFilter === 'drive') items = items.filter((it) => !it.archived && ['drive', 'driveFolder', 'docs', 'sheets'].includes(it.resourceType));
      else if (ui.quickFilter === 'noFolder') items = items.filter((it) => !it.archived && !it.folderId);
      items = items.filter((it) => matchesLibraryTagFilter(it.tags));
      if (ui.quickFilter === 'recent') items = items.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 60);
      annotateItemPaths(items);
      return { mode: 'quick', modeLabel: LIBRARY_QUICK_LABELS[ui.quickFilter] || ui.quickFilter, visibleFolders: [], visibleItems: ui.quickFilter === 'recent' ? items : sortLibraryItems(items), breadcrumb: [], ...nav };
    }

    const currentId = ui.currentFolderId;
    const folders = state.libraryFolders.filter((f) => f.parentId === currentId && (showArchived || !f.archived));
    const items = state.libraryItems.filter((it) => it.folderId === currentId && (showArchived || !it.archived) && matchesLibraryTagFilter(it.tags));
    return {
      mode: 'browse',
      modeLabel: '',
      visibleFolders: sortLibraryFolders(folders),
      visibleItems: sortLibraryItems(items),
      breadcrumb: libraryFolderPath(currentId),
      ...nav,
    };
  }

  function renderLibraryRoute(ctx) {
    const ui = state.ui.library;
    const computed = computeLibraryVisible();
    const libCtx = {
      ...ctx,
      allFolders: state.libraryFolders,
      allItems: state.libraryItems,
      currentFolderId: ui.currentFolderId,
      view: ui.view,
      search: ui.search,
      sort: ui.sort,
      quickFilter: ui.quickFilter,
      filterTagIds: ui.filterTagIds,
      showFilters: ui.showFilters,
      showNewMenu: ui.showNewMenu,
      selectedIds: ui.selectedIds,
      mode: computed.mode,
      modeLabel: computed.modeLabel,
      breadcrumb: computed.breadcrumb,
      visibleFolders: computed.visibleFolders,
      visibleItems: computed.visibleItems,
      canGoBack: computed.canGoBack,
      canGoForward: computed.canGoForward,
    };
    return Components.renderLibraryView(libCtx);
  }

  /* ---- Navegación ---- */

  function navigateLibraryFolder(folderId) {
    const ui = state.ui.library;
    const normalized = folderId || null;
    if (ui.currentFolderId !== normalized) {
      ui.historyBack.push(ui.currentFolderId);
      ui.historyForward = [];
    }
    ui.currentFolderId = normalized;
    ui.search = '';
    ui.quickFilter = 'all';
    ui.selectedIds = [];
    renderMain();
  }

  function libraryGoBack() {
    const ui = state.ui.library;
    if (!ui.historyBack.length) return;
    ui.historyForward.push(ui.currentFolderId);
    ui.currentFolderId = ui.historyBack.pop();
    renderMain();
  }

  function libraryGoForward() {
    const ui = state.ui.library;
    if (!ui.historyForward.length) return;
    ui.historyBack.push(ui.currentFolderId);
    ui.currentFolderId = ui.historyForward.pop();
    renderMain();
  }

  /* ---- CRUD de carpetas ---- */

  function newFolderDefaults(parentId) {
    const siblings = state.libraryFolders.filter((f) => f.parentId === (parentId || null));
    const maxPos = siblings.reduce((m, f) => Math.max(m, f.position || 0), -1);
    const now = Utils.nowISO();
    return { id: Utils.uuid(), name: 'Nueva carpeta', parentId: parentId || null, description: '', icon: '📁', color: '#8a8a8a', favorite: false, archived: false, isSample: false, createdAt: now, updatedAt: now, position: maxPos + 1 };
  }

  async function createFolder(parentId, overrides = {}) {
    const folder = { ...newFolderDefaults(parentId), ...overrides };
    state.libraryFolders.push(folder);
    await DB.put('libraryFolders', folder);
    Utils.toast('Carpeta creada', 'success');
    renderMain();
    return folder;
  }

  async function updateFolder(id, patch) {
    const f = libFolder(id);
    if (!f) return;
    Object.assign(f, patch, { updatedAt: Utils.nowISO() });
    await DB.put('libraryFolders', f);
  }

  async function toggleFolderFavorite(id) {
    const f = libFolder(id);
    if (!f) return;
    await updateFolder(id, { favorite: !f.favorite });
    renderMain();
  }

  async function archiveFolder(id) {
    const f = libFolder(id);
    if (!f) return;
    await updateFolder(id, { archived: !f.archived });
    Utils.toast(f.archived ? 'Carpeta restaurada' : 'Carpeta archivada', 'success');
    renderMain();
  }

  async function moveFolderTo(id, targetParentId) {
    const normalized = targetParentId || null;
    if (id === normalized) {
      Utils.toast('No podés mover una carpeta dentro de sí misma', 'error');
      return false;
    }
    if (normalized && Utils.isFolderDescendant(state.libraryFolders, normalized, id)) {
      Utils.toast('No podés mover una carpeta dentro de una de sus propias subcarpetas', 'error');
      return false;
    }
    await updateFolder(id, { parentId: normalized });
    Utils.toast('Carpeta movida', 'success');
    return true;
  }

  async function duplicateFolderRecursive(id) {
    const original = libFolder(id);
    if (!original) return;
    const now = Utils.nowISO();
    const newFolders = [];
    const newItems = [];

    function cloneFolder(folder, newParentId, isRoot) {
      const clone = { ...folder, id: Utils.uuid(), parentId: newParentId, name: isRoot ? folder.name + ' (copia)' : folder.name, isSample: false, createdAt: now, updatedAt: now };
      newFolders.push(clone);
      state.libraryFolders.filter((f) => f.parentId === folder.id).forEach((c) => cloneFolder(c, clone.id, false));
      state.libraryItems.filter((it) => it.folderId === folder.id).forEach((it) => {
        newItems.push({ ...it, id: Utils.uuid(), folderId: clone.id, isSample: false, createdAt: now, updatedAt: now });
      });
      return clone;
    }
    cloneFolder(original, original.parentId, true);
    state.libraryFolders.push(...newFolders);
    state.libraryItems.push(...newItems);
    await DB.bulkPut('libraryFolders', newFolders);
    if (newItems.length) await DB.bulkPut('libraryItems', newItems);
    Utils.toast('Carpeta duplicada', 'success');
    renderMain();
  }

  /** Recolecta recursivamente los IDs de subcarpetas (incluida la propia) y recursos contenidos. */
  function collectFolderDescendants(folderId) {
    const folderIds = [folderId];
    const itemIds = [];
    const queue = [folderId];
    while (queue.length) {
      const cur = queue.shift();
      state.libraryFolders.filter((f) => f.parentId === cur).forEach((c) => {
        folderIds.push(c.id);
        queue.push(c.id);
      });
      state.libraryItems.filter((it) => it.folderId === cur).forEach((it) => itemIds.push(it.id));
    }
    return { folderIds, itemIds };
  }

  async function permanentlyDeleteFolder(id) {
    const { folderIds, itemIds } = collectFolderDescendants(id);
    for (const iid of itemIds) {
      const item = libItem(iid);
      if (item) await deleteLibraryStorageFile(item);
    }
    for (const fid of folderIds) await DB.remove('libraryFolders', fid);
    for (const iid of itemIds) await DB.remove('libraryItems', iid);
    state.libraryFolders = state.libraryFolders.filter((f) => !folderIds.includes(f.id));
    state.libraryItems = state.libraryItems.filter((it) => !itemIds.includes(it.id));
    Utils.toast('Carpeta y su contenido eliminados definitivamente', 'success');
    renderMain();
  }

  async function deleteFolderFlow(id) {
    const f = libFolder(id);
    if (!f) return;
    const { folderIds, itemIds } = collectFolderDescendants(id);
    const extra = folderIds.length - 1 + itemIds.length;
    const behavior = state.settings.libraryDeleteBehavior || 'archive';

    if (behavior === 'ask') {
      openArchiveOrDeleteChoiceModal('folder', id, extra);
      return;
    }
    if (state.settings.libraryConfirmBeforeDelete) {
      const willDelete = behavior === 'delete';
      const ok = await Utils.confirmDialog({
        title: willDelete ? 'Eliminar carpeta' : 'Archivar carpeta',
        message: `${extra > 0 ? `Esto afecta a ${extra} elemento(s) contenidos. ` : ''}¿${willDelete ? 'Eliminar definitivamente' : 'Archivar'} "${f.name}"?`,
        danger: willDelete,
        confirmText: willDelete ? 'Eliminar' : 'Archivar',
      });
      if (!ok) return;
    }
    if (behavior === 'delete') await permanentlyDeleteFolder(id);
    else await archiveFolder(id);
  }

  /* ---- CRUD de recursos ---- */

  function newItemDefaults(folderId) {
    const now = Utils.nowISO();
    return {
      id: Utils.uuid(), folderId: folderId || null, name: 'Nuevo recurso', description: '', resourceType: 'other', storageMode: 'link', url: '', fileData: null, mimeType: null, fileSize: 0, thumbnailData: null, tags: [], linkedVideoIds: [], favorite: false, archived: false, isSample: false, createdAt: now, updatedAt: now, lastUsedAt: null,
    };
  }

  async function createItem(overrides = {}) {
    const item = { ...newItemDefaults(overrides.folderId), ...overrides };
    state.libraryItems.push(item);
    try {
      await DB.put('libraryItems', item);
    } catch (e) {
      // Revertimos el push optimista si IndexedDB rechaza la escritura (por
      // ejemplo, error de cuota al guardar un archivo pesado como local):
      // así el recurso no queda "fantasma" en memoria sin persistir.
      state.libraryItems = state.libraryItems.filter((i) => i.id !== item.id);
      const isQuota = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
      Utils.toast(
        isQuota
          ? 'No hay espacio suficiente en el navegador para guardar este archivo. Probá con un enlace de Drive en su lugar.'
          : 'No se pudo guardar el recurso: ' + (e.message || 'error desconocido'),
        'error'
      );
      renderMain();
      return null;
    }
    renderMain();
    return item;
  }

  async function saveItem(item) {
    item.updatedAt = Utils.nowISO();
    await DB.put('libraryItems', item);
  }

  async function toggleItemFavorite(id) {
    const it = libItem(id);
    if (!it) return;
    it.favorite = !it.favorite;
    await saveItem(it);
    renderMain();
    if (state.ui.library.detailItemId === id) renderEditorOverlay();
  }

  async function toggleItemTag(item, tagId) {
    item.tags = item.tags || [];
    item.tags = item.tags.includes(tagId) ? item.tags.filter((t) => t !== tagId) : [...item.tags, tagId];
    await saveItem(item);
    renderEditorOverlay();
    renderMain();
  }

  async function moveItemTo(id, targetFolderId) {
    const it = libItem(id);
    if (!it) return;
    it.folderId = targetFolderId || null;
    await saveItem(it);
    Utils.toast('Recurso movido', 'success');
  }

  async function duplicateItemFlow(id) {
    const it = libItem(id);
    if (!it) return;
    const copy = { ...it, id: Utils.uuid(), name: it.name + ' (copia)', favorite: false, isSample: false, createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() };
    state.libraryItems.push(copy);
    await DB.put('libraryItems', copy);
    Utils.toast('Recurso duplicado', 'success');
    renderMain();
  }

  async function permanentlyDeleteItem(id) {
    const item = libItem(id);
    if (item) await deleteLibraryStorageFile(item);
    await DB.remove('libraryItems', id);
    state.libraryItems = state.libraryItems.filter((it) => it.id !== id);
    Utils.toast('Recurso eliminado definitivamente', 'success');
    if (state.ui.library.detailItemId === id) closeLibraryDetail();
    renderMain();
  }

  async function archiveItem(id) {
    const it = libItem(id);
    if (!it) return;
    it.archived = !it.archived;
    await saveItem(it);
    Utils.toast(it.archived ? 'Recurso archivado' : 'Recurso restaurado', 'success');
    renderMain();
    if (state.ui.library.detailItemId === id) renderEditorOverlay();
  }

  async function deleteItemFlow(id) {
    const it = libItem(id);
    if (!it) return;
    const behavior = state.settings.libraryDeleteBehavior || 'archive';
    if (behavior === 'ask') {
      openArchiveOrDeleteChoiceModal('item', id, 0);
      return;
    }
    if (state.settings.libraryConfirmBeforeDelete) {
      const willDelete = behavior === 'delete';
      const ok = await Utils.confirmDialog({
        title: willDelete ? 'Eliminar recurso' : 'Archivar recurso',
        message: `¿${willDelete ? 'Eliminar definitivamente' : 'Archivar'} "${it.name}"?`,
        danger: willDelete,
        confirmText: willDelete ? 'Eliminar' : 'Archivar',
      });
      if (!ok) return;
    }
    if (behavior === 'delete') await permanentlyDeleteItem(id);
    else await archiveItem(id);
  }

  function openArchiveOrDeleteChoiceModal(kind, id, extraCount) {
    const dialog = document.getElementById('generic-modal');
    const label = kind === 'folder' ? 'la carpeta' : 'el recurso';
    dialog.innerHTML = `
      <div class="modal__header"><h3>Eliminar ${label}</h3></div>
      <div class="modal__body"><p>${extraCount ? `Esto afecta a ${extraCount} elemento(s) contenidos. ` : ''}¿Querés archivar${kind === 'folder' ? ' la carpeta (su contenido queda oculto hasta restaurarla)' : ''} o eliminar definitivamente?</p></div>
      <div class="modal__footer modal__footer--wrap">
        <button class="btn btn--secondary" data-action="choice-archive" data-kind="${kind}" data-id="${id}">Archivar</button>
        <button class="btn btn--danger" data-action="choice-delete" data-kind="${kind}" data-id="${id}">Eliminar definitivamente</button>
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
      </div>`;
    dialog.showModal();
  }

  async function resolveArchiveOrDeleteChoice(action, kind, id) {
    document.getElementById('generic-modal').close();
    if (kind === 'folder') {
      if (action === 'choice-delete') await permanentlyDeleteFolder(id);
      else await archiveFolder(id);
    } else if (action === 'choice-delete') {
      await permanentlyDeleteItem(id);
    } else {
      await archiveItem(id);
    }
  }

  /* ---- Detalle de recurso (overlay compartido con el editor de video) ---- */

  function currentLibraryDetailItem() {
    return state.ui.library.detailItemId ? libItem(state.ui.library.detailItemId) : null;
  }

  async function markLibraryItemUsed(id) {
    const it = libItem(id);
    if (!it) return;
    it.lastUsedAt = Utils.nowISO();
    await DB.put('libraryItems', it);
  }

  function openLibraryDetail(itemId) {
    markLibraryItemUsed(itemId);
    state.ui.editingVideoId = null;
    state.ui.library.detailItemId = itemId;
    renderEditorOverlay();
  }

  function closeLibraryDetail() {
    state.ui.library.detailItemId = null;
    document.getElementById('editor-root').innerHTML = '';
    renderMain();
  }

  const saveLibraryItemDebounced = Utils.debounce((id) => {
    const it = libItem(id);
    if (it) {
      it.updatedAt = Utils.nowISO();
      DB.put('libraryItems', it);
    }
  }, 500);

  /* ---- Abrir / copiar / descargar recursos ---- */

  const LIBRARY_STORAGE_BUCKET = 'inserts';

  function storageClient() {
    if (typeof Supa === 'undefined' || !Supa.client) {
      throw new Error('Supabase no está configurado.');
    }
    return Supa.client.storage.from(LIBRARY_STORAGE_BUCKET);
  }

  function safeStorageFileName(name) {
    const raw = String(name || 'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const clean = raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return clean || 'archivo';
  }

  function storagePathForFile(fileName) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}/${m}/${Utils.uuid()}-${safeStorageFileName(fileName)}`;
  }

  function publicStorageUrl(path) {
    if (!path) return '';
    const { data } = storageClient().getPublicUrl(path);
    return data && data.publicUrl ? data.publicUrl : '';
  }

  async function uploadLibraryBlob(blob, fileName, mimeType) {
    const path = storagePathForFile(fileName);
    const { error } = await storageClient().upload(path, blob, {
      cacheControl: '3600',
      contentType: mimeType || blob.type || 'application/octet-stream',
      upsert: false,
    });
    if (error) throw new Error(`No se pudo subir el archivo a Supabase Storage: ${error.message}`);
    return { path, url: publicStorageUrl(path) };
  }

  async function deleteLibraryStorageFile(item) {
    if (!item || !item.storagePath) return;
    const isShared = state.libraryItems.some((other) => other.id !== item.id && other.storagePath === item.storagePath);
    if (isShared) return;
    const { error } = await storageClient().remove([item.storagePath]);
    if (error) console.warn('[Fútbol XL Studio] No se pudo eliminar el archivo de Storage:', error.message);
  }

  function libraryItemFileUrl(item) {
    return (item && (item.url || item.fileData)) || '';
  }

  function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function openLibraryItem(id) {
    const it = libItem(id);
    if (!it) return;
    markLibraryItemUsed(id);
    if (it.storageMode === 'link') {
      if (it.url && Utils.looksLikeUrl(it.url)) {
        window.open(it.url, '_blank', 'noopener');
      } else if (it.url) {
        Utils.toast('Este enlace no tiene una URL válida (debe empezar con http:// o https://)', 'error');
      }
      return;
    }
    const source = libraryItemFileUrl(it);
    if (!source) return;
    if (it.storagePath || /^https?:\/\//i.test(source)) {
      window.open(source, '_blank', 'noopener');
      return;
    }
    try {
      const blob = dataUrlToBlob(source);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      window.open(source, '_blank', 'noopener');
    }
  }

  function downloadLibraryItem(id) {
    const it = libItem(id);
    if (!it || it.storageMode !== 'file') return;
    const source = libraryItemFileUrl(it);
    if (!source) return;
    if (it.storagePath || /^https?:\/\//i.test(source)) {
      const a = document.createElement('a');
      a.href = source;
      a.download = it.name || 'archivo';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    try {
      const blob = dataUrlToBlob(source);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = it.name || 'archivo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      Utils.toast('No se pudo preparar la descarga', 'error');
    }
  }

  async function copyLibraryItemLink(id) {
    const it = libItem(id);
    if (!it) return;
    const text = it.storageMode === 'link' ? it.url : (it.url || `${it.name} (archivo guardado en la Biblioteca)`);
    const ok = await Utils.copyToClipboard(text);
    Utils.toast(ok ? 'Copiado' : 'No se pudo copiar', ok ? 'success' : 'error');
  }

  /* ---- Subida de archivos (input, drag&drop de SO, pegado) ---- */

  function triggerLibraryFileInput() {
    document.getElementById('library-file-input')?.click();
  }

  /** Muestra el modal de advertencia y espera la decisión del usuario. */
  function askFileSizeDecision(sizeLabel, limitMB) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('generic-modal');
      dialog.innerHTML = Components.renderFileSizeWarningModalBody(sizeLabel, limitMB);
      dialog._resolveFileSize = resolve;
      dialog.showModal();
    });
  }

  async function handleLibraryFileUpload(files, folderId) {
    const limitBytes = 50 * 1024 * 1024;
    let addedCount = 0;
    for (const file of Array.from(files || [])) {
      if (file.size > limitBytes) {
        Utils.toast(`"${file.name}" supera el límite de 50 MB configurado en Supabase.`, 'error');
        continue;
      }

      const resourceType = Utils.resourceTypeFromFile(file.type, file.name);
      let thumbnailData = null;
      if (resourceType === 'image') {
        const dataUrl = await Utils.readFileAsDataURL(file);
        thumbnailData = state.settings.libraryCompressThumbnails
          ? await Utils.generateThumbnail(dataUrl, 320, state.settings.libraryThumbnailQuality || 0.72)
          : dataUrl;
      }

      let uploaded = null;
      try {
        Utils.toast(`Subiendo ${file.name}…`, 'info');
        uploaded = await uploadLibraryBlob(file, file.name, file.type);
        const created = await createItem({
          folderId: folderId || null,
          name: file.name,
          resourceType,
          storageMode: 'file',
          storageProvider: 'supabase',
          storagePath: uploaded.path,
          url: uploaded.url,
          fileData: null,
          thumbnailData,
          mimeType: file.type,
          fileSize: file.size,
        });
        if (!created) {
          await storageClient().remove([uploaded.path]);
          continue;
        }
        addedCount++;
      } catch (e) {
        if (uploaded && uploaded.path) await storageClient().remove([uploaded.path]);
        Utils.toast(e.message || `No se pudo subir ${file.name}`, 'error');
      }
    }
    if (addedCount) Utils.toast(`${addedCount} archivo(s) agregado(s) a la Biblioteca`, 'success');
  }

  /* ---- Pegar imagen desde el portapapeles (Ctrl/Cmd+V) ---- */

  let pendingPastedImage = null;

  function openPasteImageModal(dataUrl, size, mimeType) {
    pendingPastedImage = { dataUrl, size, mimeType };
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderPasteImageModalBody(Utils.formatBytes(size));
    dialog.showModal();
    setTimeout(() => document.getElementById('paste-form-name')?.focus(), 30);
  }

  async function submitPasteImage() {
    if (!pendingPastedImage) return;
    const name = document.getElementById('paste-form-name').value.trim() || 'Imagen pegada';
    const description = document.getElementById('paste-form-description').value.trim();
    const thumbnailData = state.settings.libraryCompressThumbnails
      ? await Utils.generateThumbnail(pendingPastedImage.dataUrl, 320, state.settings.libraryThumbnailQuality || 0.72)
      : pendingPastedImage.dataUrl;
    const blob = dataUrlToBlob(pendingPastedImage.dataUrl);
    let uploaded = null;
    try {
      uploaded = await uploadLibraryBlob(blob, name, pendingPastedImage.mimeType);
      const created = await createItem({
        folderId: state.ui.library.currentFolderId,
        name,
        description,
        resourceType: 'image',
        storageMode: 'file',
        storageProvider: 'supabase',
        storagePath: uploaded.path,
        url: uploaded.url,
        fileData: null,
        thumbnailData,
        mimeType: pendingPastedImage.mimeType,
        fileSize: pendingPastedImage.size,
      });
      if (!created) throw new Error('No se pudo guardar el registro de la imagen.');
      pendingPastedImage = null;
      document.getElementById('generic-modal').close();
      Utils.toast('Imagen guardada en la Biblioteca', 'success');
    } catch (e) {
      if (uploaded && uploaded.path) await storageClient().remove([uploaded.path]);
      Utils.toast(e.message || 'No se pudo guardar la imagen', 'error');
    }
  }

  function wireLibraryPasteHandler() {
    document.addEventListener('paste', async (e) => {
      if (state.ui.route !== 'library') return;
      if (Utils.isTypingInField()) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const dataItem of items) {
        if (dataItem.type && dataItem.type.startsWith('image/')) {
          e.preventDefault();
          const file = dataItem.getAsFile();
          if (!file) continue;
          const dataUrl = await Utils.readFileAsDataURL(file);
          openPasteImageModal(dataUrl, file.size, file.type);
          break;
        }
      }
    });
  }

  /* ---- Modales: nueva carpeta / editar carpeta ---- */

  /** Cierra tanto el menú desplegable "+ Nuevo" (desktop) como el menú del FAB (mobile). */
  function closeLibraryNewMenus() {
    state.ui.library.showNewMenu = false;
    document.getElementById('menu-library-new')?.setAttribute('hidden', '');
    renderMain();
  }

  function openNewFolderModal() {
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderFolderFormModalBody({}, null);
    dialog.showModal();
    setTimeout(() => document.getElementById('folder-form-name')?.focus(), 30);
  }

  function openEditFolderModal(id) {
    const f = libFolder(id);
    if (!f) return;
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderFolderFormModalBody({}, f);
    dialog.showModal();
  }

  function folderFormValues() {
    return {
      name: document.getElementById('folder-form-name').value.trim() || 'Nueva carpeta',
      description: document.getElementById('folder-form-description').value.trim(),
      icon: document.getElementById('folder-form-icon').value.trim() || '📁',
      color: document.getElementById('folder-form-color').value,
    };
  }

  async function submitNewFolder() {
    const values = folderFormValues();
    const parentId = state.ui.library.currentFolderId;
    const dup = state.libraryFolders.some((f) => f.parentId === parentId && !f.archived && f.name.trim().toLowerCase() === values.name.toLowerCase());
    if (dup) {
      Utils.toast('Ya existe una carpeta con ese nombre en este nivel', 'error');
      return;
    }
    await createFolder(parentId, values);
    document.getElementById('generic-modal').close();
  }

  async function submitEditFolder(id) {
    const f = libFolder(id);
    if (!f) return;
    const values = folderFormValues();
    const dup = state.libraryFolders.some((x) => x.id !== id && x.parentId === f.parentId && !x.archived && x.name.trim().toLowerCase() === values.name.toLowerCase());
    if (dup) {
      Utils.toast('Ya existe una carpeta con ese nombre en este nivel', 'error');
      return;
    }
    await updateFolder(id, values);
    document.getElementById('generic-modal').close();
    renderMain();
  }

  /* ---- Modal: agregar enlace ---- */

  function openNewLinkModal(presetType) {
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderNewLinkModalBody({}, presetType || '');
    dialog.showModal();
    setTimeout(() => document.getElementById('link-form-url')?.focus(), 30);
  }

  async function submitNewLink() {
    const name = document.getElementById('link-form-name').value.trim();
    const url = document.getElementById('link-form-url').value.trim();
    const typeSel = document.getElementById('link-form-type').value;
    const description = document.getElementById('link-form-description').value.trim();
    if (!url || !Utils.looksLikeUrl(url)) {
      Utils.toast('Ingresá una URL válida (debe empezar con http:// o https://)', 'error');
      return;
    }
    const detected = Utils.detectLinkType(url);
    const typeMap = { drive: 'drive', driveFolder: 'driveFolder', docs: 'docs', sheets: 'sheets', slides: 'docs', youtube: 'youtube', vimeo: 'vimeo', web: 'link' };
    const resourceType = typeSel || typeMap[detected] || 'link';
    await createItem({ folderId: state.ui.library.currentFolderId, name: name || Utils.urlDomain(url), url, resourceType, storageMode: 'link', description });
    Utils.toast('Enlace agregado', 'success');
    document.getElementById('generic-modal').close();
  }

  /* ---- Modal: nota o documento rápido ---- */

  function openQuickNoteModal() {
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = `
      <div class="modal__header"><h3>Agregar nota o documento</h3></div>
      <div class="modal__body">
        <div class="form-grid">
          <label class="field field--wide"><span>Nombre</span><input type="text" id="note-form-name" placeholder="Nombre de la nota o documento" /></label>
          <label class="field field--wide"><span>Contenido</span><textarea id="note-form-content" rows="6" placeholder="Escribí el contenido…"></textarea></label>
        </div>
        <p class="muted small">Se guarda como un archivo de texto local dentro de la Biblioteca.</p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="submit-quick-note">Guardar</button>
      </div>`;
    dialog.showModal();
    setTimeout(() => document.getElementById('note-form-name')?.focus(), 30);
  }

  async function submitQuickNote() {
    const name = document.getElementById('note-form-name').value.trim() || 'Nota sin título';
    const content = document.getElementById('note-form-content').value;
    const fileData = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    await createItem({ folderId: state.ui.library.currentFolderId, name, resourceType: 'document', storageMode: 'file', fileData, mimeType: 'text/plain', fileSize: content.length });
    Utils.toast('Nota guardada', 'success');
    document.getElementById('generic-modal').close();
  }

  /* ---- Modal: mover a… (individual o en masa) ---- */

  function openMoveModal(kind, id) {
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderMoveToModalBody({ allFolders: state.libraryFolders }, kind, id || '');
    dialog.dataset.moveKind = kind;
    dialog.dataset.moveId = id || '';
    dialog.showModal();
  }

  function openBulkMoveModal() {
    openMoveModal('bulk', '');
  }

  async function submitMove() {
    const dialog = document.getElementById('generic-modal');
    const kind = dialog.dataset.moveKind;
    const id = dialog.dataset.moveId;
    const select = document.getElementById('move-target-select');
    const targetId = select ? select.value || null : null;

    if (kind === 'bulk') {
      for (const iid of state.ui.library.selectedIds) {
        const it = libItem(iid);
        if (it) {
          it.folderId = targetId;
          await saveItem(it);
        }
      }
      state.ui.library.selectedIds = [];
      Utils.toast('Recursos movidos', 'success');
      dialog.close();
      renderMain();
      return;
    }

    let ok = true;
    if (kind === 'folder') ok = await moveFolderTo(id, targetId);
    else await moveItemTo(id, targetId);
    if (ok) {
      dialog.close();
      renderMain();
    }
  }

  /* ---- Modal: relacionar un recurso con videos ---- */

  function wirePickerSearch(inputId, listId) {
    const search = document.getElementById(inputId);
    if (!search) return;
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll(`#${listId} .library-video-picker__row`).forEach((row) => {
        row.style.display = row.dataset.title.includes(q) ? '' : 'none';
      });
    });
  }

  function openRelateVideosModal(itemId) {
    const item = libItem(itemId);
    if (!item) return;
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderRelateVideosModalBody({ videos: state.videos }, item);
    dialog.showModal();
    wirePickerSearch('relate-video-search', 'relate-video-list');
  }

  async function submitRelateVideos(itemId) {
    const item = libItem(itemId);
    if (!item) return;
    const checked = Array.from(document.querySelectorAll('#relate-video-list input[type=checkbox]:checked')).map((el) => el.dataset.videoId);
    item.linkedVideoIds = checked;
    await saveItem(item);
    document.getElementById('generic-modal').close();
    renderMain();
    if (state.ui.library.detailItemId === itemId) renderEditorOverlay();
  }

  /* ---- Modal: agregar recursos existentes desde la ficha de un video ---- */

  function openLinkLibraryPicker(videoId) {
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderLinkLibraryPickerModalBody({ allItems: state.libraryItems }, videoId);
    dialog.showModal();
    wirePickerSearch('link-picker-search', 'link-picker-list');
  }

  async function submitLinkPicker(videoId) {
    const checked = new Set(Array.from(document.querySelectorAll('#link-picker-list input[type=checkbox]:checked')).map((el) => el.dataset.itemId));
    for (const it of state.libraryItems) {
      const has = (it.linkedVideoIds || []).includes(videoId);
      const shouldHave = checked.has(it.id);
      if (has && !shouldHave) {
        it.linkedVideoIds = it.linkedVideoIds.filter((v) => v !== videoId);
        await saveItem(it);
      } else if (!has && shouldHave) {
        it.linkedVideoIds = [...(it.linkedVideoIds || []), videoId];
        await saveItem(it);
      }
    }
    document.getElementById('generic-modal').close();
    renderEditorBody();
  }

  async function unlinkItemFromVideo(itemId, videoId) {
    const it = libItem(itemId);
    if (!it) return;
    it.linkedVideoIds = (it.linkedVideoIds || []).filter((v) => v !== videoId);
    await saveItem(it);
    if (state.ui.editingVideoId) renderEditorBody();
    if (state.ui.library.detailItemId === itemId) renderEditorOverlay();
  }

  async function createLibraryItemForVideo(videoId) {
    const video = state.videos.find((v) => v.id === videoId);
    const item = await createItem({
      folderId: state.settings.libraryDefaultFolderId || null,
      name: `Recurso de "${video ? video.title || 'video sin título' : 'video'}"`,
      linkedVideoIds: [videoId],
    });
    if (!item) return; // no se pudo persistir (ver createItem); ya se mostró el toast de error
    // Cerramos el editor de video y abrimos el detalle del recurso recién
    // creado para que el usuario complete tipo/URL/archivo. El video sigue
    // accesible desde "Videos relacionados" en el propio recurso.
    state.ui.editingVideoId = null;
    state.ui.library.detailItemId = item.id;
    renderEditorOverlay();
    renderMain();
  }

  function openVideoFromLibrary(videoId) {
    state.ui.library.detailItemId = null;
    openVideoEditor(videoId, 'library');
  }

  /* ---- Bulk actions (vista Lista) ---- */

  async function libraryBulkFavorite() {
    for (const id of state.ui.library.selectedIds) {
      const it = libItem(id);
      if (it) {
        it.favorite = true;
        await saveItem(it);
      }
    }
    Utils.toast('Marcados como favoritos', 'success');
    state.ui.library.selectedIds = [];
    renderMain();
  }

  async function libraryBulkArchive() {
    for (const id of state.ui.library.selectedIds) {
      const it = libItem(id);
      if (it) {
        it.archived = true;
        await saveItem(it);
      }
    }
    Utils.toast('Recursos archivados', 'success');
    state.ui.library.selectedIds = [];
    renderMain();
  }

  async function libraryBulkDelete() {
    const ok = await Utils.confirmDialog({ title: 'Eliminar recursos', message: `¿Eliminar definitivamente ${state.ui.library.selectedIds.length} recurso(s)? Esta acción no se puede deshacer.`, danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    const ids = state.ui.library.selectedIds;
    for (const id of ids) await DB.remove('libraryItems', id);
    state.libraryItems = state.libraryItems.filter((it) => !ids.includes(it.id));
    state.ui.library.selectedIds = [];
    Utils.toast('Recursos eliminados', 'success');
    renderMain();
  }

  async function libraryBulkTag(tagId) {
    if (!tagId) return;
    for (const id of state.ui.library.selectedIds) {
      const it = libItem(id);
      if (it) {
        it.tags = Array.from(new Set([...(it.tags || []), tagId]));
        await saveItem(it);
      }
    }
    Utils.toast('Etiqueta aplicada', 'success');
    renderMain();
  }

  /* ============================================================================
     MÓDULO COSTOS (v1.2.0)
     Registro y control de gastos y suscripciones. "Proyecto asociado" se
     reutiliza contra las series/videos EXISTENTES (projectSeriesId /
     projectVideoId): no hay una entidad "Proyecto" separada.
     ========================================================================= */

  function renderCostsRoute(ctx) {
    const fullCtx = {
      ...ctx,
      costsTab: state.ui.costsTab,
      costSettingsSection: state.ui.costSettingsSection,
      expenseFilters: state.ui.costExpenseFilters,
      expenseSearch: state.ui.costExpenseSearch,
      showCostFilters: state.ui.showCostFilters,
      visibleExpenses: computeVisibleExpenses(),
    };
    let body = '';
    if (state.ui.costsTab === 'expenses') body = Components.renderCostsExpensesTab(fullCtx);
    else if (state.ui.costsTab === 'subscriptions') body = Components.renderCostsSubscriptionsTab(fullCtx);
    else if (state.ui.costsTab === 'settings') body = Components.renderCostsSettingsTab(fullCtx);
    else body = Components.renderCostsSummaryTab(fullCtx);
    return Components.renderCostsShell(fullCtx, body);
  }

  /* ---- Filtros / búsqueda de gastos ---- */

  function matchesExpenseFilters(e, f) {
    if (f.month && new Date(e.date + 'T00:00:00').getMonth() + 1 !== Number(f.month)) return false;
    if (f.year && (e.date || '').slice(0, 4) !== String(f.year)) return false;
    if (f.categoryId && e.categoryId !== f.categoryId) return false;
    if (f.expenseTypeId && e.expenseTypeId !== f.expenseTypeId) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.currencyId && e.currencyId !== f.currencyId) return false;
    if (f.projectVideoId && e.projectVideoId !== f.projectVideoId) return false;
    if (f.projectSeriesId && e.projectSeriesId !== f.projectSeriesId) return false;
    if (f.recipient && !(e.recipient || '').toLowerCase().includes(f.recipient.toLowerCase())) return false;
    if (f.dateFrom && e.date < f.dateFrom) return false;
    if (f.dateTo && e.date > f.dateTo) return false;
    return true;
  }

  function matchesExpenseSearch(e, qRaw) {
    const q = (qRaw || '').trim().toLowerCase();
    if (!q) return true;
    const blob = [e.description, e.recipient, e.notes].filter(Boolean).join(' ').toLowerCase();
    return blob.includes(q);
  }

  function computeVisibleExpenses() {
    const f = state.ui.costExpenseFilters;
    let list = state.expenses.filter((e) => matchesExpenseFilters(e, f) && matchesExpenseSearch(e, state.ui.costExpenseSearch));
    list = list.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    return list;
  }

  function expenseById(id) {
    return state.expenses.find((e) => e.id === id) || null;
  }

  function subscriptionById(id) {
    return state.subscriptions.find((s) => s.id === id) || null;
  }

  /* ---- CRUD de gastos ---- */

  function newExpenseDefaults() {
    const now = Utils.nowISO();
    return {
      id: Utils.uuid(),
      date: Utils.todayISO(),
      description: '',
      categoryId: '',
      recipient: '',
      amount: 0,
      currencyId: '',
      expenseTypeId: '',
      status: 'pending',
      paymentMethodId: '',
      projectVideoId: null,
      projectSeriesId: null,
      notes: '',
      receiptUrl: '',
      subscriptionId: null,
      isSample: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  function readExpenseForm() {
    return {
      date: document.getElementById('expense-form-date').value,
      description: document.getElementById('expense-form-description').value.trim(),
      categoryId: document.getElementById('expense-form-category').value,
      recipient: document.getElementById('expense-form-recipient').value.trim(),
      amount: document.getElementById('expense-form-amount').value,
      currencyId: document.getElementById('expense-form-currency').value,
      expenseTypeId: document.getElementById('expense-form-type').value,
      status: document.getElementById('expense-form-status').value,
      paymentMethodId: document.getElementById('expense-form-method').value,
      projectVideoId: document.getElementById('expense-form-project-video').value || null,
      projectSeriesId: document.getElementById('expense-form-project-series').value || null,
      receiptUrl: document.getElementById('expense-form-receipt').value.trim(),
      notes: document.getElementById('expense-form-notes').value.trim(),
    };
  }

  /** Regla de negocio: fecha, descripción, categoría, monto, moneda y estado son obligatorios; el monto no puede ser negativo. */
  function validateExpenseForm(vals) {
    if (!vals.date) return 'Completá los campos obligatorios: falta la fecha.';
    if (!vals.description) return 'Completá los campos obligatorios: falta la descripción.';
    if (!vals.categoryId) return 'Completá los campos obligatorios: falta la categoría.';
    if (vals.amount === '' || vals.amount === null || isNaN(Number(vals.amount))) return 'Completá los campos obligatorios: falta el monto.';
    if (Number(vals.amount) < 0) return 'El monto no puede ser negativo.';
    if (!vals.currencyId) return 'Completá los campos obligatorios: falta la moneda.';
    if (!vals.status) return 'Completá los campos obligatorios: falta el estado.';
    if (vals.receiptUrl && !Utils.looksLikeUrl(vals.receiptUrl)) return 'El comprobante debe ser una URL que empiece con http:// o https://.';
    return null;
  }

  function openNewExpenseModal(presetProjectVideoId) {
    const dialog = document.getElementById('generic-modal');
    const base = presetProjectVideoId ? { projectVideoId: presetProjectVideoId } : null;
    dialog.innerHTML = Components.renderExpenseFormModalBody(buildBaseCtx(), base);
    dialog.showModal();
    setTimeout(() => document.getElementById('expense-form-description')?.focus(), 30);
  }

  function openEditExpenseModal(id) {
    const e = expenseById(id);
    if (!e) return;
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderExpenseFormModalBody(buildBaseCtx(), e);
    dialog.showModal();
  }

  async function submitNewExpense() {
    const vals = readExpenseForm();
    const err = validateExpenseForm(vals);
    if (err) {
      Utils.toast(err, 'error');
      return;
    }
    const expense = { ...newExpenseDefaults(), ...vals, amount: Number(vals.amount) };
    state.expenses.push(expense);
    try {
      await DB.put('expenses', expense);
    } catch (ex) {
      state.expenses = state.expenses.filter((x) => x.id !== expense.id);
      Utils.toast('No se pudo guardar el gasto: ' + (ex.message || 'error desconocido'), 'error');
      renderMain();
      return;
    }
    document.getElementById('generic-modal').close();
    Utils.toast('Gasto creado correctamente', 'success');
    renderMain();
  }

  async function submitEditExpense(id) {
    const e = expenseById(id);
    if (!e) return;
    const vals = readExpenseForm();
    const err = validateExpenseForm(vals);
    if (err) {
      Utils.toast(err, 'error');
      return;
    }
    const previous = { ...e };
    Object.assign(e, vals, { amount: Number(vals.amount), updatedAt: Utils.nowISO() });
    try {
      await DB.put('expenses', e);
    } catch (ex) {
      Object.assign(e, previous);
      Utils.toast('No se pudo guardar el gasto: ' + (ex.message || 'error desconocido'), 'error');
      renderMain();
      return;
    }
    document.getElementById('generic-modal').close();
    Utils.toast('Gasto actualizado', 'success');
    renderMain();
  }

  async function duplicateExpense(id) {
    const e = expenseById(id);
    if (!e) return;
    const now = Utils.nowISO();
    const copy = { ...e, id: Utils.uuid(), description: `${e.description} (copia)`, status: 'pending', subscriptionId: null, isSample: false, createdAt: now, updatedAt: now };
    state.expenses.push(copy);
    await DB.put('expenses', copy);
    Utils.toast('Gasto duplicado', 'success');
    renderMain();
  }

  async function markExpensePaid(id) {
    const e = expenseById(id);
    if (!e) return;
    e.status = 'paid';
    e.updatedAt = Utils.nowISO();
    await DB.put('expenses', e);
    Utils.toast('Gasto marcado como pagado', 'success');
    renderMain();
  }

  async function deleteExpense(id) {
    const e = expenseById(id);
    if (!e) return;
    if (state.settings.costsConfirmBeforeDelete) {
      const ok = await Utils.confirmDialog({ title: 'Eliminar gasto', message: `¿Eliminar "${e.description || 'este gasto'}"? Esta acción no se puede deshacer.`, danger: true, confirmText: 'Eliminar' });
      if (!ok) return;
    }
    state.expenses = state.expenses.filter((x) => x.id !== id);
    await DB.remove('expenses', id);
    Utils.toast('Gasto eliminado', 'success');
    renderMain();
  }

  /* ---- CRUD de suscripciones ---- */

  function newSubscriptionDefaults() {
    const now = Utils.nowISO();
    return {
      id: Utils.uuid(),
      name: '',
      categoryId: '',
      description: '',
      amount: 0,
      currencyId: '',
      frequency: 'monthly',
      customFrequencyValue: null,
      customFrequencyUnit: 'months',
      nextBillingDate: Utils.todayISO(),
      startDate: Utils.todayISO(),
      paymentMethodId: '',
      status: 'active',
      autoRenew: true,
      projectVideoId: null,
      projectSeriesId: null,
      website: '',
      notes: '',
      isSample: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  function readSubscriptionForm() {
    const frequency = document.getElementById('sub-form-frequency').value;
    return {
      name: document.getElementById('sub-form-name').value.trim(),
      categoryId: document.getElementById('sub-form-category').value,
      description: document.getElementById('sub-form-description').value.trim(),
      amount: document.getElementById('sub-form-amount').value,
      currencyId: document.getElementById('sub-form-currency').value,
      frequency,
      customFrequencyValue: frequency === 'custom' ? document.getElementById('sub-form-custom-value')?.value || '' : null,
      customFrequencyUnit: frequency === 'custom' ? document.getElementById('sub-form-custom-unit')?.value || 'months' : null,
      nextBillingDate: document.getElementById('sub-form-next-billing').value,
      startDate: document.getElementById('sub-form-start-date').value,
      paymentMethodId: document.getElementById('sub-form-method').value,
      status: document.getElementById('sub-form-status').value,
      autoRenew: document.getElementById('sub-form-autorenew').checked,
      projectVideoId: document.getElementById('sub-form-project-video').value || null,
      projectSeriesId: document.getElementById('sub-form-project-series').value || null,
      website: document.getElementById('sub-form-website').value.trim(),
      notes: document.getElementById('sub-form-notes').value.trim(),
    };
  }

  function validateSubscriptionForm(vals) {
    if (!vals.name) return 'Completá los campos obligatorios: falta el nombre.';
    if (vals.amount === '' || vals.amount === null || isNaN(Number(vals.amount))) return 'Completá los campos obligatorios: falta el precio.';
    if (Number(vals.amount) < 0) return 'El precio no puede ser negativo.';
    if (!vals.currencyId) return 'Completá los campos obligatorios: falta la moneda.';
    if (!vals.frequency) return 'Completá los campos obligatorios: falta la frecuencia.';
    if (!vals.nextBillingDate) return 'Completá los campos obligatorios: falta la próxima fecha de cobro.';
    if (vals.frequency === 'custom' && (!vals.customFrequencyValue || Number(vals.customFrequencyValue) < 1)) return 'Indicá cada cuántos días/meses se cobra en la frecuencia personalizada.';
    if (vals.website && !Utils.looksLikeUrl(vals.website)) return 'El sitio web debe ser una URL que empiece con http:// o https://.';
    return null;
  }

  function openNewSubscriptionModal() {
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderSubscriptionFormModalBody(buildBaseCtx(), null);
    dialog.showModal();
    setTimeout(() => document.getElementById('sub-form-name')?.focus(), 30);
  }

  function openEditSubscriptionModal(id) {
    const s = subscriptionById(id);
    if (!s) return;
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderSubscriptionFormModalBody(buildBaseCtx(), s);
    dialog.showModal();
  }

  async function submitNewSubscription() {
    const vals = readSubscriptionForm();
    const err = validateSubscriptionForm(vals);
    if (err) {
      Utils.toast(err, 'error');
      return;
    }
    const sub = { ...newSubscriptionDefaults(), ...vals, amount: Number(vals.amount) };
    state.subscriptions.push(sub);
    try {
      await DB.put('subscriptions', sub);
    } catch (ex) {
      state.subscriptions = state.subscriptions.filter((x) => x.id !== sub.id);
      Utils.toast('No se pudo guardar la suscripción: ' + (ex.message || 'error desconocido'), 'error');
      renderMain();
      return;
    }
    document.getElementById('generic-modal').close();
    Utils.toast('Suscripción creada correctamente', 'success');
    renderMain();
  }

  async function submitEditSubscription(id) {
    const s = subscriptionById(id);
    if (!s) return;
    const vals = readSubscriptionForm();
    const err = validateSubscriptionForm(vals);
    if (err) {
      Utils.toast(err, 'error');
      return;
    }
    // Regla de negocio: modificar el precio de una suscripción NO debe
    // alterar los gastos históricos ya generados por pagos anteriores.
    Object.assign(s, vals, { amount: Number(vals.amount), updatedAt: Utils.nowISO() });
    await DB.put('subscriptions', s);
    document.getElementById('generic-modal').close();
    Utils.toast('Suscripción actualizada', 'success');
    renderMain();
  }

  async function pauseSubscription(id) {
    const s = subscriptionById(id);
    if (!s) return;
    s.status = 'paused';
    s.updatedAt = Utils.nowISO();
    await DB.put('subscriptions', s);
    Utils.toast('Suscripción pausada', 'success');
    renderMain();
  }

  async function reactivateSubscription(id) {
    const s = subscriptionById(id);
    if (!s) return;
    s.status = 'active';
    s.updatedAt = Utils.nowISO();
    await DB.put('subscriptions', s);
    Utils.toast('Suscripción reactivada', 'success');
    renderMain();
  }

  async function cancelSubscription(id) {
    const s = subscriptionById(id);
    if (!s) return;
    const ok = await Utils.confirmDialog({ title: 'Cancelar suscripción', message: `¿Cancelar "${s.name}"? Los gastos ya registrados por esta suscripción se conservan; solo se detienen los próximos cobros.`, danger: true, confirmText: 'Cancelar suscripción' });
    if (!ok) return;
    s.status = 'cancelled';
    s.updatedAt = Utils.nowISO();
    await DB.put('subscriptions', s);
    Utils.toast('Suscripción cancelada', 'success');
    renderMain();
  }

  async function deleteSubscription(id) {
    const s = subscriptionById(id);
    if (!s) return;
    const linkedCount = state.expenses.filter((e) => e.subscriptionId === id).length;
    const ok = await Utils.confirmDialog({
      title: 'Eliminar suscripción',
      message: linkedCount
        ? `¿Eliminar "${s.name}"? Esta acción no se puede deshacer. Los ${linkedCount} gasto(s) históricos ya registrados por esta suscripción NO se eliminan.`
        : `¿Eliminar "${s.name}"? Esta acción no se puede deshacer.`,
      danger: true,
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    state.subscriptions = state.subscriptions.filter((x) => x.id !== id);
    await DB.remove('subscriptions', id);
    Utils.toast('Suscripción eliminada', 'success');
    renderMain();
  }

  /**
   * Registra el pago de una suscripción: crea un gasto asociado (pagado),
   * y recién ENTONCES avanza la próxima fecha de cobro según la
   * frecuencia. No se generan gastos futuros automáticamente: esto solo
   * ocurre cuando el usuario confirma el pago manualmente.
   *
   * Protección contra duplicados: (a) un lock en memoria (`pendingSubscriptionPayments`)
   * evita que un doble click dispare dos registros en paralelo antes de que
   * el primero termine de guardarse, y (b) igualmente se verifica que no
   * exista ya un gasto para esta suscripción con la misma fecha de cobro.
   */
  async function registerSubscriptionPayment(id) {
    if (pendingSubscriptionPayments.has(id)) return;
    pendingSubscriptionPayments.add(id);
    try {
      const s = subscriptionById(id);
      if (!s) return;
      if (s.status === 'cancelled') {
        Utils.toast('No se puede registrar un pago de una suscripción cancelada.', 'error');
        return;
      }
      const already = state.expenses.some((e) => e.subscriptionId === s.id && e.date === s.nextBillingDate);
      if (already) {
        Utils.toast('Ya se registró un pago para esta fecha de cobro.', 'error');
        return;
      }
      const recurringType = state.expenseTypes.find((t) => /recurrente/i.test(t.name));
      const now = Utils.nowISO();
      const expense = {
        id: Utils.uuid(),
        date: s.nextBillingDate,
        description: `Pago de suscripción: ${s.name}`,
        categoryId: s.categoryId || '',
        recipient: s.name,
        amount: s.amount,
        currencyId: s.currencyId,
        expenseTypeId: recurringType ? recurringType.id : '',
        status: 'paid',
        paymentMethodId: s.paymentMethodId || '',
        projectVideoId: s.projectVideoId || null,
        projectSeriesId: s.projectSeriesId || null,
        notes: '',
        receiptUrl: '',
        subscriptionId: s.id,
        isSample: false,
        createdAt: now,
        updatedAt: now,
      };
      state.expenses.push(expense);
      try {
        await DB.put('expenses', expense);
      } catch (ex) {
        state.expenses = state.expenses.filter((x) => x.id !== expense.id);
        Utils.toast('No se pudo registrar el pago: ' + (ex.message || 'error desconocido'), 'error');
        renderMain();
        return;
      }
      s.nextBillingDate = Utils.computeNextBillingDate(s.nextBillingDate, s.frequency, s.customFrequencyValue, s.customFrequencyUnit);
      s.updatedAt = Utils.nowISO();
      await DB.put('subscriptions', s);
      Utils.toast('Pago registrado', 'success');
      renderMain();
    } finally {
      pendingSubscriptionPayments.delete(id);
    }
  }

  /* ---- Configuración de Costos: categorías / tipos / medios / monedas / proveedores ---- */

  const COST_ENTITY_STORE = {
    expenseCategories: 'expenseCategories',
    expenseTypes: 'expenseTypes',
    paymentMethods: 'paymentMethods',
    currencies: 'currencies',
    recipients: 'recipients',
  };

  const COST_ENTITY_LABEL = {
    expenseCategories: 'la categoría',
    expenseTypes: 'el tipo de gasto',
    paymentMethods: 'el medio de pago',
    currencies: 'la moneda',
    recipients: 'el proveedor',
  };

  const COST_ENTITY_FIELD = {
    expenseCategories: 'categoryId',
    expenseTypes: 'expenseTypeId',
    paymentMethods: 'paymentMethodId',
    currencies: 'currencyId',
  };

  function newCostEntityDefaults(type, order) {
    const now = Utils.nowISO();
    const base = { id: Utils.uuid(), order, createdAt: now, updatedAt: now };
    switch (type) {
      case 'expenseCategories':
        return { ...base, name: 'Nueva categoría', icon: '📦', active: true };
      case 'expenseTypes':
        return { ...base, name: 'Nuevo tipo', active: true };
      case 'paymentMethods':
        return { ...base, name: 'Nuevo medio de pago', active: true };
      case 'currencies':
        return { ...base, code: 'XXX', name: 'Nueva moneda', symbol: '', decimalPlaces: 2, active: true };
      case 'recipients':
        return { id: Utils.uuid(), name: 'Nuevo proveedor', notes: '', active: true, createdAt: now, updatedAt: now };
      default:
        return base;
    }
  }

  async function addCostEntity(type) {
    const arr = state[type];
    if (!arr) return;
    const maxOrder = arr.reduce((m, e) => Math.max(m, e.order || 0), -1);
    const entity = newCostEntityDefaults(type, maxOrder + 1);
    arr.push(entity);
    await DB.put(COST_ENTITY_STORE[type], entity);
    Utils.toast('Elemento creado', 'success');
    renderMain();
  }

  async function updateCostEntityField(type, id, field, rawValue, el) {
    const arr = state[type];
    const entity = arr && arr.find((e) => e.id === id);
    if (!entity) return;
    let value = rawValue;
    if (el && el.type === 'checkbox') value = el.checked;
    else if (el && el.type === 'number') value = Number(rawValue) || 0;
    entity[field] = value;
    entity.updatedAt = Utils.nowISO();
    await DB.put(COST_ENTITY_STORE[type], entity);
  }

  const saveCostEntityDebounced = Utils.debounce((type, id) => {
    const arr = state[type];
    const entity = arr && arr.find((e) => e.id === id);
    if (entity) DB.put(COST_ENTITY_STORE[type], entity);
  }, 500);

  function updateCostEntityFieldDebounced(type, id, field, value) {
    const arr = state[type];
    const entity = arr && arr.find((e) => e.id === id);
    if (!entity) return;
    entity[field] = value;
    entity.updatedAt = Utils.nowISO();
    saveCostEntityDebounced(type, id);
  }

  function costEntityUsageCount(type, id) {
    if (type === 'expenseCategories') return state.expenses.filter((e) => e.categoryId === id).length + state.subscriptions.filter((s) => s.categoryId === id).length;
    if (type === 'expenseTypes') return state.expenses.filter((e) => e.expenseTypeId === id).length;
    if (type === 'paymentMethods') return state.expenses.filter((e) => e.paymentMethodId === id).length + state.subscriptions.filter((s) => s.paymentMethodId === id).length;
    if (type === 'currencies') return state.expenses.filter((e) => e.currencyId === id).length + state.subscriptions.filter((s) => s.currencyId === id).length;
    return 0;
  }

  async function deleteCostEntity(type, id) {
    const arr = state[type];
    const entity = arr && arr.find((e) => e.id === id);
    if (!entity) return;

    if (type === 'recipients') {
      // Los proveedores frecuentes son solo una sugerencia para el campo de
      // texto libre "Proveedor/persona" de un gasto: no bloquean nada.
      const ok = await Utils.confirmDialog({ title: 'Eliminar proveedor', message: `¿Eliminar "${entity.name}" de la lista de proveedores frecuentes?`, danger: true, confirmText: 'Eliminar' });
      if (!ok) return;
      state.recipients = state.recipients.filter((r) => r.id !== id);
      await DB.remove('recipients', id);
      Utils.toast('Proveedor eliminado', 'success');
      renderMain();
      return;
    }

    const count = costEntityUsageCount(type, id);
    if (count === 0) {
      const ok = await Utils.confirmDialog({ title: `Eliminar ${COST_ENTITY_LABEL[type]}`, message: `¿Eliminar "${entity.name || entity.code}"? Esta acción no se puede deshacer.`, danger: true, confirmText: 'Eliminar' });
      if (!ok) return;
      state[type] = state[type].filter((e) => e.id !== id);
      await DB.remove(COST_ENTITY_STORE[type], id);
      Utils.toast('Elemento eliminado', 'success');
      renderMain();
      return;
    }

    // No se puede eliminar a ciegas: hay que reasignar sus gastos/suscripciones
    // a otro elemento o desactivarlo en su lugar (regla de negocio explícita).
    openCostReassignModal(type, entity, count);
  }

  function openCostReassignModal(type, entity, count) {
    const others = state[type].filter((e) => e.id !== entity.id);
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderCostReassignModalBody(buildBaseCtx(), type, entity, count, others);
    dialog.showModal();
  }

  async function costReassignAndDelete(type, id) {
    const targetId = document.getElementById('cost-reassign-target')?.value;
    if (!targetId) {
      Utils.toast('Elegí un destino para reasignar', 'error');
      return;
    }
    const field = COST_ENTITY_FIELD[type];
    for (const e of state.expenses.filter((x) => x[field] === id)) {
      e[field] = targetId;
      e.updatedAt = Utils.nowISO();
      await DB.put('expenses', e);
    }
    for (const s of state.subscriptions.filter((x) => x[field] === id)) {
      s[field] = targetId;
      s.updatedAt = Utils.nowISO();
      await DB.put('subscriptions', s);
    }
    state[type] = state[type].filter((e) => e.id !== id);
    await DB.remove(COST_ENTITY_STORE[type], id);
    document.getElementById('generic-modal').close();
    Utils.toast('Elemento reasignado y eliminado', 'success');
    renderMain();
  }

  async function costDeactivateInstead(type, id) {
    const entity = state[type] && state[type].find((e) => e.id === id);
    if (!entity) return;
    entity.active = false;
    entity.updatedAt = Utils.nowISO();
    await DB.put(COST_ENTITY_STORE[type], entity);
    document.getElementById('generic-modal').close();
    Utils.toast('Elemento desactivado', 'success');
    renderMain();
  }

  /** "Ver todos los costos" desde la ficha de un video: navega a Costos → Gastos filtrado por ese video. */
  function viewProjectCosts(videoId) {
    closeVideoEditor();
    state.ui.route = 'costs';
    state.ui.costsTab = 'expenses';
    state.ui.showCostFilters = true;
    state.ui.costExpenseFilters = { projectVideoId: videoId };
    state.ui.costExpenseSearch = '';
    renderAll();
  }

  /* ------------------------------------------------------------------ */
  /* Panel de edición de video                                           */
  /* ------------------------------------------------------------------ */

  function currentVideo() {
    return state.videos.find((v) => v.id === state.ui.editingVideoId) || null;
  }

  function renderEditorOverlay() {
    // Un único contenedor (#editor-root) se reutiliza tanto para la ficha
    // de video como para el panel de detalles de un recurso de Biblioteca:
    // son mutuamente excluyentes (nunca están abiertos los dos a la vez).
    const root = document.getElementById('editor-root');
    const video = currentVideo();
    if (video) {
      const ctx = { ...buildBaseCtx(), editorTab: state.ui.editorTab };
      root.innerHTML = Components.renderVideoEditor(video, ctx);
      return;
    }
    const item = currentLibraryDetailItem();
    if (item) {
      root.innerHTML = Components.renderLibraryDetailPanel(item, buildBaseCtx());
      return;
    }
    root.innerHTML = '';
  }

  function renderEditorBody() {
    const video = currentVideo();
    if (!video) return;
    const body = document.getElementById('editor-body');
    if (body) body.innerHTML = Components.renderEditorTab(state.ui.editorTab, video, buildBaseCtx());
  }

  function openVideoEditor(id, tab) {
    state.ui.library.detailItemId = null;
    state.ui.editingVideoId = id;
    state.ui.editorTab = tab || 'general';
    renderEditorOverlay();
    setTimeout(() => {
      const titleInput = document.getElementById('editor-title');
      if (titleInput && !currentVideo().title) titleInput.focus();
    }, 30);
  }

  function closeVideoEditor() {
    if (state.ui.editingVideoId) {
      saveVideoNow(state.ui.editingVideoId);
    }
    state.ui.editingVideoId = null;
    document.getElementById('editor-root').innerHTML = '';
    renderMain();
    renderSidebarAndTopbar();
  }

  /* ------------------------------------------------------------------ */
  /* Guardado (autosave con indicador)                                   */
  /* ------------------------------------------------------------------ */

  function markSaving() {
    state.ui.saveState = 'saving';
    updateSaveIndicator();
  }

  function markSaved() {
    state.ui.saveState = 'saved';
    updateSaveIndicator();
  }

  function updateSaveIndicator() {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    el.dataset.state = state.ui.saveState;
    el.querySelector('.save-indicator__text').textContent = state.ui.saveState === 'saving' ? 'Guardando…' : 'Guardado';
  }

  async function saveVideoNow(id) {
    const video = state.videos.find((v) => v.id === id);
    if (!video) return;
    markSaving();
    video.updatedAt = Utils.nowISO();
    await DB.put('videos', video);
    markSaved();
  }

  const saveVideoDebounced = Utils.debounce((id) => saveVideoNow(id), 500);

  function touchAndSaveDebounced(video) {
    video.updatedAt = Utils.nowISO();
    saveVideoDebounced(video.id);
  }

  function touchAndSaveNow(video) {
    saveVideoNow(video.id);
  }

  async function sendAssignmentEmail(video, employee) {
    if (!employee || !employee.email) {
      Utils.toast('El responsable no tiene un email cargado en Equipo', 'info');
      return;
    }

    if (state.authUser?.guest) {
      Utils.toast('Los emails no se envían en modo invitado', 'info');
      return;
    }

    try {
      const { data, error } = await Supa.client.auth.getSession();
      if (error || !data?.session?.access_token) {
        throw new Error('No se pudo validar la sesión de Supabase.');
      }

      const currentState = Components.byId(state.states, video.stateId);
      const response = await fetch('/api/send-assignment-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          to: employee.email,
          employeeName: employee.name || 'Integrante del equipo',
          videoTitle: video.title || 'Video sin título',
          statusName: currentState?.name || 'Sin estado',
          targetDate: video.targetDate || null,
          assignedBy: state.currentEmployee?.name || state.authUser?.email || 'Fútbol XL Studio',
          appUrl: window.location.origin,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudo enviar el correo.');

      Utils.toast(`Email enviado a ${employee.name || employee.email}`, 'success');
    } catch (error) {
      console.error('[Fútbol XL Studio] Error al enviar email de asignación:', error);
      Utils.toast(`La asignación se guardó, pero el email no pudo enviarse: ${error.message}`, 'error');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Utilidades de historial                                             */
  /* ------------------------------------------------------------------ */

  function pushHistory(video, type, message) {
    video.history = video.history || [];
    video.history.push(DB.makeHistoryEntry(type, message));
  }

  /* ------------------------------------------------------------------ */
  /* Creación / edición / borrado de videos                              */
  /* ------------------------------------------------------------------ */

  function blankVideo(stateId) {
    const now = Utils.nowISO();
    const initialState = stateId || (state.states.find((s) => s.isInitial) || state.states[0] || {}).id;
    const defaultPriority = (state.priorities.find((p) => /media/i.test(p.name)) || state.priorities[0] || {}).id;
    return {
      id: Utils.uuid(),
      title: '',
      altTitle: '',
      description: '',
      stateId: initialState || null,
      seriesId: null,
      formatId: null,
      contentTypeId: null,
      priorityId: defaultPriority || null,
      targetDate: null,
      publishDate: null,
      estimatedDuration: '',
      finalDuration: '',
      owner: '',
      ownerId: null,
      favorite: false,
      archived: false,
      tagIds: [],
      driveLinks: {
        mainFolder: { url: '', label: 'Carpeta principal' },
        script: { url: '', label: 'Guion' },
        premiere: { url: '', label: 'Premiere' },
        raw: { url: '', label: 'Brutos' },
        inserts: { url: '', label: 'Inserts' },
        thumbnail: { url: '', label: 'Miniatura' },
        finalExport: { url: '', label: 'Exportación final' },
        published: { url: '', label: 'Video publicado' },
      },
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
      history: [DB.makeHistoryEntry('created', 'Video creado')],
      createdAt: now,
      updatedAt: now,
      isSample: false,
    };
  }

  async function createNewVideo(stateId) {
    const video = blankVideo(stateId);
    state.videos.unshift(video);
    await DB.put('videos', video);
    Utils.toast('Video creado', 'success');
    renderMain();
    openVideoEditor(video.id, 'general');
  }

  async function duplicateVideo(id) {
    const original = state.videos.find((v) => v.id === id);
    if (!original) return;
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = Utils.uuid();
    copy.title = (original.title || 'Sin título') + ' (copia)';
    copy.favorite = false;
    copy.createdAt = Utils.nowISO();
    copy.updatedAt = Utils.nowISO();
    copy.history = [DB.makeHistoryEntry('duplicated', `Duplicado a partir de "${original.title || 'Sin título'}"`)];
    state.videos.unshift(copy);
    await DB.put('videos', copy);
    Utils.toast('Video duplicado', 'success');
    renderMain();
  }

  async function toggleFavorite(id) {
    const v = state.videos.find((x) => x.id === id);
    if (!v) return;
    v.favorite = !v.favorite;
    await touchAndSaveNow(v);
    if (state.ui.editingVideoId === id) renderEditorOverlay();
    else renderMain();
  }

  async function archiveVideo(id) {
    const v = state.videos.find((x) => x.id === id);
    if (!v) return;
    const wasArchived = v.archived;
    if (state.settings.confirmBeforeDelete && !wasArchived) {
      const ok = await Utils.confirmDialog({ title: 'Archivar video', message: `¿Archivar "${v.title || 'Sin título'}"? Podés recuperarlo luego desde los filtros.`, confirmText: 'Archivar' });
      if (!ok) return;
    }
    state.undo.push({ type: 'archive-video', id, prevArchived: wasArchived });
    v.archived = !wasArchived;
    pushHistory(v, 'archived', v.archived ? 'Video archivado' : 'Video desarchivado');
    await touchAndSaveNow(v);
    Utils.toast(v.archived ? 'Video archivado' : 'Video desarchivado', 'success');
    if (state.ui.editingVideoId === id) renderEditorOverlay();
    renderMain();
  }

  async function deleteVideo(id) {
    const v = state.videos.find((x) => x.id === id);
    if (!v) return;
    if (state.settings.confirmBeforeDelete) {
      const ok = await Utils.confirmDialog({ title: 'Eliminar video', message: `¿Eliminar "${v.title || 'Sin título'}"? Esta acción se puede deshacer con Ctrl/Cmd+Z inmediatamente después.`, confirmText: 'Eliminar', danger: true });
      if (!ok) return;
    }
    state.undo.push({ type: 'delete-video', video: JSON.parse(JSON.stringify(v)) });
    state.videos = state.videos.filter((x) => x.id !== id);
    await DB.remove('videos', id);
    Utils.toast('Video eliminado', 'success');
    if (state.ui.editingVideoId === id) {
      state.ui.editingVideoId = null;
      document.getElementById('editor-root').innerHTML = '';
    }
    renderMain();
  }

  /* ------------------------------------------------------------------ */
  /* Deshacer (Ctrl/Cmd+Z) — acciones simples                            */
  /* ------------------------------------------------------------------ */

  async function undoLastAction() {
    const action = state.undo.pop();
    if (!action) {
      Utils.toast('No hay nada para deshacer', 'info');
      return;
    }
    if (action.type === 'delete-video') {
      state.videos.unshift(action.video);
      await DB.put('videos', action.video);
      Utils.toast('Se restauró el video eliminado', 'success');
    } else if (action.type === 'archive-video') {
      const v = state.videos.find((x) => x.id === action.id);
      if (v) {
        v.archived = action.prevArchived;
        await DB.put('videos', v);
        Utils.toast('Acción deshecha', 'success');
      }
    } else if (action.type === 'bulk-delete') {
      action.videos.forEach((v) => state.videos.unshift(v));
      await DB.bulkPut('videos', action.videos);
      Utils.toast('Se restauraron los videos eliminados', 'success');
    } else if (action.type === 'bulk-archive') {
      action.items.forEach(({ id, prevArchived }) => {
        const v = state.videos.find((x) => x.id === id);
        if (v) v.archived = prevArchived;
      });
      await DB.bulkPut('videos', action.items.map(({ id }) => state.videos.find((x) => x.id === id)).filter(Boolean));
      Utils.toast('Acción deshecha', 'success');
    }
    renderMain();
  }

  /* ------------------------------------------------------------------ */
  /* Actualización de campos del video (formulario general)              */
  /* ------------------------------------------------------------------ */

  function coerceValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') return el.value === '' ? '' : Number(el.value);
    return el.value;
  }

  async function handleGeneralFieldChange(video, field, el) {
    const value = coerceValue(el);
    const prev = video[field];
    if (prev === value) return;

    if (field === 'stateId') {
      const oldState = Components.byId(state.states, prev);
      const newState = Components.byId(state.states, value);
      video.stateId = value || null;
      pushHistory(video, 'state-change', `Estado cambiado de "${oldState ? oldState.name : 'Sin estado'}" a "${newState ? newState.name : 'Sin estado'}"`);
    } else if (field === 'seriesId') {
      video.seriesId = value || null;
      const newSeries = Components.byId(state.series, value);
      pushHistory(video, 'series-change', `Serie cambiada a "${newSeries ? newSeries.name : 'Sin serie'}"`);
      if (newSeries && newSeries.defaultChecklistTemplateId) {
        await maybeApplyTemplate(video, newSeries.defaultChecklistTemplateId, `la serie "${newSeries.name}"`);
      }
    } else if (field === 'formatId') {
      video.formatId = value || null;
      const newFormat = Components.byId(state.formats, value);
      pushHistory(video, 'format-change', `Formato cambiado a "${newFormat ? newFormat.name : 'Sin formato'}"`);
      if (newFormat && newFormat.defaultChecklistTemplateId) {
        await maybeApplyTemplate(video, newFormat.defaultChecklistTemplateId, `el formato "${newFormat.name}"`);
      }
    } else if (field === 'ownerId') {
      video.ownerId = value || null;
      const employee = state.employees.find((item) => item.id === value);
      video.owner = employee ? employee.name : '';
      pushHistory(video, 'owner-change', `Responsable cambiado a "${employee ? employee.name : 'Sin responsable'}"`);
      if (employee && employee.email && prev !== value) {
        setTimeout(() => sendAssignmentEmail(video, employee), 0);
      }
    } else if (field === 'targetDate' || field === 'publishDate') {
      video[field] = value || null;
      pushHistory(video, 'date-change', `${field === 'targetDate' ? 'Fecha objetivo' : 'Fecha de publicación'} actualizada a ${value || 'sin definir'}`);
    } else {
      video[field] = value;
    }
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  async function maybeApplyTemplate(video, templateId, sourceLabel) {
    const template = state.templates.find((t) => t.id === templateId);
    if (!template) return;
    if (video.checklist && video.checklist.length) {
      const ok = await Utils.confirmDialog({
        title: 'Aplicar checklist predeterminado',
        message: `¿Querés aplicar el checklist predeterminado de ${sourceLabel} ("${template.name}")? Esto reemplazará el checklist actual del video.`,
        confirmText: 'Aplicar',
      });
      if (!ok) return;
    }
    applyTemplateToVideo(video, template);
  }

  function cloneTemplateItems(items) {
    return (items || []).map((it) => ({
      id: Utils.uuid(),
      text: it.text,
      done: false,
      subtasks: (it.subtasks || []).map((s) => ({ id: Utils.uuid(), text: s.text, done: false })),
    }));
  }

  function applyTemplateToVideo(video, template) {
    video.checklist = cloneTemplateItems(template.items);
    pushHistory(video, 'checklist-template', `Checklist aplicado desde la plantilla "${template.name}"`);
  }

  /* ------------------------------------------------------------------ */
  /* Enlaces de Drive                                                    */
  /* ------------------------------------------------------------------ */

  function updateDriveLinkModel(video, key, url) {
    video.driveLinks = video.driveLinks || {};
    if (!video.driveLinks[key]) video.driveLinks[key] = { url: '', label: key };
    video.driveLinks[key].url = url;
  }

  function commitDriveLinkChange(video, key) {
    pushHistory(video, 'link-change', `Enlace actualizado: ${video.driveLinks[key].label}`);
    touchAndSaveNow(video);
    renderEditorBody();
  }

  async function addAdditionalLink(video) {
    video.additionalLinks = video.additionalLinks || [];
    video.additionalLinks.push({ id: Utils.uuid(), label: '', url: '' });
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  async function removeAdditionalLink(video, id) {
    video.additionalLinks = (video.additionalLinks || []).filter((l) => l.id !== id);
    pushHistory(video, 'link-change', 'Enlace adicional eliminado');
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  /* ------------------------------------------------------------------ */
  /* Checklist                                                           */
  /* ------------------------------------------------------------------ */

  function findChecklistItem(video, itemId) {
    for (const item of video.checklist || []) {
      if (item.id === itemId) return item;
      const sub = (item.subtasks || []).find((s) => s.id === itemId);
      if (sub) return sub;
    }
    return null;
  }

  async function addChecklistItem(video) {
    video.checklist = video.checklist || [];
    video.checklist.push({ id: Utils.uuid(), text: 'Nueva tarea', done: false, subtasks: [] });
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  async function addSubtask(video, parentId) {
    const parent = (video.checklist || []).find((i) => i.id === parentId);
    if (!parent) return;
    parent.subtasks = parent.subtasks || [];
    parent.subtasks.push({ id: Utils.uuid(), text: 'Nueva subtarea', done: false });
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  async function toggleChecklistItem(video, itemId) {
    const item = findChecklistItem(video, itemId);
    if (!item) return;
    item.done = !item.done;
    const total = Components.checklistProgress(video.checklist);
    if (total.total > 0 && total.done === total.total) {
      pushHistory(video, 'checklist-complete', 'Checklist completado al 100%');
    }
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  async function removeChecklistItem(video, itemId) {
    video.checklist = (video.checklist || []).filter((i) => i.id !== itemId);
    video.checklist.forEach((i) => {
      i.subtasks = (i.subtasks || []).filter((s) => s.id !== itemId);
    });
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  /**
   * Reordena una tarea (o subtarea) del checklist moviéndola una posición
   * hacia arriba o abajo dentro de su misma lista (tareas de primer nivel
   * o subtareas de un mismo padre).
   */
  async function moveChecklistItem(video, itemId, parentId, dir) {
    const list = parentId ? (video.checklist.find((i) => i.id === parentId) || {}).subtasks : video.checklist;
    if (!list) return;
    const idx = list.findIndex((i) => i.id === itemId);
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[swapWith];
    list[swapWith] = tmp;
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  async function applySelectedTemplate(video, templateId) {
    if (!templateId) return;
    const template = state.templates.find((t) => t.id === templateId);
    if (!template) return;
    await maybeApplyTemplate(video, templateId, `la plantilla`);
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  /* ------------------------------------------------------------------ */
  /* Etiquetas del video                                                 */
  /* ------------------------------------------------------------------ */

  async function toggleVideoTag(video, tagId) {
    video.tagIds = video.tagIds || [];
    if (video.tagIds.includes(tagId)) {
      video.tagIds = video.tagIds.filter((t) => t !== tagId);
    } else {
      video.tagIds.push(tagId);
    }
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  async function quickAddTag(video, name) {
    const clean = (name || '').trim();
    if (!clean) return;
    const existing = state.tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    let tag = existing;
    if (!tag) {
      tag = { id: Utils.uuid(), name: clean, color: randomTagColor() };
      state.tags.push(tag);
      await DB.put('tags', tag);
    }
    if (!video.tagIds.includes(tag.id)) video.tagIds.push(tag.id);
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  function randomTagColor() {
    const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#c084fc', '#38bdf8', '#f87171', '#a3e635'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  /* ------------------------------------------------------------------ */
  /* Archivos e imágenes                                                 */
  /* ------------------------------------------------------------------ */

  async function checkFileSize(file) {
    const limitBytes = (state.settings.fileSizeLimitMB || 2) * 1024 * 1024;
    if (file.size > limitBytes) {
      const ok = await Utils.confirmDialog({
        title: 'Archivo pesado',
        message: `Este archivo pesa ${Utils.formatBytes(file.size)}, por encima del límite recomendado de ${state.settings.fileSizeLimitMB} MB. Se recomienda guardar solo un enlace de Drive en su lugar. ¿Querés guardarlo de todos modos en este navegador?`,
        confirmText: 'Guardar igual',
      });
      return ok;
    }
    return true;
  }

  async function handleThumbnailUpload(video, file) {
    if (!file) return;
    const proceed = await checkFileSize(file);
    if (!proceed) return;
    const dataUrl = await Utils.readFileAsDataURL(file);
    video.thumbnail = dataUrl;
    pushHistory(video, 'thumbnail', 'Miniatura actualizada');
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  async function removeThumbnail(video) {
    video.thumbnail = null;
    await touchAndSaveNow(video);
    renderEditorBody();
    renderMain();
  }

  async function handleImageUpload(video, files) {
    for (const file of Array.from(files || [])) {
      const proceed = await checkFileSize(file);
      if (!proceed) continue;
      const dataUrl = await Utils.readFileAsDataURL(file);
      video.images = video.images || [];
      video.images.push({ id: Utils.uuid(), name: file.name, size: file.size, dataUrl });
    }
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  async function removeImage(video, id) {
    video.images = (video.images || []).filter((i) => i.id !== id);
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  /* ------------------------------------------------------------------ */
  /* Comentarios                                                         */
  /* ------------------------------------------------------------------ */

  async function addComment(video, text) {
    const clean = (text || '').trim();
    if (!clean) return;
    video.comments = video.comments || [];
    video.comments.push({ id: Utils.uuid(), text: clean, date: Utils.nowISO() });
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  async function removeComment(video, id) {
    video.comments = (video.comments || []).filter((c) => c.id !== id);
    await touchAndSaveNow(video);
    renderEditorBody();
  }

  /* ------------------------------------------------------------------ */
  /* Kanban: drag & drop                                                 */
  /* ------------------------------------------------------------------ */

  let draggedVideoId = null;

  async function moveVideoToState(videoId, stateId) {
    const v = state.videos.find((x) => x.id === videoId);
    if (!v || v.stateId === stateId) return;
    const oldState = Components.byId(state.states, v.stateId);
    const newState = Components.byId(state.states, stateId);
    v.stateId = stateId;
    pushHistory(v, 'state-change', `Estado cambiado de "${oldState ? oldState.name : 'Sin estado'}" a "${newState ? newState.name : 'Sin estado'}" (arrastre)`);
    await touchAndSaveNow(v);
    renderMain();
  }

  /* ------------------------------------------------------------------ */
  /* Gestión genérica de entidades de catálogo                           */
  /* ------------------------------------------------------------------ */

  const ENTITY_STORE = {
    series: 'series',
    formats: 'formats',
    contentTypes: 'contentTypes',
    states: 'states',
    priorities: 'priorities',
    tags: 'tags',
    checklistTemplates: 'checklistTemplates',
    // Tipos "reordenables" del módulo Costos (comparten el mismo botón de
    // subir/bajar y el mismo caso 'move-entity' que series/formatos/etc.,
    // ya que moveEntity() es genérico: solo necesita el array en `state` y
    // el nombre del object store de IndexedDB).
    expenseCategories: 'expenseCategories',
    expenseTypes: 'expenseTypes',
    paymentMethods: 'paymentMethods',
    currencies: 'currencies',
  };

  const ENTITY_LABEL = {
    series: 'la serie',
    formats: 'el formato',
    contentTypes: 'el tipo de contenido',
    states: 'el estado',
    priorities: 'la prioridad',
    tags: 'la etiqueta',
    checklistTemplates: 'la plantilla',
  };

  const ENTITY_VIDEO_FIELD = {
    series: 'seriesId',
    formats: 'formatId',
    contentTypes: 'contentTypeId',
    states: 'stateId',
    priorities: 'priorityId',
  };

  function entityArrayKey(type) {
    // 'checklistTemplates' se guarda en state.templates
    return type === 'checklistTemplates' ? 'templates' : type;
  }

  function newEntityDefaults(type, order) {
    const base = { id: Utils.uuid(), order };
    switch (type) {
      case 'series':
        return { ...base, name: 'Nueva serie', color: '#a3a3a3', icon: '⚽', description: '', image: null, defaultChecklistTemplateId: null, defaultFormatId: null, archived: false };
      case 'formats':
        return { ...base, name: 'Nuevo formato', color: '#a3a3a3', icon: '🎬', aspectRatio: '', durationHint: '', exportNotes: '', defaultChecklistTemplateId: null, suggestedStateIds: [], archived: false };
      case 'contentTypes':
        return { ...base, name: 'Nuevo tipo', color: '#a3a3a3', icon: '🏷️', archived: false };
      case 'states':
        return { ...base, name: 'Nuevo estado', color: '#a3a3a3', icon: '📌', isInitial: false, isFinal: false, showInKanban: true, archived: false };
      case 'priorities':
        return { ...base, name: 'Nueva prioridad', color: '#a3a3a3' };
      case 'tags':
        return { id: Utils.uuid(), name: 'nueva-etiqueta', color: randomTagColor() };
      case 'checklistTemplates':
        return { id: Utils.uuid(), name: 'Nueva plantilla', items: [], linkedFormatIds: [], linkedSeriesIds: [] };
      default:
        return base;
    }
  }

  async function addEntity(type) {
    const arrKey = entityArrayKey(type);
    const maxOrder = state[arrKey].reduce((m, e) => Math.max(m, e.order || 0), -1);
    const entity = newEntityDefaults(type, maxOrder + 1);
    state[arrKey].push(entity);
    await DB.put(ENTITY_STORE[type], entity);
    Utils.toast('Elemento creado', 'success');
    renderSettingsBody();
  }

  async function updateEntityField(type, id, field, rawValue, el) {
    const arrKey = entityArrayKey(type);
    const entity = state[arrKey].find((e) => e.id === id);
    if (!entity) return;
    let value = rawValue;
    if (el && el.type === 'checkbox') value = el.checked;
    entity[field] = value;
    await DB.put(ENTITY_STORE[type], entity);
  }

  /**
   * Igual que updateEntityField pero pensada para el evento "input" sobre
   * campos de texto: actualiza el modelo en memoria al instante (para que
   * la UI quede consistente) pero posterga el guardado en IndexedDB con
   * debounce, evitando una escritura por cada tecla presionada.
   */
  const saveEntityDebounced = Utils.debounce((type, id) => {
    const arrKey = entityArrayKey(type);
    const entity = state[arrKey].find((e) => e.id === id);
    if (entity) DB.put(ENTITY_STORE[type], entity);
  }, 500);

  function updateEntityFieldDebounced(type, id, field, value) {
    const arrKey = entityArrayKey(type);
    const entity = state[arrKey].find((e) => e.id === id);
    if (!entity) return;
    entity[field] = value;
    saveEntityDebounced(type, id);
  }

  async function moveEntity(type, id, dir) {
    const arrKey = entityArrayKey(type);
    const list = state[arrKey].slice().sort((a, b) => a.order - b.order);
    const idx = list.findIndex((e) => e.id === id);
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= list.length) return;
    const a = list[idx];
    const b = list[swapWith];
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    await DB.bulkPut(ENTITY_STORE[type], [a, b]);
    renderSettingsBody();
  }

  function entityLabelName(type, id) {
    const arrKey = entityArrayKey(type);
    const entity = state[arrKey].find((e) => e.id === id);
    return entity ? entity.name : '';
  }

  async function deleteEntity(type, id) {
    const arrKey = entityArrayKey(type);
    const entity = state[arrKey].find((e) => e.id === id);
    if (!entity) return;

    if (type === 'tags') {
      const count = state.videos.filter((v) => (v.tagIds || []).includes(id)).length;
      if (count > 0) {
        const ok = await Utils.confirmDialog({ title: 'Eliminar etiqueta', message: `"${entity.name}" está siendo utilizada en ${count} video(s). Se quitará de todos ellos. ¿Continuar?`, danger: true, confirmText: 'Eliminar' });
        if (!ok) return;
        for (const v of state.videos.filter((v) => (v.tagIds || []).includes(id))) {
          v.tagIds = v.tagIds.filter((t) => t !== id);
          await DB.put('videos', v);
        }
      }
      state.tags = state.tags.filter((t) => t.id !== id);
      await DB.remove('tags', id);
      Utils.toast('Etiqueta eliminada', 'success');
      renderSettingsBody();
      return;
    }

    if (type === 'checklistTemplates') {
      const usedBy = [
        ...state.series.filter((s) => s.defaultChecklistTemplateId === id),
        ...state.formats.filter((f) => f.defaultChecklistTemplateId === id),
      ];
      if (usedBy.length) {
        const ok = await Utils.confirmDialog({ title: 'Eliminar plantilla', message: `Esta plantilla está asignada como predeterminada en ${usedBy.length} serie(s)/formato(s). Se quitará esa asignación. ¿Continuar?`, danger: true, confirmText: 'Eliminar' });
        if (!ok) return;
        for (const s of state.series.filter((s) => s.defaultChecklistTemplateId === id)) {
          s.defaultChecklistTemplateId = null;
          await DB.put('series', s);
        }
        for (const f of state.formats.filter((f) => f.defaultChecklistTemplateId === id)) {
          f.defaultChecklistTemplateId = null;
          await DB.put('formats', f);
        }
      }
      state.templates = state.templates.filter((t) => t.id !== id);
      await DB.remove('checklistTemplates', id);
      Utils.toast('Plantilla eliminada', 'success');
      renderSettingsBody();
      return;
    }

    const field = ENTITY_VIDEO_FIELD[type];
    const count = state.videos.filter((v) => v[field] === id).length;
    if (count === 0) {
      const ok = await Utils.confirmDialog({ title: `Eliminar ${ENTITY_LABEL[type]}`, message: `¿Eliminar "${entity.name}"? Esta acción no se puede deshacer.`, danger: true, confirmText: 'Eliminar' });
      if (!ok) return;
      state[arrKey] = state[arrKey].filter((e) => e.id !== id);
      await DB.remove(ENTITY_STORE[type], id);
      Utils.toast('Elemento eliminado', 'success');
      renderSettingsBody();
      return;
    }

    openReassignModal(type, entity, count, field);
  }

  function openReassignModal(type, entity, count, field) {
    const arrKey = entityArrayKey(type);
    const others = state[arrKey].filter((e) => e.id !== entity.id);
    const supportsArchive = ['series', 'formats', 'contentTypes', 'states'].includes(type);
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = `
      <div class="modal__header"><h3>Eliminar ${ENTITY_LABEL[type]}</h3></div>
      <div class="modal__body">
        <p>"${Utils.escapeHtml(entity.name)}" está siendo utilizada en <strong>${count}</strong> video(s). Elegí qué hacer antes de eliminarla:</p>
        ${others.length ? `
        <label class="field field--wide">
          <span>Mover videos a otra opción</span>
          <select id="reassign-target">
            <option value="">Elegir…</option>
            ${others.map((o) => `<option value="${o.id}">${Utils.escapeHtml(o.name)}</option>`).join('')}
          </select>
        </label>` : '<p class="muted small">No hay otra opción disponible para reasignar.</p>'}
      </div>
      <div class="modal__footer modal__footer--wrap">
        ${others.length ? `<button class="btn btn--primary" data-action="reassign-move">Mover y eliminar</button>` : ''}
        <button class="btn btn--secondary" data-action="reassign-unassign">Dejar videos sin asignar y eliminar</button>
        ${supportsArchive ? `<button class="btn btn--secondary" data-action="reassign-archive">Archivar en su lugar</button>` : ''}
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
      </div>`;
    dialog.dataset.entityType = type;
    dialog.dataset.entityId = entity.id;
    dialog.dataset.field = field;
    dialog.showModal();
  }

  async function resolveReassign(action) {
    const dialog = document.getElementById('generic-modal');
    const type = dialog.dataset.entityType;
    const id = dialog.dataset.entityId;
    const field = dialog.dataset.field;
    const arrKey = entityArrayKey(type);

    if (action === 'reassign-move') {
      const targetSel = document.getElementById('reassign-target');
      const targetId = targetSel ? targetSel.value : '';
      if (!targetId) {
        Utils.toast('Elegí una opción de destino', 'error');
        return;
      }
      for (const v of state.videos.filter((v) => v[field] === id)) {
        v[field] = targetId;
        await DB.put('videos', v);
      }
      state[arrKey] = state[arrKey].filter((e) => e.id !== id);
      await DB.remove(ENTITY_STORE[type], id);
      Utils.toast('Videos reasignados y elemento eliminado', 'success');
    } else if (action === 'reassign-unassign') {
      for (const v of state.videos.filter((v) => v[field] === id)) {
        v[field] = null;
        await DB.put('videos', v);
      }
      state[arrKey] = state[arrKey].filter((e) => e.id !== id);
      await DB.remove(ENTITY_STORE[type], id);
      Utils.toast('Videos actualizados y elemento eliminado', 'success');
    } else if (action === 'reassign-archive') {
      const entity = state[arrKey].find((e) => e.id === id);
      if (entity) {
        entity.archived = true;
        await DB.put(ENTITY_STORE[type], entity);
      }
      Utils.toast('Elemento archivado', 'success');
    }
    dialog.close();
    renderSettingsBody();
  }

  /* ---- Fusión de etiquetas ---- */

  async function mergeSelectedTags() {
    const ids = state.ui.tagMergeSelection;
    if (ids.length < 2) {
      Utils.toast('Seleccioná al menos dos etiquetas para fusionar', 'error');
      return;
    }
    const [keepId, ...rest] = ids;
    const keep = state.tags.find((t) => t.id === keepId);
    const ok = await Utils.confirmDialog({ title: 'Fusionar etiquetas', message: `Se fusionarán ${ids.length} etiquetas en "${keep.name}". Esta acción no se puede deshacer.`, confirmText: 'Fusionar', danger: true });
    if (!ok) return;
    for (const v of state.videos) {
      if (rest.some((r) => (v.tagIds || []).includes(r))) {
        const set = new Set(v.tagIds || []);
        rest.forEach((r) => set.delete(r));
        set.add(keepId);
        v.tagIds = Array.from(set);
        await DB.put('videos', v);
      }
    }
    for (const r of rest) {
      state.tags = state.tags.filter((t) => t.id !== r);
      await DB.remove('tags', r);
    }
    state.ui.tagMergeSelection = [];
    Utils.toast('Etiquetas fusionadas', 'success');
    renderSettingsBody();
  }

  /* ---- Plantillas de checklist ---- */

  async function duplicateTemplate(id) {
    const t = state.templates.find((x) => x.id === id);
    if (!t) return;
    const copy = JSON.parse(JSON.stringify(t));
    copy.id = Utils.uuid();
    copy.name = t.name + ' (copia)';
    copy.items = cloneTemplateItems(t.items);
    state.templates.push(copy);
    await DB.put('checklistTemplates', copy);
    Utils.toast('Plantilla duplicada', 'success');
    renderSettingsBody();
  }

  async function addTemplateItem(templateId) {
    const t = state.templates.find((x) => x.id === templateId);
    if (!t) return;
    t.items = t.items || [];
    t.items.push({ id: Utils.uuid(), text: 'Nueva tarea', done: false, subtasks: [] });
    await DB.put('checklistTemplates', t);
    renderSettingsBody();
  }

  async function removeTemplateItem(templateId, itemId) {
    const t = state.templates.find((x) => x.id === templateId);
    if (!t) return;
    t.items = (t.items || []).filter((i) => i.id !== itemId);
    await DB.put('checklistTemplates', t);
    renderSettingsBody();
  }

  async function toggleTemplateAssoc(templateId, field, id) {
    const t = state.templates.find((x) => x.id === templateId);
    if (!t) return;
    t[field] = t[field] || [];
    if (t[field].includes(id)) t[field] = t[field].filter((x) => x !== id);
    else t[field].push(id);
    await DB.put('checklistTemplates', t);
    renderSettingsBody();
  }

  /* ------------------------------------------------------------------ */
  /* Ajustes / identidad / respaldo                                      */
  /* ------------------------------------------------------------------ */

  async function updateSetting(key, rawValue, el) {
    let value = rawValue;
    if (el) {
      if (el.type === 'checkbox') value = el.checked;
      else if (el.type === 'number') value = Number(el.value);
    }
    state.settings = await DB.saveSettings({ [key]: value });
    applyTheme();
    renderAll();
  }

  async function resetAppName() {
    state.settings = await DB.saveSettings({ appName: 'Fútbol XL Studio' });
    renderAll();
  }

  async function handleLogoUpload(file) {
    if (!file) return;
    const dataUrl = await Utils.readFileAsDataURL(file);
    await DB.setLogo(dataUrl);
    state.logo = dataUrl;
    Utils.toast('Logo actualizado', 'success');
    renderAll();
  }

  async function removeLogo() {
    await DB.setLogo(null);
    state.logo = null;
    Utils.toast('Logo eliminado', 'success');
    renderAll();
  }

  async function exportBackupFile() {
    const backup = await DB.exportBackup();
    const stamp = Utils.todayISO();
    Utils.downloadJSON(backup, `fxl-studio-backup-${stamp}.json`);
    Utils.toast('Respaldo exportado', 'success');
  }

  async function importBackupFile(file) {
    if (!file) return;
    let parsed;
    try {
      const text = await Utils.readFileAsText(file);
      parsed = JSON.parse(text);
    } catch (e) {
      Utils.toast('El archivo no es un JSON válido', 'error');
      return;
    }
    const err = DB.validateBackup(parsed);
    if (err) {
      Utils.toast(err, 'error');
      return;
    }
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = `
      <div class="modal__header"><h3>Importar respaldo</h3></div>
      <div class="modal__body">
        <p>¿Cómo querés aplicar este respaldo (exportado el ${Utils.formatDateTime(parsed.exportedAt)})?</p>
      </div>
      <div class="modal__footer modal__footer--wrap">
        <button class="btn btn--danger" data-action="import-replace">Reemplazar todos los datos</button>
        <button class="btn btn--secondary" data-action="import-merge">Combinar con datos existentes</button>
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
      </div>`;
    dialog._pendingBackup = parsed;
    dialog.showModal();
  }

  async function resolveImport(mode) {
    const dialog = document.getElementById('generic-modal');
    const backup = dialog._pendingBackup;
    dialog.close();
    if (!backup) return;
    try {
      await DB.importBackup(backup, mode === 'import-replace' ? 'replace' : 'merge');
      await loadAllFromDB();
      applyTheme();
      // Evita quedar "navegando" dentro de una carpeta que ya no exista
      // tras un reemplazo completo de los datos.
      state.ui.library.currentFolderId = null;
      state.ui.library.detailItemId = null;
      state.ui.library.historyBack = [];
      state.ui.library.historyForward = [];
      renderAll();
      Utils.toast('Respaldo importado correctamente', 'success');
    } catch (e) {
      Utils.toast('Error al importar: ' + e.message, 'error');
    }
  }

  async function restoreSampleData() {
    try {
      const added = await DB.reseedSampleVideos();
      state.videos.push(...added);
      Utils.toast(`${added.length} videos de ejemplo restaurados`, 'success');
      renderMain();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }

  async function removeSampleData() {
    const ok = await Utils.confirmDialog({ title: 'Eliminar datos de ejemplo', message: '¿Eliminar todos los videos y las carpetas/recursos de Biblioteca marcados como ejemplo?', danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    const removed = await DB.removeSampleData();
    state.videos = state.videos.filter((v) => !v.isSample);
    state.libraryFolders = state.libraryFolders.filter((f) => !f.isSample);
    state.libraryItems = state.libraryItems.filter((it) => !it.isSample);
    if (state.ui.library.detailItemId && !libItem(state.ui.library.detailItemId)) {
      state.ui.library.detailItemId = null;
    }
    Utils.toast(`${removed} elemento(s) de ejemplo eliminados`, 'success');
    renderAll();
  }

  async function wipeAllData() {
    const ok = await Utils.confirmDialog({
      title: 'Eliminar todos los datos',
      message: 'Esta acción borra permanentemente todo lo guardado en este navegador (videos, series, formatos, estados, etiquetas, plantillas y configuración) y reinicia la app con los valores de fábrica. ¿Continuar?',
      danger: true,
      confirmText: 'Eliminar todo',
    });
    if (!ok) return;
    await DB.wipeAll();
    await DB.seedIfEmpty();
    await DB.seedLibraryIfEmpty();
    await loadAllFromDB();
    applyTheme();
    state.ui.route = 'home';
    state.ui.library.currentFolderId = null;
    state.ui.library.detailItemId = null;
    state.ui.library.historyBack = [];
    state.ui.library.historyForward = [];
    renderAll();
    Utils.toast('Todos los datos fueron eliminados y la app se reinició con valores de fábrica', 'success');
  }

  async function refreshUsage() {
    state.ui.usage = await DB.estimateUsage();
  }

  /* ------------------------------------------------------------------ */
  /* Equipo                                                              */
  /* ------------------------------------------------------------------ */

  function openEmployeeModal(employeeId) {
    const employee = employeeId ? state.employees.find((x) => x.id === employeeId) : null;
    const dialog = document.getElementById('generic-modal');
    dialog.innerHTML = Components.renderEmployeeModal(employee || {});
    dialog.showModal();
  }

  async function saveEmployee(employeeId) {
    const name = document.getElementById('employee-name')?.value.trim();
    if (!name) {
      Utils.toast('Ingresá el nombre del empleado', 'error');
      return;
    }
    const existing = employeeId ? state.employees.find((x) => x.id === employeeId) : null;
    const employee = {
      ...(existing || {}),
      id: existing?.id || Utils.uuid(),
      name,
      role: document.getElementById('employee-role')?.value.trim() || '',
      email: document.getElementById('employee-email')?.value.trim() || '',
      phone: document.getElementById('employee-phone')?.value.trim() || '',
      active: document.getElementById('employee-active')?.checked ?? true,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    await DB.put('employees', employee);
    if (existing) Object.assign(existing, employee);
    else state.employees.push(employee);
    document.getElementById('generic-modal').close();
    renderAll();
    Utils.toast(existing ? 'Empleado actualizado' : 'Empleado creado', 'success');
  }

  async function deleteEmployee(employeeId) {
    const employee = state.employees.find((x) => x.id === employeeId);
    if (!employee) return;
    const assigned = state.videos.filter((v) => v.ownerId === employeeId).length;
    const ok = await Utils.confirmDialog({
      title: 'Eliminar empleado',
      message: assigned
        ? `${employee.name} está asignado a ${assigned} video(s). Esos videos quedarán sin responsable. ¿Continuar?`
        : `¿Eliminar a ${employee.name} del equipo?`,
      danger: true,
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    for (const video of state.videos.filter((v) => v.ownerId === employeeId)) {
      video.ownerId = null;
      video.owner = '';
      await DB.put('videos', video);
    }
    await DB.remove('employees', employeeId);
    state.employees = state.employees.filter((x) => x.id !== employeeId);
    renderAll();
    Utils.toast('Empleado eliminado', 'success');
  }

  function moveDashboardCitasSlider(direction) {
    const slider = document.querySelector('[data-citas-slider]');
    if (!slider) return;
    const slides = Array.from(slider.querySelectorAll('[data-citas-slide]'));
    if (slides.length < 2) return;
    const current = Number(slider.dataset.index || 0);
    const next = (current + direction + slides.length) % slides.length;
    const dots=Array.from(slider.querySelectorAll('[data-citas-dot]'));
    slides[current].classList.remove('is-active');
    window.setTimeout(()=>{
      slides[current].style.display='none';
      slides[next].style.display='block';
      requestAnimationFrame(()=>slides[next].classList.add('is-active'));
      dots.forEach((d,i)=>d.classList.toggle('is-active',i===next));
      slider.dataset.index=String(next);
      const counter=slider.querySelector('[data-citas-counter]');
      if(counter) counter.textContent=`${next+1} / ${slides.length}`;
    },225);
    return;
    if (counter) counter.textContent = `${next + 1} / ${slides.length}`;
  }

  /* ------------------------------------------------------------------ */
  /* Delegación de eventos                                               */
  /* ------------------------------------------------------------------ */

  function closest(el, selector) {
    return el && el.closest ? el.closest(selector) : null;
  }

  function wireGlobalEvents() {
    document.addEventListener('click', onGlobalClick);
    document.addEventListener('input', onGlobalInput);
    document.addEventListener('change', onGlobalChange);
    document.addEventListener('keydown', onGlobalKeydown);
    document.addEventListener('dragstart', onGlobalDragStart);
    document.addEventListener('dragover', onGlobalDragOver);
    document.addEventListener('drop', onGlobalDrop);
    document.addEventListener('dragend', onGlobalDragEnd);
    // Avanza automáticamente el slider de la carpeta "citas" cada 5 segundos.
    // La función no hace nada cuando el dashboard no está visible o hay menos de 2 imágenes.
    window.setInterval(() => moveDashboardCitasSlider(1), 5000);
    window.addEventListener('dragleave', (event) => {
      if (event.clientX === 0 && event.clientY === 0) {
        document.querySelector('.view--library')?.classList.remove('library-drop-active');
      }
    });
    wireLibraryPasteHandler();
  }

  async function onGlobalClick(e) {
    // Cerrar dropdowns abiertos si el click fue afuera
    const openMenus = document.querySelectorAll('.dropdown__menu:not([hidden])');
    openMenus.forEach((m) => {
      if (!closest(e.target, '.dropdown')) m.setAttribute('hidden', '');
    });

    const actionEl = closest(e.target, '[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    switch (action) {
      case 'logout':
        await logout();
        break;
      case 'navigate':
        state.ui.route = actionEl.dataset.route;
        state.ui.mobileSidebarOpen = false;
        if (state.ui.route === 'settings' && state.ui.settingsSection === 'backup') refreshUsage().then(renderMain);
        renderAll();
        break;
      case 'toggle-sidebar':
        state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
        renderSidebarAndTopbar();
        break;
      case 'toggle-mobile-sidebar':
        state.ui.mobileSidebarOpen = !state.ui.mobileSidebarOpen;
        renderSidebarAndTopbar();
        document.querySelector('.sidebar')?.classList.toggle('sidebar--mobile-open', state.ui.mobileSidebarOpen);
        break;
      case 'open-more-menu':
        state.ui.mobileSidebarOpen = true;
        renderSidebarAndTopbar();
        document.querySelector('.sidebar')?.classList.add('sidebar--mobile-open');
        break;
      case 'quick-note-add':
        addQuickNote();
        break;
      case 'quick-note-delete':
        deleteQuickNote(id);
        break;
      case 'quick-note-edit':
        editQuickNote(id);
        break;
      case 'quick-note-to-project':
        await quickNoteToProject(id);
        break;
      case 'planner-new':
        createSeriesPlanner();
        break;
      case 'planner-select':
        state.ui.selectedSeriesPlannerId = id;
        renderMain();
        break;
      case 'planner-delete':
        deleteSeriesPlanner(id);
        break;
      case 'planner-add-season':
        addPlannerSeason();
        break;
      case 'planner-toggle-season':
        togglePlannerSeason(actionEl.dataset.seasonId);
        break;
      case 'planner-add-episode':
        addPlannerEpisode(actionEl.dataset.seasonId);
        break;
      case 'planner-delete-episode':
        deletePlannerEpisode(actionEl.dataset.seasonId, id);
        break;
      case 'planner-create-video':
        await createVideoFromPlanner(actionEl.dataset.seasonId, id);
        break;

      case 'thumbnail-lab-device':
        state.ui.thumbnailLab.device = actionEl.dataset.device || 'desktop';
        renderMain();
        break;
      case 'thumbnail-lab-clear':
        state.ui.thumbnailLab = { title: '', image: '', device: 'desktop' };
        renderMain();
        break;
      case 'dashboard-citas-prev':
        moveDashboardCitasSlider(-1);
        break;
      case 'dashboard-citas-next':
        moveDashboardCitasSlider(1);
        break;
      case 'clear-search':
        state.ui.search = '';
        renderMain();
        document.getElementById('global-search')?.focus();
        break;
      case 'new-video':
        createNewVideo();
        break;
      case 'new-video-in-state':
        createNewVideo(id);
        break;
      case 'open-video':
        openVideoEditor(id, 'general');
        break;
      case 'toggle-favorite':
        toggleFavorite(id);
        break;
      case 'duplicate-video':
        duplicateVideo(id);
        break;
      case 'archive-video':
        archiveVideo(id);
        break;
      case 'delete-video':
        deleteVideo(id);
        break;
      case 'set-videos-view':
        state.ui.videosView = actionEl.dataset.view;
        renderMain();
        break;
      case 'toggle-filters':
        state.ui.showFilters = !state.ui.showFilters;
        renderMain();
        break;
      case 'toggle-filter-tag': {
        const tags = state.ui.filters.tagIds || [];
        state.ui.filters.tagIds = tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id];
        renderMain();
        break;
      }
      case 'clear-filters':
        state.ui.filters = {};
        renderMain();
        break;
      case 'toggle-column':
      case 'collapse-column':
        toggleColumnCollapsed(id);
        break;
      case 'show-more-column':
        state.settings.cardsPerColumnLimit = 0;
        renderMain();
        break;
      case 'toggle-menu': {
        const menu = document.getElementById('menu-' + actionEl.dataset.menu);
        if (menu) menu.toggleAttribute('hidden');
        break;
      }
      case 'edit-state':
      case 'goto-states-settings':
        state.ui.route = 'settings';
        state.ui.settingsSection = 'states';
        renderAll();
        break;
      case 'select-all': {
        const visibleIds = computeVideosForList().map((v) => v.id);
        const allSelected = visibleIds.every((vid) => state.ui.selectedIds.includes(vid));
        state.ui.selectedIds = allSelected ? [] : visibleIds;
        renderMain();
        break;
      }
      case 'sort-by': {
        const key = actionEl.dataset.key;
        if (state.ui.sort.key === key) state.ui.sort.dir = state.ui.sort.dir === 'asc' ? 'desc' : 'asc';
        else state.ui.sort = { key, dir: 'asc' };
        renderMain();
        break;
      }
      case 'bulk-archive': {
        const items = state.ui.selectedIds.map((sid) => ({ id: sid, prevArchived: (state.videos.find((v) => v.id === sid) || {}).archived }));
        state.undo.push({ type: 'bulk-archive', items });
        for (const sid of state.ui.selectedIds) {
          const v = state.videos.find((x) => x.id === sid);
          if (v) {
            v.archived = true;
            await DB.put('videos', v);
          }
        }
        state.ui.selectedIds = [];
        Utils.toast('Videos archivados', 'success');
        renderMain();
        break;
      }
      case 'bulk-delete': {
        const ok = await Utils.confirmDialog({ title: 'Eliminar videos', message: `¿Eliminar ${state.ui.selectedIds.length} video(s) seleccionados?`, danger: true, confirmText: 'Eliminar' });
        if (!ok) break;
        const removedVideos = state.videos.filter((v) => state.ui.selectedIds.includes(v.id)).map((v) => JSON.parse(JSON.stringify(v)));
        state.undo.push({ type: 'bulk-delete', videos: removedVideos });
        for (const sid of state.ui.selectedIds) await DB.remove('videos', sid);
        state.videos = state.videos.filter((v) => !state.ui.selectedIds.includes(v.id));
        state.ui.selectedIds = [];
        Utils.toast('Videos eliminados', 'success');
        renderMain();
        break;
      }
      case 'clear-selection':
        state.ui.selectedIds = [];
        renderMain();
        break;
      case 'cal-prev-month':
        shiftCalendarMonth(-1);
        break;
      case 'cal-next-month':
        shiftCalendarMonth(1);
        break;
      case 'cal-today':
        state.ui.calendarMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
        renderMain();
        break;
      case 'close-editor':
        closeVideoEditor();
        break;
      case 'close-editor-overlay':
        if (e.target.classList.contains('editor-overlay')) closeVideoEditor();
        break;
      case 'editor-tab':
        state.ui.editorTab = actionEl.dataset.tab;
        renderEditorBody();
        break;
      case 'open-link': {
        const url = actionEl.dataset.url;
        if (url && Utils.looksLikeUrl(url)) window.open(url, '_blank', 'noopener');
        else if (url) Utils.toast('Enlace inválido (debe empezar con http:// o https://)', 'error');
        break;
      }
      case 'copy-link': {
        const ok = await Utils.copyToClipboard(actionEl.dataset.url);
        Utils.toast(ok ? 'Enlace copiado' : 'No se pudo copiar', ok ? 'success' : 'error');
        break;
      }
      case 'clear-drive-link': {
        const v = currentVideo();
        if (v) {
          updateDriveLinkModel(v, actionEl.dataset.key, '');
          commitDriveLinkChange(v, actionEl.dataset.key);
        }
        break;
      }
      case 'add-additional-link':
        if (currentVideo()) addAdditionalLink(currentVideo());
        break;
      case 'remove-additional-link':
        if (currentVideo()) removeAdditionalLink(currentVideo(), id);
        break;
      case 'copy-field': {
        const field = actionEl.dataset.field;
        const el = document.querySelector(`[data-field="${field}"]`);
        if (el) {
          const ok = await Utils.copyToClipboard(el.value);
          Utils.toast(ok ? 'Contenido copiado' : 'No se pudo copiar', ok ? 'success' : 'error');
        }
        break;
      }
      case 'toggle-checklist-item':
        if (currentVideo()) toggleChecklistItem(currentVideo(), id);
        break;
      case 'remove-checklist-item':
        if (currentVideo()) removeChecklistItem(currentVideo(), id);
        break;
      case 'move-checklist-item':
        if (currentVideo()) moveChecklistItem(currentVideo(), id, actionEl.dataset.parent || null, actionEl.dataset.dir);
        break;
      case 'add-subtask':
        if (currentVideo()) addSubtask(currentVideo(), id);
        break;
      case 'add-checklist-item':
        if (currentVideo()) addChecklistItem(currentVideo());
        break;
      case 'toggle-video-tag':
        if (currentVideo()) toggleVideoTag(currentVideo(), id);
        break;
      case 'quick-add-tag': {
        const v = currentVideo();
        const input = document.getElementById('quick-tag-input');
        if (v && input) {
          quickAddTag(v, input.value);
          input.value = '';
        }
        break;
      }
      case 'remove-thumbnail':
        if (currentVideo()) removeThumbnail(currentVideo());
        break;
      case 'remove-image':
        if (currentVideo()) removeImage(currentVideo(), id);
        break;
      case 'add-comment': {
        const v = currentVideo();
        const ta = document.getElementById('new-comment-text');
        if (v && ta) {
          addComment(v, ta.value);
          ta.value = '';
        }
        break;
      }
      case 'remove-comment':
        if (currentVideo()) removeComment(currentVideo(), id);
        break;
      case 'settings-section':
        state.ui.settingsSection = actionEl.dataset.section;
        if (state.ui.settingsSection === 'backup') refreshUsage().then(renderMain);
        else renderMain();
        break;
      case 'reset-app-name':
        resetAppName();
        break;
      case 'remove-logo':
        removeLogo();
        break;
      case 'move-entity':
        moveEntity(actionEl.dataset.entity, id, actionEl.dataset.dir);
        break;
      case 'delete-entity':
        deleteEntity(actionEl.dataset.entity, id);
        break;
      case 'add-entity':
        addEntity(actionEl.dataset.entity);
        break;
      case 'merge-selected-tags':
        mergeSelectedTags();
        break;
      case 'duplicate-template':
        duplicateTemplate(id);
        break;
      case 'remove-template-item':
        removeTemplateItem(actionEl.dataset.template, actionEl.dataset.item);
        break;
      case 'add-template-item':
        addTemplateItem(actionEl.dataset.template);
        break;
      case 'toggle-template-format':
        toggleTemplateAssoc(actionEl.dataset.template, 'linkedFormatIds', id);
        break;
      case 'toggle-template-series':
        toggleTemplateAssoc(actionEl.dataset.template, 'linkedSeriesIds', id);
        break;
      case 'export-backup':
        exportBackupFile();
        break;
      case 'restore-sample-data':
        restoreSampleData();
        break;
      case 'remove-sample-data':
        removeSampleData();
        break;
      case 'wipe-all-data':
        wipeAllData();
        break;
      case 'reassign-move':
      case 'reassign-unassign':
      case 'reassign-archive':
        resolveReassign(action);
        break;
      case 'import-replace':
        resolveImport('import-replace');
        break;
      case 'import-merge':
        resolveImport('import-merge');
        break;
      case 'modal-cancel': {
        const dialog = document.getElementById('generic-modal');
        if (dialog._resolveFileSize) {
          dialog._resolveFileSize('cancel');
          delete dialog._resolveFileSize;
        }
        dialog.close();
        break;
      }

      /* ---- Biblioteca: navegación ---- */
      case 'open-library-folder':
        navigateLibraryFolder(actionEl.dataset.folderId);
        break;
      case 'navigate-library-folder':
        navigateLibraryFolder(actionEl.dataset.id || null);
        break;
      case 'library-go-back':
        libraryGoBack();
        break;
      case 'library-go-forward':
        libraryGoForward();
        break;
      case 'set-library-view':
        state.ui.library.view = actionEl.dataset.view;
        renderMain();
        break;
      case 'set-library-quick-filter':
        state.ui.library.quickFilter = actionEl.dataset.key;
        state.ui.library.search = '';
        state.ui.library.selectedIds = [];
        renderMain();
        break;
      case 'toggle-library-filters':
        state.ui.library.showFilters = !state.ui.library.showFilters;
        renderMain();
        break;
      case 'toggle-library-filter-tag': {
        const list = state.ui.library.filterTagIds;
        state.ui.library.filterTagIds = list.includes(id) ? list.filter((t) => t !== id) : [...list, id];
        renderMain();
        break;
      }
      case 'clear-library-filters':
        state.ui.library.filterTagIds = [];
        renderMain();
        break;
      case 'clear-library-search':
        state.ui.library.search = '';
        renderMain();
        document.getElementById('library-search')?.focus();
        break;

      /* ---- Biblioteca: menú "Nuevo" ---- */
      case 'open-new-menu':
        state.ui.library.showNewMenu = true;
        renderMain();
        break;
      case 'close-new-menu':
        if (e.target.classList.contains('library-new-menu-overlay')) {
          state.ui.library.showNewMenu = false;
          renderMain();
        }
        break;
      case 'quick-new-folder':
      case 'quick-new-folder-btn':
        closeLibraryNewMenus();
        openNewFolderModal();
        break;
      case 'quick-upload-file':
        closeLibraryNewMenus();
        triggerLibraryFileInput();
        break;
      case 'quick-add-link':
        closeLibraryNewMenus();
        openNewLinkModal();
        break;
      case 'quick-add-drive-folder':
        closeLibraryNewMenus();
        openNewLinkModal('driveFolder');
        break;
      case 'quick-add-note':
        closeLibraryNewMenus();
        openQuickNoteModal();
        break;

      /* ---- Biblioteca: carpetas ---- */
      case 'toggle-folder-favorite':
        toggleFolderFavorite(id);
        break;
      case 'rename-folder':
        openEditFolderModal(id);
        break;
      case 'duplicate-folder':
        duplicateFolderRecursive(id);
        break;
      case 'archive-folder':
        archiveFolder(id);
        break;
      case 'delete-folder':
        deleteFolderFlow(id);
        break;
      case 'submit-new-folder':
        submitNewFolder();
        break;
      case 'submit-edit-folder':
        submitEditFolder(id);
        break;

      /* ---- Biblioteca: recursos ---- */
      case 'open-library-detail':
        state.ui.route = 'library';
        openLibraryDetail(actionEl.dataset.itemId);
        renderSidebarAndTopbar();
        break;
      case 'close-library-detail':
        closeLibraryDetail();
        break;
      case 'close-library-detail-overlay':
        if (e.target.classList.contains('editor-overlay')) closeLibraryDetail();
        break;
      case 'toggle-item-favorite':
        toggleItemFavorite(id);
        break;
      case 'toggle-item-tag': {
        const item = currentLibraryDetailItem();
        if (item) toggleItemTag(item, id);
        break;
      }
      case 'archive-item':
        archiveItem(id);
        break;
      case 'delete-item':
        deleteItemFlow(id);
        break;
      case 'duplicate-item':
        duplicateItemFlow(id);
        break;
      case 'open-item-link':
        openLibraryItem(id);
        break;
      case 'copy-item-link':
        copyLibraryItemLink(id);
        break;
      case 'download-item':
        downloadLibraryItem(id);
        break;
      case 'open-move-modal':
        openMoveModal(actionEl.dataset.kind, id);
        break;
      case 'submit-move':
        submitMove();
        break;
      case 'submit-new-link':
        submitNewLink();
        break;
      case 'submit-quick-note':
        submitQuickNote();
        break;
      case 'filesize-save-anyway': {
        const dialog = document.getElementById('generic-modal');
        dialog._resolveFileSize && dialog._resolveFileSize('save-anyway');
        delete dialog._resolveFileSize;
        dialog.close();
        break;
      }
      case 'filesize-use-link': {
        const dialog = document.getElementById('generic-modal');
        dialog._resolveFileSize && dialog._resolveFileSize('use-link');
        delete dialog._resolveFileSize;
        dialog.close();
        break;
      }
      case 'submit-paste-image':
        submitPasteImage();
        break;
      case 'open-relate-videos-modal':
        openRelateVideosModal(id);
        break;
      case 'submit-relate-videos':
        submitRelateVideos(id);
        break;
      case 'open-link-library-picker':
        openLinkLibraryPicker(id);
        break;
      case 'submit-link-picker':
        submitLinkPicker(actionEl.dataset.videoId);
        break;
      case 'create-library-item-for-video':
        createLibraryItemForVideo(id);
        break;
      case 'unlink-item-from-video':
        unlinkItemFromVideo(id, actionEl.dataset.videoId);
        break;
      case 'open-video-from-library':
        openVideoFromLibrary(id);
        break;
      case 'choice-archive':
      case 'choice-delete':
        resolveArchiveOrDeleteChoice(action, actionEl.dataset.kind, id);
        break;

      /* ---- Biblioteca: selección y acciones masivas (vista Lista) ---- */
      case 'select-all-library': {
        const visibleIds = computeLibraryVisible().visibleItems.map((it) => it.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every((iid) => state.ui.library.selectedIds.includes(iid));
        state.ui.library.selectedIds = allSelected ? [] : visibleIds;
        renderMain();
        break;
      }
      case 'library-bulk-move':
        openBulkMoveModal();
        break;
      case 'library-bulk-favorite':
        libraryBulkFavorite();
        break;
      case 'library-bulk-archive':
        libraryBulkArchive();
        break;
      case 'library-bulk-delete':
        libraryBulkDelete();
        break;
      case 'library-clear-selection':
        state.ui.library.selectedIds = [];
        renderMain();
        break;

      /* ---- Costos (v1.2.0) ---- */
      case 'costs-tab':
        state.ui.costsTab = actionEl.dataset.tab;
        renderMain();
        break;
      case 'cost-settings-section':
        state.ui.costSettingsSection = actionEl.dataset.section;
        renderMain();
        break;
      case 'toggle-cost-filters':
        state.ui.showCostFilters = !state.ui.showCostFilters;
        renderMain();
        break;
      case 'clear-cost-filters':
        state.ui.costExpenseFilters = {};
        renderMain();
        break;
      case 'new-expense':
        openNewExpenseModal();
        break;
      case 'open-expense':
        openEditExpenseModal(id);
        break;
      case 'submit-new-expense':
        submitNewExpense();
        break;
      case 'submit-edit-expense':
        submitEditExpense(id);
        break;
      case 'duplicate-expense':
        duplicateExpense(id);
        break;
      case 'mark-expense-paid':
        markExpensePaid(id);
        break;
      case 'delete-expense':
        deleteExpense(id);
        break;
      case 'new-subscription':
        openNewSubscriptionModal();
        break;
      case 'open-subscription':
        openEditSubscriptionModal(id);
        break;
      case 'submit-new-subscription':
        submitNewSubscription();
        break;
      case 'submit-edit-subscription':
        submitEditSubscription(id);
        break;
      case 'register-subscription-payment':
        registerSubscriptionPayment(id);
        break;
      case 'pause-subscription':
        pauseSubscription(id);
        break;
      case 'reactivate-subscription':
        reactivateSubscription(id);
        break;
      case 'cancel-subscription':
        cancelSubscription(id);
        break;
      case 'delete-subscription':
        deleteSubscription(id);
        break;
      case 'add-cost-entity':
        addCostEntity(actionEl.dataset.entity);
        break;
      case 'delete-cost-entity':
        deleteCostEntity(actionEl.dataset.entity, id);
        break;
      case 'cost-reassign-and-delete':
        costReassignAndDelete(actionEl.dataset.entity, id);
        break;
      case 'cost-deactivate-instead':
        costDeactivateInstead(actionEl.dataset.entity, id);
        break;
      case 'view-project-costs':
        viewProjectCosts(actionEl.dataset.videoId);
        break;

      /* ---- Equipo ---- */
      case 'new-employee':
        openEmployeeModal();
        break;
      case 'edit-employee':
        openEmployeeModal(id);
        break;
      case 'save-employee':
        saveEmployee(id || null);
        break;
      case 'delete-employee':
        deleteEmployee(id);
        break;

      default:
        break;
    }
  }

  function toggleColumnCollapsed(stateId) {
    const list = state.ui.collapsedColumns;
    state.ui.collapsedColumns = list.includes(stateId) ? list.filter((s) => s !== stateId) : [...list, stateId];
    renderMain();
  }

  function shiftCalendarMonth(delta) {
    let { year, month } = state.ui.calendarMonth;
    month += delta;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    state.ui.calendarMonth = { year, month };
    renderMain();
  }

  /* ---- input (sin re-render, para no perder el foco) ---- */

  function onGlobalInput(e) {
    const el = e.target;

    if (el.dataset.plannerField) {
      const planner = currentSeriesPlanner();
      if (!planner) return;
      planner[el.dataset.plannerField] = el.value;
      planner.updatedAt = Utils.nowISO();
      saveSeriesPlanner();
      return;
    }

    if (el.dataset.seasonField) {
      const planner = currentSeriesPlanner();
      const season = planner?.seasons.find((x) => x.id === el.dataset.seasonId);
      if (!season) return;
      season[el.dataset.seasonField] = el.value;
      planner.updatedAt = Utils.nowISO();
      saveSeriesPlanner();
      return;
    }

    if (el.dataset.episodeField) {
      const planner = currentSeriesPlanner();
      const season = planner?.seasons.find((x) => x.id === el.dataset.seasonId);
      const episode = season?.episodes.find((x) => x.id === el.dataset.episodeId);
      if (!episode) return;
      episode[el.dataset.episodeField] = el.value;
      planner.updatedAt = Utils.nowISO();
      saveSeriesPlanner();
      return;
    }


    if (el.id === 'thumbnail-lab-title') {
      state.ui.thumbnailLab.title = el.value;
      const preview = document.getElementById('thumbnail-lab-preview-title');
      if (preview) preview.textContent = el.value.trim() || 'Título del video';
      return;
    }

    if (el.id === 'global-search') {
      state.ui.search = el.value;
      renderMain();
      // Restaurar foco tras el re-render (el input es recreado en el DOM)
      const newSearch = document.getElementById('global-search');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
      }
      return;
    }

    if (el.id === 'library-search') {
      state.ui.library.search = el.value;
      renderMain();
      const newSearch = document.getElementById('library-search');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
      }
      return;
    }

    if (el.id === 'cost-expense-search') {
      state.ui.costExpenseSearch = el.value;
      renderMain();
      const newSearch = document.getElementById('cost-expense-search');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
      }
      return;
    }

    const libraryItem = currentLibraryDetailItem();

    if (el.id === 'library-item-name' && libraryItem) {
      libraryItem.name = el.value;
      saveLibraryItemDebounced(libraryItem.id);
      return;
    }

    if (el.dataset.itemField && libraryItem) {
      libraryItem[el.dataset.itemField] = el.value;
      saveLibraryItemDebounced(libraryItem.id);
      return;
    }

    const video = currentVideo();

    if (el.id === 'editor-title' && video) {
      video.title = el.value;
      touchAndSaveDebounced(video);
      return;
    }

    if (el.dataset.field && video && !['stateId', 'seriesId', 'formatId', 'contentTypeId', 'priorityId', 'ownerId'].includes(el.dataset.field)) {
      video[el.dataset.field] = el.value;
      touchAndSaveDebounced(video);
      return;
    }

    if (el.dataset.driveUrl && video) {
      updateDriveLinkModel(video, el.dataset.driveUrl, el.value);
      touchAndSaveDebounced(video);
      return;
    }

    if (el.dataset.additionalUrl && video) {
      const link = (video.additionalLinks || []).find((l) => l.id === el.dataset.additionalUrl);
      if (link) {
        link.url = el.value;
        touchAndSaveDebounced(video);
      }
      return;
    }

    if (el.dataset.additionalLabel && video) {
      const link = (video.additionalLinks || []).find((l) => l.id === el.dataset.additionalLabel);
      if (link) {
        link.label = el.value;
        touchAndSaveDebounced(video);
      }
      return;
    }

    if (el.dataset.checklistText && video) {
      const item = findChecklistItem(video, el.dataset.checklistText);
      if (item) {
        item.text = el.value;
        touchAndSaveDebounced(video);
      }
      return;
    }

    if (el.dataset.entity && el.dataset.id && (el.type === 'text')) {
      updateEntityFieldDebounced(el.dataset.entity, el.dataset.id, el.dataset.field, el.value);
      return;
    }

    if (el.dataset.costEntity && el.dataset.id && (el.type === 'text' || el.type === 'number')) {
      updateCostEntityFieldDebounced(el.dataset.costEntity, el.dataset.id, el.dataset.field, el.type === 'number' ? Number(el.value) || 0 : el.value);
      return;
    }

    if (el.dataset.templateItem) {
      const templateId = closest(el, '.template-card')?.dataset.id;
      const t = state.templates.find((x) => x.id === templateId);
      if (t) {
        const item = t.items.find((i) => i.id === el.dataset.templateItem);
        if (item) {
          item.text = el.value;
          DB.put('checklistTemplates', t);
        }
      }
      return;
    }
  }

  /* ---- change (selects, checkboxes, color, date, file) ---- */

  async function onGlobalChange(e) {
    const el = e.target;
    const video = currentVideo();

    if (el.hasAttribute('data-episode-status')) {
      const planner = currentSeriesPlanner();
      const season = planner?.seasons.find((x) => x.id === el.dataset.seasonId);
      const episode = season?.episodes.find((x) => x.id === el.dataset.episodeId);
      if (!episode) return;
      episode.status = el.value;
      planner.updatedAt = Utils.nowISO();
      try {
        await saveSeriesPlanner();
        renderMain();
      } catch (error) {
        // Si Supabase rechaza el cambio, recargamos el valor real para no
        // mostrar un estado que después se pierde al refrescar la página.
        const freshPlanner = await DB.get('seriesPlanner', planner.id).catch(() => null);
        if (freshPlanner) {
          const index = state.seriesPlanner.findIndex((item) => item.id === planner.id);
          if (index >= 0) state.seriesPlanner[index] = freshPlanner;
        }
        renderMain();
      }
      return;
    }


    if (el.id === 'thumbnail-lab-image') {
      const file = el.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        Utils.toast('Elegí un archivo de imagen.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        state.ui.thumbnailLab.image = reader.result;
        renderMain();
      };
      reader.readAsDataURL(file);
      return;
    }

    if (el.id === 'logo-input') {
      handleLogoUpload(el.files[0]);
      return;
    }
    if (el.id === 'thumbnail-input' && video) {
      handleThumbnailUpload(video, el.files[0]);
      return;
    }
    if (el.id === 'image-input' && video) {
      handleImageUpload(video, el.files);
      return;
    }
    if (el.id === 'import-backup-input') {
      importBackupFile(el.files[0]);
      return;
    }
    if (el.id === 'apply-template-select' && video) {
      applySelectedTemplate(video, el.value);
      el.value = '';
      return;
    }

    if (el.id === 'library-file-input') {
      handleLibraryFileUpload(el.files, state.ui.library.currentFolderId).then(() => renderMain());
      el.value = '';
      return;
    }

    if (el.id === 'library-sort') {
      state.ui.library.sort = el.value;
      renderMain();
      return;
    }

    if (el.id === 'library-bulk-tag') {
      libraryBulkTag(el.value);
      el.value = '';
      return;
    }

    /* ---- Costos (v1.2.0) ---- */

    if (el.id === 'sub-form-frequency') {
      // Re-renderizamos el modal para mostrar/ocultar los campos de
      // frecuencia personalizada. Releemos TODOS los campos ya tipeados en
      // el formulario actual (esté creando o editando) para no perder nada
      // que el usuario ya haya completado.
      const dialog = document.getElementById('generic-modal');
      const submitBtn = dialog.querySelector('[data-action="submit-edit-subscription"], [data-action="submit-new-subscription"]');
      const isEdit = submitBtn?.dataset.action === 'submit-edit-subscription';
      const g = (elId) => document.getElementById(elId)?.value ?? '';
      const draft = {
        ...(isEdit ? subscriptionById(submitBtn.dataset.id) || {} : {}),
        name: g('sub-form-name'),
        categoryId: g('sub-form-category'),
        description: g('sub-form-description'),
        amount: g('sub-form-amount'),
        currencyId: g('sub-form-currency'),
        frequency: el.value,
        nextBillingDate: g('sub-form-next-billing') || Utils.todayISO(),
        startDate: g('sub-form-start-date') || Utils.todayISO(),
        paymentMethodId: g('sub-form-method'),
        status: g('sub-form-status') || 'active',
        autoRenew: document.getElementById('sub-form-autorenew')?.checked ?? true,
        projectVideoId: g('sub-form-project-video'),
        projectSeriesId: g('sub-form-project-series'),
        website: g('sub-form-website'),
        notes: g('sub-form-notes'),
      };
      if (!isEdit) delete draft.id;
      dialog.innerHTML = Components.renderSubscriptionFormModalBody(buildBaseCtx(), draft);
      return;
    }

    if (el.id === 'cost-expense-search') {
      state.ui.costExpenseSearch = el.value;
      renderMain();
      return;
    }

    if (el.dataset.costFilter) {
      state.ui.costExpenseFilters = { ...state.ui.costExpenseFilters, [el.dataset.costFilter]: el.value };
      renderMain();
      return;
    }

    if (el.dataset.costEntity && el.dataset.id) {
      updateCostEntityField(el.dataset.costEntity, el.dataset.id, el.dataset.field, el.value, el);
      if (el.type === 'checkbox' || el.type === 'color' || el.tagName === 'SELECT') renderMain();
      return;
    }

    const libraryItem = currentLibraryDetailItem();
    if (libraryItem && el.dataset.itemField) {
      if (el.dataset.itemField === 'url' && el.value && !Utils.looksLikeUrl(el.value)) {
        Utils.toast('La URL debe empezar con http:// o https://', 'error');
        el.value = libraryItem.url || '';
        return;
      }
      libraryItem[el.dataset.itemField] = el.value;
      await saveItem(libraryItem);
      renderEditorOverlay();
      renderMain();
      return;
    }

    if (el.dataset.action === 'select-library-row') {
      const list = state.ui.library.selectedIds;
      state.ui.library.selectedIds = el.checked ? [...list, el.dataset.id] : list.filter((x) => x !== el.dataset.id);
      renderMain();
      return;
    }

    if (video && el.dataset.field && ['stateId', 'seriesId', 'formatId', 'contentTypeId', 'priorityId', 'ownerId', 'archived', 'favorite', 'targetDate', 'publishDate'].includes(el.dataset.field)) {
      handleGeneralFieldChange(video, el.dataset.field, el);
      return;
    }
    if (video && el.dataset.driveUrl) {
      updateDriveLinkModel(video, el.dataset.driveUrl, el.value);
      commitDriveLinkChange(video, el.dataset.driveUrl);
      return;
    }

    if (el.dataset.filter) {
      const key = el.dataset.filter;
      if (key === 'archived' || key === 'favorite' || key === 'overdue' || key === 'hasThumbnail' || key === 'hasDrive') {
        state.ui.filters[key] = el.value || '';
      } else {
        state.ui.filters[key] = el.value || '';
      }
      renderMain();
      return;
    }

    if (el.dataset.bulkAction) {
      const type = el.dataset.bulkAction;
      const fieldMap = { state: 'stateId', series: 'seriesId', format: 'formatId' };
      const field = fieldMap[type];
      if (field && el.value) {
        for (const sid of state.ui.selectedIds) {
          const v = state.videos.find((x) => x.id === sid);
          if (v) {
            v[field] = el.value;
            pushHistory(v, 'bulk-edit', `Actualización masiva de ${type}`);
            await touchAndSaveNow(v);
          }
        }
        Utils.toast('Videos actualizados', 'success');
        el.value = '';
        renderMain();
      }
      return;
    }

    if (el.dataset.setting) {
      updateSetting(el.dataset.setting, el.value, el);
      return;
    }

    if (el.dataset.entity && el.dataset.id) {
      updateEntityField(el.dataset.entity, el.dataset.id, el.dataset.field, el.value, el);
      if (el.type === 'checkbox' || el.type === 'color' || el.tagName === 'SELECT') renderSettingsBody();
      return;
    }

    if (el.dataset.action === 'select-row') {
      const id = el.dataset.id;
      state.ui.selectedIds = el.checked ? [...state.ui.selectedIds, id] : state.ui.selectedIds.filter((x) => x !== id);
      renderMain();
      return;
    }

    if (el.dataset.action === 'select-tag-merge') {
      const id = el.dataset.id;
      state.ui.tagMergeSelection = el.checked
        ? [...state.ui.tagMergeSelection, id]
        : state.ui.tagMergeSelection.filter((x) => x !== id);
      return;
    }
  }

  /* ---- teclado ---- */

  function onGlobalKeydown(e) {
    if (e.target?.id === 'quick-note-input' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addQuickNote();
      return;
    }

    const typing = Utils.isTypingInField();
    const meta = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      if (state.ui.editingVideoId) {
        closeVideoEditor();
        return;
      }
      if (state.ui.library.detailItemId) {
        closeLibraryDetail();
        return;
      }
      if (state.ui.library.showNewMenu) {
        state.ui.library.showNewMenu = false;
        renderMain();
        return;
      }
      document.querySelectorAll('.dropdown__menu:not([hidden])').forEach((m) => m.setAttribute('hidden', ''));
      return;
    }

    if (meta && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('global-search')?.focus();
      return;
    }

    if (meta && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (state.ui.editingVideoId) saveVideoNow(state.ui.editingVideoId);
      Utils.toast('Guardado', 'success');
      return;
    }

    if (meta && e.key.toLowerCase() === 'z') {
      if (typing) return; // dejar el undo nativo del campo de texto
      e.preventDefault();
      undoLastAction();
      return;
    }

    if (!typing && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      createNewVideo();
    }
  }

  /* ---- drag & drop ---- */

  function onGlobalDragStart(e) {
    const card = closest(e.target, '.video-card');
    if (card) {
      draggedVideoId = card.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('video-card--dragging');
      return;
    }
    const libCard = closest(e.target, '.library-card');
    if (libCard) {
      draggedLibraryId = libCard.dataset.id;
      draggedLibraryKind = libCard.dataset.kind;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', libCard.dataset.id);
      libCard.classList.add('video-card--dragging');
    }
  }

  /** Resuelve a qué carpeta apunta un posible destino de drop (tarjeta de carpeta, grilla o breadcrumb). */
  function libraryDropTargetFolderId(el) {
    if (!el) return undefined;
    if (el.dataset.folderId !== undefined) return el.dataset.folderId || null;
    if (el.dataset.dropFolder !== undefined) return el.dataset.dropFolder || null;
    if (el.dataset.id !== undefined) return el.dataset.id || null;
    return undefined;
  }

  function onGlobalDragOver(e) {
    const col = closest(e.target, '[data-drop-state]');
    if (col && draggedVideoId) {
      e.preventDefault();
      col.classList.add('kanban-col--drag-over');
      return;
    }

    if (state.ui.route !== 'library') return;

    const isFileDrag = e.dataTransfer?.types
      && Array.from(e.dataTransfer.types).includes('Files');

    const libTarget = closest(
      e.target,
      '.library-card--folder, .library-empty-dropzone, .library-grid, .view--library[data-drop-folder], .crumb'
    );

    if (!libTarget) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = isFileDrag ? 'copy' : 'move';

    if (isFileDrag) {
      document.querySelector('.view--library')?.classList.add('library-drop-active');
    } else {
      libTarget.classList.add('kanban-col--drag-over');
    }
  }

  async function onGlobalDrop(e) {
    const col = closest(e.target, '[data-drop-state]');
    if (col && draggedVideoId) {
      e.preventDefault();
      col.classList.remove('kanban-col--drag-over');
      await moveVideoToState(draggedVideoId, col.dataset.dropState);
      draggedVideoId = null;
      return;
    }

    const libTarget = closest(
      e.target,
      '.library-card--folder, .library-empty-dropzone, .library-grid, .view--library[data-drop-folder], .crumb'
    );
    if (libTarget && state.ui.route === 'library') {
      e.preventDefault();
      document.querySelectorAll('.library-drop-active, .kanban-col--drag-over').forEach((el) => {
        el.classList.remove('library-drop-active', 'kanban-col--drag-over');
      });
      const targetFolderId = libraryDropTargetFolderId(libTarget);

      // Arrastre de archivos desde el sistema operativo (subida directa).
      const isFileDrop = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
      if (isFileDrop && e.dataTransfer.files && e.dataTransfer.files.length) {
        await handleLibraryFileUpload(e.dataTransfer.files, targetFolderId || null);
        renderMain();
        return;
      }

      // Arrastre interno de una carpeta o un recurso ya existentes.
      if (draggedLibraryId && draggedLibraryKind) {
        if (draggedLibraryKind === 'folder') {
          if (draggedLibraryId !== targetFolderId) await moveFolderTo(draggedLibraryId, targetFolderId);
        } else {
          await moveItemTo(draggedLibraryId, targetFolderId);
        }
        renderMain();
      }
      draggedLibraryId = null;
      draggedLibraryKind = null;
    }
  }

  function onGlobalDragEnd(e) {
    document.querySelectorAll('.video-card--dragging').forEach((c) => c.classList.remove('video-card--dragging'));
    document.querySelectorAll('.kanban-col--drag-over, .library-drop-active').forEach((c) => {
      c.classList.remove('kanban-col--drag-over', 'library-drop-active');
    });
    draggedVideoId = null;
    draggedLibraryId = null;
    draggedLibraryKind = null;
  }

  /* ------------------------------------------------------------------ */
  /* Arranque de la aplicación                                           */
  /* ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', init);
})();

document.addEventListener('click',e=>{
 const d=e.target.closest('[data-citas-dot]');
 if(!d)return;
 const slider=document.querySelector('[data-citas-slider]');
 if(!slider)return;
 const target=Number(d.dataset.citasDot);
 const slides=[...slider.querySelectorAll('[data-citas-slide]')];
 const current=Number(slider.dataset.index||0);
 if(target===current)return;
 slider.dataset.index=String(current);
 moveDashboardCitasSlider(target-current);
});
