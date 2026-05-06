// ═══════════════════════════════════════════
//  ui.js  —  Interface, affichage, modals, charts
// ═══════════════════════════════════════════
//
//  INDEX — fonctions & entrées principales (navigation rapide)
//  ───────────────────────────────────────────────────────────
//  Devise / TVA / formats : CUR, isAutoEntrepreneurVAT,
//    docIsAutoEntrepreneurExempt, fmtNum, fmt, today, yyyy, pad
//  Pagination listes (clients, stock) : getListPageSlice,
//    updateListPaginationUI
//  Footer / marque : invoFooterTaglineHtml, renderInvoSidebarFooterTagline
//  Recherche surlignée : highlightQuery
//  Toast & modales : toast, openModal, closeModal,
//    confirmMessageToPlainText, showConfirm, _confirmOk, _confirmCancel
//  Spinner PDF : showPdfSpinner, hidePdfSpinner, setPdfSpinnerStep
//  Navigation & chrome : sbItem, nav, toggleSidebar, openMobSidebar,
//    closeMobSidebar, toggleTheme, openWhatsApp
//  Selects thématiques : initThemedSelects, refreshThemedSelect
//  Graphiques (Chart.js) : makeAreaChart, makeDonutChart, makeBarChart
//  Boot & overview : init, setOvPeriod, getOvMonths, _setSkeletonLoading,
//    renderOverview, renderOvCAChart, renderOvStatusChart,
//    renderOvTopClients, renderOvTVA, renderOvAlerts
//  Recherche globale (⌘K) : globalKeyHandler, _getSearchFocusableEls,
//    _searchTrapFocus, openSearch, closeSearch, searchKeyNav,
//    _renderSearchQuickActions, renderSearchResults
//  Notifications : buildNotifications, updateNotifBadge, toggleNotifPanel,
//    renderNotifList, notifClick, markAllRead
//  Onboarding : checkOnboarding, renderObStep, obNext, skipOnboarding,
//    finishOnboarding
//
// ═══════════════════════════════════════════

// ── Format helpers ──
// ═══════════════════════════════════════════
const CUR = () => DB.settings.currency || 'DH';
/** TVA entreprise à 0 % (paramètre) = régime auto-entrepreneur / exonéré — pas de TVA sur les documents */
function isAutoEntrepreneurVAT() {
  const t = parseInt(String(DB.settings?.tva ?? '20'), 10);
  return t === 0;
}
/** PDF / affichage : document exonéré (pas de colonne TVA). Legacy sans flag : seulement si montant TVA du doc ≈ 0 */
function docIsAutoEntrepreneurExempt(doc) {
  if (!doc) return isAutoEntrepreneurVAT();
  if (doc.aeExempt === true) return true;
  if (doc.aeExempt === false) return false;
  return (Number(doc.tva) || 0) < 0.005;
}
function fmtNum(n) {
  const num = Number(n || 0);
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
}
function fmt(n) {
  return fmtNum(n) + '\u00a0' + CUR();
}
function today() {
  return new Date().toISOString().split('T')[0];
}
function yyyy() {
  return new Date().getFullYear();
}
function pad(n, w = 4) {
  return String(n).padStart(w, '0');
}

// ── Pagination listes (Clients, Stock) — Historique : APP.histPage / histPerPage dans docs.js
// ═══════════════════════════════════════════
var LIST_PAGE_SIZE = 50;
var _listPaging = {
  clients: { page: 1, key: '' },
  stock: { page: 1, key: '' },
};

/**
 * Découpe un tableau filtré selon la page courante ; réinitialise la page si la clé de filtres change.
 * @param {'clients'|'stock'} ns
 * @param {string} filterKey
 * @param {unknown[]} arr
 * @param {number} [pageSize]
 */
function getListPageSlice(ns, filterKey, arr, pageSize) {
  const ps = pageSize || LIST_PAGE_SIZE;
  const st = _listPaging[ns];
  if (!st || !Array.isArray(arr)) {
    return { rows: Array.isArray(arr) ? arr.slice() : [], page: 1, totalPages: 1, total: 0 };
  }
  if (st.key !== filterKey) {
    st.page = 1;
    st.key = filterKey;
  }
  const total = arr.length;
  if (total === 0) return { rows: [], page: 1, totalPages: 1, total: 0 };
  const totalPages = Math.ceil(total / ps);
  if (st.page > totalPages) st.page = totalPages;
  if (st.page < 1) st.page = 1;
  const start = (st.page - 1) * ps;
  return {
    rows: arr.slice(start, start + ps),
    page: st.page,
    totalPages,
    total,
  };
}

/**
 * Barre Préc. / Suiv. sous un tableau (masquée si une seule page).
 * @param {string} containerId
 * @param {'clients'|'stock'} ns
 * @param {() => void} rerender
 */
function updateListPaginationUI(containerId, ns, total, page, totalPages, pageSize, rerender) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (total <= pageSize) {
    clearChildren(el);
    el.style.display = 'none';
    return;
  }
  el.style.display = 'flex';
  clearChildren(el);
  el.style.cssText =
    'display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:10px 0 4px;font-size:13px;color:var(--text2)';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const info = document.createElement('span');
  info.textContent = `${start}–${end} sur ${total}`;
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'btn btn-secondary btn-sm';
  prev.textContent = '← Préc.';
  prev.disabled = page <= 1;
  prev.addEventListener('click', () => {
    _listPaging[ns].page--;
    rerender();
  });
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn-secondary btn-sm';
  next.textContent = 'Suiv. →';
  next.disabled = page >= totalPages;
  next.addEventListener('click', () => {
    _listPaging[ns].page++;
    rerender();
  });
  el.appendChild(prev);
  el.appendChild(info);
  el.appendChild(next);
}
/* escapeHtml : js/html-safe.js (chargé avant ce fichier) */

/**
 * Mentions / copyright INVOO OFFICE (année dynamique : new Date().getFullYear()).
 * @param {'sidebar'|'auth'|'auth-compact'|'print'} variant
 */
function invoFooterTaglineHtml(variant) {
  const y = new Date().getFullYear();
  const linkClass = variant === 'print' ? 'invo-link-print' : 'invo-link-auth';
  const core =
    'INVOO OFFICE · Système de facturation intelligent ·<br>Données 100 % locales · Conforme DGI Maroc © ' +
    y +
    ' INVOO OFFICE · <a href="paiement.html" class="' +
    linkClass +
    '">Paiement de licence</a>';
  if (variant === 'sidebar') {
    return (
      '<div class="sb-footer-tagline-inner">' +
      core +
      '</div>'
    );
  }
  if (variant === 'auth') {
    return (
      '<div class="invo-auth-footer-tagline invo-auth-footer-tagline-main">' +
      core +
      '</div>'
    );
  }
  if (variant === 'auth-compact') {
    return (
      '<div class="invo-auth-footer-tagline invo-auth-footer-tagline-compact">' +
      core +
      '</div>'
    );
  }
  if (variant === 'print') {
    return (
      '<div class="footer footer-print-tagline">' +
      core +
      '</div>'
    );
  }
  return core;
}
window.invoFooterTaglineHtml = invoFooterTaglineHtml;

