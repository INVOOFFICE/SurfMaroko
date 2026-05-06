// ═══════════════════════════════════════════
//  auth.js — Activation locale + essai 1 h + verrouillage session
//  100 % offline — validation SHA-256(email|deviceId|secret)
// ═══════════════════════════════════════════

const OPFS_ACTIVATION_KEY = globalThis.INVOO_OPFS_ACTIVATION_KEY || 'invoo_activation_v3';
const SESSION_LOCK_KEY = globalThis.INVOO_SESSION_LOCK_KEY || 'invoo_app_session_lock';
const OPFS_LICENCE_LEGACY_KEY = 'invoo_licence';
const OPFS_DEMO_KEY = 'invoo_demo_session';
const DEMO_DURATION_MS = 60 * 60 * 1000;
const SESSION_PASSWORD_MIN_LEN = 6;
const SESSION_PBKDF2_ITERATIONS = 100000;
const ACTIVATION_STEP2_STORAGE_KEY = 'invoo_activation_step2_shown';

let _demoTimer = null;
let _demoExpireAt = null;

// ════════════════════════════════════════
//  POINT D'ENTRÉE — appelé par app.js
// ════════════════════════════════════════
async function checkAuth() {
  const state = await _loadActivationState();
  if (state?.isActivated) {
    let sessionLocked = false;
    try {
      sessionLocked = sessionStorage.getItem(SESSION_LOCK_KEY) === '1';
    } catch (_) {}
    if (sessionLocked || !!state.sessionLockedAt) {
      await _showLockScreen();
      return;
    }
    _launchApp();
    return;
  }

  const demo = await _loadKey(OPFS_DEMO_KEY);
  if (demo?.startedAt) {
    const elapsed = Date.now() - demo.startedAt;
    if (elapsed < DEMO_DURATION_MS) {
      _demoExpireAt = demo.startedAt + DEMO_DURATION_MS;
      _launchApp();
      _startDemoTimer();
      return;
    }
    await _showActivationScreen({ demoExpired: true });
    return;
  }

  await _showActivationScreen({ demoExpired: false });
}

async function _loadActivationState() {
  let act = await _loadKey(OPFS_ACTIVATION_KEY);
  if (act?.isActivated) return act;

  const old = await _loadKey(OPFS_LICENCE_LEGACY_KEY);
  if (old?.activated) {
    const deviceId = await globalThis.invooGetStableDeviceId();
    act = { isActivated: true, email: (DB?.settings?.email || ''), deviceId, licenseKey: '', legacyMigratedFromV2: true };
    await _saveKey(OPFS_ACTIVATION_KEY, act);
    return act;
  }
  return null;
}

async function _showActivationScreen(opts) {
  const demoExpired = !!(opts && opts.demoExpired);
  _clearScreen();
  _injectBaseStyles();

  const deviceId = await globalThis.invooGetStableDeviceId();
  const prefilled =
    (typeof DB !== 'undefined' && DB.settings && DB.settings.email) ||
    (await _loadKey(OPFS_ACTIVATION_KEY))?.email ||
    '';
  const prefilledPhone =
    (typeof DB !== 'undefined' && DB.settings && DB.settings.phone && String(DB.settings.phone).trim()) || '';

  const overlay = document.createElement('div');
  overlay.id = 'auth-screen';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:var(--bg,#0f1923);display:flex;align-items:flex-start;justify-content:center;padding:20px 16px 28px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;font-family:inherit;';

  setStaticHtml(
    overlay,
    buildActivationHTML({
      deviceId,
      prefilledEmail: prefilled,
      prefilledPhone,
      demoExpired,
      showDemoOption: !demoExpired,
    }),
  );

  document.body.appendChild(overlay);
  _bindActivationEvents(overlay);
  _restoreActivationStep2IfNeeded();

  if (typeof _showAuthInstallBanner === 'function') _showAuthInstallBanner();
  if (typeof _tryShowAuthPwaManualHint === 'function') _tryShowAuthPwaManualHint();
}

async function _showLockScreen() {
  _clearScreen();
  _injectBaseStyles();

  const act = await _loadKey(OPFS_ACTIVATION_KEY);
  const hasPassword = !!(act?.sessionPassHash && act?.sessionPassSalt);

  const overlay = document.createElement('div');
  overlay.id = 'auth-screen';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:var(--bg,#0f1923);display:flex;align-items:flex-start;justify-content:center;padding:20px 16px 28px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;font-family:inherit;';

  setStaticHtml(overlay, buildLockScreenHTML({ hasPassword }));
  document.body.appendChild(overlay);
  _bindLockEvents(overlay, { hasPassword });

  if (hasPassword) {
    overlay.querySelector('#lock-session-password')?.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') overlay.querySelector('[data-auth-action="unlock-session"]')?.click();
    });
  }
}

