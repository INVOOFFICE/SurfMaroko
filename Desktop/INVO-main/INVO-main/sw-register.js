// ═══════════════════════════════════════════
//  sw-register.js  —  Enregistrement SW
//  Gère l'enregistrement, les mises à jour
//  et le feedback utilisateur hors-ligne
// ═══════════════════════════════════════════

(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('[SW] Service Worker non supporté dans ce navigateur.');
    return;
  }

  /**
   * Base URL du répertoire de l’app (toujours avec / final).
   * Sur GitHub Pages, une URL du type …/INVOO (sans slash) fait que
   * `./sw.js` se résout en …/sw.js (racine du site) → 404 et pas de SW.
   */
  function getAppDirectoryBaseUrl() {
    const u = new URL(location.href);
    let path = u.pathname;
    if (path.endsWith('/')) {
      // déjà un répertoire
    } else if (/\.html?$/i.test(path)) {
      path = path.replace(/\/[^/]+$/, '/');
    } else {
      path = `${path}/`;
    }
    u.pathname = path;
    u.hash = '';
    u.search = '';
    return u.href;
  }

  // ── Enregistrement ──
  function registerSw() {
    if (!window.isSecureContext) {
      console.warn('[SW] Contexte non sécurisé (HTTPS requis) — enregistrement ignoré.');
      return;
    }

    const scopeBase = getAppDirectoryBaseUrl();
    const swUrl = new URL('sw.js', scopeBase).href;
    console.info('[SW] URL script:', swUrl, '| base app:', scopeBase);

    // Pas d’option `scope` : le navigateur applique le scope max autorisé par l’emplacement de sw.js
    // (évite les rejets subtils si la chaîne de scope ne correspond pas au caractère près).
    navigator.serviceWorker
      .register(swUrl)
      .then(registration => {
        console.log('[SW] Enregistré — scope:', registration.scope);

        function checkSwUpdate() {
          registration.update().catch(() => {});
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkSwUpdate();
        });
        window.addEventListener('focus', checkSwUpdate);
        setInterval(checkSwUpdate, 6 * 60 * 60 * 1000);

        // ── Détecter une nouvelle version du SW ──
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouvelle version disponible — proposer le rechargement
              showUpdateToast(registration);
            }
          });
        });
      })
      .catch(err => {
        console.error('[SW] Échec enregistrement:', err?.message || err, err);
      });
  }

  if (document.readyState === 'complete') {
    registerSw();
  } else {
    window.addEventListener('load', registerSw);
  }

  // ── Messages du SW (ex. rechargement après mise à jour) ──
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload();
      return;
    }
    if (event.data?.type === 'SW_PRECACHE_CRITICAL_FAILED') {
      const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
      console.error('[SW] Precache critique échoué — mise à jour non activée.', urls);
      if (typeof toast === 'function') {
        toast(
          '⚠️ Mise à jour hors-ligne incomplète (fichiers manquants). Rechargez ou vérifiez le déploiement.',
          'err',
        );
      }
      return;
    }
    if (event.data?.type === 'SW_PRECACHE_OPTIONAL_FAILED') {
      const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
      console.warn('[SW] Captures PWA non mises en cache (hors-ligne store):', urls);
      if (typeof toast === 'function') {
        toast('⚠️ Captures d’écran PWA non disponibles hors-ligne (non bloquant).', '');
      }
    }
  });

  // ── Indicateurs réseau hors-ligne / en ligne ──
  window.addEventListener('offline', () => {
    showNetworkBanner('offline');
  });

  window.addEventListener('online', () => {
    showNetworkBanner('online');
  });
})();

/**
 * HTML statique de confiance : toujours passer par setStaticHtml (DOMPurify) en navigateur.
 * Sans setStaticHtml (ex. tests Node) : texte brut uniquement — jamais innerHTML non assaini.
 */