function renderInvoSidebarFooterTagline() {
  const el = document.getElementById('app-footer-tagline');
  if (el) setStaticHtml(el, invoFooterTaglineHtml('sidebar'));
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderInvoSidebarFooterTagline);
  } else {
    renderInvoSidebarFooterTagline();
  }
}

/**
 * Surligne une recherche (HTML échappé — voir js/html-safe.js).
 * @param {string} [markStyle] — styles CSS du <mark> (défaut : surlignage vert)
 */
function highlightQuery(text, q, markStyle) {
  return highlightQueryHtml(text, q, markStyle);
}

// ── Toast ──
// ═══════════════════════════════════════════
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  const el = document.createElement('div');
  const cls =
    type === 'err' ? 'err' : type === 'suc' ? 'suc' : type === 'warn' ? 'warn' : '';
  el.className = 'toast-item ' + cls;
  const prefix =
    type === 'suc' ? '✅ ' : type === 'err' ? '❌ ' : type === 'warn' ? '⚠️ ' : 'ℹ️ ';
  el.textContent = prefix + msg;
  t.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    if (el.getAttribute('role') === 'dialog') el.setAttribute('aria-hidden', 'true');
  }
}
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    if (el.getAttribute('role') === 'dialog') el.setAttribute('aria-hidden', 'false');
  }
}

// ── Modal confirmation ──
// ═══════════════════════════════════════════
/** Affichage sûr : pas d’innerHTML (évite XSS si le message contient des données utilisateur). */
function confirmMessageToPlainText(message) {
  return String(message ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}
let _confirmResolve = null;
function showConfirm({
  title = 'Confirmer',
  message,
  icon = '⚠️',
  okLabel = 'Confirmer',
  okStyle = 'danger',
  cancelLabel = 'Annuler',
} = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    const msgEl = document.getElementById('confirm-message');
    if (msgEl) {
      msgEl.style.whiteSpace = 'pre-line';
      msgEl.textContent = confirmMessageToPlainText(message);
    }
    document.getElementById('confirm-icon').textContent = icon;
    document.getElementById('confirm-btn-cancel').textContent = cancelLabel;
    const okBtn = document.getElementById('confirm-btn-ok');
    okBtn.textContent = okLabel;
    okBtn.className =
      'btn ' +
      (okStyle === 'danger'
        ? 'btn-danger'
        : okStyle === 'primary'
          ? 'btn-primary'
          : 'btn-secondary');
    openModal('modal-confirm');
  });
}
function _confirmOk() {
  closeModal('modal-confirm');
  if (_confirmResolve) {
    _confirmResolve(true);
    _confirmResolve = null;
  }
}
function _confirmCancel() {
  closeModal('modal-confirm');
  if (_confirmResolve) {
    _confirmResolve(false);
    _confirmResolve = null;
  }
}

// ── Spinner PDF ──
// ═══════════════════════════════════════════
function showPdfSpinner(label = 'Génération PDF…') {
  const ov = document.getElementById('pdf-spinner-overlay');
  if (!ov) return;
  document.getElementById('pdf-spinner-label').textContent = label;
  document.getElementById('pdf-spinner-step').textContent = 'Préparation du document';
  document.getElementById('pdf-spinner-bar').style.width = '0%';
  ov.style.display = 'flex';
}
function hidePdfSpinner() {
  const ov = document.getElementById('pdf-spinner-overlay');
  if (ov) ov.style.display = 'none';
}
function setPdfSpinnerStep(text, pct) {
  const step = document.getElementById('pdf-spinner-step');
  const bar = document.getElementById('pdf-spinner-bar');
  if (step) step.textContent = text;
  if (bar && pct !== undefined) bar.style.width = pct + '%';
}

// ── Navigation (nav, toggleSidebar, mobile sidebar) ──
// ═══════════════════════════════════════════
const pageMap = {
  overview: "Vue d'ensemble",
  generate: 'Générer Document',
  history: 'Historique',
  reports: 'Rapports / Fiscal',
  stock: 'Gestion Stock',
  clients: 'Clients',
  fournisseurs: 'Fournisseurs',
  'bons-commande': 'Bons de commande',
  settings: 'Paramètres',
};
function sbItem(pageId) {
  return document.querySelector(`.sb-item[data-page="${pageId}"]`);
}
function nav(id, el) {
  const prevPageId = document.querySelector('.page.active')?.id;
  // QUAL-04: si on quitte "history", revenir à la page 1 à l'entrée suivante
  try {
    if (prevPageId === 'page-history' && id !== 'history') {
      if (typeof APP?.histPage !== 'undefined') APP.histPage = 1;
    }
  } catch (_) {}

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  if (el && el.classList.contains('sb-item')) el.classList.add('active');
  else {
    const found = sbItem(id);
    if (found) found.classList.add('active');
  }
  // Sync mobile tab bar
  document.querySelectorAll('.mob-tab[data-page]').forEach(t => {
    t.classList.toggle('active', t.dataset.page === id);
  });
  const tt = document.getElementById('topbar-title');
  if (tt) tt.textContent = pageMap[id] || id;
  const tb = document.getElementById('topbar-badge');
  if (tb) tb.textContent = pageMap[id] || id;
  if (id === 'overview') renderOverview();
  if (id === 'history') {
    populateHistClientFilter();
    renderHistory();
  }
  if (id === 'reports') renderReports();
  if (id === 'stock') renderStock();
  if (id === 'clients') renderClients();
  if (id === 'fournisseurs') renderFournisseurs();
  if (id === 'bons-commande') renderBonsCommande();
  // Ne pas rappeler loadSettings si on est déjà sur Paramètres (évite de réinitialiser le curseur logo / champs non sauvegardés)
  if (id === 'settings' && prevPageId !== 'page-settings') loadSettings();
  if (id === 'generate') {
    populateDocClient();
    initDocLines();
    setTimeout(runDGICheck, 50);
  }
  // Auto-close sidebar drawer on mobile after nav
  if (window.innerWidth <= 768) closeMobSidebar();
}
function toggleSidebar() {
  if (window.innerWidth <= 768) {
    const sb = document.getElementById('sidebar');
    sb.classList.contains('mob-open') ? closeMobSidebar() : openMobSidebar();
  } else {
    document.getElementById('sidebar')?.classList.toggle('collapsed');
  }
}
function openMobSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.add('mob-open');
  ov.classList.add('open');
  // drawer open - overlay handles the background
}
function closeMobSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.remove('mob-open');
  ov.classList.remove('open');
  // drawer closed
}
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const ti = document.getElementById('theme-icon');
  if (ti) ti.textContent = isDark ? '🌙' : '☀️';
  const tbi = document.getElementById('theme-btn-icon');
  if (tbi) tbi.textContent = isDark ? '🌙' : '☀️';
}
function openWhatsApp() {
  window.open(
    'https://wa.me/212630230803?text=Bonjour%2C%20besoin%20d%27aide%20INVOO%20OFFICE',
    '_blank',
  );
}