function _bindLockEvents(root, opts) {
  const hasPassword = !!(opts && opts.hasPassword);
  root.addEventListener('click', async e => {
    const btn = e.target.closest('[data-auth-action]');
    if (!btn) return;
    if (btn.getAttribute('data-auth-action') === 'unlock-session') {
      if (!hasPassword) {
        try {
          sessionStorage.removeItem(SESSION_LOCK_KEY);
        } catch (_) {}
        await _setPersistentSessionLock(false);
        _clearScreen();
        void checkAuth();
        return;
      }
      _hideLockError();
      const pwd = document.getElementById('lock-session-password')?.value || '';
      const act = await _loadKey(OPFS_ACTIVATION_KEY);
      if (!act?.sessionPassSalt || !act?.sessionPassHash) {
        try {
          sessionStorage.removeItem(SESSION_LOCK_KEY);
        } catch (_) {}
        await _setPersistentSessionLock(false);
        _clearScreen();
        void checkAuth();
        return;
      }
      try {
        const h = await _deriveSessionPasswordHash(pwd, act.sessionPassSalt);
        if (!_hexStringsEqual(h, act.sessionPassHash)) {
          _showLockError('Mot de passe incorrect.');
          return;
        }
      } catch {
        _showLockError('Vérification impossible (HTTPS ou localhost requis).');
        return;
      }
      try {
        sessionStorage.removeItem(SESSION_LOCK_KEY);
      } catch (_) {}
      await _setPersistentSessionLock(false);
      const inp = document.getElementById('lock-session-password');
      if (inp) inp.value = '';
      _clearScreen();
      void checkAuth();
    }
  });
}

function _buildWhatsAppActivationUrl(email, deviceId, phoneE164) {
  const e = String(email || '').trim();
  const d = String(deviceId || '').trim();
  const p = String(phoneE164 || '').trim();
  const msg = `Licence INVOO\n\nEmail: ${e}\nPhone: ${p}\nDevice ID: ${d}`;
  return `https://wa.me/212630230803?text=${encodeURIComponent(msg)}`;
}

/**
 * Interprète toujours le numéro comme marocain (+212) : avec ou sans indicatif, avec ou sans 0 initial.
 * @returns {{ ok: true, e164: string } | { ok: false, error: string }}
 */
function _normalizeMoroccoWhatsAppPhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (!d) {
    return { ok: false, error: 'Indiquez votre numéro WhatsApp marocain.' };
  }
  if (d.startsWith('00')) {
    d = d.slice(2);
  }
  let national = '';
  if (d.startsWith('212')) {
    national = d.slice(3);
  } else if (d.length === 10 && d[0] === '0') {
    national = d.slice(1);
  } else if (d.length === 9) {
    national = d;
  } else {
    return {
      ok: false,
      error:
        'Numéro marocain invalide. Ex. : 0612345678, 612345678 ou +212612345678.',
    };
  }
  if (national.length !== 9 || !/^\d{9}$/.test(national)) {
    return {
      ok: false,
      error: 'Il faut 9 chiffres au Maroc après +212 (ex. 06 12 34 56 78).',
    };
  }
  if (!/^[567]/.test(national)) {
    return {
      ok: false,
      error: 'Numéro invalide : après +212, le premier chiffre doit être 5, 6 ou 7.',
    };
  }
  return { ok: true, e164: '+212' + national };
}

/** Affichage lisible pour le champ (même valeur normalisée). */
function _formatMoroccoPhoneDisplay(e164) {
  const full = String(e164 || '').replace(/\D/g, '');
  if (full.length !== 12 || !full.startsWith('212')) {
    return e164;
  }
  const n = full.slice(3);
  return '+212 ' + n.slice(0, 1) + ' ' + n.slice(1, 3) + ' ' + n.slice(3, 5) + ' ' + n.slice(5, 7) + ' ' + n.slice(7, 9);
}

