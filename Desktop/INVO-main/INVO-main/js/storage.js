// ═══════════════════════════════════════════
//  storage.js  —  OPFS Layer + DB State
//  Chargé EN PREMIER — toutes les autres
//  fonctions dépendent de DB et des helpers OPFS
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
const KEYS = {
  settings: 'invoo_settings',
  clients: 'invoo_clients',
  stock: 'invoo_stock',
  docs: 'invoo_docs',
  fournisseurs: 'invoo_fournisseurs',
  bonsCommande: 'invoo_bons_commande',
  stockMoves: 'invoo_stock_moves',
};
/** Version logique du schéma OPFS / données — incrémenter quand une migration est ajoutée. */
const DB_VERSION = 1;
/** Fichier JSON `{ "v": number }` — jamais passé par l’enveloppe STORAGE_FORMAT_MARKER. */
const DB_VERSION_KEY = 'invoo_db_version';

const STORAGE_FORMAT_VERSION = 2;
const STORAGE_FORMAT_MARKER = 'invoo_storage_v2';

// ── Mode debug : mettre à true en développement uniquement ──
// En production, les logs sont supprimés pour éviter l'exposition d'infos internes.
const DEBUG = false;
const dbg = (...a) => {
  if (DEBUG) console.log('[INVO]', ...a);
};
const dbgWarn = (...a) => {
  if (DEBUG) console.warn('[INVO]', ...a);
};
const dbgErr = (...a) => {
  if (DEBUG) console.error('[INVO]', ...a);
};

// ═══ OPFS Storage Layer ═══
let _opfsDir = null,
  _opfsReady = false,
  _opfsMemCache = {};
/** Chaîne d’écritures OPFS pour éviter les écritures concurrentes et les états incohérents */
let _opfsWriteChain = Promise.resolve();

// ── Maintenabilité : encapsulation OPFS (réduction risque globaux) ──
// On expose uniquement un accès via window.APP.opfs pour que les autres fichiers
// n'utilisent pas directement _opfsMemCache/_opfsReady/_opfsDir.
window.APP = window.APP || {};
window.APP.opfs = window.APP.opfs || {};
const _defineOpfsState = (key, getter, setter) => {
  try {
    const desc = Object.getOwnPropertyDescriptor(window.APP.opfs, key);
    if (desc && (desc.get || desc.set)) return;
    Object.defineProperty(window.APP.opfs, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: false,
    });
  } catch (_) {}
};
_defineOpfsState(
  'dir',
  () => _opfsDir,
  v => {
    _opfsDir = v;
  },
);
_defineOpfsState(
  'ready',
  () => _opfsReady,
  v => {
    _opfsReady = v;
  },
);
_defineOpfsState(
  'memCache',
  () => _opfsMemCache,
  v => {
    _opfsMemCache = v;
  },
);

async function initOPFS() {
  try {
    _opfsDir = await navigator.storage.getDirectory();
    _opfsReady = true;
    // Migrate from localStorage if OPFS is empty
    const keys = Object.values(KEYS).concat([
      'invoo_notif_read',
      'invoo_onboarding_done',
      'invoo_activation_v3',
      'invoo_demo_session',
      DB_VERSION_KEY,
    ]);
    for (const k of keys) {
      try {
        await _opfsDir.getFileHandle(k + '.json');
      } catch {
        // fichier absent dans OPFS → migrer depuis localStorage
        const lsVal = localStorage.getItem(k);
        if (lsVal) {
          const ok = await opfsWrite(k, lsVal);
          // Prudence : on ne supprime localStorage que si l'écriture OPFS a réussi.
          if (ok) localStorage.removeItem(k);
        }
      }
    }
    updateOPFSInfo();
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage
          .persist()
          .then(granted => {
            if (!granted) {
              // Le navigateur peut effacer les données sous pression mémoire.
              console.warn('[INVO] storage.persist() refusé — données OPFS non persistantes.');
              // Toast discret après chargement de l'app.
              setTimeout(() => {
                if (typeof toast === 'function') {
                  toast(
                    '⚠️ Stockage non persistant — pensez à exporter un backup régulièrement.',
                    '',
                  );
                }
              }, 3500);
            }
          })
          .catch(() => {});
      }
    } catch (_) {}
  } catch (e) {
    dbgWarn('OPFS not available, falling back to localStorage', e);
    _opfsReady = false;
    document.getElementById('opfs-bar')?.style.setProperty('display', 'none');
  }
}