// ── Themed selects (custom dropdown) ──
// ═══════════════════════════════════════════
function initThemedSelects(scope = document) {
  scope.querySelectorAll('select').forEach(sel => {
    if (sel.classList.contains('themed-select-native')) return;
    if (sel.matches('[multiple]')) return;
    if (sel.dataset.lineTvaSelect === '1') return;
    if (sel.closest('.inv-line')) return;
    if (sel.id === 'f-score') return;
    if (sel.style.display === 'none') return;
    if (sel.dataset.tselReady === '1') {
      refreshThemedSelect(sel.id);
      return;
    }
    sel.dataset.tselReady = '1';

    const wrap = document.createElement('div');
    wrap.className = 'tselect';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('themed-select-native');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tselect-trigger';
    const label = document.createElement('span');
    label.className = 'tselect-label';
    const caret = document.createElement('span');
    caret.className = 'tselect-caret';
    caret.textContent = '▾';
    trigger.appendChild(label);
    trigger.appendChild(caret);

    const menu = document.createElement('div');
    menu.className = 'tselect-menu';

    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    let focusIdx = -1;
    const getItems = () => [...menu.querySelectorAll('.tselect-option:not(.disabled)')];
    const setFocus = idx => {
      const items = getItems();
      if (!items.length) return;
      focusIdx = Math.max(0, Math.min(idx, items.length - 1));
      items.forEach((it, i) => it.classList.toggle('focused', i === focusIdx));
      items[focusIdx].scrollIntoView({ block: 'nearest' });
    };
    const open = () => {
      wrap.classList.add('open');
      const items = getItems();
      const activeIdx = items.findIndex(it => it.classList.contains('active'));
      setFocus(activeIdx >= 0 ? activeIdx : 0);
    };
    const close = () => {
      wrap.classList.remove('open');
      focusIdx = -1;
      menu
        .querySelectorAll('.tselect-option.focused')
        .forEach(it => it.classList.remove('focused'));
    };
    const render = () => {
      const opts = [...sel.options];
      clearChildren(menu);
      opts.forEach(o => {
        const item = document.createElement('div');
        item.className =
          'tselect-option' +
          (o.disabled ? ' disabled' : '') +
          (o.value === sel.value ? ' active' : '');
        item.textContent = o.textContent;
        item.addEventListener('click', () => {
          if (o.disabled) return;
          sel.value = o.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          render();
          close();
        });
        menu.appendChild(item);
      });
      const current = opts.find(o => o.value === sel.value) || opts[0];
      label.textContent = current ? current.textContent : '—';
    };

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      if (wrap.classList.contains('open')) close();
      else open();
    });
    trigger.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!wrap.classList.contains('open')) open();
        else setFocus(focusIdx + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!wrap.classList.contains('open')) open();
        else setFocus(focusIdx - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!wrap.classList.contains('open')) open();
        else {
          const items = getItems();
          const target = items[focusIdx] || items[0];
          if (target) target.click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        trigger.blur();
      } else if (e.key === 'Tab') {
        close();
      }
    });
    menu.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus(focusIdx + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus(focusIdx - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const items = getItems();
        const target = items[focusIdx] || items[0];
        if (target) target.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        trigger.focus();
      }
    });
    sel.addEventListener('change', render);
    render();
  });
}

function refreshThemedSelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const wrap = sel.closest('.tselect');
  if (!wrap) {
    initThemedSelects(document);
    return;
  }
  sel.dispatchEvent(new Event('change', { bubbles: false }));
}

document.addEventListener('click', e => {
  document.querySelectorAll('.tselect.open').forEach(w => {
    if (!w.contains(e.target)) w.classList.remove('open');
  });
});

// ── Charts (style Vinted dark) ──
// ═══════════════════════════════════════════
const TEAL = '#09BC8A',
  TEAL_A = 'rgba(9,188,138,0.15)',
  GOLD = '#F0A500',
  RED = '#EF4444',
  BLUE = '#3B82F6';
const GRID_COLOR = 'rgba(255,255,255,0.05)',
  TICK_COLOR = '#5A7089';

function makeAreaChart(canvasId, labels, datasets) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  return new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(d => ({
        ...d,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: { color: TICK_COLOR, font: { size: 11 }, usePointStyle: true, boxWidth: 8 },
        },
        tooltip: {
          backgroundColor: '#1a2736',
          borderColor: 'rgba(9,188,138,0.3)',
          borderWidth: 1,
          titleColor: '#E8EEF4',
          bodyColor: '#94A8BE',
          padding: 10,
        },
      },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR, font: { size: 11 } } },
        y: {
          grid: { color: GRID_COLOR },
          ticks: { color: TICK_COLOR, font: { size: 11 } },
          beginAtZero: true,
        },
      },
    },
  });
}
function makeDonutChart(canvasId, labels, data, colors) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  return new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: '#141f2b', borderWidth: 3 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2736',
          borderColor: 'rgba(9,188,138,0.3)',
          borderWidth: 1,
          titleColor: '#E8EEF4',
          bodyColor: '#94A8BE',
          padding: 10,
        },
      },
    },
  });
}
function makeBarChart(canvasId, labels, datasets) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  return new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(d => ({ ...d, borderRadius: 4, borderSkipped: false })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: { color: TICK_COLOR, font: { size: 11 }, usePointStyle: true, boxWidth: 8 },
        },
        tooltip: {
          backgroundColor: '#1a2736',
          borderColor: 'rgba(9,188,138,0.3)',
          borderWidth: 1,
          titleColor: '#E8EEF4',
          bodyColor: '#94A8BE',
          padding: 10,
        },
      },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR, font: { size: 11 } } },
        y: {
          grid: { color: GRID_COLOR },
          ticks: { color: TICK_COLOR, font: { size: 11 } },
          beginAtZero: true,
        },
      },
    },
  });
}

// ── Override renderOverview charts ──
// ═══════════════════════════════════════════

function init() {
  // DB.settings.color est réservé à la couleur de l'en-tête des documents (factures/devis),
  // il ne doit pas modifier --brand de l'interface.
  const docDate = document.getElementById('doc-date');
  if (docDate) docDate.value = today();
  initThemedSelects(document);
  updateDocRef();
  const scheduleOverview =
    typeof requestIdleCallback === 'function'
      ? cb => requestIdleCallback(cb, { timeout: 300 })
      : cb => setTimeout(cb, 0);
  scheduleOverview(() => renderOverview());
  checkOnboarding();
  buildNotifications();
  if (typeof checkBackupReminder === 'function') checkBackupReminder();
  if (typeof renderBackupReminderStatus === 'function') renderBackupReminderStatus();
  if (typeof invooSupabaseTryAutoStart === 'function') {
    setTimeout(() => void invooSupabaseTryAutoStart(), 1200);
  }
  applyDeepLinkFromHash();
  // ⚠️ Les listeners 'keydown' (globalKeyHandler) et 'click' (fermeture notif-panel)
  // sont enregistrés UNE SEULE FOIS dans events.js (DOMContentLoaded).
  // Ne pas les ajouter ici pour éviter le double déclenchement.
}