function _revealActivationStep2() {
  const step2 = document.getElementById('activation-step-2');
  if (!step2) return;
  step2.classList.add('is-visible');
  step2.setAttribute('aria-hidden', 'false');
  try {
    sessionStorage.setItem(ACTIVATION_STEP2_STORAGE_KEY, '1');
  } catch (_) {}
  requestAnimationFrame(() => {
    try {
      step2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {}
  });
}

function _restoreActivationStep2IfNeeded() {
  try {
    if (sessionStorage.getItem(ACTIVATION_STEP2_STORAGE_KEY) === '1') {
      _revealActivationStep2();
    }
  } catch (_) {}
}

function _clearActivationStep2Flag() {
  try {
    sessionStorage.removeItem(ACTIVATION_STEP2_STORAGE_KEY);
  } catch (_) {}
}

function _showActivationError(msg) {
  const el = document.getElementById('activation-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function _hideActivationError() {
  const el = document.getElementById('activation-error');
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

function _setActivationFieldState(fieldId, state, message) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const error = document.getElementById(`${fieldId}-error`);
  input.classList.remove('auth-input-error', 'auth-input-success');
  input.removeAttribute('aria-invalid');
  if (error) {
    error.textContent = '';
    error.style.display = 'none';
  }
  if (state === 'error') {
    input.classList.add('auth-input-error');
    input.setAttribute('aria-invalid', 'true');
    if (error) {
      error.textContent = String(message || 'Ce champ est invalide.');
      error.style.display = 'block';
    }
    return;
  }
  if (state === 'success') {
    input.classList.add('auth-input-success');
  }
}

function _clearActivationFieldStates() {
  _setActivationFieldState('activation-email', 'idle');
  _setActivationFieldState('activation-phone', 'idle');
  _setActivationFieldState('activation-license-key', 'idle');
}

function _showLockError(msg) {
  const el = document.getElementById('lock-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function _hideLockError() {
  const el = document.getElementById('lock-error');
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

function _showSetPasswordError(msg) {
  const el = document.getElementById('set-password-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function _hideSetPasswordError() {
  const el = document.getElementById('set-password-error');
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

function _hexToUint8(hex) {
  const h = String(hex || '');
  if (h.length % 2 !== 0) throw new Error('Salt hex invalide.');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function _hexStringsEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function _generateSessionSaltHex() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

async function _deriveSessionPasswordHash(password, saltHex) {
  if (!crypto?.subtle) {
    throw new Error('SubtleCrypto indisponible (HTTPS ou localhost requis).');
  }
  const salt = _hexToUint8(saltHex);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: SESSION_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function _showSetPasswordScreen(record) {
  _clearScreen();
  _injectBaseStyles();

  const overlay = document.createElement('div');
  overlay.id = 'auth-screen';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:var(--bg,#0f1923);display:flex;align-items:flex-start;justify-content:center;padding:20px 16px 28px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;font-family:inherit;';

  setStaticHtml(overlay, buildSetSessionPasswordHTML());
  document.body.appendChild(overlay);

  const submit = async () => {
    _hideSetPasswordError();
    const p1 = document.getElementById('session-password')?.value || '';
    const p2 = document.getElementById('session-password-confirm')?.value || '';
    if (p1.length < SESSION_PASSWORD_MIN_LEN) {
      _showSetPasswordError(`Mot de passe trop court (minimum ${SESSION_PASSWORD_MIN_LEN} caractères).`);
      return;
    }
    if (p1 !== p2) {
      _showSetPasswordError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    let saltHex;
    let hashHex;
    try {
      saltHex = await _generateSessionSaltHex();
      hashHex = await _deriveSessionPasswordHash(p1, saltHex);
    } catch (err) {
      _showSetPasswordError(err?.message || 'Impossible de sécuriser le mot de passe.');
      return;
    }
    record.sessionPassSalt = saltHex;
    record.sessionPassHash = hashHex;
    await _saveKey(OPFS_ACTIVATION_KEY, record);
    try {
      sessionStorage.removeItem(SESSION_LOCK_KEY);
    } catch (_) {}
    if (typeof DB !== 'undefined' && DB.settings && !DB.settings.email) {
      DB.settings.email = record.email;
      if (typeof save === 'function') save('settings');
    }
    if (typeof toast === 'function') toast('Activation réussie ✓', 'suc');
    _clearScreen();
    _launchApp();
  };

  overlay.addEventListener('click', e => {
    const btn = e.target.closest('[data-auth-action]');
    if (!btn) return;
    if (btn.getAttribute('data-auth-action') === 'set-session-password') {
      void submit();
    }
  });

  overlay.querySelector('#session-password-confirm')?.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') void submit();
  });
}

function _bindActivationEvents(root) {
  root.querySelector('#activation-email')?.addEventListener('input', () => {
    _setActivationFieldState('activation-email', 'idle');
    _hideActivationError();
  });
  root.querySelector('#activation-phone')?.addEventListener('input', () => {
    _setActivationFieldState('activation-phone', 'idle');
    _hideActivationError();
  });
  root.querySelector('#activation-license-key')?.addEventListener('input', () => {
    _setActivationFieldState('activation-license-key', 'idle');
    _hideActivationError();
  });

  root.addEventListener('click', async e => {
    const btn = e.target.closest('[data-auth-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-auth-action') || '';

    if (action === 'start-demo') {
      _hideActivationError();
      _clearActivationFieldStates();
      _clearActivationStep2Flag();
      void _startDemo();
      return;
    }

    if (action === 'send-whatsapp') {
      const email = document.getElementById('activation-email')?.value || '';
      const deviceId = document.getElementById('activation-device-id')?.value || '';
      const phone = document.getElementById('activation-phone')?.value || '';
      if (!String(email).trim()) {
        _setActivationFieldState('activation-email', 'error', 'Saisissez votre e-mail pour continuer.');
        _showActivationError('Veuillez renseigner votre e-mail avant d’ouvrir WhatsApp.');
        return;
      }
      if (!globalThis.invooNormalizeActivationEmail(email)) {
        _setActivationFieldState('activation-email', 'error', 'Format e-mail invalide (exemple: nom@domaine.com).');
        _showActivationError('Votre e-mail n’est pas valide. Vérifiez le format puis réessayez.');
        return;
      }
      if (!globalThis.invooIsValidEmail(email)) {
        _setActivationFieldState('activation-email', 'error', 'Format e-mail invalide (exemple: nom@domaine.com).');
        _showActivationError('Votre e-mail n’est pas valide. Vérifiez le format puis réessayez.');
        return;
      }
      _setActivationFieldState('activation-email', 'success');
      const phoneNorm = _normalizeMoroccoWhatsAppPhone(phone);
      if (!phoneNorm.ok) {
        _setActivationFieldState('activation-phone', 'error', phoneNorm.error);
        _showActivationError(phoneNorm.error);
        return;
      }
      _setActivationFieldState('activation-phone', 'success');
      if (!String(deviceId).trim()) {
        _showActivationError('Device ID manquant.');
        return;
      }
      _hideActivationError();
      const phoneInput = document.getElementById('activation-phone');
      if (phoneInput) {
        phoneInput.value = _formatMoroccoPhoneDisplay(phoneNorm.e164);
      }
      const url = _buildWhatsAppActivationUrl(email, deviceId, phoneNorm.e164);
      window.open(url, '_blank', 'noopener,noreferrer');
      _revealActivationStep2();
      return;
    }

    if (action === 'submit-activation') {
      _hideActivationError();
      const step2 = document.getElementById('activation-step-2');
      if (!step2 || !step2.classList.contains('is-visible')) {
        _showActivationError('Utilisez d’abord « Envoyer via WhatsApp », puis saisissez votre clé.');
        return;
      }
      const email = document.getElementById('activation-email')?.value || '';
      const deviceId = document.getElementById('activation-device-id')?.value || '';
      const keyIn = document.getElementById('activation-license-key')?.value || '';

      if (!globalThis.invooNormalizeActivationEmail(email)) {
        _setActivationFieldState('activation-email', 'error', 'Format e-mail invalide (exemple: nom@domaine.com).');
        _showActivationError('E-mail invalide. Saisissez une adresse comme nom@domaine.com.');
        return;
      }
      if (!globalThis.invooIsValidEmail(email)) {
        _setActivationFieldState('activation-email', 'error', 'Format e-mail invalide (exemple: nom@domaine.com).');
        _showActivationError('E-mail invalide. Saisissez une adresse comme nom@domaine.com.');
        return;
      }
      _setActivationFieldState('activation-email', 'success');
      if (!String(deviceId).trim()) {
        _showActivationError('Device ID manquant.');
        return;
      }
      if (!globalThis.invooNormalizeLicenseKeyInput(keyIn)) {
        _setActivationFieldState(
          'activation-license-key',
          'error',
          'Collez la clé complète reçue par WhatsApp (64 caractères hexadécimaux).',
        );
        _showActivationError('Clé manquante ou invalide. Collez la clé reçue par WhatsApp.');
        return;
      }
      _setActivationFieldState('activation-license-key', 'success');

      try {
        const expected = await globalThis.invooComputeExpectedLicenseHex(email, deviceId);
        if (!globalThis.invooLicenseKeysMatch(keyIn, expected)) {
          _setActivationFieldState(
            'activation-license-key',
            'error',
            'Cette clé ne correspond pas à cet e-mail et cet appareil.',
          );
          _showActivationError('Clé de licence incorrecte pour cet e-mail et cet appareil.');
          return;
        }
      } catch (err) {
        _showActivationError(err?.message || 'Erreur de calcul. Utilisez HTTPS ou localhost.');
        return;
      }
      const record = {
        isActivated: true,
        email: globalThis.invooNormalizeActivationEmail(email),
        deviceId: String(deviceId).trim(),
        licenseKey: globalThis.invooNormalizeLicenseKeyInput(keyIn),
        activatedAt: new Date().toISOString(),
      };
      if (_demoTimer) {
        clearInterval(_demoTimer);
        _demoTimer = null;
      }
      document.getElementById('demo-bar')?.remove();
      await _demoClear();
      _clearActivationStep2Flag();
      if (typeof toast === 'function') toast('Clé acceptée — définissez votre mot de passe', 'suc');
      await _showSetPasswordScreen(record);
    }
  });

  root.querySelector('#activation-license-key')?.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') root.querySelector('[data-auth-action="submit-activation"]')?.click();
  });
}

// ════════════════════════════════════════
//  DÉMO 1 H
// ════════════════════════════════════════
async function _startDemo() {
  const startedAt = Date.now();
  _demoExpireAt = startedAt + DEMO_DURATION_MS;
  await _saveKey(OPFS_DEMO_KEY, { startedAt });
  _clearScreen();
  _launchApp();
  _startDemoTimer();
  if (typeof toast === 'function') toast('Mode démo 1 h — toutes les fonctions', 'suc');
}

function _startDemoTimer() {
  _createDemoBar();
  _updateDemoBar();
  if (_demoTimer) clearInterval(_demoTimer);
  _demoTimer = setInterval(() => {
    const remaining = _demoExpireAt - Date.now();
    if (remaining <= 0) {
      clearInterval(_demoTimer);
      _demoTimer = null;
      void _demoExpire();
    } else {
      _updateDemoBar();
    }
  }, 1000);
}

function _createDemoBar() {
  if (document.getElementById('demo-bar')) return;
  if (!document.getElementById('demo-bar-style')) {
    const s = document.createElement('style');
    s.id = 'demo-bar-style';
    s.textContent = `
      #demo-bar{position:fixed;top:8px;right:12px;z-index:9000;background:rgba(28,20,0,.85);border:1.5px solid var(--gold,#F0A500);border-radius:20px;padding:4px 10px 4px 8px;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--gold,#F0A500);font-family:inherit;backdrop-filter:blur(6px);box-shadow:0 2px 12px rgba(0,0,0,.3);pointer-events:none}
      #demo-bar.urgent{border-color:#ef4444 !important;color:#f87171 !important;animation:demoUrgentPulse 1.5s ease infinite}
      #demo-timer{font-weight:800;font-size:12px;font-variant-numeric:tabular-nums;min-width:34px}
      @keyframes demoUrgentPulse{0%,100%{box-shadow:0 2px 12px rgba(0,0,0,.3)}50%{box-shadow:0 2px 16px rgba(239,68,68,.4)}}
    `;
    document.head.appendChild(s);
  }
  const bar = document.createElement('div');
  bar.id = 'demo-bar';
  const sp = document.createElement('span');
  sp.style.fontSize = '11px';
  sp.textContent = '⏱';
  const timer = document.createElement('span');
  timer.id = 'demo-timer';
  timer.textContent = '60:00';
  bar.appendChild(sp);
  bar.appendChild(timer);
  document.body.appendChild(bar);
}

function _updateDemoBar() {
  const remaining = Math.max(0, _demoExpireAt - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timer = document.getElementById('demo-timer');
  const bar = document.getElementById('demo-bar');
  if (timer) timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  if (bar) bar.classList.toggle('urgent', remaining < 2 * 60 * 1000);
}

async function _demoExpire() {
  document.getElementById('demo-bar')?.remove();
  document.getElementById('app')?.classList.remove('app-visible');
  document.getElementById('mob-tabbar')?.style.setProperty('display','none');
  document.getElementById('mob-fab')?.style.setProperty('display','none');
  if (typeof toast === 'function') toast('Démo terminée — activez avec une clé de licence', '');
  await _showActivationScreen({ demoExpired: true });
}

async function _demoClear() {
  delete APP.opfs.memCache?.[OPFS_DEMO_KEY];
  if (APP.opfs.dir) {
    try {
      await APP.opfs.dir.removeEntry(OPFS_DEMO_KEY + '.json');
    } catch (_) {}
  }
  try {
    localStorage.removeItem(OPFS_DEMO_KEY);
  } catch (_) {}
}

// ════════════════════════════════════════
//  LANCER L'APP
// ════════════════════════════════════════
function _launchApp() {
  _clearScreen();
  document.getElementById('app')?.classList.add('app-visible');
  document.getElementById('mob-tabbar')?.style.removeProperty('display');
  document.getElementById('mob-fab')?.style.removeProperty('display');
  if (typeof init === 'function') init();
}

// ════════════════════════════════════════
//  DÉCONNEXION → verrouillage session (sans effacer la licence)
// ════════════════════════════════════════
async function authLogout() {
  if (_demoTimer) {
    clearInterval(_demoTimer);
    _demoTimer = null;
  }
  document.getElementById('demo-bar')?.remove();

  try {
    sessionStorage.setItem(SESSION_LOCK_KEY, '1');
  } catch (_) {}
  await _setPersistentSessionLock(true);

  document.getElementById('app')?.classList.remove('app-visible');
  document.getElementById('mob-tabbar')?.style.setProperty('display','none');
  document.getElementById('mob-fab')?.style.setProperty('display','none');

  await _showLockScreen();
}

async function _setPersistentSessionLock(locked) {
  const act = await _loadKey(OPFS_ACTIVATION_KEY);
  if (!act || !act.isActivated) return;
  if (locked) {
    act.sessionLockedAt = new Date().toISOString();
  } else {
    delete act.sessionLockedAt;
  }
  await _saveKey(OPFS_ACTIVATION_KEY, act);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-logout')?.addEventListener('click', authLogout);
  const mobileLogoutBtn = document.getElementById('btn-logout-mobile');
  mobileLogoutBtn?.addEventListener('click', authLogout);
  mobileLogoutBtn?.addEventListener('mouseenter', e => {
    e.currentTarget.style.background = 'rgba(239,68,68,.12)';
  });
  mobileLogoutBtn?.addEventListener('mouseleave', e => {
    e.currentTarget.style.background = 'none';
  });
});

// ════════════════════════════════════════
//  HELPERS UI
// ════════════════════════════════════════
function _clearScreen() {
  document.getElementById('auth-screen')?.remove();
  document.getElementById('auth-blocked')?.remove();
}

function _injectBaseStyles() {
  if (document.getElementById('auth-base-style')) return;
  const s = document.createElement('style');
  s.id = 'auth-base-style';
  s.textContent = `
    @keyframes authShake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)}
      60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }
    .auth-act-step-2{
      overflow:hidden;
      max-height:0;
      opacity:0;
      transition:max-height 0.5s ease, opacity 0.4s ease, margin-top 0.35s ease, padding-top 0.35s ease, border-color 0.35s ease;
      margin-top:0;
      padding-top:0;
      border-top:1px solid transparent;
      pointer-events:none;
    }
    .auth-act-step-2.is-visible{
      max-height:280px;
      opacity:1;
      margin-top:18px;
      padding-top:18px;
      border-top-color:rgba(255,255,255,.1);
      pointer-events:auto;
    }
  `;
  document.head.appendChild(s);
}

// ════════════════════════════════════════
//  PERSISTANCE OPFS / localStorage
// ════════════════════════════════════════
async function _saveKey(key, data) {
  const json = JSON.stringify(data);
  APP.opfs.memCache[key] = json;
  if (typeof opfsWrite === 'function' && APP.opfs.ready) {
    await opfsWrite(key, json);
  } else {
    localStorage.setItem(key, json);
  }
}

async function _loadKey(key) {
  const cached = APP.opfs.memCache?.[key];
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  let raw = null;
  if (typeof opfsRead === 'function' && APP.opfs.ready) {
    try {
      raw = await opfsRead(key);
    } catch {
      raw = null;
    }
    if (raw == null) {
      try {
        raw = localStorage.getItem(key);
      } catch (_) {}
    }
  } else {
    raw = localStorage.getItem(key);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Paramètres : statut licence (texte uniquement, pas d’innerHTML) */
globalThis.renderSettingsActivationStatus = async function renderSettingsActivationStatus() {
  const el = document.getElementById('settings-activation-status');
  if (!el) return;
  if (typeof clearChildren === 'function') clearChildren(el);
  else el.replaceChildren();

  const act = await _loadKey(OPFS_ACTIVATION_KEY);
  const demo = await _loadKey(OPFS_DEMO_KEY);
  const demoLive =
    demo?.startedAt &&
    Date.now() - demo.startedAt < DEMO_DURATION_MS &&
    !act?.isActivated;

  if (!act?.isActivated && !demoLive) {
    el.appendChild(document.createTextNode('Application non activée sur cet appareil.'));
    return;
  }
  if (demoLive && !act?.isActivated) {
    const dm = document.createElement('div');
    dm.style.cssText = 'font-size:14px;font-weight:700;color:var(--gold,#F0A500);margin-bottom:6px';
    dm.textContent = 'Mode démo actif ⏱️';
    el.appendChild(dm);
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:var(--text2,#94A8BE)';
    sub.textContent = 'Activez avec une clé pour un accès illimité.';
    el.appendChild(sub);
    return;
  }
  const ok = document.createElement('div');
  ok.style.cssText = 'font-size:14px;font-weight:700;color:var(--teal,#09BC8A);margin-bottom:6px';
  ok.textContent = 'Activé ✔️';
  el.appendChild(ok);
  if (act.sessionPassHash) {
    const pw = document.createElement('div');
    pw.style.cssText = 'font-size:12px;color:var(--text2,#94A8BE);margin-top:4px';
    pw.textContent = 'Mot de passe de session : défini (déverrouillage après déconnexion).';
    el.appendChild(pw);
  } else {
    const noPw = document.createElement('div');
    noPw.id = 'settings-no-session-pw-warning';
    noPw.setAttribute('role', 'status');
    noPw.style.cssText =
      'margin-top:12px;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.45;' +
      'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);color:var(--text,#E8EEF4)';
    noPw.textContent =
      'Aucun mot de passe de session : après « Terminer session », la réouverture ne demande pas de code. Pour en ajouter un, passez par le flux d’activation (nouvelle clé) ou restaurez une sauvegarde puis redéfinissez le mot de passe à l’activation.';
    el.appendChild(noPw);
  }
  if (act.email) {
    const em = document.createElement('div');
    em.style.cssText = 'font-size:12px;color:var(--text2,#94A8BE)';
    em.textContent = `E-mail : ${act.email}`;
    el.appendChild(em);
  }
  if (act.licenseExp) {
    const ex = document.createElement('div');
    ex.style.cssText = 'font-size:12px;color:var(--text2,#94A8BE)';
    ex.textContent = `Expire le : ${new Date(Number(act.licenseExp) * 1000).toLocaleDateString('fr-FR')}`;
    el.appendChild(ex);
  }
  const did = document.createElement('div');
  did.style.cssText =
    'font-size:11px;color:var(--text3,#5A7089);margin-top:8px;font-family:ui-monospace,monospace;word-break:break-all';
  did.textContent = act.deviceId ? `Device ID : ${act.deviceId}` : '';
  if (did.textContent) el.appendChild(did);

  if (act.sessionPassHash && act.sessionPassSalt) {
    const box = document.createElement('div');
    box.style.cssText =
      'margin-top:18px;padding-top:18px;border-top:1px solid var(--border2,rgba(255,255,255,.1))';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text,#E8EEF4)';
    h.textContent = 'Changer le mot de passe de session';
    box.appendChild(h);

    function addPwRow(labelText, inputId, auto) {
      const wrap = document.createElement('div');
      wrap.className = 'form-group';
      const lab = document.createElement('label');
      lab.textContent = labelText;
      const inp = document.createElement('input');
      inp.type = 'password';
      inp.id = inputId;
      inp.setAttribute('autocomplete', auto);
      inp.style.boxSizing = 'border-box';
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      box.appendChild(wrap);
    }

    addPwRow('Mot de passe actuel', 'settings-sess-pw-current', 'current-password');
    addPwRow('Nouveau mot de passe', 'settings-sess-pw-new', 'new-password');
    addPwRow('Confirmer le nouveau', 'settings-sess-pw-new2', 'new-password');

    const err = document.createElement('div');
    err.id = 'settings-sess-pw-err';
    err.style.cssText =
      'display:none;font-size:12px;color:#f87171;margin-bottom:10px;padding:8px 12px;background:rgba(239,68,68,.08);border-radius:8px;border:1px solid rgba(239,68,68,.2)';
    box.appendChild(err);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Enregistrer le nouveau mot de passe';
    btn.addEventListener('click', () => {
      void globalThis.submitSettingsSessionPasswordChange();
    });
    box.appendChild(btn);

    el.appendChild(box);
  }
};

/** Paramètres : changement du mot de passe de déverrouillage (sans reclé) */
globalThis.submitSettingsSessionPasswordChange = async function submitSettingsSessionPasswordChange() {
  const errEl = document.getElementById('settings-sess-pw-err');
  const setErr = msg => {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    } else {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  };
  setErr('');

  const cur = document.getElementById('settings-sess-pw-current')?.value || '';
  const p1 = document.getElementById('settings-sess-pw-new')?.value || '';
  const p2 = document.getElementById('settings-sess-pw-new2')?.value || '';

  if (!cur) {
    setErr('Saisissez le mot de passe actuel.');
    return;
  }
  if (p1.length < SESSION_PASSWORD_MIN_LEN) {
    setErr(`Nouveau mot de passe trop court (minimum ${SESSION_PASSWORD_MIN_LEN} caractères).`);
    return;
  }
  if (p1 !== p2) {
    setErr('La confirmation ne correspond pas au nouveau mot de passe.');
    return;
  }

  const act = await _loadKey(OPFS_ACTIVATION_KEY);
  if (!act?.sessionPassSalt || !act?.sessionPassHash) {
    setErr('Aucun mot de passe de session enregistré.');
    return;
  }

  try {
    const hCur = await _deriveSessionPasswordHash(cur, act.sessionPassSalt);
    if (!_hexStringsEqual(hCur, act.sessionPassHash)) {
      setErr('Mot de passe actuel incorrect.');
      return;
    }
    const saltHex = await _generateSessionSaltHex();
    const hNew = await _deriveSessionPasswordHash(p1, saltHex);
    act.sessionPassSalt = saltHex;
    act.sessionPassHash = hNew;
    await _saveKey(OPFS_ACTIVATION_KEY, act);
  } catch (e) {
    setErr(e?.message || 'Impossible de mettre à jour le mot de passe.');
    return;
  }

  const c = document.getElementById('settings-sess-pw-current');
  const n = document.getElementById('settings-sess-pw-new');
  const n2 = document.getElementById('settings-sess-pw-new2');
  if (c) c.value = '';
  if (n) n.value = '';
  if (n2) n2.value = '';

  if (typeof toast === 'function') toast('Mot de passe de session mis à jour ✓', 'suc');
};
