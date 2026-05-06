// js/backup.js — Paramètres, sauvegarde JSON, reset
// ── Paramètres ──
// ═══════════════════════════════════════════
/** Hauteur max. (px) du fichier image enregistré — évite des images énormes et préserve le rendu PDF. */
const LOGO_MAX_STORED_HEIGHT_PX = 400;
/** Plage de hauteur d'affichage du logo dans les documents (px) ; largeur = ratio conservé. */
const LOGO_DOC_HEIGHT_MIN = 24;
const LOGO_DOC_HEIGHT_MAX = 120;
const LOGO_DOC_HEIGHT_DEFAULT = 48;

function clampLogoDocHeight(v) {
  const n = Number(v);
  const base = Number.isFinite(n) ? Math.round(n) : LOGO_DOC_HEIGHT_DEFAULT;
  return Math.min(LOGO_DOC_HEIGHT_MAX, Math.max(LOGO_DOC_HEIGHT_MIN, base));
}

/**
 * Redimensionne l'image si elle dépasse LOGO_MAX_STORED_HEIGHT_PX en hauteur (largeur proportionnelle).
 * Retourne une data URL PNG (transparence préservée pour logos).
 */
function normalizeLogoDataURL(dataURL, maxHeight = LOGO_MAX_STORED_HEIGHT_PX) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth,
          h = img.naturalHeight;
        if (!w || !h) {
          resolve(dataURL);
          return;
        }
        if (h <= maxHeight) {
          resolve(dataURL);
          return;
        }
        const scale = maxHeight / h;
        const newH = Math.round(h * scale);
        const newW = Math.round(w * scale);
        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataURL);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newW, newH);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Image logo invalide'));
    img.src = dataURL;
  });
}

function syncLogoSettingsUI() {
  const s = DB.settings;
  const img = document.getElementById('logo-preview');
  const ph = document.getElementById('logo-placeholder');
  const range = document.getElementById('s-logo-height');
  const label = document.getElementById('s-logo-height-val');
  if (range) {
    range.value = String(clampLogoDocHeight(s.logoHeightPx));
    if (label) label.textContent = range.value;
  }
  const sci = document.getElementById('s-pdf-show-company-with-logo');
  if (sci) sci.checked = s.pdfShowCompanyInfoWithLogo !== false;
  if (img && ph) {
    if (s.logoData) {
      img.src = s.logoData;
      img.style.display = 'block';
      ph.style.display = 'none';
    } else {
      img.src = '';
      img.style.display = 'none';
      ph.style.display = '';
    }
  }
}