async function opfsWrite(k, jsonStr) {
  if (!_opfsReady) {
    localStorage.setItem(k, jsonStr);
    return false;
  }
  try {
    const fh = await _opfsDir.getFileHandle(k + '.json', { create: true });
    const w = await fh.createWritable();
    await w.write(jsonStr);
    await w.close();
    _opfsMemCache[k] = jsonStr;
    return true;
  } catch (e) {
    // Si OPFS échoue, on conserve aussi localStorage (pas de perte)
    localStorage.setItem(k, jsonStr);
    return false;
  }
}

async function opfsRead(k) {
  if (!_opfsReady) {
    const v = localStorage.getItem(k);
    return v;
  }
  if (_opfsMemCache[k] !== undefined) return _opfsMemCache[k];
  try {
    const fh = await _opfsDir.getFileHandle(k + '.json');
    const file = await fh.getFile();
    const text = await file.text();
    _opfsMemCache[k] = text;
    return text;
  } catch {
    return localStorage.getItem(k);
  }
}

async function updateOPFSInfo() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const used = est.usage || 0;
      const quota = est.quota || 0;
      const usedMB = (used / 1024 / 1024).toFixed(1);
      const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(1);
      const infoEl = document.getElementById('opfs-storage-info');
      if (infoEl) infoEl.textContent = `Utilisé: ${usedMB} MB · Quota disponible: ${quotaGB} GB`;
      const barInfo = document.getElementById('opfs-bar-info');
      if (barInfo) barInfo.textContent = `${usedMB} MB utilisés`;
    }
  } catch (e) {}
}

// Sync wrappers (called in save() — async behind the scenes)
function ls(k) {
  // Synchronous read from cache or localStorage fallback
  if (_opfsMemCache[k] !== undefined) {
    const raw = _opfsMemCache[k];
    try {
      return _decodeStoredPayload(k, JSON.parse(raw));
    } catch {
      // Prudence : si OPFS JSON est corrompu, tenter localStorage si présent
      try {
        const lsRaw = localStorage.getItem(k);
        if (lsRaw !== null) return _decodeStoredPayload(k, JSON.parse(lsRaw));
      } catch {}
      return null;
    }
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(k) || 'null');
    return _decodeStoredPayload(k, parsed);
  } catch {
    return null;
  }
}
function lss(k, v) {
  const json = JSON.stringify(_encodeStoredPayload(k, v));
  _opfsMemCache[k] = json;
  if (_opfsReady) {
    const nextWrite = _opfsWriteChain
      .then(() => opfsWrite(k, json))
      .catch(() => {
        try {
          localStorage.setItem(k, json);
        } catch (_) {}
      });
    _opfsWriteChain = nextWrite;
    // Compacter la chaîne une fois idle, sans casser un enchaînement plus récent.
    nextWrite.finally(() => {
      if (_opfsWriteChain === nextWrite) _opfsWriteChain = Promise.resolve();
    });
  } else {
    localStorage.setItem(k, json);
  }
}

function _isObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function _isVersionedStorageEnvelope(v) {
  return (
    _isObject(v) &&
    v.__fmt === STORAGE_FORMAT_MARKER &&
    Number.isInteger(v.version) &&
    Object.prototype.hasOwnProperty.call(v, 'data')
  );
}

function _encodeStoredPayload(k, value) {
  if (!Object.values(KEYS).includes(k)) return value;
  return { __fmt: STORAGE_FORMAT_MARKER, version: STORAGE_FORMAT_VERSION, data: value };
}

function _decodeStoredPayload(k, parsed) {
  if (!_isVersionedStorageEnvelope(parsed)) return parsed;
  // Si demain un format plus récent existe, on garde la lecture la plus sûre possible.
  if (parsed.version > STORAGE_FORMAT_VERSION) return parsed.data;
  return parsed.data;
}

