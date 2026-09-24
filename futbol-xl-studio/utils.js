/**
 * utils.js
 * -----------------------------------------------------------------------
 * Funciones utilitarias genéricas, sin dependencias externas.
 * No contienen lógica de negocio específica de "videos" ni acceden a
 * IndexedDB: solo helpers reutilizables (fechas, strings, archivos, UI
 * de bajo nivel como toasts y diálogos de confirmación).
 * -----------------------------------------------------------------------
 */

const Utils = (() => {
  /* ------------------------------------------------------------------ */
  /* Identificadores                                                     */
  /* ------------------------------------------------------------------ */

  /** Genera un identificador único (usa crypto.randomUUID si existe). */
  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    // Fallback simple para navegadores sin randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Fechas                                                              */
  /* ------------------------------------------------------------------ */

  /** Devuelve la fecha actual en formato ISO (YYYY-MM-DD), sin hora. */
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Devuelve timestamp ISO completo (con hora). */
  function nowISO() {
    return new Date().toISOString();
  }

  /**
   * Formatea una fecha (YYYY-MM-DD o ISO) según el formato preferido.
   * @param {string} dateStr
   * @param {'dd/mm/yyyy'|'mm/dd/yyyy'|'yyyy-mm-dd'} format
   */
  function formatDate(dateStr, format = 'dd/mm/yyyy') {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    if (format === 'mm/dd/yyyy') return `${mm}/${dd}/${yyyy}`;
    if (format === 'yyyy-mm-dd') return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  }

  /** Formatea fecha + hora para historial/comentarios. */
  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  /** Días restantes (negativo = vencido) hasta una fecha YYYY-MM-DD. */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /** Determina si un video está vencido (fecha objetivo pasada y no publicado). */
  function isOverdue(targetDate, isFinalState) {
    if (!targetDate || isFinalState) return false;
    const days = daysUntil(targetDate);
    return days !== null && days < 0;
  }

  /** true si dos fechas ISO caen en el mismo mes/año. */
  function isSameMonth(dateStr, refDate = new Date()) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
  }

  /* ------------------------------------------------------------------ */
  /* Costos: fechas de facturación, meses, monedas                       */
  /* ------------------------------------------------------------------ */

  /** Clave "YYYY-MM" a partir de una fecha (para agrupar gastos por mes). */
  function monthKey(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Etiqueta legible ("ene 2026") a partir de una clave "YYYY-MM". */
  function monthKeyLabel(key) {
    if (!key) return '';
    const [y, m] = key.split('-').map(Number);
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${meses[m - 1] || ''} ${y}`;
  }

  /** Devuelve las últimas `count` claves "YYYY-MM" terminando en el mes actual. */
  function lastMonthKeys(count = 6, refDate = new Date()) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }

  /** Suma `months` meses a una fecha YYYY-MM-DD, preservando el día cuando es posible. */
  function addMonthsToDate(dateStr, months) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDayOfTargetMonth));
    return d.toISOString().slice(0, 10);
  }

  /** Suma `days` días a una fecha YYYY-MM-DD. */
  function addDaysToDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Calcula la próxima fecha de cobro de una suscripción a partir de la
   * fecha actual de cobro y su frecuencia. No modifica el string de
   * entrada; devuelve una nueva fecha YYYY-MM-DD.
   * frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'custom'
   * En 'custom', customFrequencyUnit es 'days' o 'months' y
   * customFrequencyValue es la cantidad.
   */
  function computeNextBillingDate(fromDateStr, frequency, customFrequencyValue, customFrequencyUnit) {
    if (!fromDateStr) return null;
    switch (frequency) {
      case 'monthly':
        return addMonthsToDate(fromDateStr, 1);
      case 'quarterly':
        return addMonthsToDate(fromDateStr, 3);
      case 'biannual':
        return addMonthsToDate(fromDateStr, 6);
      case 'annual':
        return addMonthsToDate(fromDateStr, 12);
      case 'custom': {
        const n = Math.max(1, parseInt(customFrequencyValue, 10) || 1);
        return customFrequencyUnit === 'months' ? addMonthsToDate(fromDateStr, n) : addDaysToDate(fromDateStr, n);
      }
      default:
        return addMonthsToDate(fromDateStr, 1);
    }
  }

  /** Formatea un monto según los datos de una moneda (símbolo + decimales). */
  function formatCurrency(amount, currency) {
    const n = Number(amount) || 0;
    const decimals = currency && Number.isInteger(currency.decimalPlaces) ? currency.decimalPlaces : 2;
    const symbol = currency && currency.symbol ? currency.symbol : '';
    const formatted = n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${symbol} ${formatted}`.trim();
  }

  /* ------------------------------------------------------------------ */
  /* Texto / strings                                                     */
  /* ------------------------------------------------------------------ */

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Trunca texto largo agregando "…" */
  function truncate(str, max = 80) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  /** Genera iniciales a partir de un nombre (para avatares/placeholders). */
  function initials(name, max = 3) {
    if (!name) return '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, max)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  /* ------------------------------------------------------------------ */
  /* Enlaces                                                             */
  /* ------------------------------------------------------------------ */

  /** Detecta el "tipo" de un enlace para mostrar el icono adecuado. */
  function detectLinkType(url) {
    if (!url) return 'web';
    const u = url.toLowerCase();
    if (u.includes('docs.google.com/spreadsheets')) return 'sheets';
    if (u.includes('docs.google.com/document')) return 'docs';
    if (u.includes('docs.google.com/presentation')) return 'slides';
    const isDriveFolder = u.includes('drive.google.com') && (u.includes('/folders/') || u.includes('folderview'));
    if (isDriveFolder) return 'driveFolder';
    if (u.includes('drive.google.com')) return 'drive';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('vimeo.com')) return 'vimeo';
    return 'web';
  }

  const LINK_ICONS = {
    drive: '📁',
    driveFolder: '🗂️',
    docs: '📄',
    sheets: '📊',
    slides: '📽️',
    youtube: '▶️',
    vimeo: '🎞️',
    web: '🔗',
  };

  function linkIcon(url) {
    return LINK_ICONS[detectLinkType(url)] || LINK_ICONS.web;
  }

  /** Extrae un dominio legible de una URL para mostrarlo en tarjetas de enlace. */
  function urlDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return url || '';
    }
  }

  /** Intenta extraer el ID de un video de YouTube para armar una miniatura. */
  function youtubeThumbnail(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  }

  /** Valida de forma permisiva si algo parece una URL. */
  function looksLikeUrl(str) {
    if (!str) return false;
    return /^https?:\/\/.+/i.test(str.trim());
  }

  /* ------------------------------------------------------------------ */
  /* Archivos / bytes                                                    */
  /* ------------------------------------------------------------------ */

  function formatBytes(bytes) {
    if (bytes === 0 || bytes === undefined || bytes === null) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  /** Lee un File/Blob y devuelve una dataURL (Promise). */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Genera una miniatura optimizada (JPEG) a partir de una dataURL de
   * imagen, usando un <canvas> oculto. Se usa en la Biblioteca para no
   * tener que renderizar los archivos originales a tamaño completo. Si la
   * imagen no puede dibujarse en canvas (algunos SVG con recursos externos,
   * por ejemplo) se resuelve con la dataURL original como respaldo, sin
   * romper la carga.
   */
  function generateThumbnail(dataUrl, maxDim = 320, quality = 0.72) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width <= 0 || height <= 0) {
              resolve(dataUrl);
              return;
            }
            if (width > height && width > maxDim) {
              height = Math.round(height * (maxDim / width));
              width = maxDim;
            } else if (height > maxDim) {
              width = Math.round(width * (maxDim / height));
              height = maxDim;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (e) {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch (e) {
        resolve(dataUrl);
      }
    });
  }

  /** Determina un resourceType razonable a partir del mime-type/nombre de archivo. */
  function resourceTypeFromFile(mimeType, fileName) {
    const name = (fileName || '').toLowerCase();
    if (mimeType?.startsWith('image/')) return 'image';
    if (mimeType?.startsWith('video/')) return 'video';
    if (mimeType?.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (/\.(docx?|txt|rtf|odt)$/.test(name)) return 'document';
    return 'other';
  }

  /**
   * Determina si `folderId` es descendiente de `ancestorId` (o el mismo)
   * dentro de una lista de carpetas con relación parentId. Se usa para
   * evitar mover una carpeta dentro de sí misma o de una de sus propias
   * subcarpetas (ciclos).
   */
  function isFolderDescendant(folders, folderId, ancestorId) {
    if (!folderId || !ancestorId) return false;
    if (folderId === ancestorId) return true;
    let current = folders.find((f) => f.id === folderId);
    const visited = new Set();
    while (current && current.parentId) {
      if (visited.has(current.id)) return false; // corte de seguridad ante datos corruptos
      visited.add(current.id);
      if (current.parentId === ancestorId) return true;
      current = folders.find((f) => f.id === current.parentId);
    }
    return false;
  }

  /** Descarga un objeto JS como archivo .json. */
  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Lee un archivo de tipo texto/JSON subido por el usuario. */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Clipboard                                                           */
  /* ------------------------------------------------------------------ */

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text || '');
      return true;
    } catch (err) {
      // Fallback para navegadores/entornos sin permisos de clipboard API
      try {
        const ta = document.createElement('textarea');
        ta.value = text || '';
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch (err2) {
        return false;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Debounce / throttle                                                 */
  /* ------------------------------------------------------------------ */

  function debounce(fn, wait = 300) {
    let t = null;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /* ------------------------------------------------------------------ */
  /* Colores                                                             */
  /* ------------------------------------------------------------------ */

  /** Devuelve blanco o negro según el contraste del color de fondo dado. */
  function contrastColor(hex) {
    if (!hex) return '#0a0a0a';
    const c = hex.replace('#', '');
    if (c.length !== 6) return '#0a0a0a';
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#0a0a0a' : '#ffffff';
  }

  /* ------------------------------------------------------------------ */
  /* Toasts (notificaciones no intrusivas)                               */
  /* ------------------------------------------------------------------ */

  function toast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    el.innerHTML = `<span class="toast__icon">${icons[type] || icons.info}</span><span class="toast__msg"></span>`;
    el.querySelector('.toast__msg').textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--show'));
    setTimeout(() => {
      el.classList.remove('toast--show');
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  /* ------------------------------------------------------------------ */
  /* Diálogo de confirmación genérico (basado en <dialog> nativo)        */
  /* ------------------------------------------------------------------ */

  function confirmDialog({ title = 'Confirmar', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('confirm-dialog');
      dialog.innerHTML = `
        <div class="modal__header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal__body">
          <p class="confirm-message">${escapeHtml(message)}</p>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      `;
      const close = (result) => {
        dialog.close();
        resolve(result);
      };
      dialog.querySelector('[data-action="cancel"]').onclick = () => close(false);
      dialog.querySelector('[data-action="confirm"]').onclick = () => close(true);
      dialog.oncancel = () => resolve(false);
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        // Fallback muy simple si <dialog> no está soportado
        resolve(window.confirm(message));
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Misc                                                                */
  /* ------------------------------------------------------------------ */

  /** Reordena un array moviendo un elemento de una posición a otra. */
  function arrayMove(arr, fromIndex, toIndex) {
    const copy = arr.slice();
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);
    return copy;
  }

  /** Devuelve true si el elemento activo del documento es un campo editable. */
  function isTypingInField() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable || tag === 'SELECT';
  }

  return {
    uuid,
    todayISO,
    nowISO,
    formatDate,
    formatDateTime,
    daysUntil,
    isOverdue,
    isSameMonth,
    monthKey,
    monthKeyLabel,
    lastMonthKeys,
    addMonthsToDate,
    addDaysToDate,
    computeNextBillingDate,
    formatCurrency,
    escapeHtml,
    truncate,
    initials,
    detectLinkType,
    linkIcon,
    urlDomain,
    youtubeThumbnail,
    looksLikeUrl,
    formatBytes,
    readFileAsDataURL,
    readFileAsText,
    generateThumbnail,
    resourceTypeFromFile,
    isFolderDescendant,
    downloadJSON,
    copyToClipboard,
    debounce,
    contrastColor,
    toast,
    confirmDialog,
    arrayMove,
    isTypingInField,
  };
})();