/** Raccourcis manifest / liens #generate, #history, etc. */
function applyDeepLinkFromHash() {
  const h = (location.hash || '').replace(/^#/, '').trim();
  if (!h) return;
  const pages = new Set([
    'overview',
    'generate',
    'history',
    'reports',
    'stock',
    'clients',
    'fournisseurs',
    'bons-commande',
    'settings',
  ]);
  if (!pages.has(h)) return;
  const btn = document.querySelector(`.sb-item[data-page="${h}"]`);
  if (btn) nav(h, btn);
}

// ── Overview analytics ──
// ═══════════════════════════════════════════
/** Uniquement les boutons Vue d'ensemble ([data-ov-period]) — pas ceux de la page Rapports (.ov-period-btn + data-rep-period). */
function setOvPeriod(n, btn) {
  APP.ovPeriodMonths = n;
  document.querySelectorAll('[data-ov-period]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderOverview();
}
function getOvMonths(n) {
  const now = new Date(),
    months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      yr: d.getFullYear(),
      mo: d.getMonth(),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return months;
}
function _setSkeletonLoading(ids, loading) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('skeleton-block', !!loading);
    el.setAttribute('aria-busy', loading ? 'true' : 'false');
  });
}
function renderOverview(_deferred) {
  if (!document.getElementById('stat-ca')) return;
  if (!_deferred) {
    _setSkeletonLoading(['ov-chart-ca', 'ov-chart-status', 'ov-top-clients', 'ov-tva-breakdown'], true);
    if (APP._ovRenderRAF) cancelAnimationFrame(APP._ovRenderRAF);
    APP._ovRenderRAF = requestAnimationFrame(() => renderOverview(true));
    return;
  }
  const months = getOvMonths(APP.ovPeriodMonths);
  const keys = new Set(months.map(m => m.key));
  const periodDocs = DB.docs.filter(d => d.date && keys.has(d.date.slice(0, 7)));
  const isFiscalDoc = d =>
    (d.type === 'F' && d.status === 'Payé') ||
    (d.type === 'AV' && (d.status === 'Validé' || d.status === 'Payé'));
  const fiscalSign = d => (d.type === 'AV' ? -1 : 1);
  const fiscalDocs = periodDocs.filter(isFiscalDoc);
  const paid = periodDocs.filter(d => d.status === 'Payé');
  const pending = DB.docs.filter(d => d.status === 'Envoyé' || d.status === 'Brouillon');
  const ca = fiscalDocs.reduce((a, d) => a + fiscalSign(d) * (d.ttc || 0), 0);
  const caHT = fiscalDocs.reduce((a, d) => a + fiscalSign(d) * (d.ht || 0), 0);
  const tvaColl = fiscalDocs.reduce((a, d) => a + fiscalSign(d) * (d.tva || 0), 0);
  const pendAmt = pending.reduce((a, d) => a + (d.ttc || 0), 0);
  document.getElementById('stat-ca').textContent = fmt(ca);
  document.getElementById('stat-ca-sub').textContent = `HT: ${fmt(caHT)}`;
  document.getElementById('stat-pending').textContent = fmt(pendAmt);
  document.getElementById('stat-pending-sub').textContent = `${pending.length} doc(s) en attente`;
  const stTvaSub = document.getElementById('stat-tva-sub');
  if (stTvaSub) stTvaSub.textContent = 'Factures payées & avoirs validés';
  document.getElementById('stat-tva').textContent = fmt(tvaColl);
  document.getElementById('stat-docs').textContent = periodDocs.length;
  document.getElementById('stat-docs-sub').textContent =
    months.length === 1 ? 'Ce mois' : `Sur ${months.length} mois`;
  renderOvCAChart(months, periodDocs);
  renderOvStatusChart(periodDocs);
  renderOvTopClients(periodDocs);
  renderOvTVA();
  renderOvAlerts();
  _setSkeletonLoading(['ov-chart-ca', 'ov-chart-status', 'ov-top-clients', 'ov-tva-breakdown'], false);
}
function renderOvCAChart(months, docs) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const htByMonth = {},
    ttcByMonth = {};
  months.forEach(m => {
    htByMonth[m.key] = 0;
    ttcByMonth[m.key] = 0;
  });
  docs
    .filter(
      d =>
        (d.type === 'F' && d.status === 'Payé') ||
        (d.type === 'AV' && (d.status === 'Validé' || d.status === 'Payé')),
    )
    .forEach(d => {
      const k = d.date.slice(0, 7);
      const s = d.type === 'AV' ? -1 : 1;
      if (htByMonth[k] !== undefined) {
        htByMonth[k] += s * (d.ht || 0);
        ttcByMonth[k] += s * (d.ttc || 0);
      }
    });
  const labels = months.map(
    m => MONTHS_FR[m.mo] + (months.length > 6 ? ` ${String(m.yr).slice(2)}` : ``),
  );
  const textCol = isDark ? '#8b949e' : '#64748b';
  const gridCol = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const caEl = document.getElementById('ov-chart-ca');
  if (!caEl) return;
  const cur = APP.ovCaChart;
  if (cur) cur.destroy();
  APP.ovCaChart = new Chart(caEl, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'TTC',
          data: months.map(m => Math.round(ttcByMonth[m.key])),
          backgroundColor: '#1D9E75',
          borderRadius: 4,
          order: 1,
        },
        {
          label: 'HT',
          data: months.map(m => Math.round(htByMonth[m.key])),
          backgroundColor: '#9FE1CB',
          borderRadius: 4,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: {
          ticks: { color: textCol, font: { size: 10 }, maxRotation: 0 },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: {
            color: textCol,
            font: { size: 10 },
            callback: v => (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
          },
          grid: { color: gridCol },
          border: { display: false },
        },
      },
    },
  });
}
function renderOvStatusChart(docs) {
  const leg = document.getElementById('ov-status-legend');
  const stEl = document.getElementById('ov-chart-status');
  if (!leg || !stEl) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const counts = { Payé: 0, Envoyé: 0, Brouillon: 0, Annulé: 0 };
  docs.forEach(d => {
    if (counts[d.status] !== undefined) counts[d.status]++;
  });
  const labels = Object.keys(counts).filter(k => counts[k] > 0);
  const data = labels.map(k => counts[k]);
  const colors = { Payé: '#1D9E75', Envoyé: '#378ADD', Brouillon: '#888780', Annulé: '#E24B4A' };
  const bgs = labels.map(k => colors[k]);
  const total = data.reduce((a, b) => a + b, 0) || 1;
  clearChildren(leg);
  labels.forEach((l, i) => {
    const span = document.createElement('span');
    span.style.cssText = 'display:flex;align-items:center;gap:4px';
    const dot = document.createElement('span');
    dot.style.cssText = `width:9px;height:9px;border-radius:2px;background:${bgs[i]};display:inline-block`;
    span.appendChild(dot);
    span.appendChild(document.createTextNode(`${l} ${Math.round((data[i] / total) * 100)}%`));
    leg.appendChild(span);
  });
  const cur = APP.ovStatusChart;
  if (cur) cur.destroy();
  APP.ovStatusChart = new Chart(stEl, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: bgs, borderWidth: 0, hoverOffset: 3 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2736',
          borderColor: 'rgba(9,188,138,.3)',
          borderWidth: 1,
          titleColor: '#E8EEF4',
          bodyColor: '#94A8BE',
          padding: 10,
          callbacks: {
            label: ctx =>
              `${ctx.label}: ${ctx.parsed} (${Math.round((ctx.parsed / total) * 100)}%)`,
          },
        },
      },
    },
  });
}
function renderOvTopClients(docs) {
  const map = {};
  docs.forEach(d => {
    if (
      !(
        (d.type === 'F' && d.status === 'Payé') ||
        (d.type === 'AV' && (d.status === 'Validé' || d.status === 'Payé'))
      )
    )
      return;
    const n = d.clientName || 'N/A';
    map[n] = (map[n] || 0) + (d.type === 'AV' ? -1 : 1) * (d.ttc || 0);
  });
  const sorted = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const max = Math.max(1, ...sorted.map(([, v]) => Math.abs(v)));
  const el = document.getElementById('ov-top-clients');
  if (!el) return;
  clearChildren(el);
  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px;color:var(--text2)';
    empty.textContent = 'Aucun client.';
    el.appendChild(empty);
    return;
  }
  sorted.forEach(([name, val]) => {
    const row = document.createElement('div');
    row.style.marginBottom = '10px';
    const head = document.createElement('div');
    head.style.cssText =
      'display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px';
    const nameSp = document.createElement('span');
    nameSp.style.cssText =
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;font-weight:500';
    nameSp.textContent = name || '';
    const valSp = document.createElement('span');
    valSp.style.cssText =
      "color:var(--text2);font-family:Arial, sans-serif;font-variant-numeric:normal;font-feature-settings:'zero' 0";
    valSp.textContent = fmt(val);
    head.appendChild(nameSp);
    head.appendChild(valSp);
    const barWrap = document.createElement('div');
    barWrap.style.cssText = 'height:5px;background:var(--border);border-radius:3px;overflow:hidden';
    const barFill = document.createElement('div');
    barFill.style.cssText = `width:${Math.round((Math.abs(val) / max) * 100)}%;height:100%;background:${val < 0 ? 'var(--danger)' : 'var(--brand)'};border-radius:3px`;
    barWrap.appendChild(barFill);
    row.appendChild(head);
    row.appendChild(barWrap);
    el.appendChild(row);
  });
}
function renderOvTVA() {
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthPaid = DB.docs.filter(
    d =>
      d.date &&
      d.date.startsWith(curKey) &&
      ((d.type === 'F' && d.status === 'Payé') ||
        (d.type === 'AV' && (d.status === 'Validé' || d.status === 'Payé'))),
  );
  const byTva = {};
  const signFn = d => (d.type === 'AV' ? -1 : 1);
  monthPaid.forEach(d => {
    if (typeof window.accumulateDocTvaByRateForReport === 'function') {
      window.accumulateDocTvaByRateForReport(d, signFn(d), byTva);
    } else if (d.lines) {
      const s = signFn(d);
      d.lines.forEach(l => {
        const r = Number(l.tva ?? 20);
        const base = (l.qty || 0) * (l.price || 0) * s;
        if (!byTva[r]) byTva[r] = { base: 0, tva: 0 };
        byTva[r].tva += base * (r / 100);
      });
    }
  });
  const rates = Object.keys(byTva)
    .filter(r => Math.abs(byTva[r].tva) > 1e-6)
    .sort((a, b) => Number(b) - Number(a));
  const colors = { 20: '#1D9E75', 14: '#378ADD', 10: '#BA7517', 7: '#D85A30', 0: '#888780' };
  const el = document.getElementById('ov-tva-breakdown');
  if (!el) return;
  clearChildren(el);
  if (!rates.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px;color:var(--text2)';
    empty.textContent = 'Aucune vente ce mois.';
    el.appendChild(empty);
    return;
  }
  rates.forEach(r => {
    const row = document.createElement('div');
    row.className = 'tva-decl-row';
    const pill = document.createElement('span');
    pill.className = 'tva-pill';
    const c = colors[r] || '#888780';
    pill.style.background = `${c}22`;
    pill.style.color = c;
    pill.textContent = `${r}%`;
    const lbl = document.createElement('span');
    lbl.style.cssText = 'color:var(--text2);font-size:11px';
    lbl.textContent = `TVA ${r}%`;
    const amt = document.createElement('span');
    amt.style.cssText =
      "font-weight:600;font-family:Arial, sans-serif;font-variant-numeric:normal;font-feature-settings:'zero' 0";
    amt.textContent = fmt(byTva[r].tva);
    row.appendChild(pill);
    row.appendChild(lbl);
    row.appendChild(amt);
    el.appendChild(row);
  });
}
function renderOvAlerts() {
  const alerts = [];
  const overdue = DB.docs.filter(
    d => d.status === 'Envoyé' && d.date && (Date.now() - new Date(d.date)) / 864e5 > 30,
  );
  if (overdue.length)
    alerts.push({ t: 'danger', msg: `${overdue.length} facture(s) impayée(s) +30j` });
  const lowStock = DB.stock.filter(s => (s.qty || 0) < 5);
  if (lowStock.length)
    alerts.push({
      t: 'warn',
      msg: `${lowStock.length} article(s) avec stock faible (moins de 5 unités)`,
    });
  const drafts = DB.docs.filter(d => d.status === 'Brouillon');
  if (drafts.length) alerts.push({ t: 'warn', msg: `${drafts.length} brouillon(s) non envoyé(s)` });
  if (!alerts.length) alerts.push({ t: 'ok', msg: 'Aucune alerte — tout est en ordre' });
  const ovAl = document.getElementById('ov-alerts');
  if (!ovAl) return;
  clearChildren(ovAl);
  alerts.forEach(a => {
    const div = document.createElement('div');
    div.className = 'ov-alert ' + a.t;
    const dot = document.createElement('span');
    dot.style.cssText =
      'width:6px;height:6px;border-radius:50%;flex-shrink:0;background:currentColor;display:inline-block';
    div.appendChild(dot);
    div.appendChild(document.createTextNode(a.msg));
    ovAl.appendChild(div);
  });
}

