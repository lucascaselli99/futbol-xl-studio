/**
 * components.js
 * -----------------------------------------------------------------------
 * Funciones "de vista": reciben datos ya preparados por app.js y devuelven
 * HTML (strings). No acceden a IndexedDB ni mutan estado — son funciones
 * puras de renderizado. Toda la interactividad se resuelve en app.js
 * mediante delegación de eventos (atributos data-action / data-id).
 * -----------------------------------------------------------------------
 */

const Components = (() => {
  const { escapeHtml, formatDate, formatDateTime, truncate, isOverdue, daysUntil, formatBytes, linkIcon } = Utils;

  /** Versión visible de la aplicación (independiente del nombre editable por el usuario). */
  const APP_VERSION = '1.2.0';

  /* ------------------------------------------------------------------ */
  /* Iconos (SVG inline, estilo lineal/minimalista)                      */
  /* ------------------------------------------------------------------ */

  const Icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m21 8-5.5 4L21 16Z"/></svg>',
    library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h4v16H4zM10.5 4h4v16h-4zM17.5 5l3.5 15-3.9.9L14 5.9Z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.4 1.3 6.3L12 17l-5.6 3.3 1.3-6.3-4.7-4.4 6.3-.7Z"/></svg>',
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.4 1.3 6.3L12 17l-5.6 3.3 1.3-6.3-4.7-4.4 6.3-.7Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16l-6 8v6l-4 2v-8Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 1 21h22Z"/><path d="M12 9v5M12 17h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5 9-9"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21 19v1"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h3"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18h6M10 22h4"/><path d="M8.2 14.5A7 7 0 1 1 15.8 14.5C14.8 15.3 14.5 16 14.5 17h-5c0-1-.3-1.7-1.3-2.5Z"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 2 21 6l-4 4"/><path d="M3 12v-1a5 5 0 0 1 5-5h13"/><path d="M7 22 3 18l4-4"/><path d="M21 12v1a5 5 0 0 1-5 5H3"/></svg>',
  };

  function icon(name, cls = '') {
    return `<span class="icon ${cls}">${Icons[name] || ''}</span>`;
  }

  /* ------------------------------------------------------------------ */
  /* Helpers de datos (lookups por id)                                   */
  /* ------------------------------------------------------------------ */

  function byId(list, id) {
    return (list || []).find((x) => x.id === id) || null;
  }

  function pill(text, color, opts = {}) {
    const style = color ? `style="--pill-color:${color}"` : '';
    const cls = opts.outline ? 'pill pill--outline' : 'pill';
    return `<span class="${cls}" ${style}>${opts.iconChar ? `<span class="pill__icon">${opts.iconChar}</span>` : ''}${escapeHtml(text)}</span>`;
  }

  function progressBar(pct, opts = {}) {
    const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    return `<div class="progress ${opts.small ? 'progress--small' : ''}"><div class="progress__fill" style="width:${p}%"></div></div>`;
  }

  function checklistProgress(checklist) {
    if (!checklist || !checklist.length) return { done: 0, total: 0, pct: 0 };
    let total = 0;
    let done = 0;
    checklist.forEach((item) => {
      total += 1;
      if (item.done) done += 1;
      (item.subtasks || []).forEach((s) => {
        total += 1;
        if (s.done) done += 1;
      });
    });
    return { done, total, pct: total ? (done / total) * 100 : 0 };
  }

  /* ------------------------------------------------------------------ */
  /* Sidebar                                                             */
  /* ------------------------------------------------------------------ */

  const NAV_ITEMS = [
    { key: 'home', label: 'Inicio', icon: 'home', ready: true },
    { key: 'videos', label: 'Videos', icon: 'video', ready: true },
    { key: 'library', label: 'Biblioteca', icon: 'library', ready: false },
    { key: 'costs', label: 'Costos', icon: 'wallet', ready: true },
    { key: 'team', label: 'Equipo', icon: 'users', ready: true },
    { key: 'thumbnail-lab', label: 'Probador de miniaturas', icon: 'image', ready: true },
    { key: 'calendar-module', label: 'Calendario', icon: 'calendar', ready: false },
    { key: 'analytics', label: 'Analytics', icon: 'analytics', ready: false },
    { key: 'settings', label: 'Configuración', icon: 'settings', ready: true },
  ];

  function renderSidebar(ctx) {
    const { settings, logo, route, sidebarCollapsed } = ctx;
    const showLogo = settings.showLogoInSidebar && settings.logoDisplay !== 'name';
    const showName = settings.logoDisplay !== 'logo';

    const brandHtml = `
      <div class="brand">
        ${showLogo ? (logo
          ? `<img class="brand__logo" src="${logo}" alt="Logo" />`
          : `<div class="brand__logo brand__logo--placeholder">FXL</div>`) : ''}
        <span class="brand__text">
          ${showName ? `<span class="brand__name">${escapeHtml(settings.appName || 'Fútbol XL Studio')}</span>` : ''}
          <span class="brand__version">v${APP_VERSION}</span>
        </span>
      </div>`;

    const navHtml = NAV_ITEMS.map((item) => {
      const active = route === item.key || (route === 'videos' && item.key === 'videos');
      return `
        <button class="nav-item ${active ? 'nav-item--active' : ''}" data-action="navigate" data-route="${item.key}" title="${escapeHtml(item.label)}">
          ${icon(item.icon)}
          <span class="nav-item__label">${escapeHtml(item.label)}</span>
          ${!item.ready ? '<span class="badge-soon">pronto</span>' : ''}
        </button>`;
    }).join('');

    return `
      <aside class="sidebar ${sidebarCollapsed ? 'sidebar--collapsed' : ''}">
        ${brandHtml}
        <nav class="nav">${navHtml}</nav>
        <div class="sidebar__footer">
          <button class="nav-item" data-action="toggle-sidebar" title="Colapsar barra lateral">
            ${icon('chevronLeft')}
            <span class="nav-item__label">Colapsar</span>
          </button>
        </div>
      </aside>`;
  }

  function renderMobileNav(route) {
    const items = NAV_ITEMS.filter((i) => ['home', 'videos', 'settings'].includes(i.key));
    return `
      <nav class="mobile-nav">
        ${items.map((item) => `
          <button class="mobile-nav__item ${route === item.key ? 'mobile-nav__item--active' : ''}" data-action="navigate" data-route="${item.key}">
            ${icon(item.icon)}
            <span>${escapeHtml(item.label)}</span>
          </button>`).join('')}
        <button class="mobile-nav__item" data-action="open-more-menu">${icon('menu')}<span>Más</span></button>
      </nav>`;
  }

  /* ------------------------------------------------------------------ */
  /* Topbar                                                              */
  /* ------------------------------------------------------------------ */

  function renderTopbar(ctx) {
    const { search, saveState, route, authUser, currentEmployee } = ctx;
    const titles = {
      home: 'Inicio',
      videos: 'Videos',
      library: 'Biblioteca',
      costs: 'Costos',
      team: 'Equipo',
      'thumbnail-lab': 'Probador de miniaturas',
      'calendar-module': 'Calendario',
      analytics: 'Analytics',
      settings: 'Configuración',
    };
    return `
      <header class="topbar">
        <button class="icon-btn topbar__menu-btn" data-action="toggle-mobile-sidebar" title="Menú">${icon('menu')}</button>
        <h1 class="topbar__title">${escapeHtml(titles[route] || '')}</h1>
        <div class="topbar__search">
          ${icon('search')}
          <input type="text" id="global-search" placeholder="Buscar videos, guiones, etiquetas... (Ctrl+K)" value="${escapeHtml(search || '')}" autocomplete="off" />
          ${search ? `<button class="icon-btn" data-action="clear-search">${icon('close')}</button>` : ''}
        </div>
        <div class="topbar__actions">
          <span class="save-indicator" id="save-indicator" data-state="${saveState || 'idle'}">
            <span class="save-indicator__dot"></span>
            <span class="save-indicator__text">${saveState === 'saving' ? 'Guardando…' : 'Guardado'}</span>
          </span>
          <button class="btn btn--primary" data-action="new-video">${icon('plus')} <span>Nuevo video</span></button>
          <div class="user-menu">
            <div class="user-menu__identity">
              <strong class="user-menu__name">${escapeHtml(currentEmployee?.name || 'Usuario sin vincular')}</strong>
              <span class="user-menu__email" title="${escapeHtml(authUser?.email || '')}">${escapeHtml(authUser?.email || '')}</span>
            </div>
            <button class="btn btn--ghost btn--sm" data-action="logout">Cerrar sesión</button>
          </div>
        </div>
      </header>`;
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard (Inicio)                                                  */
  /* ------------------------------------------------------------------ */

  function renderDashboard(ctx) {
    const { videos, states, series, formats, settings, quickNotes = [] } = ctx;
    const active = videos.filter((v) => !v.archived);
    const byStateName = (name) => {
      const st = states.find((s) => s.name.toLowerCase() === name.toLowerCase());
      return st ? active.filter((v) => v.stateId === st.id).length : 0;
    };
    const finalStateIds = states.filter((s) => s.isFinal).map((s) => s.id);
    const overdueCount = active.filter((v) => isOverdue(v.targetDate, finalStateIds.includes(v.stateId))).length;
    const priorityHighIds = ctx.priorities.filter((p) => /alta|urgente/i.test(p.name)).map((p) => p.id);
    const highPriorityCount = active.filter((v) => priorityHighIds.includes(v.priorityId)).length;
    const publishedThisMonth = active.filter((v) => v.publishDate && Utils.isSameMonth(v.publishDate)).length;
    const scheduled = byStateName('Programado');

    const cards = [
      { label: 'Videos activos', value: active.length, icon: 'video' },
      { label: 'Ideas', value: byStateName('Ideas'), icon: 'home' },
      { label: 'En investigación', value: byStateName('Investigación'), icon: 'search' },
      { label: 'Guiones pendientes', value: byStateName('Guion'), icon: 'edit' },
      { label: 'En grabación', value: byStateName('Grabación'), icon: 'video' },
      { label: 'En edición', value: byStateName('Edición'), icon: 'copy' },
      { label: 'Miniaturas pendientes', value: byStateName('Miniatura'), icon: 'image' },
      { label: 'Programados', value: scheduled, icon: 'calendar' },
      { label: 'Publicados este mes', value: publishedThisMonth, icon: 'check' },
      { label: 'Vencidos', value: overdueCount, icon: 'warn', danger: overdueCount > 0 },
      { label: 'Prioridad alta', value: highPriorityCount, icon: 'star' },
    ];

    const upcoming = active
      .filter((v) => v.targetDate && !finalStateIds.includes(v.stateId))
      .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
      .slice(0, 6);

    const recent = active
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 6);

    const formatDist = formats
      .map((f) => ({ name: f.name, color: f.color, count: active.filter((v) => v.formatId === f.id).length }))
      .filter((f) => f.count > 0);
    const seriesDist = series
      .map((s) => ({ name: s.name, color: s.color, count: active.filter((v) => v.seriesId === s.id).length }))
      .filter((s) => s.count > 0);

    const totalForProgress = active.length || 1;
    const publishedCount = active.filter((v) => finalStateIds.includes(v.stateId)).length;
    const overallProgress = (publishedCount / totalForProgress) * 100;

    // --- Métricas de Biblioteca (agregadas en v1.1.0), sin sobrecargar el
    // panel principal: se muestran en una sección compacta aparte. ---
    const libFolders = (ctx.libraryFolders || []).filter((f) => !f.archived);
    const libItems = (ctx.libraryItems || []).filter((i) => !i.archived);
    const libImages = libItems.filter((i) => i.resourceType === 'image' || i.resourceType === 'logo').length;
    const libDriveLinks = libItems.filter((i) => i.resourceType === 'drive' || i.resourceType === 'driveFolder').length;
    const libFavorites = libItems.filter((i) => i.favorite).length;
    const libNoFolder = libItems.filter((i) => !i.folderId).length;
    const libraryCards = [
      { label: 'Recursos en Biblioteca', value: libItems.length, icon: 'library' },
      { label: 'Imágenes', value: libImages, icon: 'image' },
      { label: 'Enlaces de Drive', value: libDriveLinks, icon: 'link' },
      { label: 'Carpetas', value: libFolders.length, icon: 'library' },
      { label: 'Favoritos', value: libFavorites, icon: 'star' },
      { label: 'Sin carpeta', value: libNoFolder, icon: 'library' },
    ];
    const libRecent = libItems
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    return `
      <div class="view view--home">
        <div class="home-header">
          <div>
            <h2>Bienvenido de nuevo 👋</h2>
            <p class="muted">Este es el resumen de producción de ${escapeHtml(settings.appName)}.</p>
          </div>
          <button class="btn btn--primary btn--lg" data-action="new-video">${icon('plus')} Nuevo video</button>
        </div>

        <div class="stat-grid">
          ${cards.map((c) => `
            <div class="stat-card ${c.danger ? 'stat-card--danger' : ''}">
              <div class="stat-card__icon">${icon(c.icon)}</div>
              <div class="stat-card__value">${c.value}</div>
              <div class="stat-card__label">${escapeHtml(c.label)}</div>
            </div>`).join('')}
        </div>

        <div class="home-grid">
          <section class="panel panel--wide quick-notes-panel">
            <div class="quick-notes__header">
              <div>
                <h3>💡 Notas rápidas</h3>
                <p class="muted small">Anotá una idea y convertíla en proyecto cuando esté lista.</p>
              </div>
            </div>
            <div class="quick-notes__composer">
              <textarea id="quick-note-input" rows="2" placeholder="Escribí una idea rápida..."></textarea>
              <button class="btn btn--primary" data-action="quick-note-add">${icon('plus')} Guardar nota</button>
            </div>
            ${quickNotes.length ? `<div class="quick-notes__grid">
              ${quickNotes.map((note) => `<article class="quick-note-card">
                <p>${escapeHtml(note.text)}</p>
                <div class="quick-note-card__actions">
                  <button class="btn btn--ghost btn--sm" data-action="quick-note-edit" data-id="${note.id}">${icon('edit')} Editar</button>
                  <button class="btn btn--secondary btn--sm" data-action="quick-note-to-project" data-id="${note.id}">${icon('video')} Proyecto</button>
                  <button class="icon-btn icon-btn--sm" data-action="quick-note-delete" data-id="${note.id}" title="Eliminar">${icon('trash')}</button>
                </div>
              </article>`).join('')}
            </div>` : `<p class="muted small empty-mini">Todavía no guardaste ninguna idea.</p>`}
          </section>

          <section class="panel">
            <h3>Próximos vencimientos</h3>
            ${upcoming.length ? `<ul class="mini-list">
              ${upcoming.map((v) => {
                const days = daysUntil(v.targetDate);
                const overdue = days < 0;
                return `<li class="mini-list__item" data-action="open-video" data-id="${v.id}">
                  <span class="mini-list__title">${escapeHtml(v.title || 'Sin título')}</span>
                  <span class="mini-list__meta ${overdue ? 'text-danger' : ''}">${overdue ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? 'Hoy' : `en ${days}d`}</span>
                </li>`;
              }).join('')}
            </ul>` : emptyMini('Sin fechas próximas')}
          </section>

          <section class="panel">
            <h3>Últimos modificados</h3>
            ${recent.length ? `<ul class="mini-list">
              ${recent.map((v) => `<li class="mini-list__item" data-action="open-video" data-id="${v.id}">
                <span class="mini-list__title">${escapeHtml(v.title || 'Sin título')}</span>
                <span class="mini-list__meta">${formatDateTime(v.updatedAt)}</span>
              </li>`).join('')}
            </ul>` : emptyMini('Todavía no hay actividad')}
          </section>

          <section class="panel">
            <h3>Distribución por formato</h3>
            ${formatDist.length ? distBars(formatDist) : emptyMini('Sin datos')}
          </section>

          <section class="panel">
            <h3>Distribución por serie</h3>
            ${seriesDist.length ? distBars(seriesDist) : emptyMini('Sin datos')}
          </section>

          <section class="panel panel--wide">
            <h3>Progreso general de producción</h3>
            <p class="muted small">Videos publicados sobre el total de videos activos.</p>
            ${progressBar(overallProgress)}
            <p class="small muted">${publishedCount} de ${active.length} publicados (${Math.round(overallProgress)}%)</p>
          </section>

          <section class="panel panel--wide">
            <h3>Biblioteca</h3>
            <div class="stat-grid stat-grid--compact">
              ${libraryCards.map((c) => `
                <div class="stat-card stat-card--sm">
                  <div class="stat-card__icon">${icon(c.icon)}</div>
                  <div class="stat-card__value">${c.value}</div>
                  <div class="stat-card__label">${escapeHtml(c.label)}</div>
                </div>`).join('')}
            </div>
            ${libRecent.length ? `
              <h4 style="margin-top:16px">Recursos agregados recientemente</h4>
              <ul class="mini-list">
                ${libRecent.map((it) => `<li class="mini-list__item" data-action="open-library-detail" data-item-id="${it.id}">
                  <span class="mini-list__title">${resourceTypeMeta(it.resourceType).icon} ${escapeHtml(it.name)}</span>
                  <span class="mini-list__meta">${formatDate(it.createdAt, settings.dateFormat)}</span>
                </li>`).join('')}
              </ul>` : ''}
          </section>
        </div>
      </div>`;
  }

  function renderThumbnailLab(ctx) {
    const lab = ctx.thumbnailLab || { title: '', image: '', device: 'desktop' };
    const title = lab.title || '';
    const device = lab.device || 'desktop';
    return `
      <div class="view thumbnail-lab">
        <div class="home-header">
          <div>
            <h2>Probador de miniaturas</h2>
            <p class="muted">Subí una miniatura y mirá cómo se ve junto al título antes de publicarla.</p>
          </div>
          <button class="btn btn--ghost" data-action="thumbnail-lab-clear">Limpiar</button>
        </div>

        <div class="thumbnail-lab__layout">
          <section class="panel thumbnail-lab__controls">
            <label class="field">
              <span>Título del video</span>
              <textarea id="thumbnail-lab-title" rows="3" placeholder="Escribí el título...">${escapeHtml(title)}</textarea>
            </label>
            <label class="thumbnail-upload">
              ${icon('upload')}
              <strong>Subir miniatura</strong>
              <span>JPG, PNG o WebP</span>
              <input id="thumbnail-lab-image" type="file" accept="image/*" hidden />
            </label>
            <div class="thumbnail-device-switch">
              ${['desktop', 'mobile', 'tv'].map((item) => `<button class="btn ${device === item ? 'btn--primary' : 'btn--secondary'} btn--sm" data-action="thumbnail-lab-device" data-device="${item}">${item === 'desktop' ? '💻 Escritorio' : item === 'mobile' ? '📱 Celular' : '📺 TV'}</button>`).join('')}
            </div>
          </section>

          <section class="panel thumbnail-preview-wrap">
            <div class="youtube-preview youtube-preview--${device}">
              <div class="youtube-preview__thumb ${lab.image ? '' : 'youtube-preview__thumb--empty'}" ${lab.image ? `style="background-image:url('${lab.image}')"` : ''}>
                ${lab.image ? '' : `<div>${icon('image')}<span>Tu miniatura aparecerá acá</span></div>`}
                <span class="youtube-preview__duration">12:34</span>
              </div>
              <div class="youtube-preview__meta">
                <div class="youtube-preview__avatar">FXL</div>
                <div>
                  <h3 id="thumbnail-lab-preview-title">${escapeHtml(title.trim() || 'Título del video')}</h3>
                  <p>Fútbol XL</p>
                  <p>18 mil vistas · hace 2 horas</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>`;
  }

  function distBars(items) {
    const max = Math.max(...items.map((i) => i.count), 1);
    return `<div class="dist-bars">
      ${items.map((i) => `
        <div class="dist-bar">
          <span class="dist-bar__label">${escapeHtml(i.name)}</span>
          <div class="dist-bar__track"><div class="dist-bar__fill" style="width:${(i.count / max) * 100}%;background:${i.color || 'var(--accent)'}"></div></div>
          <span class="dist-bar__count">${i.count}</span>
        </div>`).join('')}
    </div>`;
  }

  function emptyMini(msg) {
    return `<p class="muted small empty-mini">${escapeHtml(msg)}</p>`;
  }

  /* ------------------------------------------------------------------ */
  /* Videos: contenedor con sub-vistas (Kanban / Lista / Calendario)     */
  /* ------------------------------------------------------------------ */

  function renderVideosToolbar(ctx) {
    const { videosView, activeFilterCount } = ctx;
    const tabs = [
      { key: 'kanban', label: 'Kanban', icon: 'grid' },
      { key: 'list', label: 'Lista', icon: 'list' },
      { key: 'calendar', label: 'Calendario', icon: 'calendar' },
    ];
    return `
      <div class="videos-toolbar">
        <div class="view-switch">
          ${tabs.map((t) => `
            <button class="view-switch__btn ${videosView === t.key ? 'view-switch__btn--active' : ''}" data-action="set-videos-view" data-view="${t.key}">
              ${icon(t.icon)} <span>${t.label}</span>
            </button>`).join('')}
        </div>
        <div class="videos-toolbar__right">
          <button class="btn btn--secondary" data-action="toggle-filters">
            ${icon('filter')} Filtros ${activeFilterCount ? `<span class="filter-count">${activeFilterCount}</span>` : ''}
          </button>
          <button class="btn btn--primary" data-action="new-video">${icon('plus')} Nuevo video</button>
        </div>
      </div>`;
  }

  function renderFilterPanel(ctx) {
    const { filters, states, series, formats, contentTypes, priorities, tags } = ctx;
    const opt = (list, selectedId, key) =>
      list.map((x) => `<option value="${x.id}" ${filters[key] === x.id ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('');

    return `
      <div class="filter-panel" id="filter-panel">
        <div class="filter-panel__grid">
          <label class="field">
            <span>Estado</span>
            <select data-filter="stateId"><option value="">Todos</option>${opt(states, filters.stateId, 'stateId')}</select>
          </label>
          <label class="field">
            <span>Serie</span>
            <select data-filter="seriesId"><option value="">Todas</option>${opt(series, filters.seriesId, 'seriesId')}</select>
          </label>
          <label class="field">
            <span>Formato</span>
            <select data-filter="formatId"><option value="">Todos</option>${opt(formats, filters.formatId, 'formatId')}</select>
          </label>
          <label class="field">
            <span>Tipo de contenido</span>
            <select data-filter="contentTypeId"><option value="">Todos</option>${opt(contentTypes, filters.contentTypeId, 'contentTypeId')}</select>
          </label>
          <label class="field">
            <span>Prioridad</span>
            <select data-filter="priorityId"><option value="">Todas</option>${opt(priorities, filters.priorityId, 'priorityId')}</select>
          </label>
          <label class="field">
            <span>Archivado</span>
            <select data-filter="archived">
              <option value="" ${!filters.archived ? 'selected' : ''}>Ocultar archivados</option>
              <option value="only" ${filters.archived === 'only' ? 'selected' : ''}>Solo archivados</option>
              <option value="all" ${filters.archived === 'all' ? 'selected' : ''}>Todos</option>
            </select>
          </label>
          <label class="field">
            <span>Favorito</span>
            <select data-filter="favorite">
              <option value="" ${!filters.favorite ? 'selected' : ''}>Todos</option>
              <option value="yes" ${filters.favorite === 'yes' ? 'selected' : ''}>Solo favoritos</option>
            </select>
          </label>
          <label class="field">
            <span>Vencido</span>
            <select data-filter="overdue">
              <option value="" ${!filters.overdue ? 'selected' : ''}>Todos</option>
              <option value="yes" ${filters.overdue === 'yes' ? 'selected' : ''}>Solo vencidos</option>
            </select>
          </label>
          <label class="field">
            <span>Miniatura</span>
            <select data-filter="hasThumbnail">
              <option value="" ${!filters.hasThumbnail ? 'selected' : ''}>Todos</option>
              <option value="yes" ${filters.hasThumbnail === 'yes' ? 'selected' : ''}>Con miniatura</option>
              <option value="no" ${filters.hasThumbnail === 'no' ? 'selected' : ''}>Sin miniatura</option>
            </select>
          </label>
          <label class="field">
            <span>Enlace de Drive</span>
            <select data-filter="hasDrive">
              <option value="" ${!filters.hasDrive ? 'selected' : ''}>Todos</option>
              <option value="yes" ${filters.hasDrive === 'yes' ? 'selected' : ''}>Con enlace</option>
              <option value="no" ${filters.hasDrive === 'no' ? 'selected' : ''}>Sin enlace</option>
            </select>
          </label>
        </div>
        <div class="filter-panel__tags">
          <span class="field__label">Etiquetas</span>
          <div class="tag-choices">
            ${tags.map((t) => `<button class="tag-choice ${filters.tagIds?.includes(t.id) ? 'tag-choice--active' : ''}" style="--tag-color:${t.color}" data-action="toggle-filter-tag" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join('') || '<span class="muted small">No hay etiquetas creadas</span>'}
          </div>
        </div>
        <div class="filter-panel__footer">
          <button class="btn btn--ghost" data-action="clear-filters">Limpiar filtros</button>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Kanban                                                              */
  /* ------------------------------------------------------------------ */

  function renderKanban(ctx) {
    const { states, videosByState, collapsedColumns } = ctx;
    const visibleStates = states.filter((s) => s.showInKanban && !s.archived).sort((a, b) => a.order - b.order);

    if (!visibleStates.length) {
      return renderEmptyState({
        title: 'No hay estados configurados para el Kanban',
        message: 'Andá a Configuración → Estados para crear columnas.',
        action: { label: 'Ir a Configuración', route: 'settings' },
      });
    }

    return `
      <div class="kanban" id="kanban-board">
        ${visibleStates.map((state) => renderKanbanColumn(state, videosByState[state.id] || [], ctx, collapsedColumns.includes(state.id))).join('')}
      </div>`;
  }

  function renderKanbanColumn(state, videos, ctx, collapsed) {
    if (collapsed) {
      return `
        <div class="kanban-col kanban-col--collapsed" data-state-id="${state.id}">
          <button class="kanban-col__expand" data-action="toggle-column" data-id="${state.id}">
            ${icon('chevronRight')}
            <span class="kanban-col__vertical-title" style="color:${state.color}">${escapeHtml(state.name)}</span>
            <span class="col-count">${videos.length}</span>
          </button>
        </div>`;
    }
    const limit = ctx.settings.cardsPerColumnLimit;
    const visible = limit ? videos.slice(0, limit) : videos;
    const hiddenCount = limit ? Math.max(0, videos.length - limit) : 0;

    return `
      <div class="kanban-col" data-state-id="${state.id}" data-action-zone="drop" data-drop-state="${state.id}">
        <div class="kanban-col__header">
          <span class="kanban-col__dot" style="background:${state.color}"></span>
          <span class="kanban-col__icon">${state.icon || ''}</span>
          <h4 class="kanban-col__title">${escapeHtml(state.name)}</h4>
          <span class="col-count">${videos.length}</span>
          <button class="icon-btn" data-action="new-video-in-state" data-id="${state.id}" title="Agregar tarjeta">${icon('plus')}</button>
          <div class="dropdown">
            <button class="icon-btn" data-action="toggle-menu" data-menu="col-${state.id}" title="Opciones">${icon('dots')}</button>
            <div class="dropdown__menu" id="menu-col-${state.id}" hidden>
              <button data-action="collapse-column" data-id="${state.id}">Colapsar columna</button>
              <button data-action="edit-state" data-id="${state.id}">Editar estado</button>
              <button data-action="goto-states-settings">Gestionar estados</button>
            </div>
          </div>
        </div>
        <div class="kanban-col__cards">
          ${visible.length ? visible.map((v) => renderVideoCard(v, ctx)).join('') : `<div class="kanban-col__empty">Sin videos</div>`}
          ${hiddenCount > 0 ? `<button class="btn btn--ghost btn--block" data-action="show-more-column" data-id="${state.id}">Ver ${hiddenCount} más</button>` : ''}
        </div>
      </div>`;
  }

  function renderVideoCard(video, ctx) {
    const series = byId(ctx.series, video.seriesId);
    const format = byId(ctx.formats, video.formatId);
    const priority = byId(ctx.priorities, video.priorityId);
    const state = byId(ctx.states, video.stateId);
    const tags = (video.tagIds || []).map((id) => byId(ctx.tags, id)).filter(Boolean);
    const progress = checklistProgress(video.checklist);
    const overdue = isOverdue(video.targetDate, state?.isFinal);
    const compact = ctx.settings.cardSize === 'compact';

    return `
      <div class="video-card ${compact ? 'video-card--compact' : ''} ${video.archived ? 'video-card--archived' : ''}"
           draggable="true" data-id="${video.id}" data-action="open-video">
        ${ctx.settings.showThumbnails && video.thumbnail ? `<div class="video-card__thumb" style="background-image:url('${video.thumbnail}')"></div>` : ''}
        <div class="video-card__body">
          <div class="video-card__top">
            <span class="video-card__title">${escapeHtml(video.title || 'Sin título')}</span>
            <button class="icon-btn icon-btn--sm" data-action="toggle-favorite" data-id="${video.id}" title="Favorito">
              ${icon(video.favorite ? 'starFill' : 'star', video.favorite ? 'text-accent' : '')}
            </button>
          </div>
          <div class="video-card__pills">
            ${series ? pill(series.name, series.color) : ''}
            ${format ? pill(format.name, format.color, { outline: true }) : ''}
            ${priority ? pill(priority.name, priority.color, { outline: true }) : ''}
          </div>
          ${tags.length ? `<div class="video-card__tags">${tags.map((t) => pill(t.name, t.color)).join('')}</div>` : ''}
          ${progress.total ? `<div class="video-card__progress">${progressBar(progress.pct, { small: true })}<span class="small muted">${progress.done}/${progress.total}</span></div>` : ''}
          <div class="video-card__footer">
            <span class="video-card__date ${overdue ? 'text-danger' : ''}">
              ${overdue ? icon('warn') : icon('clock')} ${video.targetDate ? formatDate(video.targetDate, ctx.settings.dateFormat) : 'Sin fecha'}
            </span>
            <span class="video-card__updated small muted">${formatDate(video.updatedAt, ctx.settings.dateFormat)}</span>
          </div>
        </div>
        <div class="video-card__quick-actions">
          <button class="icon-btn icon-btn--sm" data-action="duplicate-video" data-id="${video.id}" title="Duplicar">${icon('copy')}</button>
          <button class="icon-btn icon-btn--sm" data-action="archive-video" data-id="${video.id}" title="Archivar">${icon('archive')}</button>
          <button class="icon-btn icon-btn--sm" data-action="delete-video" data-id="${video.id}" title="Eliminar">${icon('trash')}</button>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Vista Lista                                                         */
  /* ------------------------------------------------------------------ */

  function renderListView(ctx) {
    const { videos, sort, selectedIds } = ctx;
    if (!videos.length) {
      return renderEmptyState({ title: 'No hay videos que coincidan', message: 'Probá ajustar los filtros o creá un nuevo video.' });
    }
    const cols = [
      { key: 'title', label: 'Título' },
      { key: 'state', label: 'Estado' },
      { key: 'series', label: 'Serie' },
      { key: 'format', label: 'Formato' },
      { key: 'priority', label: 'Prioridad' },
      { key: 'targetDate', label: 'Fecha objetivo' },
      { key: 'progress', label: 'Progreso' },
      { key: 'updatedAt', label: 'Última modificación' },
    ];
    const allSelected = videos.length > 0 && videos.every((v) => selectedIds.includes(v.id));

    return `
      <div class="list-view">
        ${selectedIds.length ? renderBulkBar(selectedIds.length, ctx) : ''}
        <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-check"><input type="checkbox" data-action="select-all" ${allSelected ? 'checked' : ''}/></th>
              ${cols.map((c) => `<th data-action="sort-by" data-key="${c.key}" class="sortable ${sort.key === c.key ? 'sortable--active' : ''}">
                ${c.label} ${sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
              </th>`).join('')}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${videos.map((v) => renderListRow(v, ctx, selectedIds.includes(v.id))).join('')}
          </tbody>
        </table>
        </div>
      </div>`;
  }

  function renderListRow(video, ctx, selected) {
    const series = byId(ctx.series, video.seriesId);
    const format = byId(ctx.formats, video.formatId);
    const priority = byId(ctx.priorities, video.priorityId);
    const state = byId(ctx.states, video.stateId);
    const progress = checklistProgress(video.checklist);
    const overdue = isOverdue(video.targetDate, state?.isFinal);
    return `
      <tr class="${selected ? 'row--selected' : ''} ${video.archived ? 'row--archived' : ''}" data-id="${video.id}">
        <td class="col-check"><input type="checkbox" data-action="select-row" data-id="${video.id}" ${selected ? 'checked' : ''}/></td>
        <td class="col-title" data-action="open-video" data-id="${video.id}">
          <span class="row-title">${video.favorite ? icon('starFill', 'text-accent') : ''} ${escapeHtml(video.title || 'Sin título')}</span>
        </td>
        <td>${state ? pill(state.name, state.color) : '—'}</td>
        <td>${series ? pill(series.name, series.color) : '—'}</td>
        <td>${format ? pill(format.name, format.color, { outline: true }) : '—'}</td>
        <td>${priority ? pill(priority.name, priority.color, { outline: true }) : '—'}</td>
        <td class="${overdue ? 'text-danger' : ''}">${video.targetDate ? formatDate(video.targetDate, ctx.settings.dateFormat) : '—'}</td>
        <td>${progress.total ? `${Math.round(progress.pct)}%` : '—'}</td>
        <td class="small muted">${formatDate(video.updatedAt, ctx.settings.dateFormat)}</td>
        <td class="col-actions">
          <button class="icon-btn icon-btn--sm" data-action="open-video" data-id="${video.id}" title="Abrir">${icon('edit')}</button>
          <button class="icon-btn icon-btn--sm" data-action="delete-video" data-id="${video.id}" title="Eliminar">${icon('trash')}</button>
        </td>
      </tr>`;
  }

  function renderBulkBar(count, ctx) {
    return `
      <div class="bulk-bar">
        <span>${count} seleccionados</span>
        <select data-bulk-action="state"><option value="">Cambiar estado…</option>${ctx.states.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
        <select data-bulk-action="series"><option value="">Cambiar serie…</option>${ctx.series.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
        <select data-bulk-action="format"><option value="">Cambiar formato…</option>${ctx.formats.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}</select>
        <button class="btn btn--secondary" data-action="bulk-archive">${icon('archive')} Archivar</button>
        <button class="btn btn--danger" data-action="bulk-delete">${icon('trash')} Eliminar</button>
        <button class="btn btn--ghost" data-action="clear-selection">Cancelar</button>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Vista Calendario (simple, basada en fecha objetivo)                 */
  /* ------------------------------------------------------------------ */

  function renderCalendarView(ctx) {
    const { calendarMonth, videos } = ctx; // calendarMonth: {year, month} month 0-based
    const first = new Date(calendarMonth.year, calendarMonth.month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
    const monthName = first.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const videosByDay = {};
    videos.forEach((v) => {
      if (!v.targetDate) return;
      const d = new Date(v.targetDate);
      if (d.getFullYear() === calendarMonth.year && d.getMonth() === calendarMonth.month) {
        const day = d.getDate();
        (videosByDay[day] = videosByDay[day] || []).push(v);
      }
    });

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell cal-cell--empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const items = videosByDay[d] || [];
      const isToday = new Date().toDateString() === new Date(calendarMonth.year, calendarMonth.month, d).toDateString();
      cells += `
        <div class="cal-cell ${isToday ? 'cal-cell--today' : ''}">
          <span class="cal-cell__num">${d}</span>
          <div class="cal-cell__items">
            ${items.slice(0, 3).map((v) => `<div class="cal-item" data-action="open-video" data-id="${v.id}" title="${escapeHtml(v.title)}">${escapeHtml(truncate(v.title, 18))}</div>`).join('')}
            ${items.length > 3 ? `<div class="cal-item cal-item--more">+${items.length - 3} más</div>` : ''}
          </div>
        </div>`;
    }

    return `
      <div class="cal-view">
        <div class="cal-header">
          <button class="icon-btn" data-action="cal-prev-month">${icon('chevronLeft')}</button>
          <h3>${monthName}</h3>
          <button class="icon-btn" data-action="cal-next-month">${icon('chevronRight')}</button>
          <button class="btn btn--ghost" data-action="cal-today">Hoy</button>
        </div>
        <div class="cal-grid cal-grid--labels">
          ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div class="cal-weekday">${d}</div>`).join('')}
        </div>
        <div class="cal-grid">${cells}</div>
        <p class="muted small">Vista simple basada en la fecha objetivo de cada video. Un calendario avanzado (grabaciones, entrevistas, recordatorios) llegará en una futura versión.</p>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Estados vacíos / módulos futuros                                    */
  /* ------------------------------------------------------------------ */

  /**
   * `action` admite dos formas: { route, label } (navega, como en Videos)
   * o { action, label, data } (dispara cualquier otro data-action, ej. abrir
   * el modal de "nuevo gasto"; `data` es un objeto de atributos extra
   * data-* opcionales).
   */
  function renderEmptyState({ title, message, action }) {
    let actionHtml = '';
    if (action && action.route) {
      actionHtml = `<button class="btn btn--primary" data-action="navigate" data-route="${action.route}">${escapeHtml(action.label)}</button>`;
    } else if (action && action.action) {
      const extraAttrs = Object.entries(action.data || {}).map(([k, v]) => ` data-${k}="${escapeHtml(String(v))}"`).join('');
      actionHtml = `<button class="btn btn--primary" data-action="${action.action}"${extraAttrs}>${escapeHtml(action.label)}</button>`;
    }
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${icon('video')}</div>
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(message || '')}</p>
        ${actionHtml}
      </div>`;
  }

  function renderTeam(ctx) {
    const currentEmployeeId = ctx.currentEmployee?.id || null;
    const employees = (ctx.employees || [])
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));

    const priorityById = Object.fromEntries(
      (ctx.priorities || []).map((priority) => [priority.id, priority])
    );

    const priorityRank = (video) => {
      const priority = priorityById[video.priorityId];
      if (!priority) return 0;

      const name = String(priority.name || '').trim().toLowerCase();
      if (name.includes('urgente')) return 5;
      if (name.includes('alta')) return 4;
      if (name.includes('media')) return 3;
      if (name.includes('baja')) return 2;

      return Number(priority.order || 1);
    };

    const cards = employees.map((employee) => {
      const videos = (ctx.videos || [])
        .filter((video) => video.ownerId === employee.id)
        .slice()
        .sort((a, b) => {
          const priorityDifference = priorityRank(b) - priorityRank(a);
          if (priorityDifference !== 0) return priorityDifference;

          return String(a.title || '').localeCompare(String(b.title || ''), 'es');
        });

      const assignedProjects = videos
        .slice(0, 4)
        .map((video) => {
          const priority = priorityById[video.priorityId];
          const priorityName = priority?.name || 'Sin prioridad';
          const priorityColor = priority?.color || '#737373';

          return `
            <button data-action="open-video" data-id="${video.id}" title="${escapeHtml(priorityName)}">
              <span
                class="pill pill--outline"
                style="--pill-color:${escapeHtml(priorityColor)};flex:0 0 auto"
              >${escapeHtml(priorityName)}</span>
              <span>${escapeHtml(video.title || 'Sin título')}</span>
            </button>`;
        })
        .join('');

      return `
        <article class="team-card">
          <div class="team-card__avatar">${escapeHtml((employee.name || '?').split(/\s+/).map((x) => x[0]).slice(0,2).join('').toUpperCase())}</div>
          <div class="team-card__body">
            <div class="team-card__heading">
              <div>
                <h3>${escapeHtml(employee.name)} ${employee.id === currentEmployeeId ? '<span class="account-link-badge">Tu cuenta</span>' : ''}</h3>
                <p class="muted">${escapeHtml(employee.role || 'Sin rol')}</p>
              </div>
              <span class="pill ${employee.active === false ? 'pill--outline' : ''}">${employee.active === false ? 'Inactivo' : 'Activo'}</span>
            </div>
            ${employee.email ? `<p class="small">${escapeHtml(employee.email)}</p>` : ''}
            ${employee.phone ? `<p class="small muted">${escapeHtml(employee.phone)}</p>` : ''}
            <p class="team-card__count"><strong>${videos.length}</strong> proyecto${videos.length === 1 ? '' : 's'} asignado${videos.length === 1 ? '' : 's'}</p>
            ${videos.length ? `<div class="team-card__projects">${assignedProjects}${videos.length > 4 ? `<span class="muted small">+${videos.length - 4} más</span>` : ''}</div>` : ''}
          </div>
          <div class="team-card__actions">
            <button class="icon-btn" data-action="edit-employee" data-id="${employee.id}" title="Editar">${icon('edit')}</button>
            <button class="icon-btn" data-action="delete-employee" data-id="${employee.id}" title="Eliminar">${icon('trash')}</button>
          </div>
        </article>`;
    }).join('');

    return `<div class="view team-view">
      <div class="page-heading"><div><h1>Equipo</h1><p class="muted">Administrá responsables y conectalos automáticamente con cada video.</p></div><button class="btn btn--primary" data-action="new-employee">${icon('plus')} Nuevo empleado</button></div>
      ${employees.length ? `<div class="team-grid">${cards}</div>` : renderEmptyState({ title: 'Todavía no hay empleados', message: 'Creá el primer integrante para asignarlo como responsable de tus videos.', action: { action: 'new-employee', label: 'Nuevo empleado' } })}
    </div>`;
  }

  function renderEmployeeModal(employee) {
    const editing = !!employee.id;
    return `<div class="modal__header"><h3>${editing ? 'Editar empleado' : 'Nuevo empleado'}</h3></div>
      <div class="modal__body"><div class="form-grid">
        <label class="field field--wide"><span>Nombre *</span><input id="employee-name" type="text" value="${escapeHtml(employee.name || '')}" autofocus /></label>
        <label class="field"><span>Rol</span><input id="employee-role" type="text" placeholder="Ej. Editor" value="${escapeHtml(employee.role || '')}" /></label>
        <label class="field"><span>Email</span><input id="employee-email" type="email" value="${escapeHtml(employee.email || '')}" /></label>
        <label class="field"><span>WhatsApp / teléfono</span><input id="employee-phone" type="text" value="${escapeHtml(employee.phone || '')}" /></label>
        <label class="field field--checkbox"><input id="employee-active" type="checkbox" ${employee.active === false ? '' : 'checked'} /><span>Empleado activo</span></label>
      </div></div>
      <div class="modal__footer"><button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button><button class="btn btn--primary" data-action="save-employee" data-id="${employee.id || ''}">${editing ? 'Guardar cambios' : 'Crear empleado'}</button></div>`;
  }

  function renderComingSoon(name, description) {
    return `
      <div class="coming-soon">
        <div class="coming-soon__badge">Próximamente</div>
        <h2>${escapeHtml(name)}</h2>
        <p class="muted">${escapeHtml(description)}</p>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Panel de edición de video                                           */
  /* ------------------------------------------------------------------ */

  const EDITOR_TABS = [
    { key: 'general', label: 'General' },
    { key: 'links', label: 'Enlaces de Drive' },
    { key: 'script', label: 'Guion y notas' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'tags', label: 'Etiquetas' },
    { key: 'files', label: 'Archivos' },
    { key: 'library', label: 'Biblioteca' },
    { key: 'history', label: 'Historial' },
    { key: 'comments', label: 'Comentarios' },
  ];

  function renderVideoEditor(video, ctx) {
    const activeTab = ctx.editorTab || 'general';
    return `
      <div class="editor-overlay" data-action="close-editor-overlay">
        <div class="editor-panel" data-stop-propagation="true">
          <div class="editor-panel__header">
            <input type="text" class="editor-title-input" id="editor-title" placeholder="Título del video…" value="${escapeHtml(video.title || '')}" />
            <div class="editor-panel__header-actions">
              <button class="icon-btn" data-action="toggle-favorite" data-id="${video.id}" title="Favorito">${icon(video.favorite ? 'starFill' : 'star', video.favorite ? 'text-accent' : '')}</button>
              <button class="icon-btn" data-action="duplicate-video" data-id="${video.id}" title="Duplicar">${icon('copy')}</button>
              <button class="icon-btn" data-action="archive-video" data-id="${video.id}" title="Archivar">${icon('archive')}</button>
              <button class="icon-btn" data-action="delete-video" data-id="${video.id}" title="Eliminar">${icon('trash')}</button>
              <button class="icon-btn" data-action="close-editor" title="Cerrar (Esc)">${icon('close')}</button>
            </div>
          </div>
          <div class="editor-panel__tabs">
            ${EDITOR_TABS.map((t) => `<button class="editor-tab ${activeTab === t.key ? 'editor-tab--active' : ''}" data-action="editor-tab" data-tab="${t.key}">${t.label}</button>`).join('')}
          </div>
          <div class="editor-panel__body" id="editor-body">
            ${renderEditorTab(activeTab, video, ctx)}
          </div>
        </div>
      </div>`;
  }

  function renderEditorTab(tab, video, ctx) {
    switch (tab) {
      case 'general':
        return renderEditorGeneral(video, ctx);
      case 'links':
        return renderEditorLinks(video, ctx);
      case 'script':
        return renderEditorScript(video, ctx);
      case 'checklist':
        return renderEditorChecklist(video, ctx);
      case 'tags':
        return renderEditorTags(video, ctx);
      case 'files':
        return renderEditorFiles(video, ctx);
      case 'library':
        return renderEditorLibraryTab(video, ctx);
      case 'history':
        return renderEditorHistory(video, ctx);
      case 'comments':
        return renderEditorComments(video, ctx);
      default:
        return '';
    }
  }

  function selectOptions(list, selectedId, allowEmpty = 'Sin asignar') {
    return `<option value="">${allowEmpty}</option>` + list
      .filter((x) => !x.archived)
      .map((x) => `<option value="${x.id}" ${x.id === selectedId ? 'selected' : ''}>${escapeHtml(x.name)}</option>`)
      .join('');
  }

  function employeeOptions(employees, selectedId, legacyOwner) {
    const selectedExists = employees.some((employee) => employee.id === selectedId);
    const options = employees
      .filter((employee) => employee.active !== false || employee.id === selectedId)
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map((employee) => `<option value="${employee.id}" ${employee.id === selectedId ? 'selected' : ''}>${escapeHtml(employee.name || 'Sin nombre')}${employee.active === false ? ' (inactivo)' : ''}</option>`)
      .join('');
    const legacy = !selectedExists && legacyOwner
      ? `<option value="" selected>${escapeHtml(legacyOwner)} (sin vincular)</option>`
      : `<option value="" ${selectedId ? '' : 'selected'}>Sin responsable</option>`;
    return legacy + options;
  }

  function renderEditorGeneral(video, ctx) {
    return `
      <div class="editor-form">
        <div class="form-grid">
          <label class="field field--wide">
            <span>Título alternativo</span>
            <input type="text" data-field="altTitle" value="${escapeHtml(video.altTitle || '')}" />
          </label>
          <label class="field field--wide">
            <span>Descripción breve</span>
            <textarea data-field="description" rows="2">${escapeHtml(video.description || '')}</textarea>
          </label>

          <label class="field">
            <span>Estado</span>
            <select data-field="stateId">${selectOptions(ctx.states, video.stateId, 'Sin estado')}</select>
          </label>
          <label class="field">
            <span>Prioridad</span>
            <select data-field="priorityId">${selectOptions(ctx.priorities, video.priorityId, 'Sin prioridad')}</select>
          </label>
          <label class="field">
            <span>Serie</span>
            <select data-field="seriesId">${selectOptions(ctx.series, video.seriesId)}</select>
          </label>
          <label class="field">
            <span>Formato</span>
            <select data-field="formatId">${selectOptions(ctx.formats, video.formatId)}</select>
          </label>
          <label class="field">
            <span>Tipo de contenido</span>
            <select data-field="contentTypeId">${selectOptions(ctx.contentTypes, video.contentTypeId)}</select>
          </label>
          <label class="field">
            <span>Responsable del proyecto</span>
            <select data-field="ownerId">${employeeOptions(ctx.employees || [], video.ownerId, video.owner)}</select>
          </label>

          <label class="field">
            <span>Fecha objetivo</span>
            <input type="date" data-field="targetDate" value="${video.targetDate || ''}" />
          </label>
          <label class="field">
            <span>Fecha de publicación</span>
            <input type="date" data-field="publishDate" value="${video.publishDate || ''}" />
          </label>
          <label class="field">
            <span>Duración estimada</span>
            <input type="text" data-field="estimatedDuration" placeholder="ej. 10 min" value="${escapeHtml(video.estimatedDuration || '')}" />
          </label>
          <label class="field">
            <span>Duración final</span>
            <input type="text" data-field="finalDuration" placeholder="ej. 12:34" value="${escapeHtml(video.finalDuration || '')}" />
          </label>

          <label class="field field--checkbox">
            <input type="checkbox" data-field="archived" ${video.archived ? 'checked' : ''} />
            <span>Archivado</span>
          </label>
          <label class="field field--checkbox">
            <input type="checkbox" data-field="favorite" ${video.favorite ? 'checked' : ''} />
            <span>Favorito</span>
          </label>
        </div>
        ${ctx.expenses ? renderProjectCostsBox(ctx, video) : ''}
      </div>`;
  }

  function driveField(key, def, video) {
    const link = (video.driveLinks && video.driveLinks[key]) || { url: '', label: def.label };
    return `
      <div class="drive-field" data-drive-key="${key}">
        <div class="drive-field__label">${escapeHtml(def.label)}</div>
        <div class="drive-field__input">
          ${link.url ? `<span class="drive-field__icon">${linkIcon(link.url)}</span>` : ''}
          <input type="text" data-drive-url="${key}" placeholder="Pegar enlace de Drive / Docs / YouTube…" value="${escapeHtml(link.url || '')}" />
        </div>
        <div class="drive-field__actions">
          <button class="icon-btn icon-btn--sm" data-action="open-link" data-url="${escapeHtml(link.url || '')}" title="Abrir" ${!link.url ? 'disabled' : ''}>${icon('external')}</button>
          <button class="icon-btn icon-btn--sm" data-action="copy-link" data-url="${escapeHtml(link.url || '')}" title="Copiar" ${!link.url ? 'disabled' : ''}>${icon('copy')}</button>
          <button class="icon-btn icon-btn--sm" data-action="clear-drive-link" data-key="${key}" title="Eliminar" ${!link.url ? 'disabled' : ''}>${icon('trash')}</button>
        </div>
      </div>`;
  }

  function renderEditorLinks(video, ctx) {
    const slots = {
      mainFolder: { label: 'Carpeta principal' },
      script: { label: 'Guion' },
      premiere: { label: 'Proyecto de Premiere' },
      raw: { label: 'Brutos' },
      inserts: { label: 'Inserts' },
      thumbnail: { label: 'Miniatura' },
      finalExport: { label: 'Exportación final' },
      published: { label: 'Video publicado' },
    };
    const additional = video.additionalLinks || [];
    return `
      <div class="editor-form">
        <h4>Enlaces principales</h4>
        <div class="drive-fields">
          ${Object.entries(slots).map(([key, def]) => driveField(key, def, video)).join('')}
        </div>
        <h4>Enlaces adicionales</h4>
        <div class="additional-links" id="additional-links">
          ${additional.map((l) => `
            <div class="drive-field" data-link-id="${l.id}">
              <div class="drive-field__input">
                <input type="text" data-additional-label="${l.id}" placeholder="Etiqueta (ej. Fuente, Artículo)" value="${escapeHtml(l.label || '')}" style="max-width:160px" />
                ${l.url ? `<span class="drive-field__icon">${linkIcon(l.url)}</span>` : ''}
                <input type="text" data-additional-url="${l.id}" placeholder="https://…" value="${escapeHtml(l.url || '')}" />
              </div>
              <div class="drive-field__actions">
                <button class="icon-btn icon-btn--sm" data-action="open-link" data-url="${escapeHtml(l.url || '')}" title="Abrir" ${!l.url ? 'disabled' : ''}>${icon('external')}</button>
                <button class="icon-btn icon-btn--sm" data-action="copy-link" data-url="${escapeHtml(l.url || '')}" title="Copiar" ${!l.url ? 'disabled' : ''}>${icon('copy')}</button>
                <button class="icon-btn icon-btn--sm" data-action="remove-additional-link" data-id="${l.id}" title="Eliminar">${icon('trash')}</button>
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn--ghost" data-action="add-additional-link">${icon('plus')} Agregar enlace</button>
      </div>`;
  }

  function textAreaField(key, label, value, opts = {}) {
    return `
      <div class="field field--wide textarea-field">
        <div class="textarea-field__header">
          <span>${escapeHtml(label)}</span>
          <button class="icon-btn icon-btn--sm" data-action="copy-field" data-field="${key}" title="Copiar contenido">${icon('copy')}</button>
        </div>
        <textarea data-field="${key}" rows="${opts.rows || 4}" placeholder="${escapeHtml(opts.placeholder || '')}">${escapeHtml(value || '')}</textarea>
      </div>`;
  }

  function renderEditorScript(video, ctx) {
    return `
      <div class="editor-form">
        ${textAreaField('idea', 'Idea principal', video.idea, { rows: 2 })}
        ${textAreaField('hook', 'Gancho inicial', video.hook, { rows: 2 })}
        ${textAreaField('script', 'Guion', video.script, { rows: 8 })}
        ${textAreaField('researchNotes', 'Notas de investigación', video.researchNotes, { rows: 4 })}
        ${textAreaField('editNotes', 'Notas de edición', video.editNotes, { rows: 4 })}
        ${textAreaField('thumbnailNotes', 'Notas para miniatura', video.thumbnailNotes, { rows: 3 })}
        ${textAreaField('descriptionText', 'Texto para descripción', video.descriptionText, { rows: 4 })}
        ${textAreaField('titleIdeas', 'Ideas de títulos', video.titleIdeas, { rows: 3 })}
        ${textAreaField('thumbnailIdeas', 'Ideas de miniatura', video.thumbnailIdeas, { rows: 3 })}
      </div>`;
  }

  function renderChecklistItem(item, depth, index, total, parentId) {
    const parentAttr = parentId || '';
    return `
      <div class="checklist-item" data-item-id="${item.id}" style="margin-left:${depth * 20}px">
        <div class="checklist-item__row">
          <span class="checklist-item__reorder">
            <button class="icon-btn icon-btn--sm" data-action="move-checklist-item" data-id="${item.id}" data-parent="${parentAttr}" data-dir="up" ${index === 0 ? 'disabled' : ''} title="Subir">▲</button>
            <button class="icon-btn icon-btn--sm" data-action="move-checklist-item" data-id="${item.id}" data-parent="${parentAttr}" data-dir="down" ${index === total - 1 ? 'disabled' : ''} title="Bajar">▼</button>
          </span>
          <input type="checkbox" data-action="toggle-checklist-item" data-id="${item.id}" ${item.done ? 'checked' : ''} />
          <input type="text" class="checklist-item__text ${item.done ? 'checklist-item__text--done' : ''}" data-checklist-text="${item.id}" value="${escapeHtml(item.text)}" />
          ${depth === 0 ? `<button class="icon-btn icon-btn--sm" data-action="add-subtask" data-id="${item.id}" title="Agregar subtarea">${icon('plus')}</button>` : ''}
          <button class="icon-btn icon-btn--sm" data-action="remove-checklist-item" data-id="${item.id}" title="Eliminar">${icon('trash')}</button>
        </div>
        ${(item.subtasks || []).map((s, i) => renderChecklistItem(s, depth + 1, i, item.subtasks.length, item.id)).join('')}
      </div>`;
  }

  function renderEditorChecklist(video, ctx) {
    const progress = checklistProgress(video.checklist);
    return `
      <div class="editor-form">
        <div class="checklist-header">
          <div class="checklist-header__progress">
            ${progressBar(progress.pct)}
            <span class="small muted">${progress.done}/${progress.total} completadas (${Math.round(progress.pct)}%)</span>
          </div>
          <select id="apply-template-select">
            <option value="">Aplicar plantilla…</option>
            ${ctx.templates.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
          </select>
        </div>
        <div class="checklist-list" id="checklist-list">
          ${(video.checklist || []).map((item, i) => renderChecklistItem(item, 0, i, video.checklist.length, null)).join('') || '<p class="muted small">Sin tareas todavía.</p>'}
        </div>
        <button class="btn btn--ghost" data-action="add-checklist-item">${icon('plus')} Agregar tarea</button>
      </div>`;
  }

  function renderEditorTags(video, ctx) {
    const selected = video.tagIds || [];
    return `
      <div class="editor-form">
        <p class="muted small">Hacé clic para agregar o quitar etiquetas. Podés crear nuevas desde Configuración → Etiquetas.</p>
        <div class="tag-choices">
          ${ctx.tags.map((t) => `<button class="tag-choice ${selected.includes(t.id) ? 'tag-choice--active' : ''}" style="--tag-color:${t.color}" data-action="toggle-video-tag" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join('') || '<span class="muted">No hay etiquetas creadas todavía.</span>'}
        </div>
        <div class="quick-add-tag">
          <input type="text" id="quick-tag-input" placeholder="Crear y agregar nueva etiqueta…" />
          <button class="btn btn--secondary" data-action="quick-add-tag">${icon('plus')} Crear</button>
        </div>
      </div>`;
  }

  function renderEditorFiles(video, ctx) {
    const images = video.images || [];
    return `
      <div class="editor-form">
        <h4>Miniatura</h4>
        <div class="thumb-upload">
          ${video.thumbnail ? `<img src="${video.thumbnail}" class="thumb-preview" />` : `<div class="thumb-preview thumb-preview--empty">${icon('image')}</div>`}
          <div class="thumb-upload__actions">
            <label class="btn btn--secondary">
              ${icon('upload')} Subir imagen
              <input type="file" accept="image/*" id="thumbnail-input" hidden />
            </label>
            ${video.thumbnail ? `<button class="btn btn--ghost" data-action="remove-thumbnail">Quitar</button>` : ''}
          </div>
        </div>

        <h4>Imágenes de referencia / capturas</h4>
        <p class="muted small">Límite recomendado configurado: ${ctx.settings.fileSizeLimitMB} MB por archivo. Si es más pesado, se recomienda guardar solo un enlace de Drive.</p>
        <div class="file-grid" id="file-grid">
          ${images.map((img) => `
            <div class="file-item" data-file-id="${img.id}">
              <img src="${img.dataUrl}" />
              <div class="file-item__meta">
                <span class="small">${escapeHtml(img.name)}</span>
                <span class="small muted">${formatBytes(img.size)}</span>
              </div>
              <button class="icon-btn icon-btn--sm file-item__remove" data-action="remove-image" data-id="${img.id}">${icon('trash')}</button>
            </div>`).join('')}
        </div>
        <label class="btn btn--secondary">
          ${icon('upload')} Subir imagen local
          <input type="file" accept="image/*" id="image-input" multiple hidden />
        </label>
      </div>`;
  }

  /**
   * Pestaña "Biblioteca" dentro de la ficha de video: muestra los recursos
   * de la Biblioteca que tienen a este video en su `linkedVideoIds`. La
   * relación se guarda únicamente por ID en el recurso (no se duplica
   * ningún archivo), así que esta pestaña simplemente filtra la colección
   * completa de recursos.
   */
  function renderEditorLibraryTab(video, ctx) {
    const linked = (ctx.libraryItems || []).filter((it) => (it.linkedVideoIds || []).includes(video.id) && !it.archived);
    return `
      <div class="editor-form">
        <div class="library-tab-header">
          <p class="muted small">Recursos de la Biblioteca asociados a este video. La relación es solo por referencia: no se duplica ningún archivo.</p>
          <div class="settings-actions-row">
            <button class="btn btn--secondary" data-action="open-link-library-picker" data-id="${video.id}">${icon('link')} Agregar desde Biblioteca</button>
            <button class="btn btn--ghost" data-action="create-library-item-for-video" data-id="${video.id}">${icon('plus')} Crear recurso nuevo</button>
          </div>
        </div>
        <div class="library-linked-grid">
          ${linked.length ? linked.map((it) => renderLibraryItemCard(it, ctx, { compact: true, unlinkVideoId: video.id })).join('') : '<p class="muted small">Todavía no hay recursos asociados a este video.</p>'}
        </div>
      </div>`;
  }

  function renderEditorHistory(video, ctx) {
    const history = (video.history || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
      <div class="editor-form">
        <div class="history-list">
          ${history.length ? history.map((h) => `
            <div class="history-item">
              <span class="history-item__dot"></span>
              <div>
                <p>${escapeHtml(h.message)}</p>
                <span class="small muted">${formatDateTime(h.date)}</span>
              </div>
            </div>`).join('') : '<p class="muted small">Sin actividad registrada todavía.</p>'}
        </div>
      </div>`;
  }

  function renderEditorComments(video, ctx) {
    const comments = (video.comments || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
      <div class="editor-form">
        <div class="comment-input">
          <textarea id="new-comment-text" rows="2" placeholder="Escribir un comentario o nota rápida…"></textarea>
          <button class="btn btn--primary" data-action="add-comment">Agregar</button>
        </div>
        <div class="comment-list">
          ${comments.length ? comments.map((c) => `
            <div class="comment-item">
              <p>${escapeHtml(c.text)}</p>
              <span class="small muted">${formatDateTime(c.date)}</span>
              <button class="icon-btn icon-btn--sm comment-item__remove" data-action="remove-comment" data-id="${c.id}">${icon('trash')}</button>
            </div>`).join('') : '<p class="muted small">Sin comentarios todavía.</p>'}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Configuración: estructura general                                   */
  /* ------------------------------------------------------------------ */

  const SETTINGS_SECTIONS = [
    { key: 'identity', label: 'Identidad visual' },
    { key: 'series', label: 'Series' },
    { key: 'formats', label: 'Formatos' },
    { key: 'contentTypes', label: 'Tipos de contenido' },
    { key: 'states', label: 'Estados' },
    { key: 'priorities', label: 'Prioridades' },
    { key: 'tags', label: 'Etiquetas' },
    { key: 'templates', label: 'Plantillas de checklist' },
    { key: 'library', label: 'Biblioteca' },
    { key: 'preferences', label: 'Preferencias' },
    { key: 'backup', label: 'Datos y respaldo' },
  ];

  function renderSettingsShell(section, bodyHtml) {
    return `
      <div class="view view--settings">
        <div class="settings-layout">
          <nav class="settings-nav">
            ${SETTINGS_SECTIONS.map((s) => `
              <button class="settings-nav__item ${section === s.key ? 'settings-nav__item--active' : ''}" data-action="settings-section" data-section="${s.key}">
                ${escapeHtml(s.label)}
              </button>`).join('')}
          </nav>
          <div class="settings-body">${bodyHtml}</div>
        </div>
      </div>`;
  }

  function settingsSectionHeader(title, subtitle) {
    return `<div class="settings-section-header"><h2>${escapeHtml(title)}</h2>${subtitle ? `<p class="muted">${escapeHtml(subtitle)}</p>` : ''}</div>`;
  }

  /* ---- Identidad visual ---- */
  function renderIdentitySettings(ctx) {
    const { settings, logo } = ctx;
    return `
      <div>
        ${settingsSectionHeader('Identidad visual', 'Personalizá el logo, el nombre y la apariencia de la aplicación.')}
        <div class="settings-card">
          <h4>Logo</h4>
          <div class="logo-editor">
            <div class="logo-editor__preview">
              ${logo ? `<img src="${logo}" />` : `<div class="brand__logo brand__logo--placeholder brand__logo--big">FXL</div>`}
            </div>
            <div class="logo-editor__actions">
              <label class="btn btn--secondary">${icon('upload')} Subir logo<input type="file" accept="image/*" id="logo-input" hidden /></label>
              ${logo ? `<button class="btn btn--ghost" data-action="remove-logo">Eliminar logo</button>` : ''}
            </div>
          </div>
          <div class="form-grid" style="margin-top:16px">
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="showLogoInSidebar" ${settings.showLogoInSidebar ? 'checked' : ''} />
              <span>Mostrar logo en la barra lateral</span>
            </label>
            <label class="field">
              <span>Mostrar en la barra lateral</span>
              <select data-setting="logoDisplay">
                <option value="both" ${settings.logoDisplay === 'both' ? 'selected' : ''}>Logo y nombre</option>
                <option value="logo" ${settings.logoDisplay === 'logo' ? 'selected' : ''}>Solo logo</option>
                <option value="name" ${settings.logoDisplay === 'name' ? 'selected' : ''}>Solo nombre</option>
              </select>
            </label>
          </div>
        </div>

        <div class="settings-card">
          <h4>Nombre de la aplicación</h4>
          <div class="form-grid">
            <label class="field field--wide">
              <span>Nombre visible</span>
              <input type="text" data-setting="appName" value="${escapeHtml(settings.appName || '')}" />
            </label>
          </div>
          <button class="btn btn--ghost" data-action="reset-app-name">Restaurar nombre predeterminado</button>
        </div>

        <div class="settings-card">
          <h4>Apariencia</h4>
          <div class="form-grid">
            <label class="field">
              <span>Tema</span>
              <select data-setting="theme">
                <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Oscuro</option>
                <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Claro</option>
              </select>
            </label>
            <label class="field">
              <span>Color de acento</span>
              <input type="color" data-setting="accentColor" value="${settings.accentColor || '#3b82f6'}" />
            </label>
          </div>
        </div>
      </div>`;
  }

  /* ---- Filas genéricas reutilizables para catálogos simples ---- */

  function entityUsageWarning(count, label) {
    return count > 0 ? `<span class="small muted">${count} video(s)</span>` : `<span class="small muted">Sin uso</span>`;
  }

  function reorderButtons(entity, id, isFirst, isLast) {
    return `
      <button class="icon-btn icon-btn--sm" data-action="move-entity" data-entity="${entity}" data-id="${id}" data-dir="up" ${isFirst ? 'disabled' : ''} title="Subir">▲</button>
      <button class="icon-btn icon-btn--sm" data-action="move-entity" data-entity="${entity}" data-id="${id}" data-dir="down" ${isLast ? 'disabled' : ''} title="Bajar">▼</button>`;
  }

  /* ---- Series ---- */
  function renderSeriesSettings(ctx) {
    const items = ctx.series.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Series', 'Creá y administrá las series de tu canal. Los videos se asocian por ID, así que podés renombrarlas sin perder la relación.')}
        <div class="entity-list">
          ${items.map((s, i) => {
            const count = ctx.videos.filter((v) => v.seriesId === s.id).length;
            return `
            <div class="entity-row ${s.archived ? 'entity-row--archived' : ''}" data-id="${s.id}">
              <div class="entity-row__reorder">${reorderButtons('series', s.id, i === 0, i === items.length - 1)}</div>
              <input type="color" data-entity="series" data-id="${s.id}" data-field="color" value="${s.color || '#a3a3a3'}" title="Color" />
              <input type="text" class="entity-row__icon" data-entity="series" data-id="${s.id}" data-field="icon" value="${escapeHtml(s.icon || '')}" maxlength="2" />
              <input type="text" class="entity-row__name" data-entity="series" data-id="${s.id}" data-field="name" value="${escapeHtml(s.name)}" />
              <input type="text" class="entity-row__desc" data-entity="series" data-id="${s.id}" data-field="description" placeholder="Descripción" value="${escapeHtml(s.description || '')}" />
              <select data-entity="series" data-id="${s.id}" data-field="defaultFormatId">
                <option value="">Formato predet.</option>
                ${ctx.formats.map((f) => `<option value="${f.id}" ${s.defaultFormatId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
              </select>
              <select data-entity="series" data-id="${s.id}" data-field="defaultChecklistTemplateId">
                <option value="">Checklist predet.</option>
                ${ctx.templates.map((t) => `<option value="${t.id}" ${s.defaultChecklistTemplateId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
              </select>
              ${entityUsageWarning(count)}
              <label class="switch" title="Archivada">
                <input type="checkbox" data-entity="series" data-id="${s.id}" data-field="archived" ${s.archived ? 'checked' : ''} />
                <span>Archivada</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-entity" data-entity="series" data-id="${s.id}" title="Eliminar">${icon('trash')}</button>
            </div>`;
          }).join('') || '<p class="muted">Todavía no hay series creadas.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-entity" data-entity="series">${icon('plus')} Nueva serie</button>
      </div>`;
  }

  /* ---- Formatos ---- */
  function renderFormatsSettings(ctx) {
    const items = ctx.formats.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Formatos', 'Definí los formatos de video (relación de aspecto, duración orientativa, notas de exportación).')}
        <div class="entity-list">
          ${items.map((f, i) => {
            const count = ctx.videos.filter((v) => v.formatId === f.id).length;
            return `
            <div class="entity-row ${f.archived ? 'entity-row--archived' : ''}" data-id="${f.id}">
              <div class="entity-row__reorder">${reorderButtons('formats', f.id, i === 0, i === items.length - 1)}</div>
              <input type="color" data-entity="formats" data-id="${f.id}" data-field="color" value="${f.color || '#a3a3a3'}" />
              <input type="text" class="entity-row__icon" data-entity="formats" data-id="${f.id}" data-field="icon" value="${escapeHtml(f.icon || '')}" maxlength="2" />
              <input type="text" class="entity-row__name" data-entity="formats" data-id="${f.id}" data-field="name" value="${escapeHtml(f.name)}" />
              <input type="text" style="max-width:80px" data-entity="formats" data-id="${f.id}" data-field="aspectRatio" placeholder="16:9" value="${escapeHtml(f.aspectRatio || '')}" />
              <input type="text" style="max-width:120px" data-entity="formats" data-id="${f.id}" data-field="durationHint" placeholder="Duración" value="${escapeHtml(f.durationHint || '')}" />
              <input type="text" style="max-width:140px" data-entity="formats" data-id="${f.id}" data-field="exportNotes" placeholder="Notas de exportación" value="${escapeHtml(f.exportNotes || '')}" />
              <select data-entity="formats" data-id="${f.id}" data-field="defaultChecklistTemplateId">
                <option value="">Checklist predet.</option>
                ${ctx.templates.map((t) => `<option value="${t.id}" ${f.defaultChecklistTemplateId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
              </select>
              ${entityUsageWarning(count)}
              <label class="switch" title="Archivado">
                <input type="checkbox" data-entity="formats" data-id="${f.id}" data-field="archived" ${f.archived ? 'checked' : ''} />
                <span>Archivado</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-entity" data-entity="formats" data-id="${f.id}" title="Eliminar">${icon('trash')}</button>
            </div>`;
          }).join('') || '<p class="muted">Todavía no hay formatos creados.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-entity" data-entity="formats">${icon('plus')} Nuevo formato</button>
      </div>`;
  }

  /* ---- Tipos de contenido ---- */
  function renderContentTypesSettings(ctx) {
    const items = ctx.contentTypes.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Tipos de contenido', 'Categorías como Análisis, Historia, Entrevista, etc.')}
        <div class="entity-list">
          ${items.map((c, i) => {
            const count = ctx.videos.filter((v) => v.contentTypeId === c.id).length;
            return `
            <div class="entity-row ${c.archived ? 'entity-row--archived' : ''}" data-id="${c.id}">
              <div class="entity-row__reorder">${reorderButtons('contentTypes', c.id, i === 0, i === items.length - 1)}</div>
              <input type="color" data-entity="contentTypes" data-id="${c.id}" data-field="color" value="${c.color || '#a3a3a3'}" />
              <input type="text" class="entity-row__icon" data-entity="contentTypes" data-id="${c.id}" data-field="icon" value="${escapeHtml(c.icon || '')}" maxlength="2" />
              <input type="text" class="entity-row__name" data-entity="contentTypes" data-id="${c.id}" data-field="name" value="${escapeHtml(c.name)}" />
              ${entityUsageWarning(count)}
              <label class="switch" title="Archivado">
                <input type="checkbox" data-entity="contentTypes" data-id="${c.id}" data-field="archived" ${c.archived ? 'checked' : ''} />
                <span>Archivado</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-entity" data-entity="contentTypes" data-id="${c.id}" title="Eliminar">${icon('trash')}</button>
            </div>`;
          }).join('') || '<p class="muted">Todavía no hay tipos de contenido.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-entity" data-entity="contentTypes">${icon('plus')} Nuevo tipo</button>
      </div>`;
  }

  /* ---- Estados (columnas del Kanban) ---- */
  function renderStatesSettings(ctx) {
    const items = ctx.states.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Estados', 'Definen dinámicamente las columnas del tablero Kanban. Marcá un estado como inicial o final, y elegí si se muestra en el tablero.')}
        <div class="entity-list">
          ${items.map((s, i) => {
            const count = ctx.videos.filter((v) => v.stateId === s.id).length;
            return `
            <div class="entity-row ${s.archived ? 'entity-row--archived' : ''}" data-id="${s.id}">
              <div class="entity-row__reorder">${reorderButtons('states', s.id, i === 0, i === items.length - 1)}</div>
              <input type="color" data-entity="states" data-id="${s.id}" data-field="color" value="${s.color || '#a3a3a3'}" />
              <input type="text" class="entity-row__icon" data-entity="states" data-id="${s.id}" data-field="icon" value="${escapeHtml(s.icon || '')}" maxlength="2" />
              <input type="text" class="entity-row__name" data-entity="states" data-id="${s.id}" data-field="name" value="${escapeHtml(s.name)}" />
              <label class="switch"><input type="checkbox" data-entity="states" data-id="${s.id}" data-field="isInitial" ${s.isInitial ? 'checked' : ''} /><span>Inicial</span></label>
              <label class="switch"><input type="checkbox" data-entity="states" data-id="${s.id}" data-field="isFinal" ${s.isFinal ? 'checked' : ''} /><span>Final</span></label>
              <label class="switch"><input type="checkbox" data-entity="states" data-id="${s.id}" data-field="showInKanban" ${s.showInKanban ? 'checked' : ''} /><span>En Kanban</span></label>
              ${entityUsageWarning(count)}
              <label class="switch" title="Archivado">
                <input type="checkbox" data-entity="states" data-id="${s.id}" data-field="archived" ${s.archived ? 'checked' : ''} />
                <span>Archivado</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-entity" data-entity="states" data-id="${s.id}" title="Eliminar">${icon('trash')}</button>
            </div>`;
          }).join('') || '<p class="muted">Todavía no hay estados creados.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-entity" data-entity="states">${icon('plus')} Nuevo estado</button>
      </div>`;
  }

  /* ---- Prioridades ---- */
  function renderPrioritiesSettings(ctx) {
    const items = ctx.priorities.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Prioridades', 'Escala de prioridad para tus videos.')}
        <div class="entity-list">
          ${items.map((p, i) => {
            const count = ctx.videos.filter((v) => v.priorityId === p.id).length;
            return `
            <div class="entity-row" data-id="${p.id}">
              <div class="entity-row__reorder">${reorderButtons('priorities', p.id, i === 0, i === items.length - 1)}</div>
              <input type="color" data-entity="priorities" data-id="${p.id}" data-field="color" value="${p.color || '#a3a3a3'}" />
              <input type="text" class="entity-row__name" data-entity="priorities" data-id="${p.id}" data-field="name" value="${escapeHtml(p.name)}" />
              ${entityUsageWarning(count)}
              <button class="icon-btn icon-btn--sm" data-action="delete-entity" data-entity="priorities" data-id="${p.id}" title="Eliminar">${icon('trash')}</button>
            </div>`;
          }).join('') || '<p class="muted">Todavía no hay prioridades.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-entity" data-entity="priorities">${icon('plus')} Nueva prioridad</button>
      </div>`;
  }

  /* ---- Etiquetas ---- */
  function renderTagsSettings(ctx) {
    const items = ctx.tags;
    return `
      <div>
        ${settingsSectionHeader('Etiquetas', 'Etiquetas libres para clasificar videos por tema, jugador, torneo, etc.')}
        <div class="entity-list">
          ${items.map((t) => {
            const count = ctx.videos.filter((v) => (v.tagIds || []).includes(t.id)).length;
            return `
            <div class="entity-row" data-id="${t.id}">
              <input type="checkbox" class="tag-merge-check" data-action="select-tag-merge" data-id="${t.id}" title="Seleccionar para fusionar" />
              <input type="color" data-entity="tags" data-id="${t.id}" data-field="color" value="${t.color || '#a3a3a3'}" />
              <input type="text" class="entity-row__name" data-entity="tags" data-id="${t.id}" data-field="name" value="${escapeHtml(t.name)}" />
              ${entityUsageWarning(count)}
              <button class="icon-btn icon-btn--sm" data-action="delete-entity" data-entity="tags" data-id="${t.id}" title="Eliminar">${icon('trash')}</button>
            </div>`;
          }).join('') || '<p class="muted">Todavía no hay etiquetas.</p>'}
        </div>
        <div class="settings-actions-row">
          <button class="btn btn--secondary" data-action="add-entity" data-entity="tags">${icon('plus')} Nueva etiqueta</button>
          <button class="btn btn--ghost" data-action="merge-selected-tags">Fusionar seleccionadas</button>
        </div>
        <p class="muted small">Marcá el checkbox de dos o más etiquetas y presioná "Fusionar seleccionadas" para combinarlas en una sola (se conserva la primera).</p>
      </div>`;
  }

  /* ---- Plantillas de checklist ---- */
  function renderTemplatesSettings(ctx) {
    const items = ctx.templates;
    return `
      <div>
        ${settingsSectionHeader('Plantillas de checklist', 'Creá listas de tareas reutilizables y asocialas a formatos o series.')}
        <div class="template-list">
          ${items.map((t) => `
            <div class="template-card" data-id="${t.id}">
              <div class="template-card__header">
                <input type="text" data-entity="checklistTemplates" data-id="${t.id}" data-field="name" value="${escapeHtml(t.name)}" />
                <button class="icon-btn icon-btn--sm" data-action="duplicate-template" data-id="${t.id}" title="Duplicar">${icon('copy')}</button>
                <button class="icon-btn icon-btn--sm" data-action="delete-entity" data-entity="checklistTemplates" data-id="${t.id}" title="Eliminar">${icon('trash')}</button>
              </div>
              <div class="template-card__items">
                ${(t.items || []).map((item) => `
                  <div class="template-item-row" data-item-id="${item.id}">
                    <input type="text" data-template-item="${item.id}" value="${escapeHtml(item.text)}" />
                    <button class="icon-btn icon-btn--sm" data-action="remove-template-item" data-template="${t.id}" data-item="${item.id}">${icon('trash')}</button>
                  </div>`).join('') || '<p class="muted small">Sin tareas.</p>'}
              </div>
              <button class="btn btn--ghost btn--sm" data-action="add-template-item" data-template="${t.id}">${icon('plus')} Agregar tarea</button>
              <div class="template-card__assoc">
                <span class="small muted">Asociar a formatos:</span>
                <div class="tag-choices">
                  ${ctx.formats.map((f) => `<button class="tag-choice ${((t.linkedFormatIds || []).includes(f.id)) ? 'tag-choice--active' : ''}" data-action="toggle-template-format" data-template="${t.id}" data-id="${f.id}">${escapeHtml(f.name)}</button>`).join('')}
                </div>
                <span class="small muted">Asociar a series:</span>
                <div class="tag-choices">
                  ${ctx.series.map((s) => `<button class="tag-choice ${((t.linkedSeriesIds || []).includes(s.id)) ? 'tag-choice--active' : ''}" data-action="toggle-template-series" data-template="${t.id}" data-id="${s.id}">${escapeHtml(s.name)}</button>`).join('')}
                </div>
              </div>
            </div>`).join('') || '<p class="muted">Todavía no hay plantillas.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-entity" data-entity="checklistTemplates">${icon('plus')} Nueva plantilla</button>
      </div>`;
  }

  /* ---- Biblioteca (preferencias del módulo) ---- */
  function renderLibrarySettings(ctx) {
    const { settings, libraryFolders } = ctx;
    // Lista plana de todas las carpetas no archivadas (de cualquier nivel), para elegir cualquiera como destino predeterminado.
    const rootFolders = (libraryFolders || []).filter((f) => !f.archived).sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div>
        ${settingsSectionHeader('Biblioteca', 'Preferencias del explorador de recursos: carpetas, archivos y enlaces.')}
        <div class="settings-card">
          <div class="form-grid">
            <label class="field">
              <span>Vista predeterminada</span>
              <select data-setting="libraryDefaultView">
                <option value="grid" ${settings.libraryDefaultView === 'grid' ? 'selected' : ''}>Cuadrícula</option>
                <option value="list" ${settings.libraryDefaultView === 'list' ? 'selected' : ''}>Lista</option>
              </select>
            </label>
            <label class="field">
              <span>Tamaño de tarjetas</span>
              <select data-setting="libraryCardSize">
                <option value="compact" ${settings.libraryCardSize === 'compact' ? 'selected' : ''}>Compacto</option>
                <option value="normal" ${settings.libraryCardSize === 'normal' ? 'selected' : ''}>Normal</option>
              </select>
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="libraryShowThumbnails" ${settings.libraryShowThumbnails ? 'checked' : ''} />
              <span>Mostrar miniaturas</span>
            </label>
            <label class="field">
              <span>Límite recomendado por archivo (MB)</span>
              <input type="number" min="1" data-setting="libraryFileSizeLimitMB" value="${settings.libraryFileSizeLimitMB}" />
            </label>
            <label class="field">
              <span>Orden predeterminado</span>
              <select data-setting="librarySortBy">
                <option value="name-asc" ${settings.librarySortBy === 'name-asc' ? 'selected' : ''}>Nombre (A-Z)</option>
                <option value="name-desc" ${settings.librarySortBy === 'name-desc' ? 'selected' : ''}>Nombre (Z-A)</option>
                <option value="updatedAt-desc" ${settings.librarySortBy === 'updatedAt-desc' ? 'selected' : ''}>Modificado recientemente</option>
                <option value="createdAt-desc" ${settings.librarySortBy === 'createdAt-desc' ? 'selected' : ''}>Agregado recientemente</option>
                <option value="fileSize-desc" ${settings.librarySortBy === 'fileSize-desc' ? 'selected' : ''}>Tamaño (mayor a menor)</option>
              </select>
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="libraryConfirmBeforeDelete" ${settings.libraryConfirmBeforeDelete ? 'checked' : ''} />
              <span>Confirmar antes de eliminar</span>
            </label>
            <label class="field">
              <span>Al eliminar un recurso/carpeta</span>
              <select data-setting="libraryDeleteBehavior">
                <option value="archive" ${settings.libraryDeleteBehavior === 'archive' ? 'selected' : ''}>Archivar primero</option>
                <option value="delete" ${settings.libraryDeleteBehavior === 'delete' ? 'selected' : ''}>Eliminar definitivamente</option>
                <option value="ask" ${settings.libraryDeleteBehavior === 'ask' ? 'selected' : ''}>Preguntar siempre</option>
              </select>
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="libraryCompressThumbnails" ${settings.libraryCompressThumbnails ? 'checked' : ''} />
              <span>Comprimir miniaturas</span>
            </label>
            <label class="field">
              <span>Calidad de miniaturas (0.1 a 1)</span>
              <input type="number" min="0.1" max="1" step="0.1" data-setting="libraryThumbnailQuality" value="${settings.libraryThumbnailQuality}" />
            </label>
            <label class="field">
              <span>Carpeta predeterminada para nuevos recursos</span>
              <select data-setting="libraryDefaultFolderId">
                <option value="">Raíz de Biblioteca</option>
                ${rootFolders.map((f) => `<option value="${f.id}" ${settings.libraryDefaultFolderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
              </select>
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="libraryShowArchived" ${settings.libraryShowArchived ? 'checked' : ''} />
              <span>Mostrar elementos archivados por defecto</span>
            </label>
            <label class="field">
              <span>Elementos por página</span>
              <input type="number" min="10" step="10" data-setting="libraryPageSize" value="${settings.libraryPageSize}" />
            </label>
          </div>
        </div>
      </div>`;
  }

  /* ---- Preferencias ---- */
  function renderPreferencesSettings(ctx) {
    const { settings } = ctx;
    return `
      <div>
        ${settingsSectionHeader('Preferencias', 'Ajustes generales de comportamiento de la aplicación.')}
        <div class="settings-card">
          <div class="form-grid">
            <label class="field">
              <span>Vista predeterminada de Videos</span>
              <select data-setting="defaultView">
                <option value="kanban" ${settings.defaultView === 'kanban' ? 'selected' : ''}>Kanban</option>
                <option value="list" ${settings.defaultView === 'list' ? 'selected' : ''}>Lista</option>
                <option value="calendar" ${settings.defaultView === 'calendar' ? 'selected' : ''}>Calendario</option>
              </select>
            </label>
            <label class="field">
              <span>Tarjetas por columna (0 = sin límite)</span>
              <input type="number" min="0" data-setting="cardsPerColumnLimit" value="${settings.cardsPerColumnLimit}" />
            </label>
            <label class="field">
              <span>Tamaño de tarjetas</span>
              <select data-setting="cardSize">
                <option value="compact" ${settings.cardSize === 'compact' ? 'selected' : ''}>Compacto</option>
                <option value="normal" ${settings.cardSize === 'normal' ? 'selected' : ''}>Normal</option>
              </select>
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="showThumbnails" ${settings.showThumbnails ? 'checked' : ''} />
              <span>Mostrar miniaturas en las tarjetas</span>
            </label>
            <label class="field">
              <span>Formato de fecha</span>
              <select data-setting="dateFormat">
                <option value="dd/mm/yyyy" ${settings.dateFormat === 'dd/mm/yyyy' ? 'selected' : ''}>DD/MM/AAAA</option>
                <option value="mm/dd/yyyy" ${settings.dateFormat === 'mm/dd/yyyy' ? 'selected' : ''}>MM/DD/AAAA</option>
                <option value="yyyy-mm-dd" ${settings.dateFormat === 'yyyy-mm-dd' ? 'selected' : ''}>AAAA-MM-DD</option>
              </select>
            </label>
            <label class="field">
              <span>Inicio de semana</span>
              <select data-setting="weekStart">
                <option value="monday" ${settings.weekStart === 'monday' ? 'selected' : ''}>Lunes</option>
                <option value="sunday" ${settings.weekStart === 'sunday' ? 'selected' : ''}>Domingo</option>
              </select>
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="confirmBeforeDelete" ${settings.confirmBeforeDelete ? 'checked' : ''} />
              <span>Pedir confirmación antes de eliminar</span>
            </label>
            <label class="field">
              <span>Límite recomendado por archivo (MB)</span>
              <input type="number" min="1" data-setting="fileSizeLimitMB" value="${settings.fileSizeLimitMB}" />
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="autosave" ${settings.autosave ? 'checked' : ''} />
              <span>Autosave activado</span>
            </label>
            <label class="field">
              <span>Frecuencia de guardado (segundos)</span>
              <input type="number" min="1" data-setting="autosaveIntervalSec" value="${settings.autosaveIntervalSec}" />
            </label>
            <label class="field field--checkbox">
              <input type="checkbox" data-setting="showFutureModules" ${settings.showFutureModules ? 'checked' : ''} />
              <span>Mostrar módulos futuros en la barra lateral</span>
            </label>
          </div>
        </div>
      </div>`;
  }

  /* ---- Datos y respaldo ---- */
  function renderBackupSettings(ctx) {
    const { usage } = ctx;
    const usagePct = usage.quota ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;
    return `
      <div>
        ${settingsSectionHeader('Datos y respaldo', 'Exportá o importá una copia de seguridad completa de la aplicación.')}
        <div class="settings-card">
          <h4>Respaldo</h4>
          <div class="settings-actions-row">
            <button class="btn btn--primary" data-action="export-backup">${icon('upload')} Exportar respaldo</button>
            <label class="btn btn--secondary">${icon('upload')} Importar respaldo<input type="file" accept="application/json" id="import-backup-input" hidden /></label>
          </div>
        </div>
        <div class="settings-card">
          <h4>Datos de ejemplo</h4>
          <p class="muted small">Podés restaurar los videos de ejemplo iniciales o eliminar únicamente los videos y recursos/carpetas de Biblioteca marcados como ejemplo.</p>
          <div class="settings-actions-row">
            <button class="btn btn--secondary" data-action="restore-sample-data">Restaurar videos de ejemplo</button>
            <button class="btn btn--ghost" data-action="remove-sample-data">Eliminar datos de ejemplo (videos + Biblioteca)</button>
          </div>
        </div>
        <div class="settings-card">
          <h4>Uso de almacenamiento</h4>
          ${progressBar(usagePct)}
          <p class="small muted">${formatBytes(usage.usage)} usados${usage.quota ? ` de ${formatBytes(usage.quota)} disponibles (estimado por el navegador)` : ''}</p>
        </div>
        <div class="settings-card settings-card--danger">
          <h4>Zona de peligro</h4>
          <p class="muted small">Esta acción elimina permanentemente todos los datos guardados en este navegador.</p>
          <button class="btn btn--danger" data-action="wipe-all-data">${icon('trash')} Eliminar todos los datos</button>
        </div>
        <p class="muted small" style="text-align:center;margin-top:8px">Fútbol XL Studio v${APP_VERSION}</p>
      </div>`;
  }

  /* ====================================================================
   * MÓDULO BIBLIOTECA
   * ====================================================================
   * Explorador de recursos tipo Finder/Drive: carpetas con subcarpetas
   * ilimitadas (relación por parentId) y recursos (archivos locales o
   * enlaces). Todas las funciones de esta sección son puras: reciben un
   * "ctx" ya resuelto por app.js (con las listas de carpetas/recursos
   * visibles ya calculadas) y devuelven HTML.
   * ==================================================================== */

  const LIBRARY_QUICK_FILTERS = [
    { key: 'all', label: 'Todos' },
    { key: 'recent', label: 'Recientes' },
    { key: 'favorites', label: 'Favoritos' },
    { key: 'images', label: 'Imágenes' },
    { key: 'videos', label: 'Videos' },
    { key: 'links', label: 'Enlaces' },
    { key: 'drive', label: 'Drive' },
    { key: 'noFolder', label: 'Sin carpeta' },
    { key: 'archived', label: 'Archivados' },
  ];

  const RESOURCE_TYPE_META = {
    image: { label: 'Imagen', icon: '🖼️' },
    video: { label: 'Video', icon: '🎬' },
    audio: { label: 'Audio', icon: '🎵' },
    document: { label: 'Documento', icon: '📄' },
    pdf: { label: 'PDF', icon: '📕' },
    link: { label: 'Enlace web', icon: '🔗' },
    drive: { label: 'Archivo de Drive', icon: '📁' },
    driveFolder: { label: 'Carpeta de Drive', icon: '🗂️' },
    docs: { label: 'Google Docs', icon: '📄' },
    sheets: { label: 'Google Sheets', icon: '📊' },
    youtube: { label: 'YouTube', icon: '▶️' },
    vimeo: { label: 'Vimeo', icon: '🎞️' },
    sfx: { label: 'SFX', icon: '🔊' },
    music: { label: 'Música', icon: '🎵' },
    logo: { label: 'Logo', icon: '🏷️' },
    overlay: { label: 'Overlay', icon: '🪄' },
    other: { label: 'Otro', icon: '📦' },
  };

  function resourceTypeMeta(type) {
    return RESOURCE_TYPE_META[type] || RESOURCE_TYPE_META.other;
  }

  /* ---- Vista principal ---- */

  function renderLibraryView(ctx) {
    return `
      <div class="view view--library">
        ${renderLibraryToolbar(ctx)}
        ${renderLibraryQuickChips(ctx)}
        ${ctx.showFilters ? renderLibraryTagFilterRow(ctx) : ''}
        ${renderLibraryBreadcrumbs(ctx)}
        ${ctx.selectedIds.length ? renderLibraryBulkBar(ctx) : ''}
        ${ctx.view === 'list' ? renderLibraryList(ctx) : renderLibraryGrid(ctx)}
      </div>
      <button class="fab" data-action="open-new-menu" title="Nuevo" aria-label="Nuevo">${icon('plus')}</button>
      ${ctx.showNewMenu ? renderLibraryNewMenu() : ''}
    `;
  }

  function renderLibraryToolbar(ctx) {
    return `
      <div class="videos-toolbar library-toolbar">
        <div class="topbar__search library-search">
          ${icon('search')}
          <input type="text" id="library-search" placeholder="Buscar recursos…" value="${escapeHtml(ctx.search || '')}" autocomplete="off" />
          ${ctx.search ? `<button class="icon-btn" data-action="clear-library-search">${icon('close')}</button>` : ''}
        </div>
        <div class="videos-toolbar__right">
          <div class="view-switch">
            <button class="view-switch__btn ${ctx.view === 'grid' ? 'view-switch__btn--active' : ''}" data-action="set-library-view" data-view="grid">${icon('grid')} <span>Cuadrícula</span></button>
            <button class="view-switch__btn ${ctx.view === 'list' ? 'view-switch__btn--active' : ''}" data-action="set-library-view" data-view="list">${icon('list')} <span>Lista</span></button>
          </div>
          <select id="library-sort" title="Ordenar">
            <option value="name-asc" ${ctx.sort === 'name-asc' ? 'selected' : ''}>Nombre (A-Z)</option>
            <option value="name-desc" ${ctx.sort === 'name-desc' ? 'selected' : ''}>Nombre (Z-A)</option>
            <option value="updatedAt-desc" ${ctx.sort === 'updatedAt-desc' ? 'selected' : ''}>Modificado recientemente</option>
            <option value="createdAt-desc" ${ctx.sort === 'createdAt-desc' ? 'selected' : ''}>Agregado recientemente</option>
            <option value="fileSize-desc" ${ctx.sort === 'fileSize-desc' ? 'selected' : ''}>Tamaño (mayor a menor)</option>
          </select>
          <button class="btn btn--secondary" data-action="toggle-library-filters">${icon('filter')} Filtros ${ctx.filterTagIds.length ? `<span class="filter-count">${ctx.filterTagIds.length}</span>` : ''}</button>
          <div class="dropdown">
            <button class="btn btn--secondary" data-action="toggle-menu" data-menu="library-new">${icon('plus')} Nuevo</button>
            <div class="dropdown__menu" id="menu-library-new" hidden>
              <button data-action="quick-new-folder">Nueva carpeta</button>
              <button data-action="quick-upload-file">Subir archivo</button>
              <button data-action="quick-add-link">Agregar enlace</button>
              <button data-action="quick-add-drive-folder">Agregar carpeta de Drive</button>
              <button data-action="quick-add-note">Agregar nota o documento</button>
            </div>
          </div>
          <button class="btn btn--primary" data-action="quick-new-folder-btn">${icon('plus')} Nueva carpeta</button>
          <input type="file" id="library-file-input" multiple hidden />
        </div>
      </div>`;
  }

  function renderLibraryQuickChips(ctx) {
    return `
      <div class="library-quickchips">
        ${LIBRARY_QUICK_FILTERS.map((f) => `<button class="tag-choice ${ctx.quickFilter === f.key ? 'tag-choice--active' : ''}" data-action="set-library-quick-filter" data-key="${f.key}">${escapeHtml(f.label)}</button>`).join('')}
      </div>`;
  }

  function renderLibraryTagFilterRow(ctx) {
    return `
      <div class="filter-panel">
        <span class="field__label">Filtrar por etiquetas</span>
        <div class="tag-choices">
          ${ctx.tags.map((t) => `<button class="tag-choice ${ctx.filterTagIds.includes(t.id) ? 'tag-choice--active' : ''}" style="--tag-color:${t.color}" data-action="toggle-library-filter-tag" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join('') || '<span class="muted small">No hay etiquetas creadas</span>'}
        </div>
        <div class="filter-panel__footer">
          <button class="btn btn--ghost" data-action="clear-library-filters">Limpiar filtros</button>
        </div>
      </div>`;
  }

  function renderLibraryBreadcrumbs(ctx) {
    const nav = `
      <button class="icon-btn" data-action="library-go-back" ${ctx.canGoBack ? '' : 'disabled'} title="Atrás">${icon('chevronLeft')}</button>
      <button class="icon-btn" data-action="library-go-forward" ${ctx.canGoForward ? '' : 'disabled'} title="Adelante">${icon('chevronRight')}</button>`;

    if (ctx.mode !== 'browse') {
      return `
        <div class="library-breadcrumbs">
          ${nav}
          <button class="crumb" data-action="navigate-library-folder" data-id="">Biblioteca</button>
          <span class="crumb-sep">/</span>
          <span class="crumb crumb--current">${escapeHtml(ctx.modeLabel)}</span>
        </div>`;
    }
    return `
      <div class="library-breadcrumbs">
        ${nav}
        <button class="crumb" data-action="navigate-library-folder" data-id="">Biblioteca</button>
        ${ctx.breadcrumb.map((b, i) => `
          <span class="crumb-sep">/</span>
          ${i === ctx.breadcrumb.length - 1
            ? `<span class="crumb crumb--current">${escapeHtml(b.name)}</span>`
            : `<button class="crumb" data-action="navigate-library-folder" data-id="${b.id}">${escapeHtml(b.name)}</button>`}
        `).join('')}
      </div>`;
  }

  function renderLibraryBulkBar(ctx) {
    return `
      <div class="bulk-bar">
        <span>${ctx.selectedIds.length} seleccionados</span>
        <button class="btn btn--secondary" data-action="library-bulk-move">Mover a…</button>
        <select id="library-bulk-tag"><option value="">Etiquetar con…</option>${ctx.tags.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
        <button class="btn btn--secondary" data-action="library-bulk-favorite">${icon('star')} Favorito</button>
        <button class="btn btn--secondary" data-action="library-bulk-archive">${icon('archive')} Archivar</button>
        <button class="btn btn--danger" data-action="library-bulk-delete">${icon('trash')} Eliminar</button>
        <button class="btn btn--ghost" data-action="library-clear-selection">Cancelar</button>
      </div>`;
  }

  function libraryFolderItemCount(folder, ctx) {
    const subfolders = ctx.allFolders.filter((f) => f.parentId === folder.id && !f.archived).length;
    const items = ctx.allItems.filter((i) => i.folderId === folder.id && !i.archived).length;
    return subfolders + items;
  }

  function renderLibraryFolderCard(folder, ctx) {
    const count = libraryFolderItemCount(folder, ctx);
    return `
      <div class="library-card library-card--folder" draggable="true" data-kind="folder" data-id="${folder.id}" data-action="open-library-folder" data-folder-id="${folder.id}">
        <div class="library-card__icon" style="color:${folder.color || 'inherit'}">${folder.icon || '📁'}</div>
        <div class="library-card__body">
          <div class="library-card__title-row">
            <span class="library-card__title">${escapeHtml(folder.name)}</span>
            <button class="icon-btn icon-btn--sm" data-action="toggle-folder-favorite" data-id="${folder.id}">${icon(folder.favorite ? 'starFill' : 'star', folder.favorite ? 'text-accent' : '')}</button>
          </div>
          <span class="small muted">${count} elemento${count === 1 ? '' : 's'}</span>
        </div>
        <div class="dropdown library-card__menu">
          <button class="icon-btn icon-btn--sm" data-action="toggle-menu" data-menu="folder-${folder.id}">${icon('dots')}</button>
          <div class="dropdown__menu" id="menu-folder-${folder.id}" hidden>
            <button data-action="rename-folder" data-id="${folder.id}">Editar</button>
            <button data-action="duplicate-folder" data-id="${folder.id}">Duplicar</button>
            <button data-action="open-move-modal" data-kind="folder" data-id="${folder.id}">Mover a…</button>
            <button data-action="archive-folder" data-id="${folder.id}">${folder.archived ? 'Restaurar' : 'Archivar'}</button>
            <button data-action="delete-folder" data-id="${folder.id}">Eliminar</button>
          </div>
        </div>
      </div>`;
  }

  function libraryItemThumb(item) {
    if (item.resourceType === 'image' || item.resourceType === 'logo') {
      const src = item.thumbnailData || item.fileData;
      if (src) return `<div class="library-card__thumb" style="background-image:url('${src}')"></div>`;
    }
    if ((item.resourceType === 'youtube') && item.url) {
      const yt = youtubeThumbnail ? youtubeThumbnail(item.url) : null;
      if (yt) return `<div class="library-card__thumb" style="background-image:url('${yt}')"></div>`;
    }
    return `<div class="library-card__icon">${resourceTypeMeta(item.resourceType).icon}</div>`;
  }

  function renderLibraryItemCard(item, ctx, opts = {}) {
    const tags = (item.tags || []).map((id) => byId(ctx.tags, id)).filter(Boolean);
    const meta = resourceTypeMeta(item.resourceType);
    const subtitle = item.storageMode === 'link' ? Utils.urlDomain(item.url) : Utils.formatBytes(item.fileSize);
    return `
      <div class="library-card library-card--item ${opts.compact ? 'library-card--compact' : ''}" draggable="true" data-kind="item" data-id="${item.id}" data-action="open-library-detail" data-item-id="${item.id}">
        ${libraryItemThumb(item)}
        <div class="library-card__body">
          <div class="library-card__title-row">
            <span class="library-card__title">${escapeHtml(item.name)}</span>
            <button class="icon-btn icon-btn--sm" data-action="toggle-item-favorite" data-id="${item.id}">${icon(item.favorite ? 'starFill' : 'star', item.favorite ? 'text-accent' : '')}</button>
          </div>
          <span class="small muted">${meta.label} · ${escapeHtml(subtitle || '')}</span>
          ${item._pathLabel ? `<span class="small muted library-card__path">${escapeHtml(item._pathLabel)}</span>` : ''}
          ${tags.length ? `<div class="video-card__tags">${tags.map((t) => pill(t.name, t.color)).join('')}</div>` : ''}
        </div>
        <div class="dropdown library-card__menu">
          <button class="icon-btn icon-btn--sm" data-action="toggle-menu" data-menu="item-${item.id}">${icon('dots')}</button>
          <div class="dropdown__menu" id="menu-item-${item.id}" hidden>
            <button data-action="open-library-detail" data-item-id="${item.id}">Abrir</button>
            <button data-action="copy-item-link" data-id="${item.id}">Copiar enlace</button>
            <button data-action="duplicate-item" data-id="${item.id}">Duplicar</button>
            <button data-action="open-move-modal" data-kind="item" data-id="${item.id}">Mover a…</button>
            <button data-action="archive-item" data-id="${item.id}">${item.archived ? 'Restaurar' : 'Archivar'}</button>
            <button data-action="delete-item" data-id="${item.id}">Eliminar</button>
            ${opts.unlinkVideoId ? `<button data-action="unlink-item-from-video" data-id="${item.id}" data-video-id="${opts.unlinkVideoId}">Quitar relación</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  function renderLibraryGrid(ctx) {
    if (!ctx.visibleFolders.length && !ctx.visibleItems.length) {
      return renderEmptyState({
        title: ctx.mode === 'browse' ? 'Esta carpeta está vacía' : 'No se encontraron resultados',
        message: ctx.mode === 'browse' ? 'Creá una carpeta o subí tu primer recurso.' : 'Probá con otra búsqueda o filtro.',
      });
    }
    return `
      <div class="library-grid" id="library-grid" data-action-zone="drop" data-drop-folder="${ctx.currentFolderId || ''}">
        ${ctx.visibleFolders.map((f) => renderLibraryFolderCard(f, ctx)).join('')}
        ${ctx.visibleItems.map((it) => renderLibraryItemCard(it, ctx)).join('')}
      </div>`;
  }

  function renderLibraryList(ctx) {
    if (!ctx.visibleFolders.length && !ctx.visibleItems.length) {
      return renderEmptyState({ title: 'No hay elementos', message: 'Creá una carpeta o subí un recurso para empezar.' });
    }
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-check"><input type="checkbox" data-action="select-all-library" /></th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Carpeta</th>
              <th>Tamaño</th>
              <th>Etiquetas</th>
              <th>Videos relacionados</th>
              <th>Modificado</th>
              <th>Favorito</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${ctx.visibleFolders.map((f) => `
              <tr data-id="${f.id}">
                <td class="col-check"></td>
                <td class="col-title" data-action="open-library-folder" data-folder-id="${f.id}">${f.icon || '📁'} ${escapeHtml(f.name)}</td>
                <td>Carpeta</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td class="small muted">${formatDate(f.updatedAt, ctx.settings.dateFormat)}</td>
                <td>${f.favorite ? icon('starFill', 'text-accent') : ''}</td>
                <td class="col-actions">
                  <button class="icon-btn icon-btn--sm" data-action="open-move-modal" data-kind="folder" data-id="${f.id}">${icon('external')}</button>
                  <button class="icon-btn icon-btn--sm" data-action="delete-folder" data-id="${f.id}">${icon('trash')}</button>
                </td>
              </tr>`).join('')}
            ${ctx.visibleItems.map((it) => {
              const tags = (it.tags || []).map((id) => byId(ctx.tags, id)).filter(Boolean);
              const folder = byId(ctx.allFolders, it.folderId);
              const linkedVideos = (it.linkedVideoIds || []).map((id) => byId(ctx.videos, id)).filter(Boolean);
              return `
              <tr class="${it.archived ? 'row--archived' : ''}" data-id="${it.id}">
                <td class="col-check"><input type="checkbox" data-action="select-library-row" data-id="${it.id}" ${ctx.selectedIds.includes(it.id) ? 'checked' : ''}/></td>
                <td class="col-title" data-action="open-library-detail" data-item-id="${it.id}">${resourceTypeMeta(it.resourceType).icon} ${escapeHtml(it.name)}</td>
                <td>${resourceTypeMeta(it.resourceType).label}</td>
                <td>${folder ? escapeHtml(folder.name) : 'Sin carpeta'}</td>
                <td>${it.storageMode === 'file' ? formatBytes(it.fileSize) : '—'}</td>
                <td>${tags.map((t) => pill(t.name, t.color)).join(' ') || '—'}</td>
                <td>${linkedVideos.map((v) => escapeHtml(v.title || 'Sin título')).join(', ') || '—'}</td>
                <td class="small muted">${formatDate(it.updatedAt, ctx.settings.dateFormat)}</td>
                <td><button class="icon-btn icon-btn--sm" data-action="toggle-item-favorite" data-id="${it.id}">${icon(it.favorite ? 'starFill' : 'star', it.favorite ? 'text-accent' : '')}</button></td>
                <td class="col-actions">
                  <button class="icon-btn icon-btn--sm" data-action="open-library-detail" data-item-id="${it.id}">${icon('edit')}</button>
                  <button class="icon-btn icon-btn--sm" data-action="delete-item" data-id="${it.id}">${icon('trash')}</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderLibraryNewMenu() {
    return `
      <div class="library-new-menu-overlay" data-action="close-new-menu">
        <div class="library-new-menu">
          <button data-action="quick-new-folder">${icon('library')} Nueva carpeta</button>
          <button data-action="quick-upload-file">${icon('upload')} Subir archivo</button>
          <button data-action="quick-add-link">${icon('link')} Agregar enlace</button>
          <button data-action="quick-add-drive-folder">${icon('external')} Agregar carpeta de Drive</button>
          <button data-action="quick-add-note">${icon('edit')} Agregar nota o documento</button>
        </div>
      </div>`;
  }

  /* ---- Panel de detalles de un recurso ---- */

  function renderLibraryPreview(item) {
    if (item.storageMode === 'file') {
      if (item.resourceType === 'image' || item.resourceType === 'logo') {
        return `<img class="library-preview__img" src="${item.fileData}" alt="${escapeHtml(item.name)}" />`;
      }
      if (item.resourceType === 'audio') {
        return `<audio class="library-preview__audio" controls src="${item.fileData}"></audio>`;
      }
      if (item.resourceType === 'video') {
        return `<video class="library-preview__video" controls src="${item.fileData}"></video>`;
      }
      if (item.resourceType === 'pdf') {
        return `<iframe class="library-preview__pdf" src="${item.fileData}" title="${escapeHtml(item.name)}"></iframe><p class="muted small">Si tu navegador no puede mostrar el PDF embebido, usá "Descargar" o "Abrir".</p>`;
      }
      return `<div class="library-preview__icon">${resourceTypeMeta(item.resourceType).icon}</div>`;
    }
    // storageMode === 'link'
    if (item.resourceType === 'youtube') {
      const thumb = Utils.youtubeThumbnail(item.url);
      return thumb
        ? `<img class="library-preview__img" src="${thumb}" alt="${escapeHtml(item.name)}" />`
        : `<div class="library-preview__icon">${resourceTypeMeta(item.resourceType).icon}</div>`;
    }
    return `
      <div class="library-preview__card">
        <div class="library-preview__icon">${resourceTypeMeta(item.resourceType).icon}</div>
        <span class="small muted">${escapeHtml(Utils.urlDomain(item.url))}</span>
      </div>`;
  }

  function renderLibraryDetailPanel(item, ctx) {
    const folder = byId(ctx.allFolders, item.folderId);
    const tags = (item.tags || []).map((id) => byId(ctx.tags, id)).filter(Boolean);
    const linkedVideos = (item.linkedVideoIds || []).map((id) => byId(ctx.videos, id)).filter(Boolean);
    return `
      <div class="editor-overlay" data-action="close-library-detail-overlay">
        <div class="editor-panel library-detail-panel">
          <div class="editor-panel__header">
            <input type="text" class="editor-title-input" id="library-item-name" value="${escapeHtml(item.name)}" placeholder="Nombre del recurso…" />
            <div class="editor-panel__header-actions">
              <button class="icon-btn" data-action="toggle-item-favorite" data-id="${item.id}">${icon(item.favorite ? 'starFill' : 'star', item.favorite ? 'text-accent' : '')}</button>
              <button class="icon-btn" data-action="duplicate-item" data-id="${item.id}">${icon('copy')}</button>
              <button class="icon-btn" data-action="archive-item" data-id="${item.id}">${icon('archive')}</button>
              <button class="icon-btn" data-action="delete-item" data-id="${item.id}">${icon('trash')}</button>
              <button class="icon-btn" data-action="close-library-detail">${icon('close')}</button>
            </div>
          </div>
          <div class="editor-panel__body">
            <div class="library-preview">${renderLibraryPreview(item)}</div>
            <div class="editor-form">
              <label class="field field--wide">
                <span>Descripción</span>
                <textarea data-item-field="description" rows="2">${escapeHtml(item.description || '')}</textarea>
              </label>
              <div class="form-grid">
                <label class="field">
                  <span>Tipo de recurso</span>
                  <select data-item-field="resourceType">
                    ${Object.entries(RESOURCE_TYPE_META).map(([key, m]) => `<option value="${key}" ${item.resourceType === key ? 'selected' : ''}>${m.label}</option>`).join('')}
                  </select>
                </label>
                <label class="field">
                  <span>Carpeta</span>
                  <span class="field-static">${folder ? escapeHtml(folder.name) : 'Sin carpeta'} · <button class="btn btn--ghost btn--sm" data-action="open-move-modal" data-kind="item" data-id="${item.id}">Mover a…</button></span>
                </label>
                ${item.storageMode === 'link' ? `
                <label class="field field--wide">
                  <span>URL</span>
                  <div class="drive-field__input">
                    <input type="text" data-item-field="url" value="${escapeHtml(item.url || '')}" />
                  </div>
                </label>` : `
                <label class="field">
                  <span>Tamaño</span>
                  <span class="field-static">${formatBytes(item.fileSize)}</span>
                </label>`}
              </div>
              <div class="settings-actions-row">
                <button class="btn btn--secondary" data-action="open-item-link" data-id="${item.id}">${icon('external')} Abrir</button>
                <button class="btn btn--secondary" data-action="copy-item-link" data-id="${item.id}">${icon('copy')} Copiar enlace</button>
                ${item.storageMode === 'file' ? `<button class="btn btn--secondary" data-action="download-item" data-id="${item.id}">${icon('upload')} Descargar</button>` : ''}
                <button class="btn btn--secondary" data-action="duplicate-item" data-id="${item.id}">${icon('copy')} Duplicar</button>
                <button class="btn btn--secondary" data-action="archive-item" data-id="${item.id}">${icon('archive')} ${item.archived ? 'Restaurar' : 'Archivar'}</button>
                <button class="btn btn--danger" data-action="delete-item" data-id="${item.id}">${icon('trash')} Eliminar</button>
              </div>

              <h4>Etiquetas</h4>
              <div class="tag-choices">
                ${ctx.tags.map((t) => `<button class="tag-choice ${(item.tags || []).includes(t.id) ? 'tag-choice--active' : ''}" style="--tag-color:${t.color}" data-action="toggle-item-tag" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join('') || '<span class="muted small">No hay etiquetas creadas.</span>'}
              </div>

              <h4>Videos relacionados</h4>
              <p class="muted small">Usado en:</p>
              <div class="library-linked-videos">
                ${linkedVideos.length ? linkedVideos.map((v) => `
                  <div class="library-linked-video">
                    <button class="crumb" data-action="open-video-from-library" data-id="${v.id}">✓ ${escapeHtml(v.title || 'Sin título')}</button>
                    <button class="icon-btn icon-btn--sm" data-action="unlink-item-from-video" data-id="${item.id}" data-video-id="${v.id}">${icon('close')}</button>
                  </div>`).join('') : '<p class="muted small">Sin videos relacionados todavía.</p>'}
              </div>
              <button class="btn btn--ghost" data-action="open-relate-videos-modal" data-id="${item.id}">${icon('plus')} Relacionar con videos</button>

              <h4>Metadatos</h4>
              <p class="small muted">Creado: ${formatDateTime(item.createdAt)}</p>
              <p class="small muted">Última modificación: ${formatDateTime(item.updatedAt)}</p>
              <p class="small muted">Última utilización: ${item.lastUsedAt ? formatDateTime(item.lastUsedAt) : 'Nunca'}</p>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ---- Modales de Biblioteca (se inyectan en #generic-modal) ---- */

  function renderFolderFormModalBody(ctx, folder) {
    const isEdit = !!folder;
    const f = folder || { name: '', description: '', icon: '📁', color: '#8a8a8a' };
    return `
      <div class="modal__header"><h3>${isEdit ? 'Editar carpeta' : 'Nueva carpeta'}</h3></div>
      <div class="modal__body">
        <div class="form-grid">
          <label class="field field--wide">
            <span>Nombre</span>
            <input type="text" id="folder-form-name" value="${escapeHtml(f.name)}" />
          </label>
          <label class="field field--wide">
            <span>Descripción</span>
            <textarea id="folder-form-description" rows="2">${escapeHtml(f.description || '')}</textarea>
          </label>
          <label class="field">
            <span>Icono (emoji)</span>
            <input type="text" id="folder-form-icon" maxlength="2" value="${escapeHtml(f.icon || '📁')}" />
          </label>
          <label class="field">
            <span>Color</span>
            <input type="color" id="folder-form-color" value="${f.color || '#8a8a8a'}" />
          </label>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="${isEdit ? 'submit-edit-folder' : 'submit-new-folder'}" data-id="${isEdit ? folder.id : ''}">${isEdit ? 'Guardar' : 'Crear carpeta'}</button>
      </div>`;
  }

  function renderNewLinkModalBody(ctx, presetType) {
    return `
      <div class="modal__header"><h3>Agregar enlace</h3></div>
      <div class="modal__body">
        <div class="form-grid">
          <label class="field field--wide">
            <span>Nombre</span>
            <input type="text" id="link-form-name" placeholder="ej. Carpeta de Drive - Inserts Messi" />
          </label>
          <label class="field field--wide">
            <span>URL</span>
            <input type="text" id="link-form-url" placeholder="https://…" />
          </label>
          <label class="field">
            <span>Tipo de recurso (se detecta automáticamente si lo dejás en blanco)</span>
            <select id="link-form-type">
              <option value="">Detectar automáticamente</option>
              ${Object.entries(RESOURCE_TYPE_META).map(([key, m]) => `<option value="${key}" ${presetType === key ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
          </label>
          <label class="field field--wide">
            <span>Descripción</span>
            <textarea id="link-form-description" rows="2"></textarea>
          </label>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="submit-new-link">Guardar enlace</button>
      </div>`;
  }

  function renderMoveToModalBody(ctx, kind, id) {
    const folders = ctx.allFolders.filter((f) => !f.archived);
    const isValidTarget = (f) => {
      if (kind === 'folder') {
        if (f.id === id) return false;
        if (Utils.isFolderDescendant(ctx.allFolders, f.id, id)) return false;
      }
      return true;
    };
    const renderOption = (f, depth) => {
      if (!isValidTarget(f)) return '';
      const children = folders.filter((c) => c.parentId === f.id);
      return `<option value="${f.id}">${'—'.repeat(depth)} ${escapeHtml(f.name)}</option>` + children.map((c) => renderOption(c, depth + 1)).join('');
    };
    const roots = folders.filter((f) => !f.parentId);
    return `
      <div class="modal__header"><h3>Mover a…</h3></div>
      <div class="modal__body">
        <label class="field field--wide">
          <span>Carpeta de destino</span>
          <select id="move-target-select">
            <option value="">Biblioteca (raíz)</option>
            ${roots.map((f) => renderOption(f, 0)).join('')}
          </select>
        </label>
        <p class="muted small">No se puede mover una carpeta dentro de sí misma ni de una de sus propias subcarpetas.</p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="submit-move" data-kind="${kind}" data-id="${id}">Mover</button>
      </div>`;
  }

  function renderRelateVideosModalBody(ctx, item) {
    const linked = new Set(item.linkedVideoIds || []);
    return `
      <div class="modal__header"><h3>Relacionar con videos</h3></div>
      <div class="modal__body">
        <input type="text" id="relate-video-search" placeholder="Buscar video…" class="field" style="width:100%;margin-bottom:10px;padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text);" />
        <div class="library-video-picker" id="relate-video-list">
          ${ctx.videos.filter((v) => !v.archived).map((v) => `
            <label class="library-video-picker__row" data-title="${escapeHtml((v.title || '').toLowerCase())}">
              <input type="checkbox" data-video-id="${v.id}" ${linked.has(v.id) ? 'checked' : ''} />
              <span>${escapeHtml(v.title || 'Sin título')}</span>
            </label>`).join('')}
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="submit-relate-videos" data-id="${item.id}">Guardar</button>
      </div>`;
  }

  function renderLinkLibraryPickerModalBody(ctx, videoId) {
    return `
      <div class="modal__header"><h3>Agregar desde Biblioteca</h3></div>
      <div class="modal__body">
        <input type="text" id="link-picker-search" placeholder="Buscar recurso…" class="field" style="width:100%;margin-bottom:10px;padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text);" />
        <div class="library-video-picker" id="link-picker-list">
          ${ctx.allItems.filter((it) => !it.archived).map((it) => `
            <label class="library-video-picker__row" data-title="${escapeHtml(it.name.toLowerCase())}">
              <input type="checkbox" data-item-id="${it.id}" ${(it.linkedVideoIds || []).includes(videoId) ? 'checked' : ''} />
              <span>${resourceTypeMeta(it.resourceType).icon} ${escapeHtml(it.name)}</span>
            </label>`).join('') || '<p class="muted small">Todavía no hay recursos en la Biblioteca.</p>'}
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="submit-link-picker" data-video-id="${videoId}">Guardar</button>
      </div>`;
  }

  function renderPasteImageModalBody(sizeLabel) {
    return `
      <div class="modal__header"><h3>Guardar imagen pegada</h3></div>
      <div class="modal__body">
        <p class="muted small">Tamaño: ${escapeHtml(sizeLabel)}</p>
        <div class="form-grid">
          <label class="field field--wide">
            <span>Nombre</span>
            <input type="text" id="paste-form-name" placeholder="Nombre del recurso" />
          </label>
          <label class="field field--wide">
            <span>Descripción</span>
            <textarea id="paste-form-description" rows="2"></textarea>
          </label>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="submit-paste-image">Guardar</button>
      </div>`;
  }

  function renderFileSizeWarningModalBody(sizeLabel, limitMB) {
    return `
      <div class="modal__header"><h3>Archivo pesado</h3></div>
      <div class="modal__body">
        <p>Este archivo pesa <strong>${escapeHtml(sizeLabel)}</strong>, por encima del límite recomendado de ${limitMB} MB.</p>
        <p class="muted small">Puede ocupar demasiado espacio en el navegador. ¿Querés guardarlo igualmente o preferís usar un enlace de Drive?</p>
      </div>
      <div class="modal__footer modal__footer--wrap">
        <button class="btn btn--secondary" data-action="filesize-save-anyway">Guardar igualmente</button>
        <button class="btn btn--secondary" data-action="filesize-use-link">Usar enlace</button>
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
      </div>`;
  }

  /* ============================================================================
     MÓDULO COSTOS (agregado en v1.2.0)
     Registro y control de gastos y suscripciones del canal. Reutiliza la
     misma identidad visual (tarjetas, tablas, modales, tabs) que el resto
     de la app; solo se usa color para los estados (verde=pagado/activo,
     amarillo=pendiente/próximo, rojo=vencido/cancelado, gris=pausado).
     ========================================================================= */

  const COSTS_TABS = [
    { key: 'summary', label: 'Resumen' },
    { key: 'expenses', label: 'Gastos' },
    { key: 'subscriptions', label: 'Suscripciones' },
    { key: 'settings', label: 'Configuración' },
  ];

  const EXPENSE_STATUS_META = {
    paid: { label: 'Pagado', dot: 'success' },
    pending: { label: 'Pendiente', dot: 'warning' },
    cancelled: { label: 'Cancelado', dot: 'danger' },
  };

  const SUBSCRIPTION_STATUS_META = {
    active: { label: 'Activa', dot: 'success' },
    paused: { label: 'Pausada', dot: 'muted' },
    cancelled: { label: 'Cancelada', dot: 'danger' },
  };

  const FREQUENCY_LABELS = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    biannual: 'Semestral',
    annual: 'Anual',
    custom: 'Personalizada',
  };

  function statusDot(dotClass, label) {
    return `<span class="status-dot status-dot--${dotClass}"></span><span>${escapeHtml(label)}</span>`;
  }

  /** Formatea un monto con el símbolo/decimales de la moneda indicada. */
  function money(ctx, amount, currencyId) {
    const cur = byId(ctx.currencies, currencyId);
    return Utils.formatCurrency(amount, cur || { symbol: '', decimalPlaces: 2 });
  }

  /**
   * Suma `amountField` agrupado por moneda. Nunca devuelve un total único
   * mezclando monedas distintas: cada entrada del array resultante es
   * { currencyId, total } para UNA sola moneda.
   */
  function sumByCurrency(list, amountField = 'amount') {
    const totals = new Map();
    list.forEach((x) => {
      const key = x.currencyId || '_sin_moneda';
      totals.set(key, (totals.get(key) || 0) + (Number(x[amountField]) || 0));
    });
    return Array.from(totals.entries()).map(([currencyId, total]) => ({ currencyId: currencyId === '_sin_moneda' ? null : currencyId, total }));
  }

  /** Renderiza una o más líneas de monto, una por moneda (nunca sumadas entre sí). */
  function renderMultiCurrencyAmount(ctx, sums, opts = {}) {
    if (!sums.length) return `<span class="cost-amount cost-amount--empty">${money(ctx, 0, ctx.settings.costsDefaultCurrencyCode ? (ctx.currencies.find((c) => c.code === ctx.settings.costsDefaultCurrencyCode) || {}).id : null)}</span>`;
    return sums
      .map((s) => `<span class="cost-amount ${opts.big ? 'cost-amount--big' : ''}">${money(ctx, s.total, s.currencyId)}</span>`)
      .join('<br/>');
  }

  function projectLabel(ctx, item) {
    if (item.projectVideoId) {
      const v = byId(ctx.videos, item.projectVideoId);
      return v ? `🎬 ${escapeHtml(v.title || 'Video sin título')}` : '—';
    }
    if (item.projectSeriesId) {
      const s = byId(ctx.series, item.projectSeriesId);
      return s ? `⚽ ${escapeHtml(s.name)}` : '—';
    }
    return '<span class="muted">Ninguno</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Shell con las 4 pestañas de Costos                                  */
  /* ------------------------------------------------------------------ */

  function renderCostsShell(ctx, bodyHtml) {
    return `
      <div class="view view--costs">
        <div class="costs-header">
          <h2>Costos</h2>
          <div class="costs-tabs">
            ${COSTS_TABS.map((t) => `<button class="costs-tab ${ctx.costsTab === t.key ? 'costs-tab--active' : ''}" data-action="costs-tab" data-tab="${t.key}">${escapeHtml(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="costs-body">${bodyHtml}</div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Resumen                                                             */
  /* ------------------------------------------------------------------ */

  function renderCostsSummaryTab(ctx) {
    const { expenses, subscriptions, categories, currencies } = {
      expenses: ctx.expenses,
      subscriptions: ctx.subscriptions,
      categories: ctx.expenseCategories,
      currencies: ctx.currencies,
    };
    const now = new Date();
    const notCancelled = expenses.filter((e) => e.status !== 'cancelled');
    const thisMonth = notCancelled.filter((e) => Utils.isSameMonth(e.date, now));
    const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = notCancelled.filter((e) => Utils.isSameMonth(e.date, lastMonthRef));

    const thisMonthPaid = thisMonth.filter((e) => e.status === 'paid');
    const lastMonthPaid = lastMonth.filter((e) => e.status === 'paid');
    const thisMonthPending = thisMonth.filter((e) => e.status === 'pending');

    const thisMonthSums = sumByCurrency(thisMonthPaid);
    const lastMonthSums = sumByCurrency(lastMonthPaid);
    const pendingSums = sumByCurrency(expenses.filter((e) => e.status === 'pending'));

    // Variación % respecto del mes anterior, calculada por moneda (nunca
    // se mezclan ARS y USD en un solo porcentaje "combinado").
    const variationLines = thisMonthSums.map((cur) => {
      const prev = lastMonthSums.find((p) => p.currencyId === cur.currencyId);
      const prevTotal = prev ? prev.total : 0;
      if (prevTotal === 0) return { currencyId: cur.currencyId, pct: cur.total > 0 ? 100 : 0 };
      return { currencyId: cur.currencyId, pct: Math.round(((cur.total - prevTotal) / prevTotal) * 100) };
    });

    const recurringTypeIds = ctx.expenseTypes.filter((t) => /recurrente/i.test(t.name)).map((t) => t.id);
    const fixedSums = sumByCurrency(thisMonthPaid.filter((e) => recurringTypeIds.includes(e.expenseTypeId) || e.subscriptionId));
    const variableSums = sumByCurrency(thisMonthPaid.filter((e) => !(recurringTypeIds.includes(e.expenseTypeId) || e.subscriptionId)));

    const activeSubs = subscriptions.filter((s) => s.status === 'active');
    const threshold = ctx.settings.costsUpcomingDaysThreshold ?? 7;
    const upcoming = activeSubs.filter((s) => {
      const d = Utils.daysUntil(s.nextBillingDate);
      return d !== null && d <= threshold;
    });

    // Categoría con mayor gasto del mes: se calcula por separado para cada
    // moneda presente (la categoría "líder" puede diferir entre ARS y USD).
    const catLeaderByCurrency = thisMonthSums.map((cs) => {
      const inCurrency = thisMonthPaid.filter((e) => (e.currencyId || null) === cs.currencyId);
      const byCat = sumByCurrency(inCurrency.map((e) => ({ ...e, currencyId: e.categoryId })), 'amount');
      let best = null;
      byCat.forEach((b) => {
        if (!best || b.total > best.total) best = b;
      });
      const cat = best ? categories.find((c) => c.id === best.currencyId) : null;
      return { currencyId: cs.currencyId, categoryName: cat ? cat.name : '—' };
    });

    const cards = [
      { label: 'Gastado este mes', value: renderMultiCurrencyAmount(ctx, thisMonthSums, { big: true }), icon: 'wallet' },
      { label: 'Gastado mes anterior', value: renderMultiCurrencyAmount(ctx, lastMonthSums), icon: 'clock' },
      {
        label: 'Variación vs. mes anterior',
        value: variationLines.length
          ? variationLines.map((v) => `<span class="cost-amount ${v.pct > 0 ? 'text-danger' : v.pct < 0 ? 'text-success' : ''}">${v.pct > 0 ? '+' : ''}${v.pct}%</span>`).join('<br/>')
          : '<span class="muted">—</span>',
        icon: 'analytics',
      },
      { label: 'Gastos fijos del mes', value: renderMultiCurrencyAmount(ctx, fixedSums), icon: 'repeat' },
      { label: 'Gastos variables del mes', value: renderMultiCurrencyAmount(ctx, variableSums), icon: 'wallet' },
      { label: 'Suscripciones activas', value: activeSubs.length, icon: 'repeat' },
      { label: 'Próximos vencimientos', value: upcoming.length, icon: 'clock', danger: upcoming.length > 0 },
      { label: 'Pagos pendientes', value: renderMultiCurrencyAmount(ctx, pendingSums), icon: 'warn', danger: pendingSums.length > 0 },
      {
        label: 'Categoría con mayor gasto',
        value: catLeaderByCurrency.length ? catLeaderByCurrency.map((c) => escapeHtml(c.categoryName)).join(' · ') : '<span class="muted">—</span>',
        icon: 'library',
      },
    ];

    // Gráfico de gastos por categoría (barras), una sección por moneda.
    const categoryChartHtml = thisMonthSums
      .map((cs) => {
        const inCurrency = thisMonthPaid.filter((e) => (e.currencyId || null) === cs.currencyId);
        const items = categories
          .map((c) => ({ name: c.name, color: null, count: inCurrency.filter((e) => e.categoryId === c.id).reduce((s, e) => s + (Number(e.amount) || 0), 0) }))
          .filter((c) => c.count > 0);
        const cur = currencies.find((c) => c.id === cs.currencyId);
        return `
          <div class="cost-chart-currency">
            <h4>${cur ? escapeHtml(cur.code) : 'Sin moneda'}</h4>
            ${items.length ? distBars(items) : emptyMini('Sin gastos este mes')}
          </div>`;
      })
      .join('') || emptyMini('Todavía no hay gastos pagados este mes');

    // Evolución mensual (6 meses), una sección por moneda con barras
    // verticales simples (sin librerías externas de gráficos).
    const evoMonths = Utils.lastMonthKeys(6, now);
    const currenciesWithData = Array.from(new Set(notCancelled.filter((e) => e.status === 'paid').map((e) => e.currencyId || null)));
    const evolutionHtml = currenciesWithData.length
      ? currenciesWithData
          .map((currencyId) => {
            const cur = currencies.find((c) => c.id === currencyId);
            const perMonth = evoMonths.map((mk) => {
              const total = notCancelled
                .filter((e) => e.status === 'paid' && (e.currencyId || null) === currencyId && Utils.monthKey(e.date) === mk)
                .reduce((s, e) => s + (Number(e.amount) || 0), 0);
              return { key: mk, total };
            });
            const max = Math.max(...perMonth.map((m) => m.total), 1);
            return `
              <div class="cost-evolution-currency">
                <h4>${cur ? escapeHtml(cur.code) : 'Sin moneda'}</h4>
                <div class="evolution-bars">
                  ${perMonth
                    .map(
                      (m) => `
                    <div class="evolution-bar" title="${escapeHtml(Utils.monthKeyLabel(m.key))}: ${money(ctx, m.total, currencyId)}">
                      <div class="evolution-bar__track"><div class="evolution-bar__fill" style="height:${(m.total / max) * 100}%"></div></div>
                      <span class="evolution-bar__label">${escapeHtml(Utils.monthKeyLabel(m.key).split(' ')[0])}</span>
                    </div>`
                    )
                    .join('')}
                </div>
              </div>`;
          })
          .join('')
      : emptyMini('Todavía no hay gastos pagados para graficar la evolución');

    // Próximos pagos: suscripciones activas ordenadas por próxima fecha de
    // cobro, más los gastos pendientes (sin fecha de vencimiento propia,
    // se muestran ordenados por fecha del gasto).
    const upcomingSorted = activeSubs.slice().sort((a, b) => new Date(a.nextBillingDate) - new Date(b.nextBillingDate)).slice(0, 8);
    const pendingSorted = expenses.filter((e) => e.status === 'pending').sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);

    return `
      <div class="costs-summary">
        <div class="stat-grid">
          ${cards.map((c) => `
            <div class="stat-card ${c.danger ? 'stat-card--danger' : ''}">
              <div class="stat-card__icon">${icon(c.icon)}</div>
              <div class="stat-card__value cost-stat-value">${c.value}</div>
              <div class="stat-card__label">${escapeHtml(c.label)}</div>
            </div>`).join('')}
        </div>

        <div class="home-grid">
          <section class="panel">
            <h3>Gastos por categoría (este mes)</h3>
            ${categoryChartHtml}
          </section>

          <section class="panel">
            <h3>Evolución mensual (últimos 6 meses)</h3>
            ${evolutionHtml}
          </section>

          <section class="panel">
            <h3>Próximos pagos (suscripciones)</h3>
            ${upcomingSorted.length ? `<table class="data-table data-table--compact">
              <thead><tr><th>Nombre</th><th>Monto</th><th>Fecha</th><th>Tipo</th><th>Estado</th></tr></thead>
              <tbody>
                ${upcomingSorted.map((s) => `
                  <tr data-action="open-subscription" data-id="${s.id}">
                    <td>${escapeHtml(s.name)}</td>
                    <td>${money(ctx, s.amount, s.currencyId)}</td>
                    <td>${formatDate(s.nextBillingDate, ctx.settings.dateFormat)}</td>
                    <td>Suscripción</td>
                    <td>${subscriptionBillingBadge(s, threshold)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` : emptyMini('Sin suscripciones activas')}
          </section>

          <section class="panel">
            <h3>Gastos pendientes</h3>
            ${pendingSorted.length ? `<ul class="mini-list">
              ${pendingSorted.map((e) => `
                <li class="mini-list__item" data-action="open-expense" data-id="${e.id}">
                  <span class="mini-list__title">${escapeHtml(e.description || 'Sin descripción')}</span>
                  <span class="mini-list__meta">${money(ctx, e.amount, e.currencyId)} · ${formatDate(e.date, ctx.settings.dateFormat)}</span>
                </li>`).join('')}
            </ul>` : emptyMini('Sin pagos pendientes')}
          </section>
        </div>
      </div>`;
  }

  /** Badge de estado de vencimiento de una suscripción (vence hoy/pronto/vencida/activa/pausada/cancelada). */
  function subscriptionBillingBadge(s, threshold) {
    if (s.status === 'paused') return statusDot('muted', 'Pausada');
    if (s.status === 'cancelled') return statusDot('danger', 'Cancelada');
    const days = daysUntil(s.nextBillingDate);
    if (days === null) return statusDot('success', 'Activa');
    if (days < 0) return statusDot('danger', 'Vencida');
    if (days === 0) return statusDot('warning', 'Vence hoy');
    if (days <= threshold) return statusDot('warning', 'Vence pronto');
    return statusDot('success', 'Activa');
  }

  /* ------------------------------------------------------------------ */
  /* Gastos                                                              */
  /* ------------------------------------------------------------------ */

  function costsExpenseFilterCount(f) {
    let n = 0;
    ['month', 'year', 'categoryId', 'expenseTypeId', 'status', 'currencyId', 'projectVideoId', 'projectSeriesId', 'recipient', 'dateFrom', 'dateTo'].forEach((k) => {
      if (f[k]) n++;
    });
    return n;
  }

  function renderCostsExpensesToolbar(ctx) {
    const f = ctx.expenseFilters;
    const count = costsExpenseFilterCount(f);
    return `
      <div class="videos-toolbar costs-toolbar">
        <div class="videos-toolbar__search">
          ${icon('search')}
          <input type="text" id="cost-expense-search" placeholder="Buscar por descripción, proveedor, notas…" value="${escapeHtml(ctx.expenseSearch || '')}" />
        </div>
        <button class="btn btn--secondary" data-action="toggle-cost-filters">${icon('filter')} Filtros ${count ? `<span class="filter-count">${count}</span>` : ''}</button>
        <button class="btn btn--primary" data-action="new-expense">${icon('plus')} Nuevo gasto</button>
      </div>
      ${ctx.showCostFilters ? renderCostsExpenseFilterPanel(ctx) : ''}`;
  }

  function renderCostsExpenseFilterPanel(ctx) {
    const f = ctx.expenseFilters;
    const opt = (list, key, labelField = 'name') =>
      list.map((x) => `<option value="${x.id}" ${f[key] === x.id ? 'selected' : ''}>${escapeHtml(x[labelField])}</option>`).join('');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const years = Array.from(new Set(ctx.expenses.map((e) => (e.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();
    return `
      <div class="filter-panel" id="cost-filter-panel">
        <div class="filter-panel__grid">
          <label class="field">
            <span>Mes</span>
            <select data-cost-filter="month">
              <option value="">Todos</option>
              ${monthNames.map((m, i) => `<option value="${i + 1}" ${String(f.month) === String(i + 1) ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Año</span>
            <select data-cost-filter="year">
              <option value="">Todos</option>
              ${years.map((y) => `<option value="${y}" ${f.year === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Categoría</span>
            <select data-cost-filter="categoryId"><option value="">Todas</option>${opt(ctx.expenseCategories, 'categoryId')}</select>
          </label>
          <label class="field">
            <span>Tipo</span>
            <select data-cost-filter="expenseTypeId"><option value="">Todos</option>${opt(ctx.expenseTypes, 'expenseTypeId')}</select>
          </label>
          <label class="field">
            <span>Estado</span>
            <select data-cost-filter="status">
              <option value="">Todos</option>
              <option value="paid" ${f.status === 'paid' ? 'selected' : ''}>Pagado</option>
              <option value="pending" ${f.status === 'pending' ? 'selected' : ''}>Pendiente</option>
              <option value="cancelled" ${f.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
            </select>
          </label>
          <label class="field">
            <span>Moneda</span>
            <select data-cost-filter="currencyId"><option value="">Todas</option>${opt(ctx.currencies, 'currencyId', 'code')}</select>
          </label>
          <label class="field">
            <span>Proyecto (video)</span>
            <select data-cost-filter="projectVideoId"><option value="">Todos</option>${opt(ctx.videos, 'projectVideoId', 'title')}</select>
          </label>
          <label class="field">
            <span>Proyecto (serie)</span>
            <select data-cost-filter="projectSeriesId"><option value="">Todas</option>${opt(ctx.series, 'projectSeriesId')}</select>
          </label>
          <label class="field">
            <span>Proveedor/persona</span>
            <input type="text" data-cost-filter="recipient" value="${escapeHtml(f.recipient || '')}" placeholder="Nombre…" />
          </label>
          <label class="field">
            <span>Desde</span>
            <input type="date" data-cost-filter="dateFrom" value="${f.dateFrom || ''}" />
          </label>
          <label class="field">
            <span>Hasta</span>
            <input type="date" data-cost-filter="dateTo" value="${f.dateTo || ''}" />
          </label>
        </div>
        <button class="btn btn--ghost" data-action="clear-cost-filters">Limpiar filtros</button>
      </div>`;
  }

  function renderCostsExpensesTab(ctx) {
    const expenses = ctx.visibleExpenses || [];
    return `
      <div class="costs-expenses">
        ${renderCostsExpensesToolbar(ctx)}
        ${expenses.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Monto</th><th>Tipo</th><th>Estado</th><th>Medio de pago</th><th>Proyecto</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map((e) => renderExpenseRow(ctx, e)).join('')}
            </tbody>
          </table>
        </div>` : renderEmptyState({ title: 'Sin gastos todavía', message: 'Registrá tu primer gasto para empezar a llevar el control de costos del canal.', action: { action: 'new-expense', label: 'Nuevo gasto' } })}
      </div>`;
  }

  function renderExpenseRow(ctx, e) {
    const cat = byId(ctx.expenseCategories, e.categoryId);
    const type = byId(ctx.expenseTypes, e.expenseTypeId);
    const method = byId(ctx.paymentMethods, e.paymentMethodId);
    const meta = EXPENSE_STATUS_META[e.status] || EXPENSE_STATUS_META.pending;
    return `
      <tr class="${e.status === 'cancelled' ? 'row--archived' : ''}" data-id="${e.id}">
        <td>${formatDate(e.date, ctx.settings.dateFormat)}</td>
        <td class="col-title" data-action="open-expense" data-id="${e.id}">${escapeHtml(e.description || 'Sin descripción')}${e.subscriptionId ? ` ${icon('repeat', 'text-muted')}` : ''}</td>
        <td>${cat ? `${cat.icon || ''} ${escapeHtml(cat.name)}` : '<span class="muted">Sin categoría</span>'}</td>
        <td>${escapeHtml(e.recipient || '—')}</td>
        <td>${money(ctx, e.amount, e.currencyId)}</td>
        <td>${type ? escapeHtml(type.name) : '—'}</td>
        <td>${statusDot(meta.dot, meta.label)}</td>
        <td>${method ? escapeHtml(method.name) : '—'}</td>
        <td>${projectLabel(ctx, e)}</td>
        <td class="col-actions">
          <button class="icon-btn icon-btn--sm" data-action="open-expense" data-id="${e.id}" title="Ver/editar">${icon('edit')}</button>
          <button class="icon-btn icon-btn--sm" data-action="duplicate-expense" data-id="${e.id}" title="Duplicar">${icon('copy')}</button>
          ${e.status !== 'paid' ? `<button class="icon-btn icon-btn--sm" data-action="mark-expense-paid" data-id="${e.id}" title="Marcar como pagado">${icon('check')}</button>` : ''}
          <button class="icon-btn icon-btn--sm" data-action="delete-expense" data-id="${e.id}" title="Eliminar">${icon('trash')}</button>
        </td>
      </tr>`;
  }

  function renderExpenseFormModalBody(ctx, expense) {
    const isEdit = !!(expense && expense.id);
    const e = expense || {
      date: Utils.todayISO(), description: '', categoryId: '', recipient: '', amount: '', currencyId: '', expenseTypeId: '',
      status: 'pending', paymentMethodId: '', projectVideoId: '', projectSeriesId: '', notes: '', receiptUrl: '',
    };
    const defaultCurrency = ctx.currencies.find((c) => c.code === ctx.settings.costsDefaultCurrencyCode);
    const currencyId = e.currencyId || (defaultCurrency ? defaultCurrency.id : '');
    return `
      <div class="modal__header"><h3>${isEdit ? 'Editar gasto' : 'Nuevo gasto'}</h3></div>
      <div class="modal__body">
        <div class="form-grid">
          <label class="field">
            <span>Fecha *</span>
            <input type="date" id="expense-form-date" value="${e.date || ''}" />
          </label>
          <label class="field field--wide">
            <span>Concepto / descripción *</span>
            <input type="text" id="expense-form-description" value="${escapeHtml(e.description || '')}" placeholder="Ej. Edición de 4 videos" />
          </label>
          <label class="field">
            <span>Categoría *</span>
            <select id="expense-form-category">
              <option value="">Elegir…</option>
              ${ctx.expenseCategories.filter((c) => c.active).map((c) => `<option value="${c.id}" ${e.categoryId === c.id ? 'selected' : ''}>${c.icon || ''} ${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Proveedor o persona</span>
            <input type="text" id="expense-form-recipient" list="cost-recipients-datalist" value="${escapeHtml(e.recipient || '')}" placeholder="Nombre…" />
            <datalist id="cost-recipients-datalist">${ctx.recipients.filter((r) => r.active).map((r) => `<option value="${escapeHtml(r.name)}"></option>`).join('')}</datalist>
          </label>
          <label class="field">
            <span>Monto *</span>
            <input type="number" id="expense-form-amount" min="0" step="0.01" value="${e.amount ?? ''}" />
          </label>
          <label class="field">
            <span>Moneda *</span>
            <select id="expense-form-currency">
              <option value="">Elegir…</option>
              ${ctx.currencies.filter((c) => c.active).map((c) => `<option value="${c.id}" ${currencyId === c.id ? 'selected' : ''}>${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Tipo de gasto</span>
            <select id="expense-form-type">
              <option value="">Elegir…</option>
              ${ctx.expenseTypes.filter((t) => t.active).map((t) => `<option value="${t.id}" ${e.expenseTypeId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Estado *</span>
            <select id="expense-form-status">
              <option value="pending" ${e.status === 'pending' ? 'selected' : ''}>Pendiente</option>
              <option value="paid" ${e.status === 'paid' ? 'selected' : ''}>Pagado</option>
              <option value="cancelled" ${e.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
            </select>
          </label>
          <label class="field">
            <span>Medio de pago</span>
            <select id="expense-form-method">
              <option value="">Elegir…</option>
              ${ctx.paymentMethods.filter((m) => m.active).map((m) => `<option value="${m.id}" ${e.paymentMethodId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Proyecto — video</span>
            <select id="expense-form-project-video">
              <option value="">Ninguno</option>
              ${ctx.videos.filter((v) => !v.archived).map((v) => `<option value="${v.id}" ${e.projectVideoId === v.id ? 'selected' : ''}>${escapeHtml(v.title || 'Sin título')}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Proyecto — serie</span>
            <select id="expense-form-project-series">
              <option value="">Ninguna</option>
              ${ctx.series.filter((s) => !s.archived).map((s) => `<option value="${s.id}" ${e.projectSeriesId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field field--wide">
            <span>Comprobante (URL opcional)</span>
            <div class="drive-field__input">
              <input type="text" id="expense-form-receipt" value="${escapeHtml(e.receiptUrl || '')}" placeholder="https://…" />
              <button type="button" class="icon-btn icon-btn--sm" data-action="open-link" data-url="${escapeHtml(e.receiptUrl || '')}" title="Abrir" ${!e.receiptUrl ? 'disabled' : ''}>${icon('external')}</button>
            </div>
          </label>
          <label class="field field--wide">
            <span>Observaciones</span>
            <textarea id="expense-form-notes" rows="2">${escapeHtml(e.notes || '')}</textarea>
          </label>
        </div>
        <p class="muted small">* Campos obligatorios: fecha, descripción, categoría, monto, moneda y estado.</p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="${isEdit ? 'submit-edit-expense' : 'submit-new-expense'}" data-id="${isEdit ? expense.id : ''}">${isEdit ? 'Guardar' : 'Crear gasto'}</button>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Suscripciones                                                       */
  /* ------------------------------------------------------------------ */

  function renderCostsSubscriptionsTab(ctx) {
    const subs = ctx.subscriptions.slice().sort((a, b) => new Date(a.nextBillingDate || 0) - new Date(b.nextBillingDate || 0));
    return `
      <div class="costs-subscriptions">
        <div class="videos-toolbar costs-toolbar">
          <h3 class="costs-subtitle">Suscripciones y pagos recurrentes</h3>
          <button class="btn btn--primary" data-action="new-subscription">${icon('plus')} Nueva suscripción</button>
        </div>
        ${subs.length ? `<div class="subscriptions-grid">${subs.map((s) => renderSubscriptionCard(ctx, s)).join('')}</div>` : renderEmptyState({ title: 'Sin suscripciones todavía', message: 'Agregá los servicios que pagás de forma recurrente (Adobe, hosting, herramientas de IA, etc.) para llevar el control de sus vencimientos.', action: { action: 'new-subscription', label: 'Nueva suscripción' } })}
      </div>`;
  }

  function renderSubscriptionCard(ctx, s) {
    const cat = byId(ctx.expenseCategories, s.categoryId);
    const threshold = ctx.settings.costsUpcomingDaysThreshold ?? 7;
    return `
      <div class="subscription-card">
        <div class="subscription-card__header">
          <span class="subscription-card__name" data-action="open-subscription" data-id="${s.id}">${escapeHtml(s.name)}</span>
          <div class="dropdown subscription-card__menu">
            <button class="icon-btn icon-btn--sm" data-action="toggle-menu" data-menu="sub-${s.id}">${icon('dots')}</button>
            <div class="dropdown__menu" id="menu-sub-${s.id}" hidden>
              <button data-action="open-subscription" data-id="${s.id}">Editar</button>
              ${s.status !== 'cancelled' ? `<button data-action="register-subscription-payment" data-id="${s.id}">Registrar pago</button>` : ''}
              ${s.status === 'active' ? `<button data-action="pause-subscription" data-id="${s.id}">Pausar</button>` : ''}
              ${s.status === 'paused' ? `<button data-action="reactivate-subscription" data-id="${s.id}">Reactivar</button>` : ''}
              ${s.status !== 'cancelled' ? `<button data-action="cancel-subscription" data-id="${s.id}">Cancelar</button>` : ''}
              <button data-action="delete-subscription" data-id="${s.id}">Eliminar</button>
            </div>
          </div>
        </div>
        <div class="subscription-card__amount">${money(ctx, s.amount, s.currencyId)} <span class="muted small">/ ${(FREQUENCY_LABELS[s.frequency] || '').toLowerCase() || 'personalizada'}</span></div>
        <div class="subscription-card__meta">
          ${cat ? `<span>${cat.icon || ''} ${escapeHtml(cat.name)}</span>` : ''}
          <span>${subscriptionBillingBadge(s, threshold)}</span>
        </div>
        <div class="subscription-card__meta small muted">
          <span>Próximo cobro: ${formatDate(s.nextBillingDate, ctx.settings.dateFormat)}</span>
          ${s.autoRenew ? '<span>· Renovación automática</span>' : '<span>· Sin renovación automática</span>'}
        </div>
        ${s.projectVideoId || s.projectSeriesId ? `<div class="small muted">Proyecto: ${projectLabel(ctx, s)}</div>` : ''}
        <div class="subscription-card__actions">
          ${s.status !== 'cancelled' ? `<button class="btn btn--secondary btn--sm" data-action="register-subscription-payment" data-id="${s.id}">Registrar pago</button>` : ''}
          <button class="btn btn--ghost btn--sm" data-action="open-subscription" data-id="${s.id}">Editar</button>
        </div>
      </div>`;
  }

  function renderSubscriptionFormModalBody(ctx, sub) {
    const isEdit = !!(sub && sub.id);
    const s = sub || {
      name: '', categoryId: '', description: '', amount: '', currencyId: '', frequency: 'monthly',
      customFrequencyValue: '', customFrequencyUnit: 'months', nextBillingDate: Utils.todayISO(), startDate: Utils.todayISO(),
      paymentMethodId: '', status: 'active', autoRenew: true, projectVideoId: '', projectSeriesId: '', website: '', notes: '',
    };
    const defaultCurrency = ctx.currencies.find((c) => c.code === ctx.settings.costsDefaultCurrencyCode);
    const currencyId = s.currencyId || (defaultCurrency ? defaultCurrency.id : '');
    return `
      <div class="modal__header"><h3>${isEdit ? 'Editar suscripción' : 'Nueva suscripción'}</h3></div>
      <div class="modal__body">
        <div class="form-grid">
          <label class="field field--wide">
            <span>Nombre del servicio *</span>
            <input type="text" id="sub-form-name" value="${escapeHtml(s.name)}" placeholder="Ej. Adobe Creative Cloud" />
          </label>
          <label class="field">
            <span>Categoría</span>
            <select id="sub-form-category">
              <option value="">Elegir…</option>
              ${ctx.expenseCategories.filter((c) => c.active).map((c) => `<option value="${c.id}" ${s.categoryId === c.id ? 'selected' : ''}>${c.icon || ''} ${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field field--wide">
            <span>Descripción</span>
            <input type="text" id="sub-form-description" value="${escapeHtml(s.description || '')}" />
          </label>
          <label class="field">
            <span>Precio *</span>
            <input type="number" id="sub-form-amount" min="0" step="0.01" value="${s.amount ?? ''}" />
          </label>
          <label class="field">
            <span>Moneda *</span>
            <select id="sub-form-currency">
              <option value="">Elegir…</option>
              ${ctx.currencies.filter((c) => c.active).map((c) => `<option value="${c.id}" ${currencyId === c.id ? 'selected' : ''}>${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Frecuencia *</span>
            <select id="sub-form-frequency">
              <option value="monthly" ${s.frequency === 'monthly' ? 'selected' : ''}>Mensual</option>
              <option value="quarterly" ${s.frequency === 'quarterly' ? 'selected' : ''}>Trimestral</option>
              <option value="biannual" ${s.frequency === 'biannual' ? 'selected' : ''}>Semestral</option>
              <option value="annual" ${s.frequency === 'annual' ? 'selected' : ''}>Anual</option>
              <option value="custom" ${s.frequency === 'custom' ? 'selected' : ''}>Personalizada</option>
            </select>
          </label>
          ${s.frequency === 'custom' ? `
          <label class="field">
            <span>Cada</span>
            <input type="number" id="sub-form-custom-value" min="1" step="1" value="${s.customFrequencyValue || ''}" />
          </label>
          <label class="field">
            <span>Unidad</span>
            <select id="sub-form-custom-unit">
              <option value="days" ${s.customFrequencyUnit === 'days' ? 'selected' : ''}>Días</option>
              <option value="months" ${s.customFrequencyUnit === 'months' ? 'selected' : ''}>Meses</option>
            </select>
          </label>` : ''}
          <label class="field">
            <span>Próxima fecha de cobro *</span>
            <input type="date" id="sub-form-next-billing" value="${s.nextBillingDate || ''}" />
          </label>
          <label class="field">
            <span>Fecha de inicio</span>
            <input type="date" id="sub-form-start-date" value="${s.startDate || ''}" />
          </label>
          <label class="field">
            <span>Medio de pago</span>
            <select id="sub-form-method">
              <option value="">Elegir…</option>
              ${ctx.paymentMethods.filter((m) => m.active).map((m) => `<option value="${m.id}" ${s.paymentMethodId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Estado</span>
            <select id="sub-form-status">
              <option value="active" ${s.status === 'active' ? 'selected' : ''}>Activa</option>
              <option value="paused" ${s.status === 'paused' ? 'selected' : ''}>Pausada</option>
              <option value="cancelled" ${s.status === 'cancelled' ? 'selected' : ''}>Cancelada</option>
            </select>
          </label>
          <label class="switch">
            <input type="checkbox" id="sub-form-autorenew" ${s.autoRenew ? 'checked' : ''} />
            <span>Renovación automática</span>
          </label>
          <label class="field">
            <span>Proyecto — video</span>
            <select id="sub-form-project-video">
              <option value="">Ninguno</option>
              ${ctx.videos.filter((v) => !v.archived).map((v) => `<option value="${v.id}" ${s.projectVideoId === v.id ? 'selected' : ''}>${escapeHtml(v.title || 'Sin título')}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Proyecto — serie</span>
            <select id="sub-form-project-series">
              <option value="">Ninguna</option>
              ${ctx.series.filter((s2) => !s2.archived).map((s2) => `<option value="${s2.id}" ${s.projectSeriesId === s2.id ? 'selected' : ''}>${escapeHtml(s2.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field field--wide">
            <span>Sitio web (opcional)</span>
            <div class="drive-field__input">
              <input type="text" id="sub-form-website" value="${escapeHtml(s.website || '')}" placeholder="https://…" />
              <button type="button" class="icon-btn icon-btn--sm" data-action="open-link" data-url="${escapeHtml(s.website || '')}" title="Abrir" ${!s.website ? 'disabled' : ''}>${icon('external')}</button>
            </div>
          </label>
          <label class="field field--wide">
            <span>Observaciones</span>
            <textarea id="sub-form-notes" rows="2">${escapeHtml(s.notes || '')}</textarea>
          </label>
        </div>
        <p class="muted small">* Campos obligatorios: nombre, precio, moneda, frecuencia y próxima fecha de cobro.</p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
        <button class="btn btn--primary" data-action="${isEdit ? 'submit-edit-subscription' : 'submit-new-subscription'}" data-id="${isEdit ? sub.id : ''}">${isEdit ? 'Guardar' : 'Crear suscripción'}</button>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Configuración de Costos                                             */
  /* ------------------------------------------------------------------ */

  const COST_SETTINGS_SECTIONS = [
    { key: 'categories', label: 'Categorías' },
    { key: 'types', label: 'Tipos de gasto' },
    { key: 'paymentMethods', label: 'Medios de pago' },
    { key: 'currencies', label: 'Monedas' },
    { key: 'recipients', label: 'Proveedores frecuentes' },
    { key: 'preferences', label: 'Preferencias' },
  ];

  function costEntityUsage(ctx, type, id) {
    if (type === 'categories') return ctx.expenses.filter((e) => e.categoryId === id).length + ctx.subscriptions.filter((s) => s.categoryId === id).length;
    if (type === 'types') return ctx.expenses.filter((e) => e.expenseTypeId === id).length;
    if (type === 'paymentMethods') return ctx.expenses.filter((e) => e.paymentMethodId === id).length + ctx.subscriptions.filter((s) => s.paymentMethodId === id).length;
    if (type === 'currencies') return ctx.expenses.filter((e) => e.currencyId === id).length + ctx.subscriptions.filter((s) => s.currencyId === id).length;
    return 0;
  }

  function renderCostsSettingsTab(ctx) {
    const section = ctx.costSettingsSection || 'categories';
    let body = '';
    if (section === 'categories') body = renderExpenseCategoriesSettings(ctx);
    else if (section === 'types') body = renderExpenseTypesSettings(ctx);
    else if (section === 'paymentMethods') body = renderPaymentMethodsSettings(ctx);
    else if (section === 'currencies') body = renderCurrenciesSettings(ctx);
    else if (section === 'recipients') body = renderRecipientsSettings(ctx);
    else if (section === 'preferences') body = renderCostsPreferencesSettings(ctx);
    return `
      <div class="settings-layout">
        <nav class="settings-nav">
          ${COST_SETTINGS_SECTIONS.map((s) => `
            <button class="settings-nav__item ${section === s.key ? 'settings-nav__item--active' : ''}" data-action="cost-settings-section" data-section="${s.key}">
              ${escapeHtml(s.label)}
            </button>`).join('')}
        </nav>
        <div class="settings-body">${body}</div>
      </div>`;
  }

  function renderExpenseCategoriesSettings(ctx) {
    const items = ctx.expenseCategories.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Categorías de gastos', 'Se usan en gastos y suscripciones. Podés crear las que necesites: estas son solo un punto de partida.')}
        <div class="entity-list">
          ${items.map((c, i) => `
            <div class="entity-row ${!c.active ? 'entity-row--archived' : ''}" data-id="${c.id}">
              <div class="entity-row__reorder">${reorderButtons('expenseCategories', c.id, i === 0, i === items.length - 1)}</div>
              <input type="text" class="entity-row__icon" data-cost-entity="expenseCategories" data-id="${c.id}" data-field="icon" value="${escapeHtml(c.icon || '')}" maxlength="2" />
              <input type="text" class="entity-row__name" data-cost-entity="expenseCategories" data-id="${c.id}" data-field="name" value="${escapeHtml(c.name)}" />
              <span class="small muted">${costEntityUsage(ctx, 'categories', c.id)} uso(s)</span>
              <label class="switch" title="Activa">
                <input type="checkbox" data-cost-entity="expenseCategories" data-id="${c.id}" data-field="active" ${c.active ? 'checked' : ''} />
                <span>Activa</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-cost-entity" data-entity="expenseCategories" data-id="${c.id}" title="Eliminar">${icon('trash')}</button>
            </div>`).join('') || '<p class="muted">Todavía no hay categorías creadas.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-cost-entity" data-entity="expenseCategories">${icon('plus')} Nueva categoría</button>
      </div>`;
  }

  function renderExpenseTypesSettings(ctx) {
    const items = ctx.expenseTypes.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Tipos de gasto', 'Ej. gasto único, recurrente, compra, servicio, honorario. Ampliables sin tocar código.')}
        <div class="entity-list">
          ${items.map((t, i) => `
            <div class="entity-row ${!t.active ? 'entity-row--archived' : ''}" data-id="${t.id}">
              <div class="entity-row__reorder">${reorderButtons('expenseTypes', t.id, i === 0, i === items.length - 1)}</div>
              <input type="text" class="entity-row__name" data-cost-entity="expenseTypes" data-id="${t.id}" data-field="name" value="${escapeHtml(t.name)}" />
              <span class="small muted">${costEntityUsage(ctx, 'types', t.id)} uso(s)</span>
              <label class="switch" title="Activo">
                <input type="checkbox" data-cost-entity="expenseTypes" data-id="${t.id}" data-field="active" ${t.active ? 'checked' : ''} />
                <span>Activo</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-cost-entity" data-entity="expenseTypes" data-id="${t.id}" title="Eliminar">${icon('trash')}</button>
            </div>`).join('') || '<p class="muted">Todavía no hay tipos creados.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-cost-entity" data-entity="expenseTypes">${icon('plus')} Nuevo tipo</button>
      </div>`;
  }

  function renderPaymentMethodsSettings(ctx) {
    const items = ctx.paymentMethods.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Medios de pago', 'Ej. efectivo, transferencia, Mercado Pago, tarjetas, PayPal.')}
        <div class="entity-list">
          ${items.map((m, i) => `
            <div class="entity-row ${!m.active ? 'entity-row--archived' : ''}" data-id="${m.id}">
              <div class="entity-row__reorder">${reorderButtons('paymentMethods', m.id, i === 0, i === items.length - 1)}</div>
              <input type="text" class="entity-row__name" data-cost-entity="paymentMethods" data-id="${m.id}" data-field="name" value="${escapeHtml(m.name)}" />
              <span class="small muted">${costEntityUsage(ctx, 'paymentMethods', m.id)} uso(s)</span>
              <label class="switch" title="Activo">
                <input type="checkbox" data-cost-entity="paymentMethods" data-id="${m.id}" data-field="active" ${m.active ? 'checked' : ''} />
                <span>Activo</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-cost-entity" data-entity="paymentMethods" data-id="${m.id}" title="Eliminar">${icon('trash')}</button>
            </div>`).join('') || '<p class="muted">Todavía no hay medios de pago creados.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-cost-entity" data-entity="paymentMethods">${icon('plus')} Nuevo medio de pago</button>
      </div>`;
  }

  function renderCurrenciesSettings(ctx) {
    const items = ctx.currencies.slice().sort((a, b) => a.order - b.order);
    return `
      <div>
        ${settingsSectionHeader('Monedas', 'ARS y USD vienen por defecto. Podés agregar otras, pero recordá: no se hacen conversiones automáticas entre monedas.')}
        <div class="entity-list">
          ${items.map((c, i) => `
            <div class="entity-row ${!c.active ? 'entity-row--archived' : ''}" data-id="${c.id}">
              <div class="entity-row__reorder">${reorderButtons('currencies', c.id, i === 0, i === items.length - 1)}</div>
              <input type="text" class="entity-row__icon" data-cost-entity="currencies" data-id="${c.id}" data-field="code" value="${escapeHtml(c.code)}" maxlength="6" title="Código (ej. ARS)" />
              <input type="text" class="entity-row__name" data-cost-entity="currencies" data-id="${c.id}" data-field="name" value="${escapeHtml(c.name)}" placeholder="Nombre" />
              <input type="text" class="entity-row__icon" data-cost-entity="currencies" data-id="${c.id}" data-field="symbol" value="${escapeHtml(c.symbol || '')}" maxlength="4" title="Símbolo" />
              <input type="number" min="0" max="4" style="width:60px" data-cost-entity="currencies" data-id="${c.id}" data-field="decimalPlaces" value="${c.decimalPlaces ?? 2}" title="Decimales" />
              <span class="small muted">${costEntityUsage(ctx, 'currencies', c.id)} uso(s)</span>
              <label class="switch" title="Activa">
                <input type="checkbox" data-cost-entity="currencies" data-id="${c.id}" data-field="active" ${c.active ? 'checked' : ''} />
                <span>Activa</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-cost-entity" data-entity="currencies" data-id="${c.id}" title="Eliminar">${icon('trash')}</button>
            </div>`).join('') || '<p class="muted">Todavía no hay monedas creadas.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-cost-entity" data-entity="currencies">${icon('plus')} Nueva moneda</button>
      </div>`;
  }

  function renderRecipientsSettings(ctx) {
    const items = ctx.recipients.slice().sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div>
        ${settingsSectionHeader('Proveedores frecuentes', 'Personas o empresas a las que les pagás seguido (editor, diseñador, Adobe, Google, hosting…). Aparecen como sugerencia al cargar un gasto, pero el campo "Proveedor" del gasto siempre admite texto libre.')}
        <div class="entity-list">
          ${items.map((r) => `
            <div class="entity-row ${!r.active ? 'entity-row--archived' : ''}" data-id="${r.id}">
              <input type="text" class="entity-row__name" data-cost-entity="recipients" data-id="${r.id}" data-field="name" value="${escapeHtml(r.name)}" />
              <input type="text" class="entity-row__desc" data-cost-entity="recipients" data-id="${r.id}" data-field="notes" placeholder="Notas" value="${escapeHtml(r.notes || '')}" />
              <label class="switch" title="Activo">
                <input type="checkbox" data-cost-entity="recipients" data-id="${r.id}" data-field="active" ${r.active ? 'checked' : ''} />
                <span>Activo</span>
              </label>
              <button class="icon-btn icon-btn--sm" data-action="delete-cost-entity" data-entity="recipients" data-id="${r.id}" title="Eliminar">${icon('trash')}</button>
            </div>`).join('') || '<p class="muted">Todavía no hay proveedores guardados.</p>'}
        </div>
        <button class="btn btn--secondary" data-action="add-cost-entity" data-entity="recipients">${icon('plus')} Nuevo proveedor</button>
      </div>`;
  }

  function renderCostsPreferencesSettings(ctx) {
    const s = ctx.settings;
    return `
      <div>
        ${settingsSectionHeader('Preferencias de Costos', 'Ajustes generales del módulo.')}
        <div class="settings-card">
          <label class="field">
            <span>Moneda predeterminada en formularios nuevos</span>
            <select data-setting="costsDefaultCurrencyCode">
              ${ctx.currencies.filter((c) => c.active).map((c) => `<option value="${c.code}" ${s.costsDefaultCurrencyCode === c.code ? 'selected' : ''}>${escapeHtml(c.code)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Considerar "vence pronto" cuando falten (días)</span>
            <input type="number" min="1" max="60" data-setting="costsUpcomingDaysThreshold" value="${s.costsUpcomingDaysThreshold ?? 7}" />
          </label>
          <label class="field">
            <span>Pestaña predeterminada al entrar a Costos</span>
            <select data-setting="costsDefaultExpenseTab">
              ${COSTS_TABS.map((t) => `<option value="${t.key}" ${s.costsDefaultExpenseTab === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </label>
          <label class="switch">
            <input type="checkbox" data-setting="costsConfirmBeforeDelete" ${s.costsConfirmBeforeDelete ? 'checked' : ''} />
            <span>Confirmar antes de eliminar gastos/suscripciones</span>
          </label>
        </div>
      </div>`;
  }

  /** Modal de reasignación al eliminar una categoría/tipo/medio/moneda en uso. */
  function renderCostReassignModalBody(ctx, type, entity, count, others) {
    const label = { categories: 'la categoría', types: 'el tipo de gasto', paymentMethods: 'el medio de pago', currencies: 'la moneda' }[type] || 'el elemento';
    return `
      <div class="modal__header"><h3>Eliminar ${label}</h3></div>
      <div class="modal__body">
        <p>"${escapeHtml(entity.name || entity.code)}" está siendo utilizada en <strong>${count}</strong> gasto(s)/suscripción(es). Elegí qué hacer antes de eliminarla:</p>
        ${others.length ? `
        <label class="field field--wide">
          <span>Reasignar a…</span>
          <select id="cost-reassign-target">
            <option value="">Elegir…</option>
            ${others.map((o) => `<option value="${o.id}">${escapeHtml(o.name || o.code)}</option>`).join('')}
          </select>
        </label>` : '<p class="muted small">No hay otro elemento del mismo tipo para reasignar.</p>'}
      </div>
      <div class="modal__footer modal__footer--wrap">
        ${others.length ? `<button class="btn btn--primary" data-action="cost-reassign-and-delete" data-entity="${type}" data-id="${entity.id}">Reasignar y eliminar</button>` : ''}
        <button class="btn btn--secondary" data-action="cost-deactivate-instead" data-entity="${type}" data-id="${entity.id}">Desactivar en vez de eliminar</button>
        <button class="btn btn--ghost" data-action="modal-cancel">Cancelar</button>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* "Costos del proyecto": mini panel embebido en la ficha del video    */
  /* ------------------------------------------------------------------ */

  function renderProjectCostsBox(ctx, video) {
    const linked = ctx.expenses.filter((e) => e.projectVideoId === video.id);
    const notCancelled = linked.filter((e) => e.status !== 'cancelled');
    const paidSums = sumByCurrency(notCancelled.filter((e) => e.status === 'paid'));
    const pendingCount = notCancelled.filter((e) => e.status === 'pending').length;
    return `
      <div class="settings-card project-costs-box">
        <h4>Costos del proyecto</h4>
        <div class="project-costs-box__stats">
          <div><span class="muted small">Total gastado</span><br/>${renderMultiCurrencyAmount(ctx, paidSums)}</div>
          <div><span class="muted small">Gastos asociados</span><br/>${notCancelled.length}</div>
          <div><span class="muted small">Gastos pendientes</span><br/>${pendingCount}</div>
        </div>
        <button class="btn btn--secondary btn--sm" data-action="view-project-costs" data-video-id="${video.id}">Ver todos los costos</button>
      </div>`;
  }

  return {
    APP_VERSION,
    icon,
    Icons,
    pill,
    progressBar,
    checklistProgress,
    renderSidebar,
    renderMobileNav,
    renderTopbar,
    renderDashboard,
    renderThumbnailLab,
    renderVideosToolbar,
    renderFilterPanel,
    renderKanban,
    renderKanbanColumn,
    renderVideoCard,
    renderListView,
    renderCalendarView,
    renderEmptyState,
    renderComingSoon,
    renderVideoEditor,
    renderTeam,
    renderEmployeeModal,
    renderEditorTab,
    EDITOR_TABS,
    byId,
    SETTINGS_SECTIONS,
    renderSettingsShell,
    renderIdentitySettings,
    renderSeriesSettings,
    renderFormatsSettings,
    renderContentTypesSettings,
    renderStatesSettings,
    renderPrioritiesSettings,
    renderTagsSettings,
    renderTemplatesSettings,
    renderPreferencesSettings,
    renderBackupSettings,
    renderLibrarySettings,
    renderEditorLibraryTab,
    // Biblioteca
    LIBRARY_QUICK_FILTERS,
    RESOURCE_TYPE_META,
    resourceTypeMeta,
    renderLibraryView,
    renderLibraryFolderCard,
    renderLibraryItemCard,
    renderLibraryDetailPanel,
    renderFolderFormModalBody,
    renderNewLinkModalBody,
    renderMoveToModalBody,
    renderRelateVideosModalBody,
    renderLinkLibraryPickerModalBody,
    renderPasteImageModalBody,
    renderFileSizeWarningModalBody,
    // Costos
    COSTS_TABS,
    COST_SETTINGS_SECTIONS,
    renderCostsShell,
    renderCostsSummaryTab,
    renderCostsExpensesTab,
    renderCostsSubscriptionsTab,
    renderCostsSettingsTab,
    renderExpenseFormModalBody,
    renderSubscriptionFormModalBody,
    renderCostReassignModalBody,
    renderProjectCostsBox,
    money,
    sumByCurrency,
  };
})();
