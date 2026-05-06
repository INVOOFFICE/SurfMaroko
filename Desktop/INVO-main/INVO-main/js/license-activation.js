// js/license-activation.js — Device ID stable + matériel de clé licence (100 % local, pas d’API)
// SECRET : constante locale uniquement (pas globalThis, pas UI). Même valeur côté génération de clés.
(function () {
  'use strict';

  const LS_DEVICE_SEED = 'invoo_device_seed_v1';
  // SÉCURITÉ : ce SECRET est lisible dans le JS livré au navigateur (pas de backend = pas de secret serveur).
  // La contrainte réelle combine e-mail + deviceId (seed aléatoire par appareil). Toute personne ayant le
  // source peut générer des clés si elle connaît aussi l’e-mail et le deviceId — usage personnel / interne.
  const SECRET = 'INVOO' + '3388';

  async function invooSha256Hex(text) {
    if (!crypto?.subtle) {
      throw new Error('SubtleCrypto indisponible (HTTPS ou localhost requis).');
    }
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function invooGetStableDeviceId() {
    let seed = '';
    try {
      seed = localStorage.getItem(LS_DEVICE_SEED) || '';
    } catch (_) {}
    if (!seed) {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      seed = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
      try {
        localStorage.setItem(LS_DEVICE_SEED, seed);
      } catch (_) {}
    }
    const fp = [
      navigator.userAgent || '',
      navigator.language || '',
      navigator.platform || '',
      String(screen.width || 0),
      String(screen.height || 0),
      String(screen.colorDepth || 0),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      seed,
    ].join('|');
    return invooSha256Hex(fp);
  }

  function invooNormalizeActivationEmail(email) {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  /**
   * Vérifie que l'e-mail normalisé a un format valide (local@domaine.ext).
   * @param {string} email
   * @returns {boolean}
   */
  function invooIsValidEmail(email) {
    const normalized = invooNormalizeActivationEmail(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  }

  async function invooComputeExpectedLicenseHex(email, deviceId) {
    const e = invooNormalizeActivationEmail(email);
    const d = String(deviceId || '').trim();
    return invooSha256Hex(`${e}|${d}|${SECRET}`);
  }

  function invooNormalizeLicenseKeyInput(key) {
    return String(key || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  function invooLicenseKeysMatch(a, b) {
    const x = invooNormalizeLicenseKeyInput(a);
    const y = invooNormalizeLicenseKeyInput(b);
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return diff === 0;
  }

  globalThis.INVOO_OPFS_ACTIVATION_KEY = 'invoo_activation_v3';
  globalThis.INVOO_SESSION_LOCK_KEY = 'invoo_app_session_lock';
  globalThis.invooGetStableDeviceId = invooGetStableDeviceId;
  globalThis.invooComputeExpectedLicenseHex = invooComputeExpectedLicenseHex;
  globalThis.invooNormalizeActivationEmail = invooNormalizeActivationEmail;
  globalThis.invooIsValidEmail = invooIsValidEmail;
  globalThis.invooLicenseKeysMatch = invooLicenseKeysMatch;
  globalThis.invooNormalizeLicenseKeyInput = invooNormalizeLicenseKeyInput;
})();