function setTrustedStaticHtml(el, trustedStaticHtml) {
  if (typeof globalThis.setStaticHtml === 'function') {
    globalThis.setStaticHtml(el, trustedStaticHtml);
    return;
  }
  if (!el) return;
  console.error(
    '[sw-register] setStaticHtml indisponible — innerHTML interdit. Contenu rendu en texte brut (sans HTML).',
  );
  const raw = trustedStaticHtml ?? '';
  el.textContent = typeof raw === 'string' ? raw : String(raw);
}

// ════════════════════════════════════════
//  INSTALLATION PWA (beforeinstallprompt)
// ════════════════════════════════════════
// ── Variable globale accessible par auth.js ──
window._pwaInstallPrompt = null;

// ── Détecter si l'app tourne DÉJÀ en mode installé (standalone) ──
// Couvre : Chrome/Edge/Samsung (display-mode), iOS Safari (standalone), TWA Android
function _isAlreadyInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true // iOS Safari
  );
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._pwaInstallPrompt = e;

  // Si l'app est déjà installée et tourne en standalone → ignorer
  if (_isAlreadyInstalled()) return;

  if (window._invooPwaManualHintTid) {
    clearTimeout(window._invooPwaManualHintTid);
    window._invooPwaManualHintTid = null;
  }
  document.getElementById('auth-install-manual-hint')?.remove();

  // Si l'écran de connexion est déjà affiché → injecter le banner immédiatement
  _showAuthInstallBanner();

  // Aussi afficher le bouton topbar si l'app est déjà lancée
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  window._pwaInstallPrompt = null;
  document.getElementById('btn-install-pwa')?.style.setProperty('display', 'none');
  document.getElementById('auth-install-banner')?.remove();
  document.getElementById('auth-install-manual-hint')?.remove();
  if (window._invooPwaManualHintTid) {
    clearTimeout(window._invooPwaManualHintTid);
    window._invooPwaManualHintTid = null;
  }
  showNetworkBanner('installed');
});

window.addEventListener('load', () => {
  // ── Si déjà installée en standalone : masquer tout bouton d'install ──
  if (_isAlreadyInstalled()) {
    document.getElementById('btn-install-pwa')?.style.setProperty('display', 'none');
    // Marquer l'app comme "installée" pour que auth.js ne montre pas le banner
    window._pwaAlreadyInstalled = true;
    return; // pas besoin d'aller plus loin
  }

  // Brancher le bouton topbar
  document.getElementById('btn-install-pwa')?.addEventListener('click', async () => {
    if (!window._pwaInstallPrompt) return;
    window._pwaInstallPrompt.prompt();
    const { outcome } = await window._pwaInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      window._pwaInstallPrompt = null;
      document.getElementById('btn-install-pwa')?.style.setProperty('display', 'none');
    }
  });

  // iOS Safari — pas de beforeinstallprompt, guider manuellement
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  if (isIOS && !isStandalone) {
    const key = 'invoo_ios_hint';
    const last = parseInt(localStorage.getItem(key) || '0', 10);
    if (Date.now() - last > 7 * 24 * 60 * 60 * 1000) {
      localStorage.setItem(key, Date.now());
      setTimeout(_showIOSInstallHint, 2500);
    }
  }
});

/** Prompt natif si dispo ; sinon court rappel (toast) pour installation manuelle. */
async function _tryPwaInstallFromBanner(bannerEl) {
  const p = window._pwaInstallPrompt;
  if (p) {
    p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') {
      window._pwaInstallPrompt = null;
      bannerEl?.remove();
    }
    return;
  }
  if (typeof globalThis.toast === 'function') {
    globalThis.toast("Menu ⋮ → Installer l'application (ou Ajouter à l'écran d'accueil).");
  }
}

/**
 * Crée et attache la bannière PWA native (nécessite window._pwaInstallPrompt).
 * Cible : #auth-card-body — évite querySelector('div:last-child') qui capturait
 * le sous-titre du header (bannière quasi invisible).
 */