// ── Global search ──
// ═══════════════════════════════════════════
let searchFocusIdx = -1;
window.APP = window.APP || {};
window.APP.ui = window.APP.ui || {};
window.APP.ui.searchActions = window.APP.ui.searchActions || [];
try {
  Object.defineProperty(window.APP.ui, 'searchFocusIdx', {
    get: () => searchFocusIdx,
    set: v => {
      searchFocusIdx = v;
    },
    enumerable: true,
    configurable: false,
  });
} catch (_) {}
function globalKeyHandler(e) {
  const searchOpen = document.getElementById('search-panel')?.classList.contains('open');
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }
  if (e.key === 'Escape' && searchOpen) {
    closeSearch();
    return;
  }
  if (e.key === 'Escape') {
    document.getElementById('notif-panel')?.classList.remove('open');
  }
}

function _getSearchFocusableEls() {
  const panel = document.getElementById('search-panel');
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function _searchTrapFocus(e) {
  if (e.key !== 'Tab') return;
  const panel = document.getElementById('search-panel');
  if (!panel || !panel.classList.contains('open')) return;
  const focusables = _getSearchFocusableEls();
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function openSearch() {
  const backdrop = document.getElementById('search-backdrop');
  const sp = document.getElementById('search-panel');
  const activeEl = document.activeElement;
  if (activeEl && typeof activeEl.focus === 'function') APP.ui.searchReturnFocusEl = activeEl;
  backdrop?.classList.add('open');
  backdrop?.setAttribute('aria-hidden', 'false');
  if (sp) {
    sp.classList.add('open');
    sp.setAttribute('aria-hidden', 'false');
    sp.addEventListener('keydown', _searchTrapFocus);
  }
  const inp = document.getElementById('search-input');
  if (inp) {
    inp.value = '';
    APP.ui.searchFocusIdx = -1;
    renderSearchResults();
    setTimeout(() => inp.focus(), 0);
  }
}
function closeSearch() {
  const backdrop = document.getElementById('search-backdrop');
  const sp = document.getElementById('search-panel');
  backdrop?.classList.remove('open');
  backdrop?.setAttribute('aria-hidden', 'true');
  if (sp) {
    sp.classList.remove('open');
    sp.setAttribute('aria-hidden', 'true');
    sp.removeEventListener('keydown', _searchTrapFocus);
  }
  const returnFocusEl = APP.ui.searchReturnFocusEl;
  if (returnFocusEl && typeof returnFocusEl.focus === 'function') {
    try {
      returnFocusEl.focus();
    } catch (_) {}
  }
}
function searchKeyNav(e) {
  const items = document.querySelectorAll('.search-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    APP.ui.searchFocusIdx = Math.min(APP.ui.searchFocusIdx + 1, items.length - 1);
    items.forEach((it, i) => it.classList.toggle('focused', i === APP.ui.searchFocusIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    APP.ui.searchFocusIdx = Math.max(APP.ui.searchFocusIdx - 1, 0);
    items.forEach((it, i) => it.classList.toggle('focused', i === APP.ui.searchFocusIdx));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (items[APP.ui.searchFocusIdx]) items[APP.ui.searchFocusIdx].click();
  }
}
function _renderSearchQuickActions(container) {
  clearChildren(container);
  const title = document.createElement('div');
  title.className = 'search-section-title';
  title.textContent = 'Actions rapides';
  container.appendChild(title);
  const actions = [
    { act: 'new-facture', icon: '📄', label: 'Nouvelle facture', sub: 'Créer un document' },
    { act: 'new-client', icon: '👤', label: 'Nouveau client', sub: '' },
    { act: 'new-stock', icon: '📦', label: 'Nouvel article', sub: '' },
    { act: 'open-settings', icon: '⚙️', label: 'Paramètres', sub: '' },
  ];
  actions.forEach(({ act, icon, label, sub }) => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.setAttribute('data-quick-action', act);
    const ic = document.createElement('div');
    ic.className = 'si-icon';
    ic.textContent = icon;
    const col = document.createElement('div');
    const lab = document.createElement('div');
    lab.className = 'si-label';
    lab.textContent = label;
    col.appendChild(lab);
    if (sub) {
      const su = document.createElement('div');
      su.className = 'si-sub';
      su.textContent = sub;
      col.appendChild(su);
    }
    item.appendChild(ic);
    item.appendChild(col);
    item.addEventListener('click', () => {
      if (act === 'new-facture') {
        closeSearch();
        nav('generate', sbItem('generate'));
        return;
      }
      if (act === 'new-client') {
        closeSearch();
        nav('clients', sbItem('clients'));
        openAddClient();
        return;
      }
      if (act === 'new-stock') {
        closeSearch();
        nav('stock', sbItem('stock'));
        openAddArticle();
        return;
      }
      if (act === 'open-settings') {
        closeSearch();
        nav('settings', sbItem('settings'));
      }
    });
    container.appendChild(item);
  });
}
function renderSearchResults() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const container = document.getElementById('search-results');
  APP.ui.searchFocusIdx = -1;
  if (!q) {
    _renderSearchQuickActions(container);
    return;
  }
  const results = [];
  const typeLabel = { F: 'Facture', D: 'Devis', BL: 'BL', AV: 'Avoir' };
  const statusClass = { Brouillon: 'draft', Envoyé: 'sent', Payé: 'paid', Annulé: 'cancelled' };
  DB.docs
    .filter(
      d =>
        (d.ref || '').toLowerCase().includes(q) || (d.clientName || '').toLowerCase().includes(q),
    )
    .slice(0, 4)
    .forEach(d => {
      const sc = statusClass[d.status] || 'draft';
      results.push({
        cat: 'Documents',
        icon: d.status === 'Annulé' ? '🚫' : '📄',
        docRef: d.ref || '',
        statusBadge: { cls: sc, text: d.status || '' },
        sub: `${typeLabel[d.type] || d.type || ''} · ${d.clientName || 'N/A'} · ${d.date || ''}`,
        right: null,
        action: () => {
          closeSearch();
          nav('history', sbItem('history'));
        },
      });
    });
  DB.clients
    .filter(
      c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q),
    )
    .slice(0, 3)
    .forEach(c => {
      results.push({
        cat: 'Clients',
        icon: '👥',
        labelText: c.name || '',
        sub: [c.email, c.phone, c.city].filter(Boolean).join(' · ') || 'Aucune info',
        right: null,
        action: () => {
          closeSearch();
          nav('clients', sbItem('clients'));
        },
      });
    });
  DB.stock
    .filter(
      a => (a.name || '').toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q),
    )
    .slice(0, 3)
    .forEach(a => {
      const stva = Number.isFinite(Number(a.tva)) ? Number(a.tva) : 20;
      const sellShown =
        typeof displayTTCForGlobalMode === 'function'
          ? displayTTCForGlobalMode(a.sell || 0, stva)
          : a.sell || 0;
      const pm = typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC';
      results.push({
        cat: 'Stock',
        icon: '📦',
        labelText: a.name || '',
        sub: `${a.category || '—'} · Stock: ${a.qty || 0} · ${fmt(sellShown)} ${pm === 'HT' ? 'HT' : 'TTC'}`,
        rightLowStock: (a.qty || 0) < 5,
        action: () => {
          closeSearch();
          nav('stock', sbItem('stock'));
        },
      });
    });
  if (!results.length) {
    clearChildren(container);
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.appendChild(document.createTextNode('Aucun résultat pour "'));
    const strong = document.createElement('strong');
    strong.textContent = q;
    empty.appendChild(strong);
    empty.appendChild(document.createTextNode('"'));
    container.appendChild(empty);
    return;
  }
  APP.ui.searchActions = [];
  clearChildren(container);
  let lastCat = '';
  results.forEach((r, idx) => {
    APP.ui.searchActions[idx] = r.action;
    if (r.cat !== lastCat) {
      const st = document.createElement('div');
      st.className = 'search-section-title';
      st.textContent = r.cat;
      container.appendChild(st);
      lastCat = r.cat;
    }
    const item = document.createElement('div');
    item.className = 'search-item';
    item.setAttribute('data-search-idx', String(idx));
    const ic = document.createElement('div');
    ic.className = 'si-icon';
    ic.textContent = r.icon;
    const mid = document.createElement('div');
    mid.style.cssText = 'flex:1;min-width:0';
    const lab = document.createElement('div');
    lab.className = 'si-label';
    if (r.statusBadge) {
      lab.appendChild(document.createTextNode(r.docRef || ''));
      const badge = document.createElement('span');
      badge.className = 'badge ' + r.statusBadge.cls;
      badge.style.marginLeft = '7px';
      badge.style.verticalAlign = 'middle';
      badge.textContent = r.statusBadge.text;
      lab.appendChild(badge);
    } else {
      lab.textContent = r.labelText || '';
    }
    const sub = document.createElement('div');
    sub.className = 'si-sub';
    sub.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    sub.textContent = r.sub || '';
    mid.appendChild(lab);
    mid.appendChild(sub);
    item.appendChild(ic);
    item.appendChild(mid);
    if (r.rightLowStock) {
      const rt = document.createElement('div');
      rt.className = 'si-right';
      const b = document.createElement('span');
      b.className = 'badge draft';
      b.textContent = 'Bas';
      rt.appendChild(b);
      item.appendChild(rt);
    }
    item.addEventListener('click', () => {
      const fn = APP.ui.searchActions[idx];
      if (typeof fn === 'function') fn();
    });
    container.appendChild(item);
  });
}

