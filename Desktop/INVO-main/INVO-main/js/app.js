// ═══════════════════════════════════════════
//  app.js  —  Point d'entrée, init, boot
//  Chargé EN DERNIER — dépend de tous les autres
// ═══════════════════════════════════════════

// ── Boot: preload OPFS then init ──
// ═══════════════════════════════════════════
// init() est appelé par _launchApp() dans auth.js
function _removeBootSpinner() {
  const el = document.getElementById('boot-spinner');
  if (el) {
    el.style.transition = 'opacity 0.2s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }
}

preloadOPFS()
  .then(() => checkAuth())
  .catch(() => checkAuth())
  .finally(() => _removeBootSpinner());
// Secours : si une promesse ne se termine jamais (ex. file:// ou bug), débloquer l’UI
setTimeout(_removeBootSpinner, 15000);

// ── Mobile helpers (swipe sidebar) ──
// ═══════════════════════════════════════════
//  MOBILE HELPERS
// ═══════════════════════════════════════════

// Swipe-to-close sidebar
(function () {
  let startX = 0,
    startY = 0;
  document.addEventListener(
    'touchstart',
    e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    e => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      const sb = document.getElementById('sidebar');
      // Swipe right on left edge → open
      if (startX < 24 && dx > 50 && dy < 60 && window.innerWidth <= 768) openMobSidebar();
      // Swipe left on open sidebar → close
      if (sb.classList.contains('mob-open') && dx < -50 && dy < 60) closeMobSidebar();
    },
    { passive: true },
  );
})();