function _mountAuthInstallBanner(bodyEl) {
  const banner = document.createElement('div');
  banner.id = 'auth-install-banner';
  banner.style.cssText = [
    'margin-top:16px',
    'background:linear-gradient(135deg, rgba(9,188,138,.1), rgba(9,188,138,.05) 45%, rgba(255,255,255,.02))',
    'border:1px solid rgba(9,188,138,.25)',
    'border-radius:12px',
    'padding:12px',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'flex-wrap:wrap',
    'transition:.15s',
    'width:100%',
    'box-sizing:border-box',
    'box-shadow:0 8px 22px rgba(0,0,0,.22)',
  ].join(';');

  setTrustedStaticHtml(
    banner,
    `
    <div style="width:54px;height:54px;border-radius:12px;overflow:hidden;flex-shrink:0;border:1px solid rgba(255,255,255,.12);box-shadow:0 4px 10px rgba(0,0,0,.25)">
      <img src="icons/icon-192.png" alt="INVOO OFFICE" width="54" height="54" style="display:block;width:100%;height:100%;object-fit:cover">
    </div>
    <div style="flex:1;min-width:140px;font-size:13px;font-weight:700;color:var(--text,#E8EEF4);line-height:1.35">
      Installez INVOO OFFICE — accès instantané, hors ligne.
    </div>
    <button id="auth-install-btn"
      style="background:var(--teal,#09BC8A);border:none;border-radius:10px;padding:9px 16px;color:#0f1923;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;box-shadow:0 0 0 1px rgba(9,188,138,.25) inset">
      Installer
    </button>
  `,
  );

  banner.querySelector('#auth-install-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    void _tryPwaInstallFromBanner(banner);
  });

  bodyEl.appendChild(banner);
}

function _disconnectAuthInstallBannerObserver() {
  const o = window._authInstallBannerObs;
  if (o) {
    o.disconnect();
    window._authInstallBannerObs = null;
  }
}

function _showAuthInstallBanner() {
  if (document.getElementById('auth-install-banner')) return;
  if (!window._pwaInstallPrompt) return;
  if (_isAlreadyInstalled()) return;

  document.getElementById('auth-install-manual-hint')?.remove();
  if (window._invooPwaManualHintTid) {
    clearTimeout(window._invooPwaManualHintTid);
    window._invooPwaManualHintTid = null;
  }

  const tryMount = () => {
    if (document.getElementById('auth-install-banner')) return true;
    const body = document.getElementById('auth-card-body');
    if (!body || !document.getElementById('auth-screen')) return false;
    _mountAuthInstallBanner(body);
    return true;
  };

  if (tryMount()) {
    _disconnectAuthInstallBannerObserver();
    return;
  }

  if (window._authInstallBannerObs) return;

  const obs = new MutationObserver(() => {
    if (tryMount()) _disconnectAuthInstallBannerObserver();
  });
  window._authInstallBannerObs = obs;
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => _disconnectAuthInstallBannerObserver(), 25000);
}

/**
 * Navigateurs sans beforeinstallprompt immédiat : rappel d'installation manuelle
 * après quelques secondes sur l'écran auth (pas sur iOS : hint dédié).
 */