// ── Notifications ──
// ═══════════════════════════════════════════
function buildNotifications() {
  APP.notifications = [];
  const now = Date.now();
  DB.docs
    .filter(d => d.status === 'Envoyé' && d.date)
    .forEach(d => {
      const age = (now - new Date(d.date)) / 864e5;
      if (age > 30)
        APP.notifications.push({
          id: 'overdue_' + d.id,
          type: 'danger',
          unread: true,
          title: 'Facture impayée',
          body: `${d.ref} (${d.clientName || 'N/A'}) — ${Math.floor(age)} jours`,
          time: d.date,
        });
    });
  DB.stock
    .filter(s => (s.qty || 0) < 5 && (s.qty || 0) >= 0)
    .forEach(s => {
      APP.notifications.push({
        id: 'stock_' + s.id,
        type: 'warn',
        unread: true,
        title: 'Stock bas',
        body: `${s.name} — ${s.qty || 0} unité(s)`,
        time: today(),
        action: () => nav('stock', sbItem('stock')),
      });
    });
  const drafts = DB.docs.filter(
    d => d.status === 'Brouillon' && d.date && (now - new Date(d.date)) / 864e5 > 3,
  );
  drafts.forEach(d => {
    APP.notifications.push({
      id: 'draft_' + d.id,
      type: 'info',
      unread: true,
      title: 'Brouillon en attente',
      body: `${d.ref} — non envoyé`,
      time: d.date,
      action: () => nav('history', sbItem('history')),
    });
  });
  const _rawRead =
    APP.opfs.memCache['invoo_notif_read'] || localStorage.getItem('invoo_notif_read') || '[]';
  const readIds = JSON.parse(_rawRead);
  APP.notifications.forEach(n => {
    if (readIds.includes(n.id)) n.unread = false;
  });
  APP.notifications = APP.notifications.slice(0, 12);
  updateNotifBadge();
  renderNotifList();
}
function updateNotifBadge() {
  const count = APP.notifications.filter(n => n.unread).length;
  document.getElementById('notif-badge')?.classList.toggle('has-notifs', count > 0);
}
function toggleNotifPanel(e) {
  e.stopPropagation();
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  panel.style.pointerEvents = panel.classList.contains('open') ? 'auto' : 'none';
  if (panel.classList.contains('open')) renderNotifList();
}
function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  clearChildren(list);
  if (!APP.notifications.length) {
    const empty = document.createElement('div');
    empty.className = 'notif-empty';
    empty.textContent = 'Aucune notification ✓';
    list.appendChild(empty);
    return;
  }
  const colors = {
    danger: 'var(--danger)',
    warn: 'var(--accent)',
    info: '#3b82f6',
    ok: 'var(--brand)',
  };
  APP.notifications.forEach(n => {
    const row = document.createElement('div');
    row.className = 'notif-item' + (n.unread ? ' unread' : '');
    row.setAttribute('data-notif-id', encodeURIComponent(String(n.id || '')));
    const left = document.createElement('div');
    left.style.paddingTop = '4px';
    const dot = document.createElement('div');
    dot.className = 'ni-dot';
    dot.style.background = colors[n.type] || colors.info;
    left.appendChild(dot);
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;min-width:0';
    const t = document.createElement('div');
    t.className = 'ni-title';
    t.textContent = n.title || '';
    const b = document.createElement('div');
    b.className = 'ni-body';
    b.textContent = n.body || '';
    const tm = document.createElement('div');
    tm.className = 'ni-time';
    tm.textContent = n.time || '';
    body.appendChild(t);
    body.appendChild(b);
    body.appendChild(tm);
    row.appendChild(left);
    row.appendChild(body);
    row.addEventListener('click', () => {
      const id = decodeURIComponent(row.getAttribute('data-notif-id') || '');
      notifClick(id);
    });
    list.appendChild(row);
  });
}
function notifClick(id) {
  const n = APP.notifications.find(x => x.id === id);
  if (!n) return;
  n.unread = false;
  const _raw =
    APP.opfs.memCache['invoo_notif_read'] || localStorage.getItem('invoo_notif_read') || '[]';
  const readIds = JSON.parse(_raw);
  if (!readIds.includes(id)) readIds.push(id);
  const json = JSON.stringify(readIds);
  APP.opfs.memCache['invoo_notif_read'] = json;
  if (APP.opfs.ready) opfsWrite('invoo_notif_read', json);
  else localStorage.setItem('invoo_notif_read', json);
  updateNotifBadge();
  renderNotifList();
  document.getElementById('notif-panel')?.classList.remove('open');
  if (n.action) n.action();
}
function markAllRead() {
  const readIds = APP.notifications.map(n => n.id);
  const json = JSON.stringify(readIds);
  APP.opfs.memCache['invoo_notif_read'] = json;
  if (APP.opfs.ready) opfsWrite('invoo_notif_read', json);
  else localStorage.setItem('invoo_notif_read', json);
  APP.notifications.forEach(n => (n.unread = false));
  updateNotifBadge();
  renderNotifList();
  toast('Tout marqué comme lu ✓', 'suc');
}