function loadSettings() {
  const s = DB.settings;
  const fields = [
    'name',
    'email',
    'phone',
    'address',
    'city',
    'bank',
    'branch',
    'rib',
    'ice',
    'if',
    'rc',
    'tp',
    'cnss',
    'footer',
  ];
  fields.forEach(f => {
    const el = document.getElementById('s-' + f);
    if (el) el.value = s[f] || '';
  });
  const sc = document.getElementById('s-currency');
  if (sc) sc.value = s.currency || 'DH';
  const st = document.getElementById('s-tva');
  if (st) st.value = s.tva || '20';
  const spm = document.getElementById('s-price-mode');
  if (spm && typeof getGlobalPriceMode === 'function') spm.value = getGlobalPriceMode();
  const sf = document.getElementById('s-seq-f');
  if (sf) sf.value = s.seqF || 1;
  const sd = document.getElementById('s-seq-d');
  if (sd) sd.value = s.seqD || 1;
  const sbl = document.getElementById('s-seq-bl');
  if (sbl) sbl.value = s.seqBL || 1;
  const sav = document.getElementById('s-seq-av');
  if (sav) sav.value = s.seqAV || 1;
  const sbm = document.getElementById('s-backup-monthly-day');
  if (sbm)
    sbm.value =
      s.backupMonthlyDay != null && s.backupMonthlyDay !== '' ? String(s.backupMonthlyDay) : '0';
  updateSettingsScore();
  const iceEl = document.getElementById('s-ice');
  if (iceEl) validateICEInput(iceEl);
  const ribEl = document.getElementById('s-rib');
  if (ribEl) validateRIBInput(ribEl);
  loadTemplateSettings();
  syncLogoSettingsUI();
  if (typeof renderSettingsActivationStatus === 'function') void renderSettingsActivationStatus();
  if (typeof syncSupabaseSettingsUI === 'function') syncSupabaseSettingsUI();
}
function saveSettings() {
  const s = DB.settings;
  [
    'name',
    'email',
    'phone',
    'address',
    'city',
    'bank',
    'branch',
    'rib',
    'ice',
    'if',
    'rc',
    'tp',
    'cnss',
    'footer',
  ].forEach(f => {
    const el = document.getElementById('s-' + f);
    if (el) s[f] = el.value.trim();
  });
  const lh = document.getElementById('s-logo-height');
  if (lh) s.logoHeightPx = clampLogoDocHeight(lh.value);
  const sci = document.getElementById('s-pdf-show-company-with-logo');
  if (sci) s.pdfShowCompanyInfoWithLogo = !!sci.checked;
  const scEl = document.getElementById('s-currency');
  const stvaEl = document.getElementById('s-tva');
  if (scEl && scEl.value) s.currency = scEl.value;
  if (stvaEl && stvaEl.value != null && stvaEl.value !== '') s.tva = stvaEl.value;
  const spm = document.getElementById('s-price-mode');
  if (spm) {
    const m = typeof normalizePriceMode === 'function' ? normalizePriceMode(spm.value) || 'TTC' : 'TTC';
    s.globalPriceMode = m;
    try {
      localStorage.setItem('priceMode', m);
    } catch (_) {}
  }
  s.seqF = parseInt(document.getElementById('s-seq-f')?.value, 10) || 1;
  s.seqD = parseInt(document.getElementById('s-seq-d')?.value, 10) || 1;
  s.seqBL = parseInt(document.getElementById('s-seq-bl')?.value, 10) || 1;
  s.seqAV = parseInt(document.getElementById('s-seq-av')?.value, 10) || 1;
  const sbm = document.getElementById('s-backup-monthly-day');
  if (sbm) {
    let v = parseInt(sbm.value, 10);
    if (Number.isNaN(v) || v < 0) v = 0;
    if (v > 31) v = 31;
    s.backupMonthlyDay = v;
  }
  saveTemplateSettings();
  const ssb = document.getElementById('s-supabase-sync-enabled');
  if (ssb) {
    const was = s.supabaseSyncEnabled;
    s.supabaseSyncEnabled = !!ssb.checked;
    if (was && !s.supabaseSyncEnabled && typeof invooSupabaseDisconnect === 'function') {
      invooSupabaseDisconnect(true);
    }
  }
  const surl = document.getElementById('s-supabase-url');
  if (surl) s.supabaseUrl = surl.value.trim();
  const sak = document.getElementById('s-supabase-anon-key');
  if (sak && sak.value.trim()) s.supabaseAnonKey = sak.value.trim();
  save('settings');
  if (typeof syncSupabaseSettingsUI === 'function') syncSupabaseSettingsUI();
  toast('Paramètres sauvegardés ✓', 'suc');
  updateSettingsScore();
  if (typeof renderBackupReminderStatus === 'function') renderBackupReminderStatus();
}
function updateSettingsScore() {
  const s = DB.settings;
  const checks = [
    { key: 'name', label: 'Raison sociale' },
    { key: 'ice', label: 'ICE' },
    { key: 'if', label: 'IF' },
    { key: 'rc', label: 'RC' },
    { key: 'tp', label: 'TP' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'rib', label: 'RIB bancaire' },
  ];
  const tmpS = { ...s };
  [
    'name',
    'email',
    'phone',
    'address',
    'city',
    'bank',
    'branch',
    'rib',
    'ice',
    'if',
    'rc',
    'tp',
    'cnss',
  ].forEach(f => {
    const el = document.getElementById('s-' + f);
    if (el) tmpS[f] = el.value;
  });
  const done = checks.filter(c => tmpS[c.key] && tmpS[c.key].toString().trim().length > 0).length;
  const score = Math.round((done / checks.length) * 100);
  const scoreEl = document.getElementById('settings-score-bar');
  if (!scoreEl) return;
  const color = score === 100 ? 'var(--brand)' : score >= 60 ? 'var(--accent)' : 'var(--danger)';
  clearChildren(scoreEl);
  const row1 = document.createElement('div');
  row1.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px';
  const t1 = document.createElement('span');
  t1.style.cssText = 'font-size:12px;font-weight:600;color:var(--text2)';
  t1.textContent = 'Complétude du profil';
  const t2 = document.createElement('span');
  t2.style.cssText = `font-size:12px;font-weight:700;color:${color}`;
  t2.textContent = `${done}/${checks.length} — ${score}%`;
  row1.appendChild(t1);
  row1.appendChild(t2);
  const barBg = document.createElement('div');
  barBg.style.cssText = 'height:6px;background:var(--border);border-radius:3px;overflow:hidden';
  const barFg = document.createElement('div');
  barFg.style.cssText = `width:${score}%;height:100%;background:${color};border-radius:3px;transition:.4s`;
  barBg.appendChild(barFg);
  const foot = document.createElement('div');
  foot.style.cssText = 'font-size:11px;margin-top:5px';
  if (score < 100) {
    foot.style.color = 'var(--text3)';
    foot.textContent =
      'Manquant : ' +
      checks
        .filter(c => !tmpS[c.key] || !tmpS[c.key].toString().trim())
        .map(c => c.label)
        .join(', ');
  } else {
    foot.style.color = 'var(--brand)';
    foot.textContent = '✅ Profil complet — conformité DGI maximale';
  }
  scoreEl.appendChild(row1);
  scoreEl.appendChild(barBg);
  scoreEl.appendChild(foot);
}
function toggleSetting(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('on');
}
function setToggle(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (val) el.classList.add('on');
  else el.classList.remove('on');
}