function _tryShowAuthPwaManualHint() {
  if (_isAlreadyInstalled()) return;
  if (window._pwaInstallPrompt) return;
  try {
    if (sessionStorage.getItem('invoo_pwa_manual_dismiss') === '1') return;
  } catch (_) {
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) return;

  if (window._invooPwaManualHintTid) {
    clearTimeout(window._invooPwaManualHintTid);
    window._invooPwaManualHintTid = null;
  }

  const manualHintDelayMs =
    typeof window.__INVOO_TEST_PWA_MANUAL_HINT_MS__ === 'number' &&
    window.__INVOO_TEST_PWA_MANUAL_HINT_MS__ >= 0
      ? window.__INVOO_TEST_PWA_MANUAL_HINT_MS__
      : 6500;

  window._invooPwaManualHintTid = setTimeout(() => {
    window._invooPwaManualHintTid = null;
    if (_isAlreadyInstalled()) return;
    if (window._pwaInstallPrompt) return;
    if (document.getElementById('auth-install-banner')) return;
    if (document.getElementById('auth-install-manual-hint')) return;
    const body = document.getElementById('auth-card-body');
    if (!body || !document.getElementById('auth-screen')) return;

    const hint = document.createElement('div');
    hint.id = 'auth-install-manual-hint';
    hint.style.cssText = [
      'margin-top:16px',
      'background:linear-gradient(135deg, rgba(9,188,138,.1), rgba(9,188,138,.05) 45%, rgba(255,255,255,.02))',
      'border:1px solid rgba(9,188,138,.25)',
      'border-radius:12px',
      'padding:12px',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'flex-wrap:wrap',
      'width:100%',
      'box-sizing:border-box',
      'box-shadow:0 8px 22px rgba(0,0,0,.22)',
    ].join(';');
    setTrustedStaticHtml(
      hint,
      `
      <div style="width:54px;height:54px;border-radius:12px;overflow:hidden;flex-shrink:0;border:1px solid rgba(255,255,255,.12);box-shadow:0 4px 10px rgba(0,0,0,.25)">
        <img src="icons/icon-192.png" alt="INVOO OFFICE" width="54" height="54" style="display:block;width:100%;height:100%;object-fit:cover">
      </div>
      <div style="flex:1;min-width:140px;font-size:13px;font-weight:700;color:var(--text,#E8EEF4);line-height:1.35">
        Installez INVOO OFFICE — accès instantané, hors ligne.
      </div>
      <button type="button" id="auth-install-manual-install"
        style="background:var(--teal,#09BC8A);border:none;border-radius:10px;padding:9px 16px;color:#0f1923;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;box-shadow:0 0 0 1px rgba(9,188,138,.25) inset">
        Installer
      </button>`,
    );
    hint.querySelector('#auth-install-manual-install')?.addEventListener('click', e => {
      e.stopPropagation();
      void _tryPwaInstallFromBanner(hint);
    });
    body.appendChild(hint);
  }, manualHintDelayMs);
}

function _showIOSInstallHint() {
  const hint = document.createElement('div');
  hint.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:9997',
    'background:var(--surface,#141f2b)',
    'border:1px solid var(--teal,#09BC8A)',
    'border-radius:14px',
    'padding:14px 18px',
    'max-width:300px',
    'width:88vw',
    'box-shadow:0 8px 30px rgba(0,0,0,.4)',
    'font-size:13px',
    'color:var(--text,#E8EEF4)',
    'font-family:inherit',
    'text-align:center',
  ].join(';');
  setTrustedStaticHtml(
    hint,
    `
    <div style="font-size:20px;margin-bottom:8px">📲</div>
    <div style="font-weight:700;margin-bottom:6px">Installer INVOO OFFICE</div>
    <div style="color:var(--text2,#94A8BE);line-height:1.6;font-size:12px">
      Appuyez sur <strong style="color:var(--text,#E8EEF4)">⬆ Partager</strong>
      puis <strong style="color:var(--text,#E8EEF4)">Sur l'écran d'accueil</strong>
    </div>
    <button id="ios-install-hint-close" type="button"
      style="margin-top:12px;background:var(--teal,#09BC8A);border:none;border-radius:8px;padding:7px 20px;color:#0f1923;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">
      Compris
    </button>`,
  );
  document.body.appendChild(hint);
  hint.querySelector('#ios-install-hint-close')?.addEventListener('click', () => hint.remove());
  setTimeout(() => hint.remove(), 10000);
}