// ── Onboarding ──
// ═══════════════════════════════════════════
const OB_STEPS = [
  {
    icon: '🏢',
    title: 'Votre entreprise',
    desc: 'Renseignez vos informations légales. Elles apparaîtront sur toutes vos factures.',
    html: `<div class="field-row c2"><div class="form-group"><label for="ob-name">Nom / Raison Sociale *</label><input id="ob-name" name="onboarding-company-name" autocomplete="organization" placeholder="Votre Entreprise SARL"></div><div class="form-group"><label for="ob-phone">Téléphone</label><input id="ob-phone" name="onboarding-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+212 6XX XX XX XX"></div></div><div class="form-group"><label for="ob-address">Adresse</label><input id="ob-address" name="onboarding-address" autocomplete="street-address" placeholder="N° Rue, Ville"></div><div class="field-row c2"><div class="form-group"><label for="ob-ice">ICE</label><input id="ob-ice" name="onboarding-ice" placeholder="000000000000000" maxlength="15"></div><div class="form-group"><label for="ob-if">IF</label><input id="ob-if" name="onboarding-if" placeholder="00000000" maxlength="8" pattern="\\d{1,8}" inputmode="numeric"></div></div>`,
  },
  {
    icon: '👥',
    title: 'Votre premier client',
    desc: 'Ajoutez un client pour pouvoir lui émettre des factures.',
    html: `<div class="field-row c2"><div class="form-group"><label for="ob-cname">Nom / Raison Sociale *</label><input id="ob-cname" name="onboarding-client-name" autocomplete="organization" placeholder="Client SARL"></div><div class="form-group"><label for="ob-cice">ICE client</label><input id="ob-cice" name="onboarding-client-ice" placeholder="000000000000000" maxlength="15"></div></div><div class="field-row c2"><div class="form-group"><label for="ob-cemail">Email</label><input id="ob-cemail" name="onboarding-client-email" type="email" autocomplete="email" placeholder="contact@client.ma"></div><div class="form-group"><label for="ob-cphone">Téléphone</label><input id="ob-cphone" name="onboarding-client-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+212 6XX XX XX XX"></div></div><div class="form-group"><label for="ob-ccity">Ville</label><input id="ob-ccity" name="onboarding-client-city" autocomplete="address-level2" placeholder="Casablanca"></div>`,
  },
  {
    icon: '🎉',
    title: "C'est prêt !",
    desc: 'INVOO OFFICE est configuré. Créez maintenant votre première facture.',
    html: `<div class="ob-finish-wrap"><div class="ob-finish-emoji">✅</div><div class="ob-finish-text">Votre compte est prêt.<br><strong class="ob-finish-strong">Conseil DGI :</strong> Pensez à renseigner votre RC, TP et CNSS dans les Paramètres pour une conformité complète.</div></div>`,
  },
];
let obCurrentStep = 0;
try {
  Object.defineProperty(window.APP.ui, 'obCurrentStep', {
    get: () => obCurrentStep,
    set: v => {
      obCurrentStep = v;
    },
    enumerable: true,
    configurable: false,
  });
} catch (_) {}
function checkOnboarding() {
  const done =
    APP.opfs.memCache['invoo_onboarding_done'] || localStorage.getItem('invoo_onboarding_done');
  if (!done) {
    APP.ui.obCurrentStep = 0;
    renderObStep(0);
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
      overlay.style.pointerEvents = 'auto';
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => overlay.classList.add('show'));
    }
  }
}
function renderObStep(step) {
  const s = OB_STEPS[step];
  document.getElementById('ob-icon').textContent = s.icon;
  document.getElementById('ob-title').textContent = s.title;
  document.getElementById('ob-desc').textContent = s.desc;
  setStaticHtml(document.getElementById('ob-body'), s.html);
  document.getElementById('ob-progress-fill').style.width =
    `${((step + 1) / OB_STEPS.length) * 100}%`;
  document.getElementById('ob-next-btn').textContent =
    step === OB_STEPS.length - 1 ? '🚀 Créer ma première facture' : 'Continuer →';
  document.querySelectorAll('.ob-step-dot').forEach((d, i) => {
    d.classList.toggle('active', i === step);
    d.classList.toggle('done', i < step);
  });
  if (step === 0 && DB.settings.name) document.getElementById('ob-name').value = DB.settings.name;

  // Validation ICE des champs onboarding dynamiques
  document.getElementById('ob-ice')?.addEventListener('input', function () {
    validateICEInput(this);
  });
  document.getElementById('ob-cice')?.addEventListener('input', function () {
    validateICEInput(this);
  });
}
function obNext() {
  if (APP.ui.obCurrentStep === 0) {
    const name = document.getElementById('ob-name').value.trim();
    if (!name) {
      toast('Le nom est requis', 'err');
      return;
    }
    DB.settings.name = name;
    DB.settings.phone = document.getElementById('ob-phone').value.trim();
    DB.settings.address = document.getElementById('ob-address').value.trim();
    DB.settings.ice = document.getElementById('ob-ice').value.trim();
    DB.settings.if = document.getElementById('ob-if').value.trim();
    save('settings');
  } else if (APP.ui.obCurrentStep === 1) {
    const cname = document.getElementById('ob-cname').value.trim();
    if (cname) {
      const client = {
        id: 'cli_' + Date.now(),
        name: cname,
        ice: document.getElementById('ob-cice').value.trim(),
        email: document.getElementById('ob-cemail').value.trim(),
        phone: document.getElementById('ob-cphone').value.trim(),
        city: document.getElementById('ob-ccity').value.trim(),
        if: '',
        rc: '',
        address: '',
        notes: '',
      };
      DB.clients.push(client);
      save('clients');
      toast(`Client "${cname}" ajouté ✓`, 'suc');
    }
  } else if (APP.ui.obCurrentStep === 2) {
    finishOnboarding();
    return;
  }
  APP.ui.obCurrentStep++;
  renderObStep(APP.ui.obCurrentStep);
}
function skipOnboarding() {
  finishOnboarding();
}
function finishOnboarding() {
  // Écrire dans les deux couches pour garantir la persistance
  localStorage.setItem('invoo_onboarding_done', '1');
  APP.opfs.memCache['invoo_onboarding_done'] = '1';
  if (APP.opfs.ready) opfsWrite('invoo_onboarding_done', '1');

  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.setAttribute('aria-hidden', 'true');
    // Désactiver immédiatement les interactions — aucun tap ne peut passer
    overlay.style.pointerEvents = 'none';
    overlay.classList.remove('show');

    // Utiliser transitionend au lieu de setTimeout — garanti de s'exécuter
    // même si le moteur JS est occupé sur mobile
    const hide = () => {
      overlay.style.display = 'none';
      overlay.removeEventListener('transitionend', hide);
    };
    overlay.addEventListener('transitionend', hide, { once: true });

    // Sécurité absolue : si transitionend ne se déclenche pas (ex: transition désactivée),
    // on force display:none après un délai généreux
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 600);
  }

  renderOverview();
  if (APP.ui.obCurrentStep >= 2) {
    setTimeout(() => {
      nav('generate', sbItem('generate'));
      populateDocClient();
    }, 400);
  }
}

// ── INIT function ──
// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════

/** Exposé pour imports.js / fournisseurs.js (aria-hidden sur les dialogues). */
window.openModal = openModal;
window.closeModal = closeModal;