// ── Export / Import ──
// ═══════════════════════════════════════════
function downloadCSV(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportAllData() {
  updateOPFSInfo();
  const data = JSON.stringify(DB, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invo-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Sauvegarde exportée ✓', 'suc');
}
function importAllData() {
  document.getElementById('import-file').click();
}

function _isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function _validateBackupArrayOfObjects(arr, label) {
  if (!Array.isArray(arr)) return `${label} doit être un tableau`;
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    if (!_isPlainObject(row)) return `${label}[${i}] est invalide (objet attendu)`;
  }
  return '';
}

function _validateBackupSettings(settings) {
  if (!_isPlainObject(settings)) return 'settings doit être un objet';
  const mustBeString = [
    'name',
    'email',
    'phone',
    'address',
    'city',
    'bank',
    'branch',
    'rib',
    'ice',
    'if',
    'rc',
    'tp',
    'cnss',
    'currency',
    'footer',
    'color',
    'logoData',
    'lastMonthlyBackupPromptDate',
  ];
  for (const k of mustBeString) {
    if (settings[k] != null && typeof settings[k] !== 'string') {
      return `settings.${k} doit être une chaîne`;
    }
  }
  const numberLike = [
    'tva',
    'seqF',
    'seqD',
    'seqBL',
    'seqAV',
    'seqBC',
    'seqBCmd',
    'backupMonthlyDay',
    'logoHeightPx',
  ];
  for (const k of numberLike) {
    if (settings[k] == null) continue;
    const n = Number(settings[k]);
    if (!Number.isFinite(n)) return `settings.${k} doit être numérique`;
    if ((k.startsWith('seq') || k === 'backupMonthlyDay') && n < 0)
      return `settings.${k} ne peut pas être négatif`;
    if (k === 'logoHeightPx' && (n < LOGO_DOC_HEIGHT_MIN || n > LOGO_DOC_HEIGHT_MAX))
      return `settings.logoHeightPx doit être entre ${LOGO_DOC_HEIGHT_MIN} et ${LOGO_DOC_HEIGHT_MAX}`;
  }
  if (
    settings.pdfShowCompanyInfoWithLogo != null &&
    typeof settings.pdfShowCompanyInfoWithLogo !== 'boolean'
  ) {
    return 'settings.pdfShowCompanyInfoWithLogo doit être un booléen';
  }
  if (settings.backupMonthlyDay != null) {
    const day = Number(settings.backupMonthlyDay);
    if (day < 0 || day > 31) return 'settings.backupMonthlyDay doit être entre 0 et 31';
  }
  return '';
}

function _validateAndNormalizeBackupPayload(raw) {
  if (!_isPlainObject(raw)) return { ok: false, error: 'Fichier JSON invalide (objet attendu)' };

  const hasVersion = Object.prototype.hasOwnProperty.call(raw, 'version');
  if (hasVersion) {
    if (!Number.isInteger(raw.version))
      return { ok: false, error: 'Version de backup invalide (entier attendu)' };
    if (raw.version !== 1)
      return { ok: false, error: `Version de backup non supportée (${raw.version})` };
  }

  if (raw.exportedAt != null) {
    if (typeof raw.exportedAt !== 'string' || Number.isNaN(new Date(raw.exportedAt).getTime())) {
      return { ok: false, error: 'exportedAt invalide (date ISO attendue)' };
    }
  }

  const requiredKeys = ['settings', 'clients', 'stock', 'docs'];
  for (const k of requiredKeys) {
    if (!(k in raw)) return { ok: false, error: `Clé manquante: ${k}` };
  }

  const eSettings = _validateBackupSettings(raw.settings);
  if (eSettings) return { ok: false, error: eSettings };

  const arraysToValidate = [
    ['clients', raw.clients],
    ['stock', raw.stock],
    ['docs', raw.docs],
    ['fournisseurs', raw.fournisseurs ?? []],
    ['bonsCommande', raw.bonsCommande ?? []],
    ['stockMoves', raw.stockMoves ?? []],
  ];
  for (const [label, arr] of arraysToValidate) {
    const err = _validateBackupArrayOfObjects(arr, label);
    if (err) return { ok: false, error: err };
  }

  // Normalisation défensive : on garde uniquement la structure attendue.
  const normalized = {
    settings: { ...(DB_DEFAULTS?.settings || {}), ...raw.settings },
    clients: raw.clients,
    stock: raw.stock,
    docs: raw.docs,
    fournisseurs: raw.fournisseurs ?? [],
    bonsCommande: raw.bonsCommande ?? [],
    stockMoves: raw.stockMoves ?? [],
  };
  return { ok: true, data: normalized };
}
/**
 * Importe une sauvegarde JSON — même structure que exportBackup() :
 * { version?, exportedAt?, settings, clients, stock, docs, fournisseurs, bonsCommande }
 * ou ancien export JSON.stringify(DB) sans métadonnées (mêmes clés racine).
 */
function handleImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => {
    toast('Lecture du fichier impossible', 'err');
    input.value = '';
  };
  reader.onload = async e => {
    try {
      const raw = JSON.parse(e.target.result);
      const parsed = _validateAndNormalizeBackupPayload(raw);
      if (!parsed.ok) {
        toast(`Import refusé: ${parsed.error}`, 'err');
        input.value = '';
        return;
      }
      const ok = await showConfirm({
        title: 'Importer les données ?',
        message:
          'Toutes vos données actuelles seront <strong>remplacées</strong> par celles du fichier.<br><br>Cette action est irréversible.',
        icon: '📥',
        okLabel: 'Importer',
        okStyle: 'danger',
      });
      if (!ok) {
        input.value = '';
        return;
      }
      DB.settings = parsed.data.settings;
      DB.clients = parsed.data.clients;
      DB.stock = parsed.data.stock;
      DB.docs = parsed.data.docs;
      DB.fournisseurs = parsed.data.fournisseurs;
      DB.bonsCommande = parsed.data.bonsCommande;
      DB.stockMoves = parsed.data.stockMoves;
      if (typeof saveAllAsync === 'function') await saveAllAsync();
      else saveAll();
      renderOverview();
      toast('Données importées ✓ — rechargement…', 'suc');
      setTimeout(() => location.reload(), 120);
    } catch {
      toast('Fichier invalide (JSON attendu, même format que l’export « Backup JSON »)', 'err');
    }
    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}
async function clearAllData() {
  const ok = await showConfirm({
    title: 'Effacer TOUTES les données ?',
    message:
      'Clients, documents, stock, fournisseurs, bons de commande et paramètres seront <strong>définitivement supprimés</strong>.<br><br>Cette action est <strong>irréversible</strong>.',
    icon: '🚨',
    okLabel: 'Tout effacer',
    okStyle: 'danger',
  });
  if (!ok) return;
  if (typeof invooSupabaseDisconnect === 'function') invooSupabaseDisconnect(true);
  DB.clients = [];
  DB.stock = [];
  DB.docs = [];
  DB.fournisseurs = [];
  DB.bonsCommande = [];
  DB.stockMoves = [];
  DB.settings = {
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
    supabaseSettingsRowUpdatedAt: '',
    globalPriceMode: 'TTC',
  };
  // Clear OPFS cache and files
  APP.opfs.memCache = {};
  if (APP.opfs.ready && APP.opfs.dir) {
    const keys = Object.values(KEYS).concat(['invoo_notif_read', 'invoo_onboarding_done']);
    keys.forEach(async k => {
      try {
        await APP.opfs.dir.removeEntry(k + '.json');
      } catch {}
    });
  }
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('invoo_onboarding_done');
  localStorage.removeItem('invoo_notif_read');
  toast('Toutes les données effacées', 'suc');
  setTimeout(() => location.reload(), 800);
}

function clearCache() {
  // Vide uniquement le cache mémoire OPFS — les données sur disque restent intactes
  APP.opfs.memCache = {};
  // Force aussi le rechargement depuis le stockage OPFS/localStorage
  toast('🔄 Cache vidé — rechargement en cours…', 'suc');
  setTimeout(() => location.reload(), 700);
}