// Valeurs par défaut des settings (centralisées pour réutilisation)
const DB_DEFAULTS = {
  settings: {
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    bank: '',
    branch: '',
    rib: '',
    ice: '',
    if: '',
    rc: '',
    tp: '',
    cnss: '',
    currency: 'DH',
    tva: '20',
    seqF: 1,
    seqD: 1,
    seqBL: 1,
    seqAV: 1,
    seqBC: 1,
    seqBCmd: 1,
    footer: 'Merci de votre confiance.',
    color: '#1a6b3c',
    logoData: '',
    logoHeightPx: 48,
    pdfShowCompanyInfoWithLogo: true,
    backupMonthlyDay: 0,
    lastMonthlyBackupPromptDate: '',
    supabaseSyncEnabled: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    /** Horodatage distant dernier appliqué (local uniquement — non synchronisé) */
    supabaseSettingsRowUpdatedAt: '',
    /** TTC | HT — aligné sur Paramètres + localStorage priceMode */
    globalPriceMode: 'TTC',
  },
  clients: [],
  stock: [],
  docs: [],
  fournisseurs: [],
  bonsCommande: [],
  stockMoves: [],
};

// DB initialisé avec les valeurs par défaut — sera peuplé après preloadOPFS()
let DB = {
  settings: { ...DB_DEFAULTS.settings },
  clients: [],
  stock: [],
  docs: [],
  fournisseurs: [],
  bonsCommande: [],
  stockMoves: [],
};

function _readDbVersionRaw() {
  let raw = _opfsMemCache[DB_VERSION_KEY];
  if (raw == null) {
    try {
      raw = localStorage.getItem(DB_VERSION_KEY);
    } catch {
      raw = null;
    }
  }
  return raw;
}