// ════════════════════════════════════════
//  BANIÈRE RÉSEAU (hors-ligne / retour en ligne)
// ════════════════════════════════════════
function showNetworkBanner(status) {
  // Supprimer une bannière existante
  document.getElementById('sw-network-banner')?.remove();

  if (status === 'installed') {
    const b = document.createElement('div');
    b.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:9998',
      'background:var(--surface,#141f2b)',
      'border:1px solid var(--teal,#09BC8A)',
      'border-radius:12px',
      'padding:14px 20px',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'font-size:13px',
      'color:var(--text,#E8EEF4)',
      'font-family:inherit',
      'box-shadow:0 8px 30px rgba(0,0,0,.3)',
      'animation:swBannerIn .3s ease',
    ].join(';');
    setTrustedStaticHtml(
      b,
      `<span style="font-size:20px">🎉</span><div><div style="font-weight:700">INVOO OFFICE installé !</div><div style="font-size:12px;color:var(--text2,#94A8BE)">Accédez à l'app depuis votre écran d'accueil.</div></div>`,
    );
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 4000);
    return;
  }

  const isOffline = status === 'offline';
  const banner = document.createElement('div');
  banner.id = 'sw-network-banner';
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:10000',
    `background:${isOffline ? '#1c0505' : '#052e16'}`,
    `border-bottom:2px solid ${isOffline ? '#ef4444' : '#09BC8A'}`,
    'padding:8px 20px',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'font-size:13px',
    'font-weight:600',
    `color:${isOffline ? '#fca5a5' : '#86efac'}`,
    'font-family:inherit',
    'animation:swBannerIn .3s ease',
  ].join(';');

  setTrustedStaticHtml(
    banner,
    isOffline
      ? `<span style="font-size:16px">📵</span>
       <span>Mode hors-ligne — L'application continue de fonctionner. Les données sont sauvegardées localement.</span>
       <button id="sw-network-banner-close" type="button" style="margin-left:auto;background:none;border:none;cursor:pointer;color:inherit;font-size:16px;padding:0 4px">✕</button>`
      : `<span style="font-size:16px">✅</span>
       <span>Connexion rétablie — Vos données sont synchronisées.</span>`,
  );

  // Ajouter l'animation CSS si absente
  if (!document.getElementById('sw-anim-style')) {
    const style = document.createElement('style');
    style.id = 'sw-anim-style';
    style.textContent =
      '@keyframes swBannerIn{from{transform:translateY(-100%)}to{transform:translateY(0)}}';
    document.head.appendChild(style);
  }

  document.body.prepend(banner);
  banner
    .querySelector('#sw-network-banner-close')
    ?.addEventListener('click', () => banner.remove());

  // Disparaît automatiquement si retour en ligne
  if (!isOffline) {
    setTimeout(() => banner.remove(), 3500);
  }
}

// ════════════════════════════════════════
//  TOAST MISE À JOUR SW DISPONIBLE
// ════════════════════════════════════════
function showUpdateToast(registration) {
  const existing = document.getElementById('sw-update-toast');
  if (existing) return; // Ne pas doubler

  const toast = document.createElement('div');
  toast.id = 'sw-update-toast';
  toast.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:9998',
    'background:var(--surface, #141f2b)',
    'border:1px solid var(--teal, #09BC8A)',
    'border-radius:12px',
    'padding:14px 18px',
    'display:flex',
    'align-items:center',
    'gap:12px',
    'box-shadow:0 8px 30px rgba(0,0,0,.3)',
    'font-size:13px',
    'color:var(--text, #E8EEF4)',
    'font-family:inherit',
    'max-width:90vw',
    'animation:swBannerIn .3s ease',
  ].join(';');

  setTrustedStaticHtml(
    toast,
    `
    <span style="font-size:20px">🔄</span>
    <div>
      <div style="font-weight:700;margin-bottom:2px">Mise à jour disponible</div>
      <div style="font-size:12px;color:var(--text2,#94A8BE)">Rechargez pour obtenir la dernière version.</div>
    </div>
    <div style="display:flex;gap:8px;margin-left:auto">
      <button id="sw-update-dismiss"
        style="background:none;border:1px solid var(--border,rgba(255,255,255,.07));border-radius:6px;padding:5px 10px;cursor:pointer;color:var(--text2,#94A8BE);font-family:inherit;font-size:12px">
        Plus tard
      </button>
      <button id="sw-update-reload"
        style="background:var(--teal,#09BC8A);border:none;border-radius:6px;padding:5px 12px;cursor:pointer;color:#0f1923;font-weight:700;font-family:inherit;font-size:12px">
        Recharger
      </button>
    </div>`,
  );

  document.body.appendChild(toast);

  document.getElementById('sw-update-dismiss')?.addEventListener('click', () => toast.remove());
  document.getElementById('sw-update-reload')?.addEventListener('click', () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });
}