function getStoredDbVersion() {
  const raw = _readDbVersionRaw();
  if (raw == null) return 0;
  try {
    const p = JSON.parse(raw);
    const n = Number(p.v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

async function persistDbVersion(version) {
  const json = JSON.stringify({ v: version });
  _opfsMemCache[DB_VERSION_KEY] = json;
  if (_opfsReady) {
    await opfsWrite(DB_VERSION_KEY, json);
  } else {
    try {
      localStorage.setItem(DB_VERSION_KEY, json);
    } catch (_) {}
  }
}

/**
 * DB_MIGRATIONS — chaîne de migrations du schéma logique (`invoo_db_version`, { v }).
 *
 * Règle obligatoire : toute évolution de schéma (champs requis sur entités,
 * renommage, normalisation des fichiers OPFS, etc.) impose :
 *   1. Incrémenter `DB_VERSION` (constante plus haut dans ce fichier).
 *   2. Ajouter une entrée ici : clé = entier `n` (version cible), valeur = fonction
 *      `async` qui transforme les données pour passer de la version `(n - 1)` à `n`.
 *      L’ordre d’exécution est séquentiel : 1, 2, … jusqu’à `DB_VERSION`.
 *   3. Couvrir le comportement par un test dans `tests/` (régression ou jeu de
 *      données représentatif après migration).
 *
 * Invariant : pour chaque entier `k` tel que `1 <= k <= DB_VERSION`, une entrée
 * `DB_MIGRATIONS[k]` (fonction) doit exister. Sinon `runDbMigrationsIfNeeded`
 * journalise une erreur et interrompt la montée de version.
 *
 * Migrations séquentielles : exécuter `n` pour passer de la version (n-1) à n.
 */
const DB_MIGRATIONS = {
  /** v0 → v1 : introduction du suivi de version (aucune transformation de données requise). */
  1: async () => {
    dbg('[INVO] Migration DB 0→1 — versionnage persisté');
  },
};

async function runDbMigrationsIfNeeded() {
  let stored = getStoredDbVersion();
  if (stored >= DB_VERSION) return;

  while (stored < DB_VERSION) {
    const target = stored + 1;
    const migrate = DB_MIGRATIONS[target];
    if (typeof migrate !== 'function') {
      console.error(
        `[INVO] Migration DB manquante pour la version ${target} (DB_VERSION=${DB_VERSION}).`,
      );
      break;
    }
    try {
      await migrate();
    } catch (e) {
      console.error('[INVO] Échec migration DB v' + target, e);
      break;
    }
    await persistDbVersion(target);
    stored = target;
  }
}

// Peuple DB depuis le cache mémoire OPFS (appelé après preloadOPFS)
function _initDBFromCache() {
  const loadedSettings = ls(KEYS.settings) || {};
  DB.settings = { ...DB_DEFAULTS.settings, ...loadedSettings };
  if (!Object.prototype.hasOwnProperty.call(loadedSettings, 'globalPriceMode')) {
    try {
      const r = localStorage.getItem('priceMode');
      if (r === 'HT' || r === 'TTC') DB.settings.globalPriceMode = r;
    } catch (_) {}
  }
  DB.clients = ls(KEYS.clients) || [];
  DB.stock = ls(KEYS.stock) || [];
  DB.docs = ls(KEYS.docs) || [];
  DB.fournisseurs = ls(KEYS.fournisseurs) || [];
  DB.bonsCommande = ls(KEYS.bonsCommande) || [];
  DB.stockMoves = ls(KEYS.stockMoves) || [];
}

function _warnOpfsFallbackOnce() {
  try {
    if (localStorage.getItem('invoo_opfs_warn_shown')) return;
    localStorage.setItem('invoo_opfs_warn_shown', '1');
  } catch (_) {}
  console.warn('[storage] OPFS indisponible — fallback localStorage activé.');
  setTimeout(() => {
    if (typeof toast === 'function') {
      toast(
        'Stockage avancé (OPFS) non disponible. Données en local (limite ~5 Mo). Mettez à jour le navigateur si possible.',
        'warn',
      );
    }
  }, 800);
}

// Async preload all data from OPFS into cache before init
async function preloadOPFS() {
  await initOPFS();
  if (!_opfsReady) {
    _warnOpfsFallbackOnce();
    await runDbMigrationsIfNeeded();
    _initDBFromCache();
    migrateDocsTvaByRateIfNeeded();
    return;
  }
  const keys = Object.values(KEYS).concat([
    'invoo_notif_read',
    'invoo_onboarding_done',
    'invoo_activation_v3',
    'invoo_demo_session',
    DB_VERSION_KEY,
  ]);
  await Promise.all(
    keys.map(async k => {
      const v = await opfsRead(k);
      if (v !== null) _opfsMemCache[k] = v;
    }),
  );
  await runDbMigrationsIfNeeded();
  await migrateStorageFormatIfNeeded();
  // DB peuplé ICI — après que toutes les données OPFS sont en cache
  _initDBFromCache();
  migrateDocsTvaByRateIfNeeded();
}

/** Même logique que saveDoc (docs.js) : tvaByRate après remise globale. */
function _docAeExemptForTvaMigration(doc, settingsTva) {
  if (doc.aeExempt === true) return true;
  if (doc.aeExempt === false) return false;
  return parseInt(String(settingsTva ?? '20'), 10) === 0;
}
function _computeTvaByRateFromDocLines(doc, settingsTva) {
  const remise = parseFloat(doc.remise) || 0;
  const aeSave = _docAeExemptForTvaMigration(doc, settingsTva);
  const byRate = {};
  (doc.lines || []).forEach(l => {
    const r = aeSave ? 0 : Number(l.tva || 0);
    const lht = Number(l.qty || 0) * Number(l.price || 0);
    if (!byRate[r]) byRate[r] = { ht: 0, tva: 0, ttc: 0 };
    byRate[r].ht += lht;
    byRate[r].tva += aeSave ? 0 : lht * (r / 100);
    byRate[r].ttc += aeSave ? lht : lht * (1 + r / 100);
  });
  if (remise > 0) {
    const factor = 1 - remise / 100;
    Object.keys(byRate).forEach(k => {
      byRate[k].ht *= factor;
      byRate[k].tva *= factor;
      byRate[k].ttc *= factor;
    });
  }
  return byRate;
}
function _tvaByRateBucketsNearEqual(a, b, eps) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k] || { ht: 0, tva: 0, ttc: 0 };
    const vb = b[k] || { ht: 0, tva: 0, ttc: 0 };
    if (Math.abs((va.ht || 0) - (vb.ht || 0)) > eps) return false;
    if (Math.abs((va.tva || 0) - (vb.tva || 0)) > eps) return false;
    if (Math.abs((va.ttc || 0) - (vb.ttc || 0)) > eps) return false;
  }
  return true;
}
/**
 * Recalcule tvaByRate pour les anciens documents (remise sans factor, ou incohérences).
 * Idempotent : ne réécrit que si les valeurs diffèrent (epsilon 2 centimes par bucket).
 */
function migrateDocsTvaByRateIfNeeded() {
  if (!Array.isArray(DB.docs) || !DB.docs.length) return;
  const settingsTva = DB.settings?.tva;
  const eps = 0.02;
  let changed = false;
  for (const d of DB.docs) {
    if (!d.lines || !d.lines.length) continue;
    const rebuilt = _computeTvaByRateFromDocLines(d, settingsTva);
    if (!Object.keys(rebuilt).length) continue;
    if (_tvaByRateBucketsNearEqual(d.tvaByRate, rebuilt, eps)) continue;
    d.tvaByRate = rebuilt;
    changed = true;
  }
  if (changed) {
    save('docs');
    dbg('[INVO] Migration tvaByRate appliquée (documents mis à jour)');
  }
}

async function migrateStorageFormatIfNeeded() {
  const dataKeys = Object.values(KEYS);
  for (const key of dataKeys) {
    let parsed = null;
    try {
      const raw = _opfsMemCache[key];
      if (raw == null) continue;
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (_isVersionedStorageEnvelope(parsed)) continue;
    // Ancien format détecté (payload brut) -> remballer en format versionné.
    const wrapped = JSON.stringify(_encodeStoredPayload(key, parsed));
    _opfsMemCache[key] = wrapped;
    if (_opfsReady) {
      try {
        await opfsWrite(key, wrapped);
      } catch (_) {}
    } else {
      try {
        localStorage.setItem(key, wrapped);
      } catch (_) {}
    }
  }
}

function save(key) {
  if (KEYS[key]) lss(KEYS[key], DB[key]);
  if (typeof window.invooSupabaseOnLocalChange === 'function' && Object.prototype.hasOwnProperty.call(KEYS, key)) {
    try {
      window.invooSupabaseOnLocalChange(key);
    } catch (_) {}
  }
}
function saveAll() {
  Object.keys(KEYS).forEach(save);
}
async function waitStorageFlush() {
  try {
    await _opfsWriteChain;
  } catch (_) {}
}
async function saveAllAsync() {
  saveAll();
  await waitStorageFlush();
}

// ── Backup export (portable) ──
function _todayYYYYMMDD() {
  try {
    return new Date().toISOString().split('T')[0];
  } catch {
    return String(Date.now());
  }
}

function exportBackup() {
  updateOPFSInfo();
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: DB.settings,
    clients: DB.clients,
    stock: DB.stock,
    docs: DB.docs,
    fournisseurs: DB.fournisseurs,
    bonsCommande: DB.bonsCommande,
    stockMoves: DB.stockMoves,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_invo_${_todayYYYYMMDD()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  DB.settings.lastBackupAt = data.exportedAt;
  // Reset anti-spam des rappels
  DB.settings.lastBackupReminderCycle = 0;
  DB.settings.lastBackupReminderAt = '';
  save('settings');
  toast('✅ Backup exporté avec succès', 'suc');
  if (typeof renderBackupReminderStatus === 'function') renderBackupReminderStatus();
}

/** Rappel planifié : un jour du mois (Paramètres). Au plus une fois par jour local. */
function tryMonthlyBackupReminder() {
  const s = DB.settings || {};
  const day = parseInt(s.backupMonthlyDay, 10);
  if (Number.isNaN(day) || day < 1 || day > 31) return false;

  const now = new Date();
  const y = now.getFullYear(),
    m = now.getMonth(),
    d = now.getDate();
  const dim = new Date(y, m + 1, 0).getDate();
  const target = Math.min(day, dim);
  if (d !== target) return false;

  if (s.lastBackupAt) {
    const lb = new Date(s.lastBackupAt);
    if (!Number.isNaN(lb.getTime())) {
      const ly = lb.getFullYear(),
        lm = lb.getMonth(),
        ld = lb.getDate();
      if (ly === y && lm === m && ld === d) return false;
    }
  }

  const todayKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (s.lastMonthlyBackupPromptDate === todayKey) return false;

  s.lastMonthlyBackupPromptDate = todayKey;
  save('settings');

  if (typeof showConfirm === 'function') {
    void showConfirm({
      title: '💾 Rappel backup mensuel',
      message: `C’est le <strong>${target}</strong> du mois — pense à exporter une sauvegarde JSON (rappel défini dans Paramètres).`,
      icon: '📅',
      okLabel: 'Exporter maintenant',
      okStyle: 'primary',
      cancelLabel: 'Plus tard',
    }).then(ok => {
      if (ok) exportBackup();
    });
  } else {
    toast(`⚠️ Rappel backup mensuel — jour ${target}`, '');
  }
  return true;
}

function checkBackupReminder() {
  if (typeof renderBackupReminderStatus === 'function') renderBackupReminderStatus();
  const s = DB.settings || {};

  // Anti-spam : on n'affiche pas le même "cycle" deux fois pour ce backup
  const lastCycleShown = Number(s.lastBackupReminderCycle || 0);

  // Cas "jamais backup" : déclencher une fois
  if (!s.lastBackupAt) {
    if (lastCycleShown < 1) {
      s.lastBackupReminderCycle = 1;
      s.lastBackupReminderAt = new Date().toISOString();
      save('settings');
      if (typeof showConfirm === 'function') {
        void showConfirm({
          title: '💾 Export backup recommandé',
          message:
            'Aucun backup enregistré. Exporte maintenant un fichier JSON pour garder tes données en sécurité.',
          icon: '📦',
          okLabel: 'Exporter maintenant',
          okStyle: 'primary',
          cancelLabel: 'Plus tard',
        }).then(ok => {
          if (ok) exportBackup();
        });
      }
      return;
    }
    if (tryMonthlyBackupReminder()) return;
    return;
  }

  if (tryMonthlyBackupReminder()) return;

  const d = new Date(s.lastBackupAt);
  if (Number.isNaN(d.getTime())) return;

  const days = (Date.now() - d.getTime()) / 864e5;

  // FIAB-01 : premier rappel à >= 30 jours, puis toutes les 15 jours
  if (days < 30) return;

  const cycleIndex = Math.floor((days - 30) / 15) + 1; // 1 => 30-44j, 2 => 45-59j, ...
  if (cycleIndex <= lastCycleShown) return;

  s.lastBackupReminderCycle = cycleIndex;
  s.lastBackupReminderAt = new Date().toISOString();
  save('settings');

  if (typeof showConfirm === 'function') {
    const isUrgent = cycleIndex >= 2;
    const labelDays = Math.floor(days);
    void showConfirm({
      title: isUrgent ? '⚠️ Backup en retard' : '💾 Rappel backup',
      message: `Ton dernier backup date d’environ <strong>${labelDays}</strong> jour(s).<br><br>Pour éviter toute perte (panne disque, effacement navigateur), exporte un fichier JSON.`,
      icon: isUrgent ? '⚠️' : '💾',
      okLabel: 'Exporter maintenant',
      okStyle: isUrgent ? 'danger' : 'primary',
      cancelLabel: 'Rappel plus tard',
    }).then(ok => {
      if (ok) exportBackup();
    });
  } else {
    toast(`⚠️ Backup à faire (>=30j) — ${Math.floor(days)} jours`, '');
  }
}

function renderBackupReminderStatus() {
  const el = document.getElementById('backup-reminder-status');
  if (!el) return;

  const s = DB.settings || {};
  const last = s.lastBackupAt;
  const md = parseInt(s.backupMonthlyDay, 10);
  const appendMonthlySuffix = () => {
    if (Number.isNaN(md) || md < 1 || md > 31) return;
    el.appendChild(document.createTextNode(' · '));
    const sp = document.createElement('span');
    sp.style.color = 'var(--teal)';
    sp.style.fontWeight = '600';
    sp.textContent = `Pop-up mensuelle : jour ${md}`;
    el.appendChild(sp);
  };

  const span = (cssText, text) => {
    const s = document.createElement('span');
    if (cssText) s.style.cssText = cssText;
    s.textContent = text;
    return s;
  };

  const renderLine = parts => {
    clearChildren(el);
    parts.forEach((p, i) => {
      if (i) el.appendChild(document.createTextNode(' · '));
      el.appendChild(typeof p === 'string' ? document.createTextNode(p) : p);
    });
    appendMonthlySuffix();
  };

  if (!last) {
    renderLine([
      span('color:var(--text3);font-weight:600', 'Dernier backup :'),
      span('color:var(--text2)', 'Aucun'),
      span('color:var(--accent);font-weight:700', 'Export recommandé'),
    ]);
    return;
  }

  const d = new Date(last);
  if (Number.isNaN(d.getTime())) {
    renderLine([
      span('color:var(--text3);font-weight:600', 'Dernier backup :'),
      span('color:var(--text2)', 'Date invalide'),
      span('color:var(--accent);font-weight:700', 'Export recommandé'),
    ]);
    return;
  }

  const lastDateShort = String(last).slice(0, 10);
  const days = (Date.now() - d.getTime()) / 864e5;
  const cycleShown = Number(s.lastBackupReminderCycle || 0);
  const nextThresholdDays = 30 + cycleShown * 15; // jours depuis lastBackupAt
  const nextInDays = nextThresholdDays - days;

  if (days < 30) {
    const in30 = 30 - days;
    renderLine([
      span('color:var(--text3);font-weight:600', 'Dernier backup :'),
      span('color:var(--text2)', lastDateShort),
      span('color:var(--brand);font-weight:700', `Rappel dans ${Math.ceil(in30)} j`),
    ]);
    return;
  }

  if (nextInDays <= 0) {
    renderLine([
      span('color:var(--text3);font-weight:600', 'Dernier backup :'),
      span('color:var(--text2)', lastDateShort),
      span('color:var(--danger);font-weight:800', 'Rappel prêt'),
    ]);
    return;
  }

  const isUrgent = cycleShown >= 2;
  const r3 = document.createElement('span');
  r3.style.cssText = `color:${isUrgent ? 'var(--danger)' : 'var(--accent)'};font-weight:800`;
  r3.textContent = `Prochain rappel dans ${Math.ceil(nextInDays)} j`;
  renderLine([
    span('color:var(--text3);font-weight:600', 'Dernier backup :'),
    span('color:var(--text2)', lastDateShort),
    r3,
  ]);
}

let editArticleId = null,
  editClientId = null,
  docLines = [],
  histPage = 1,
  histPerPage = 15;
let _ovCaChart = null,
  _ovStatusChart = null,
  _ovPeriodMonths = 1;
let _newClientType = 'particulier';
let _notifications = [];
const MONTHS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

// ── Maintenabilité : encapsulation des états partagés ──
// On ne modifie pas le code existant : on expose juste ces variables via window.APP
// (progressivement, tu pourras écrire APP.editClientId, etc. sans casser l’app).
window.APP = window.APP || {};
const _defineAppState = (key, getter, setter) => {
  try {
    const desc = Object.getOwnPropertyDescriptor(window.APP, key);
    if (desc && (desc.get || desc.set)) return;
    Object.defineProperty(window.APP, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: false,
    });
  } catch (_) {}
};
_defineAppState(
  'editArticleId',
  () => editArticleId,
  v => {
    editArticleId = v;
  },
);
_defineAppState(
  'editClientId',
  () => editClientId,
  v => {
    editClientId = v;
  },
);
_defineAppState(
  'docLines',
  () => docLines,
  v => {
    docLines = v;
  },
);
_defineAppState(
  'histPage',
  () => histPage,
  v => {
    histPage = v;
  },
);
_defineAppState(
  'histPerPage',
  () => histPerPage,
  v => {
    histPerPage = v;
  },
);
_defineAppState(
  'ovCaChart',
  () => _ovCaChart,
  v => {
    _ovCaChart = v;
  },
);
_defineAppState(
  'ovStatusChart',
  () => _ovStatusChart,
  v => {
    _ovStatusChart = v;
  },
);
_defineAppState(
  'ovPeriodMonths',
  () => _ovPeriodMonths,
  v => {
    _ovPeriodMonths = v;
  },
);
_defineAppState(
  'newClientType',
  () => _newClientType,
  v => {
    _newClientType = v;
  },
);
_defineAppState(
  'notifications',
  () => _notifications,
  v => {
    _notifications = v;
  },
);
