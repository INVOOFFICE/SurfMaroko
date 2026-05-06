// ═══════════════════════════════════════════
//  docs.js  —  Documents, lignes, DGI, historique
// ═══════════════════════════════════════════
//
//  INDEX — fonctions & entrées principales (navigation rapide)
//  ───────────────────────────────────────────────────────────
//  Référence & numérotation : maxSeqFromExistingRefs, parseDocRefNum,
//    docRefExistsGlobally, getNextRef, syncSeqCounterFromDocs,
//    applyUniqueSequentialRef, updateDocRef, bumpSeq
//  Avoir / document source : syncAvoirSourceMetaFromContext,
//    refreshDocSourceHint
//  Statuts & liste déroulante doc : updateDocStatus, initDocLines
//  Lignes de document : addLine, removeLine, getLineTTC, getLineUnitTTC,
//    setLineFromUnitTTC, getDisplayedUnitPrice, applyUserUnitPriceInput,
//    renderDocLines, updateLineTotal, updLine
//  Montants, TVA, arrêté : nombreEnLettres, calcTotals, renderTVABreakdown,
//    refreshAutoEntrepreneurDocUI, getTotals
//  Persistance & PDF : saveDoc, saveAndDownloadPDF, showPostSaveActions,
//    closePostSaveBar
//  Formulaire génération : populateDocClient, onClientChange,
//    syncGenerateFromSettings, validateICEInput, runDGICheck
//  Historique & CRUD doc : editDocFromHistory,
//    createAvoirFromCancelledFacture, populateHistClientFilter,
//    getHistFiltered, openConvertModal, updateConvDateField, confirmConvert,
//    showConvertSuccessBar, renderHistory, quickChangeStatus, cancelDoc,
//    resetHistFilters, deleteDoc, duplicateDoc, exportHistXLSX,
//    sendDocWhatsApp, _normalizePhoneForWhatsApp
//  Rapports fiscaux : showSalesReport, accumulateDocTvaByRateForReport,
//    _setReportsSkeletonLoading, _repDocYmd, _repCutoffYmd, setRepPeriod,
//    renderReports
//
// ═══════════════════════════════════════════

// ── Référence document (séquence stricte ; comptabilise tous les documents, y compris Annulé) ──
// ═══════════════════════════════════════════════════════════════════════════════════════════
function maxSeqFromExistingRefs(type, year) {
  const re = new RegExp('^' + type + '-' + year + '-(\\d+)$');
  let max = 0;
  for (const d of DB.docs || []) {
    if (d.type !== type) continue;
    const m = String(d.ref || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  }
  return max;
}

function parseDocRefNum(type, ref) {
  const yr = yyyy();
  const re = new RegExp('^' + type + '-' + yr + '-(\\d+)$');
  const m = String(ref || '')
    .trim()
    .match(re);
  return m ? parseInt(m[1], 10) : null;
}

function docRefExistsGlobally(ref) {
  const r = String(ref || '').trim();
  if (!r) return false;
  return DB.docs.some(d => d.ref === r);
}

function getNextRef(type) {
  const s = DB.settings;
  const yr = yyyy();
  const seqKey = { F: 'seqF', D: 'seqD', BL: 'seqBL', AV: 'seqAV' }[type];
  const seqNext = (seqKey && (s[seqKey] || 1)) || 1;
  const maxE = maxSeqFromExistingRefs(type, yr);
  const n = Math.max(maxE + 1, seqNext);
  return `${type}-${yr}-${pad(n)}`;
}

function syncSeqCounterFromDocs(type) {
  const s = DB.settings;
  const yr = yyyy();
  const seqKey = { F: 'seqF', D: 'seqD', BL: 'seqBL', AV: 'seqAV' }[type];
  if (!seqKey) return;
  const maxE = maxSeqFromExistingRefs(type, yr);
  const cur = s[seqKey] || 1;
  s[seqKey] = Math.max(maxE + 1, cur);
  save('settings');
}

// Nouveau document : numéro ≥ max existant + 1 (tous statuts) et pas de doublon de ref.
function applyUniqueSequentialRef(type) {
  const refEl = document.getElementById('doc-ref');
  const ref = (refEl?.value || '').trim();
  const yr = yyyy();
  const maxE = maxSeqFromExistingRefs(type, yr);
  const exists = docRefExistsGlobally(ref);
  const parsed = parseDocRefNum(type, ref);
  const seqKey = { F: 'seqF', D: 'seqD', BL: 'seqBL', AV: 'seqAV' }[type];
  const seqNext = (seqKey && DB.settings[seqKey]) || 1;
  const minRequired = Math.max(maxE + 1, seqNext);

  // Ref vide → générer automatiquement
  if (!ref) {
    const nextRef = getNextRef(type);
    if (refEl) refEl.value = nextRef;
    hideDocRefHint();
    return;
  }

  // Ref déjà utilisée dans les docs → refuser, générer une nouvelle
  if (exists) {
    const nextRef = getNextRef(type);
    if (refEl) refEl.value = nextRef;
    showDocRefHint(`Référence déjà utilisée → ajustée en ${nextRef}`, true);
    toast(`Référence ajustée : ${nextRef} (doublon détecté)`, '');
    return;
  }

  // Ref au format standard mais numéro trop petit → avertir, conserver la saisie
  if (parsed !== null && parsed < minRequired) {
    showDocRefHint(`⚠️ Numéro inférieur au minimum conseillé (${minRequired}). Référence conservée.`, true);
    return;
  }

  // Ref personnalisée valide (format libre ou numéro correct) → accepter
  if (parsed === null && ref) {
    showDocRefHint('Référence personnalisée acceptée ✓', false);
  } else {
    hideDocRefHint();
  }
}

function updateDocRef() {
  const type = document.getElementById('doc-type')?.value;
  if (type) {
    document.getElementById('doc-ref').value = getNextRef(type);
    hideDocRefHint();
  }
}
function hideDocRefHint() {
  const h = document.getElementById('doc-ref-hint');
  if (!h) return;
  h.textContent = '';
  h.style.display = 'none';
}
function showDocRefHint(msg, isError) {
  const h = document.getElementById('doc-ref-hint');
  if (!h) return;
  h.textContent = msg;
  h.style.color = isError ? 'var(--danger,#e53935)' : 'var(--success,#2e7d32)';
  h.style.display = 'block';
}

function syncAvoirSourceMetaFromContext() {
  const type = document.getElementById('doc-type')?.value || 'F';
  if (type !== 'AV') return;
  const sourceRefEl = document.getElementById('doc-source-ref');
  const sourceIdEl = document.getElementById('doc-source-id');
  const sourceTypeEl = document.getElementById('doc-source-type');
  if (!sourceRefEl || !sourceIdEl || !sourceTypeEl) return;
  if (sourceRefEl.value) return;

  const originType = (document.getElementById('doc-origin-type')?.value || '').trim();
  const originStatus = (document.getElementById('doc-origin-status')?.value || '').trim();
  const originRef = (document.getElementById('doc-origin-ref')?.value || '').trim();
  const docId = (document.getElementById('doc-id')?.value || '').trim();

  // Règle métier : si facture annulée -> transformée en avoir, on conserve le lien.
  if (originType === 'F' && originStatus === 'Annulé' && originRef) {
    sourceRefEl.value = originRef;
    sourceIdEl.value = docId;
    sourceTypeEl.value = 'F';
  }
}

function refreshDocSourceHint() {
  const wrap = document.getElementById('doc-source-hint-wrap');
  const txt = document.getElementById('doc-source-hint-text');
  if (!wrap || !txt) return;

  syncAvoirSourceMetaFromContext();

  const type = document.getElementById('doc-type')?.value || '';
  const srcRef = (document.getElementById('doc-source-ref')?.value || '').trim();
  const srcType = (document.getElementById('doc-source-type')?.value || '').trim();
  if (type !== 'AV' || !srcRef) {
    wrap.style.display = 'none';
    return;
  }
  const label =
    srcType === 'F' ? 'Facture d’origine' : srcType === 'D' ? 'Devis source' : 'Document source';
  txt.textContent = `${label} : ${srcRef}`;
  wrap.style.display = 'block';
}

// ── Statuts autorisés par type de document ──
const DOC_STATUS_MAP = {
  F: [
    { value: 'Brouillon', label: 'Brouillon' },
    { value: 'Envoyé', label: 'Envoyé' },
    { value: 'Payé', label: 'Payé' },
    { value: 'Annulé', label: 'Annulé' },
  ],
  D: [
    { value: 'Brouillon', label: 'Brouillon' },
    { value: 'Envoyé', label: 'Envoyé' },
    { value: 'Accepté', label: 'Accepté' },
    { value: 'Refusé', label: 'Refusé' },
    { value: 'Expiré', label: 'Expiré' },
  ],
  BL: [
    { value: 'Brouillon', label: 'Brouillon' },
    { value: 'Envoyé', label: 'Envoyé' },
    { value: 'Livré', label: 'Livré' },
    { value: 'Annulé', label: 'Annulé' },
  ],
  AV: [
    { value: 'Brouillon', label: 'Brouillon' },
    { value: 'Envoyé', label: 'Envoyé' },
    { value: 'Validé', label: 'Validé' },
    { value: 'Annulé', label: 'Annulé' },
  ],
};

function updateDocStatus(preserveValue) {
  const typeEl = document.getElementById('doc-type');
  const statusEl = document.getElementById('doc-status');
  if (!typeEl || !statusEl) return;
  const type = typeEl.value;
  const statuses = DOC_STATUS_MAP[type] || DOC_STATUS_MAP['F'];
  const current = preserveValue || statusEl.value;
  clearChildren(statusEl);
  statuses.forEach(s => {
    const o = document.createElement('option');
    o.value = s.value;
    o.textContent = s.label;
    statusEl.appendChild(o);
  });
  // Restore previously selected value if it's still valid for the new type
  const still = statuses.find(s => s.value === current);
  statusEl.value = still ? current : statuses[0].value;
  if (typeof refreshThemedSelect === 'function') refreshThemedSelect('doc-status');
}
function bumpSeq(type) {
  syncSeqCounterFromDocs(type);
}

// ── Init lignes ──
// ═══════════════════════════════════════════
function initDocLines() {
  APP.docLines = [];
  const c = document.getElementById('doc-lines');
  if (c) clearChildren(c);
  const empty = document.getElementById('doc-lines-empty');
  if (empty) empty.style.display = 'block';
  ['doc-date', 'doc-remise', 'doc-acompte', 'doc-notes', 'doc-terms', 'doc-payment'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  updateDocStatus('Brouillon');
  const clientEl = document.getElementById('doc-client');
  if (clientEl) clientEl.value = '';
  const pillEl = document.getElementById('client-ice-pill');
  if (pillEl) pillEl.style.display = 'none';
  const docDate = document.getElementById('doc-date');
  if (docDate) docDate.value = today();
  // Réinitialiser l'id caché → le prochain save sera un nouveau document
  const docIdEl = document.getElementById('doc-id');
  if (docIdEl) docIdEl.value = '';
  // Réinitialiser les métadonnées de liaison (source doc)
  const srcRefEl = document.getElementById('doc-source-ref');
  if (srcRefEl) srcRefEl.value = '';
  const srcIdEl = document.getElementById('doc-source-id');
  if (srcIdEl) srcIdEl.value = '';
  const srcTypeEl = document.getElementById('doc-source-type');
  if (srcTypeEl) srcTypeEl.value = '';
  const originRefEl = document.getElementById('doc-origin-ref');
  if (originRefEl) originRefEl.value = '';
  const originTypeEl = document.getElementById('doc-origin-type');
  if (originTypeEl) originTypeEl.value = '';
  const originStatusEl = document.getElementById('doc-origin-status');
  if (originStatusEl) originStatusEl.value = '';
  updateDocRef();
  calcTotals();
  if (typeof refreshAutoEntrepreneurDocUI === 'function') refreshAutoEntrepreneurDocUI();
  closePostSaveBar();
  runDGICheck();
  refreshDocSourceHint();
  if (typeof refreshThemedSelect === 'function') {
    ['doc-type', 'doc-status', 'doc-client', 'doc-terms', 'doc-payment', 'doc-price-mode'].forEach(
      refreshThemedSelect,
    );
  }
  initDocPriceModeForNewDoc();
  // ── Bouton 🔄 régénération référence ──
  const btnRegen = document.getElementById('btn-regen-ref');
  if (btnRegen) {
    btnRegen.onclick = () => {
      updateDocRef();
      toast('Référence régénérée automatiquement', '');
    };
  }
  // ── Validation live du champ Référence ──
  const refInput = document.getElementById('doc-ref');
  if (refInput) {
    // Supprimer l'ancien listener pour éviter les doublons
    if (refInput._refInputHandler) refInput.removeEventListener('input', refInput._refInputHandler);
    refInput._refInputHandler = () => {
      const val = (refInput.value || '').trim();
      hideDocRefHint();
      if (!val) return;
      const editingId = document.getElementById('doc-id')?.value || '';
      const isDuplicate = DB.docs.some(d => d.ref === val && d.id !== editingId);
      if (isDuplicate) {
        showDocRefHint('⚠️ Cette référence est déjà utilisée.', true);
      } else {
        showDocRefHint('Référence disponible ✓', false);
      }
    };
    refInput.addEventListener('input', refInput._refInputHandler);
  }
}

// ── Ajouter ligne ──
// ═══════════════════════════════════════════
function addLine(article = null) {
  // Ignorer si article est un Event (clic sur div vide) ou n'a pas de name
  if (article && (article instanceof Event || typeof article.name !== 'string')) article = null;
  const id = Date.now() + '_' + Math.random().toString(36).slice(2);
  const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  const defaultTva = ae ? 0 : parseInt(DB.settings.tva, 10) || 20;
  const line = article
    ? {
        id,
        name: article.name,
        qty: 1,
        price: 0,
        tva: ae ? 0 : article.tva != null ? article.tva : defaultTva,
        fromStock: article.id,
      }
    : { id, name: '', qty: 1, price: 0, tva: defaultTva, fromStock: null };
  // Catalogue stock : prix de vente article.sell en TTC → toujours converti en PU HT (line.price).
  if (article) setLineFromUnitTTC(line, article.sell || 0);
  APP.docLines.push(line);
  renderDocLines();
  calcTotals(); /* refresh via renderDocLines */
  setTimeout(() => {
    const row = document.getElementById('line-' + id);
    if (row) row.querySelector('input')?.focus();
  }, 30);
}
function removeLine(id) {
  APP.docLines = APP.docLines.filter(l => l.id !== id);
  renderDocLines();
  calcTotals();
}
function getLineTTC(line) {
  const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  const qty = Number(line?.qty || 0);
  const price = Number(line?.price || 0);
  const rate = ae ? 0 : Number(line?.tva || 0);
  const ht = qty * price;
  return ht + (ht * rate) / 100;
}

// Prix Unitaire TTC (line.price stocke le PU HT en interne)
function getLineUnitTTC(line) {
  const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  const rate = ae ? 0 : Number(line?.tva || 0);
  const htUnit = Number(line?.price || 0);
  return htUnit + (htUnit * rate) / 100;
}

// Convertit un PU TTC en PU HT (pour stocker dans line.price)
function setLineFromUnitTTC(line, unitTTC) {
  const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  const rate = ae ? 0 : Number(line?.tva || 0);
  const denom = 1 + rate / 100;
  const ttc = Number(unitTTC) || 0;
  line.price = denom > 0 ? ttc / denom : 0;
}

/**
 * PU affiché dans le champ « Prix U » selon le mode document / global (TTC ou HT).
 * Stockage interne inchangé : line.price reste toujours HT.
 */
function getDisplayedUnitPrice(line) {
  if (typeof getEffectiveDocPriceMode === 'function' && getEffectiveDocPriceMode() === 'HT') {
    return Number(line?.price || 0);
  }
  return getLineUnitTTC(line);
}

/**
 * Interprète la saisie utilisateur du PU selon le mode (TTC → conversion, HT → stockage direct).
 */
function applyUserUnitPriceInput(line, rawStr) {
  const v = parseFloat(rawStr) || 0;
  if (typeof getEffectiveDocPriceMode === 'function' && getEffectiveDocPriceMode() === 'HT') {
    line.price = v;
  } else {
    setLineFromUnitTTC(line, v);
  }
}

function refreshDocPriceModeLabels() {
  const ht = typeof getEffectiveDocPriceMode === 'function' && getEffectiveDocPriceMode() === 'HT';
  const label = ht ? 'Prix U (HT)' : 'Prix U (TTC)';
  const head = document.getElementById('doc-inv-head-price');
  if (head) head.textContent = label;
  document.querySelectorAll('.inv-line .inv-cell-price .inv-mini-label').forEach(el => {
    el.textContent = label;
  });
}

function refreshAllDocLinePriceInputs() {
  (APP.docLines || []).forEach(l => {
    const row = document.getElementById('line-' + l.id);
    const inp = row?.querySelector('input[data-line-field="price"]');
    if (inp) inp.value = l.price ? String(getDisplayedUnitPrice(l)) : '';
  });
}

/** Synchronise APP.docPriceMode depuis le select document (bonus : mode par document). */
function syncDocPriceModeFromSelect() {
  const sel = document.getElementById('doc-price-mode');
  if (!sel) return;
  const m =
    typeof normalizePriceMode === 'function' ? normalizePriceMode(sel.value) : null;
  APP.docPriceMode = m || (typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC');
}

function initDocPriceModeForNewDoc() {
  APP.docPriceMode = typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC';
  const sel = document.getElementById('doc-price-mode');
  if (sel) sel.value = APP.docPriceMode;
  refreshDocPriceModeLabels();
}

function loadDocPriceModeFromSaved(d) {
  const fromDoc =
    d && typeof normalizePriceMode === 'function' ? normalizePriceMode(d.priceMode) : null;
  APP.docPriceMode = fromDoc || (typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC');
  const sel = document.getElementById('doc-price-mode');
  if (sel) sel.value = APP.docPriceMode;
  refreshDocPriceModeLabels();
}

/** Changement du mode sur le document : réaffiche les PU sans altérer line.price (HT). */
function onDocPriceModeChange() {
  syncDocPriceModeFromSelect();
  refreshDocPriceModeLabels();
  refreshAllDocLinePriceInputs();
  if (document.getElementById('modal-stock-picker')?.classList.contains('open') && typeof renderStockPicker === 'function') {
    renderStockPicker();
  }
}

// ── Render lignes (autocomplete) ──
// ═══════════════════════════════════════════
function renderDocLines() {
  const c = document.getElementById('doc-lines');
  const empty = document.getElementById('doc-lines-empty');
  if (empty) empty.style.display = APP.docLines.length ? 'none' : 'block';
  c.querySelectorAll('.inv-line').forEach(row => {
    if (!APP.docLines.find(l => l.id === row.dataset.lid)) row.remove();
  });

  APP.docLines.forEach((l, idx) => {
    if (document.getElementById('line-' + l.id)) return;
    const row = document.createElement('div');
    row.className = 'inv-line';
    row.id = 'line-' + l.id;
    row.dataset.lid = l.id;

    // Helper: field wrapper with mobile mini-label
    const makeCell = (label, child, extraClass = '') => {
      const cell = document.createElement('div');
      cell.className = 'inv-cell ' + extraClass;
      const lab = document.createElement('div');
      lab.className = 'inv-mini-label';
      lab.textContent = label;
      cell.appendChild(lab);
      cell.appendChild(child);
      return cell;
    };

    // Autocomplete wrap
    const acWrap = document.createElement('div');
    acWrap.className = 'ac-wrap';
    const name = document.createElement('input');
    name.dataset.lineField = 'name';
    name.value = l.name;
    name.placeholder = 'Désignation ou code article...';
    name.autocomplete = 'off';
    name.style.width = '100%';
    const dropdown = document.createElement('div');
    dropdown.className = 'ac-dropdown';
    dropdown.id = 'ac-' + l.id;
    let acFocusIdx = -1;
    const closeAC = () => {
      dropdown.classList.remove('open');
      acFocusIdx = -1;
    };
    const markAc = 'background:rgba(26,107,60,.15);color:var(--brand);border-radius:2px';
    const applyArt = a => {
      const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
      l.name = a.name;
      l.tva = ae ? 0 : a.tva != null ? a.tva : parseInt(DB.settings.tva, 10) || 20;
      l.fromStock = a.id;
      setLineFromUnitTTC(l, a.sell || 0);
      name.value = a.name;
      const priceInput = row.querySelector('input[data-line-field="price"]');
      const qtyInput = row.querySelector('input[data-line-field="qty"]');
      if (priceInput) priceInput.value = l.price ? String(getDisplayedUnitPrice(l)) : '';
      if (qtyInput) qtyInput.value = l.qty;
      const s = row.querySelector('select');
      if (s) s.value = String(l.tva);
      updateLineTotal(l);
      calcTotals();
      if (qtyInput) {
        qtyInput.select();
        qtyInput.focus();
      }
    };
    const openAC = q => {
      const ql = (q || '').toLowerCase();
      const results = q
        ? DB.stock
            .filter(
              a =>
                a.name.toLowerCase().includes(ql) ||
                (a.barcode || '').toLowerCase().includes(ql) ||
                (a.category || '').toLowerCase().includes(ql),
            )
            .slice(0, 8)
        : DB.stock.slice(0, 8);
      clearChildren(dropdown);
      acFocusIdx = -1;
      if (!results.length && q) {
        const empty = document.createElement('div');
        empty.className = 'ac-empty';
        empty.textContent = 'Aucun article pour "' + q + '"';
        dropdown.appendChild(empty);
        const libre = document.createElement('div');
        libre.className = 'ac-add';
        libre.appendChild(document.createTextNode('✏️ Utiliser "'));
        const st = document.createElement('strong');
        st.textContent = q;
        libre.appendChild(st);
        libre.appendChild(document.createTextNode('" comme texte libre'));
        libre.addEventListener('mousedown', e => {
          e.preventDefault();
          l.name = q;
          name.value = q;
          closeAC();
        });
        dropdown.appendChild(libre);
        dropdown.classList.add('open');
        return;
      }
      if (!results.length) {
        closeAC();
        return;
      }
      results.forEach(a => {
        const low = (a.qty || 0) < 5,
          zero = (a.qty || 0) === 0;
        const item = document.createElement('div');
        item.className = 'ac-item';
        const left = document.createElement('div');
        const nameRow = document.createElement('div');
        nameRow.className = 'ac-name';
        appendHighlightedContent(nameRow, a.name, q, markAc);
        if (low && !zero) {
          const w = document.createElement('span');
          w.className = 'ac-stock-low';
          w.textContent = '⚠';
          nameRow.appendChild(w);
        }
        const meta = document.createElement('div');
        meta.className = 'ac-meta';
        meta.textContent = `${a.category || '—'} · stock: ${a.qty || 0}`;
        left.appendChild(nameRow);
        left.appendChild(meta);
        const price = document.createElement('div');
        price.className = 'ac-price';
        const aePick = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
        const arTva = aePick ? 0 : a.tva != null ? a.tva : parseInt(DB.settings.tva, 10) || 20;
        const sellShown =
          typeof displayTTCForDocLineMode === 'function'
            ? displayTTCForDocLineMode(a.sell || 0, arTva)
            : a.sell || 0;
        price.textContent = fmt(sellShown);
        item.appendChild(left);
        item.appendChild(price);
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          applyArt(a);
          closeAC();
        });
        dropdown.appendChild(item);
      });
      if (q) {
        const libre = document.createElement('div');
        libre.className = 'ac-add';
        libre.appendChild(document.createTextNode('✏️ Utiliser "'));
        const st2 = document.createElement('strong');
        st2.textContent = q;
        libre.appendChild(st2);
        libre.appendChild(document.createTextNode('" comme texte libre'));
        libre.addEventListener('mousedown', e => {
          e.preventDefault();
          l.name = q;
          name.value = q;
          closeAC();
        });
        dropdown.appendChild(libre);
      }
      dropdown.classList.add('open');
    };
    name.addEventListener('input', e => {
      l.name = e.target.value;
      openAC(e.target.value.trim());
    });
    name.addEventListener('focus', e => {
      if (DB.stock.length) openAC(e.target.value.trim());
    });
    name.addEventListener('blur', () => setTimeout(closeAC, 160));
    name.addEventListener('change', e => {
      l.name = e.target.value;
    });
    name.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('.ac-item,.ac-add');
      if (!dropdown.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acFocusIdx = Math.min(acFocusIdx + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('focused', i === acFocusIdx));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acFocusIdx = Math.max(acFocusIdx - 1, 0);
        items.forEach((it, i) => it.classList.toggle('focused', i === acFocusIdx));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const f = dropdown.querySelector('.focused') || dropdown.querySelector('.ac-item');
        if (f) f.dispatchEvent(new MouseEvent('mousedown'));
        closeAC();
      } else if (e.key === 'Escape' || e.key === 'Tab') closeAC();
    });
    acWrap.appendChild(name);
    acWrap.appendChild(dropdown);
    row.appendChild(makeCell('Désignation', acWrap, 'inv-cell-name'));

    const priceLabel =
      typeof getEffectiveDocPriceMode === 'function' && getEffectiveDocPriceMode() === 'HT'
        ? 'Prix U (HT)'
        : 'Prix U (TTC)';

    const price = document.createElement('input');
    price.type = 'text';
    price.inputMode = 'decimal';
    price.value = l.price ? String(getDisplayedUnitPrice(l)) : '';
    price.dataset.lineField = 'price';
    price.addEventListener('input', e => {
      applyUserUnitPriceInput(l, e.target.value);
      updateLineTotal(l);
      calcTotals();
    });
    price.addEventListener('blur', e => {
      if (e.target.value === '' || e.target.value === '0') e.target.value = '';
    });
    row.appendChild(makeCell(priceLabel, price, 'inv-cell-price'));

    const qty = document.createElement('input');
    qty.type = 'text';
    qty.inputMode = 'decimal';
    qty.value = l.qty;
    qty.dataset.lineField = 'qty';
    qty.addEventListener('input', e => {
      l.qty = parseFloat(e.target.value) || 0;
      updateLineTotal(l);
      calcTotals();
      runDGICheck();
    });
    qty.addEventListener('blur', e => {
      if (e.target.value === '') e.target.value = 0;
    });
    row.appendChild(makeCell('Qté', qty, 'inv-cell-qty'));

    const total = document.createElement('div');
    total.id = 'line-total-' + l.id;
    total.style.cssText =
      'font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1,"zero" 0';
    total.textContent = l.price > 0 ? fmtNum(l.qty * l.price) : '';
    row.appendChild(makeCell('Total HT', total, 'inv-cell-totalht'));

    const totalTTC = document.createElement('div');
    totalTTC.id = 'line-total-ttc-' + l.id;
    totalTTC.style.cssText =
      'font-size:12px;font-weight:700;color:var(--brand);font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1,"zero" 0';
    totalTTC.textContent = l.price > 0 ? fmtNum(getLineTTC(l)) : '';
    row.appendChild(makeCell('Total TTC', totalTTC, 'inv-cell-totalttc'));

    const sel = document.createElement('select');
    sel.style.cssText = 'padding:6px 4px;font-size:12px';
    sel.dataset.lineTvaSelect = '1';
    ['20', '14', '10', '7', '0'].forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r + '%';
      if (String(l.tva) === r) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', e => {
      l.tva = parseInt(e.target.value, 10);
      const unitInput = row.querySelector('input[data-line-field="price"]');
      const raw = parseFloat(unitInput?.value) || 0;
      if (typeof getEffectiveDocPriceMode === 'function' && getEffectiveDocPriceMode() === 'HT') {
        l.price = raw;
      } else {
        setLineFromUnitTTC(l, raw);
      }
      updateLineTotal(l);
      calcTotals();
    });
    row.appendChild(makeCell('TVA%', sel, 'inv-cell-tva'));

    const del = document.createElement('button');
    del.className = 'btn btn-icon btn-danger';
    del.textContent = '✕';
    del.addEventListener('click', () => removeLine(l.id));
    row.appendChild(del);

    const rows = c.querySelectorAll('.inv-line');
    if (rows[idx]) c.insertBefore(row, rows[idx]);
    else c.appendChild(row);
  });
  refreshDocPriceModeLabels();
  if (typeof refreshAutoEntrepreneurDocUI === 'function') refreshAutoEntrepreneurDocUI();
  runDGICheck();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.ac-wrap'))
    document.querySelectorAll('.ac-dropdown').forEach(d => d.classList.remove('open'));
});

function updateLineTotal(l) {
  const el = document.getElementById('line-total-' + l.id);
  if (el) el.textContent = l.qty && l.price ? fmtNum(l.qty * l.price) : '';
  const ttcEl = document.getElementById('line-total-ttc-' + l.id);
  if (ttcEl) ttcEl.textContent = l.qty && l.price ? fmtNum(getLineTTC(l)) : '';
}
function updLine(id, field, val) {
  const l = APP.docLines.find(x => x.id === id);
  if (!l) return;
  if (field === 'price') applyUserUnitPriceInput(l, val);
  else if (field === 'qty' || field === 'tva') l[field] = parseFloat(val) || 0;
  else l[field] = val;
  updateLineTotal(l);
  calcTotals();
}

// ── Nombre en lettres (DGI Maroc) ──
// ═══════════════════════════════════════════
function nombreEnLettres(montant, devise) {
  const u = [
    '',
    'un',
    'deux',
    'trois',
    'quatre',
    'cinq',
    'six',
    'sept',
    'huit',
    'neuf',
    'dix',
    'onze',
    'douze',
    'treize',
    'quatorze',
    'quinze',
    'seize',
    'dix-sept',
    'dix-huit',
    'dix-neuf',
  ];
  const d = [
    '',
    '',
    'vingt',
    'trente',
    'quarante',
    'cinquante',
    'soixante',
    'soixante',
    'quatre-vingt',
    'quatre-vingt',
  ];
  function dizaine(n) {
    if (n < 20) return u[n];
    const di = Math.floor(n / 10),
      un = n % 10;
    if (di === 7) {
      if (un === 0) return 'soixante-dix';
      if (un === 1) return 'soixante et onze';
      return 'soixante-' + u[10 + un];
    }
    if (di === 8) {
      return un === 0 ? 'quatre-vingts' : 'quatre-vingt-' + u[un];
    }
    if (di === 9) {
      return 'quatre-vingt-' + u[10 + un];
    }
    if (un === 0) return d[di];
    if (un === 1 && di !== 8) return d[di] + ' et un';
    return d[di] + '-' + u[un];
  }
  function centaine(n) {
    if (n < 100) return dizaine(n);
    const c = Math.floor(n / 100),
      r = n % 100;
    if (c === 1) return r === 0 ? 'cent' : 'cent ' + dizaine(r);
    return dizaine(c) + ' cent' + (r === 0 && c > 1 ? 's' : r > 0 ? ' ' + dizaine(r) : '');
  }
  function millier(n) {
    if (n === 0) return '';
    if (n < 1000) return centaine(n);
    if (n < 1000000) {
      const m = Math.floor(n / 1000),
        r = n % 1000;
      const ms = m === 1 ? 'mille' : centaine(m) + ' mille';
      return r === 0 ? ms : ms + ' ' + centaine(r);
    }
    const m = Math.floor(n / 1000000),
      r = n % 1000000;
    const ms = m === 1 ? 'un million' : centaine(m) + ' millions';
    return r === 0 ? ms : ms + ' ' + millier(r);
  }
  const total = Math.round(montant * 100);
  const entier = Math.floor(total / 100);
  const cents = total % 100;
  const devs = devise || 'DH';
  // Unité monétaire
  const unitePrincipale = devs === 'EUR' ? 'euro' : 'dirham';
  const uniteSecondaire = devs === 'EUR' ? 'centime' : 'centime';
  let res = entier === 0 ? 'zéro' : millier(entier) || 'zéro';
  res = res.charAt(0).toUpperCase() + res.slice(1);
  res += ' ' + unitePrincipale + (entier > 1 ? 's' : '');
  if (cents > 0)
    res += ' et ' + (millier(cents) || 'zéro') + ' ' + uniteSecondaire + (cents > 1 ? 's' : '');
  return res;
}

// ── Calcul totaux + TVA breakdown ──
// ═══════════════════════════════════════════
function calcTotals() {
  const remise = parseFloat(document.getElementById('doc-remise')?.value) || 0;
  const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  let globalHT = 0,
    globalTVA = 0;
  const byRate = {};

  APP.docLines.forEach(l => {
    const lineHT = l.qty * l.price;
    const ratePct = ae ? 0 : l.tva || 0;
    const lineTVA = lineHT * (ratePct / 100);
    globalHT += lineHT;
    globalTVA += lineTVA;
    const r = ratePct;
    if (!byRate[r]) byRate[r] = { ht: 0, tva: 0, ttc: 0 };
    byRate[r].ht += lineHT;
    byRate[r].tva += lineTVA;
    byRate[r].ttc += lineHT + lineTVA;
  });

  // Apply global discount proportionally
  if (remise > 0) {
    const factor = 1 - remise / 100;
    globalHT *= factor;
    globalTVA *= factor;
    Object.keys(byRate).forEach(r => {
      byRate[r].ht *= factor;
      byRate[r].tva *= factor;
      byRate[r].ttc *= factor;
    });
  }

  const ttc = globalHT + globalTVA;
  const acompte = parseFloat(document.getElementById('doc-acompte')?.value) || 0;
  const reste = ttc - acompte;

  document.getElementById('sum-ht').textContent = fmt(globalHT);
  document.getElementById('sum-tva').textContent = fmt(globalTVA);
  document.getElementById('sum-ttc').textContent = fmt(ttc);

  // ── Adapter le bloc "Reste à payer" selon le type de document ──
  const type = document.getElementById('doc-type')?.value || 'F';
  const resteBlock = document.getElementById('sum-reste-block');
  const resteLabel = document.getElementById('sum-reste-label');
  const resteVal = document.getElementById('sum-reste');
  if (type === 'F') {
    // Facture : afficher "Reste à payer" avec l'acompte déduit
    if (resteBlock) resteBlock.style.display = '';
    if (resteLabel) resteLabel.textContent = 'Reste à payer';
    if (resteVal) resteVal.textContent = fmt(Math.max(reste, 0));
  } else if (type === 'AV') {
    // Avoir : afficher "Montant à rembourser"
    if (resteBlock) resteBlock.style.display = '';
    if (resteLabel) resteLabel.textContent = 'Montant à rembourser';
    if (resteVal) resteVal.textContent = fmt(ttc);
  } else {
    // Devis, BL : masquer le bloc, sans sens métier
    if (resteBlock) resteBlock.style.display = 'none';
  }
  // ── Arrêté en toutes lettres ──
  const arrEl = document.getElementById('sum-arrete');
  const arrTxt = document.getElementById('sum-arrete-text');
  if (arrEl && arrTxt) {
    if (ttc > 0) {
      arrTxt.textContent = nombreEnLettres(ttc, CUR());
      arrEl.style.display = '';
    } else {
      arrEl.style.display = 'none';
    }
  }
  // ── TVA breakdown ──
  renderTVABreakdown(byRate, globalHT, globalTVA, ttc);
}

function renderTVABreakdown(byRate, globalHT, globalTVA, ttc) {
  const w = document.getElementById('tva-by-rate-wrap');
  if (!w) return;

  // Masquer si aucune ligne ou TVA = 0
  const rates = Object.keys(byRate || {})
    .map(Number)
    .sort((a, b) => a - b);
  if (!rates.length || globalTVA === 0) {
    w.style.display = 'none';
    return;
  }

  // N'afficher que s'il y a plusieurs taux OU au moins un taux > 0
  const hasTVA = rates.some(r => r > 0);
  if (!hasTVA) {
    w.style.display = 'none';
    return;
  }

  const tbody = document.getElementById('tva-by-rate-body');
  const tfoot = document.getElementById('tva-by-rate-foot');
  if (!tbody || !tfoot) return;

  // Couleurs par taux
  const tvaColors = { 0: '#64748b', 7: '#3b82f6', 10: '#8b5cf6', 14: '#f59e0b', 20: '#09BC8A' };

  clearChildren(tbody);
  rates.forEach(r => {
    const v = byRate[r];
    const color = tvaColors[r] || '#94a3b8';
    const tr = document.createElement('tr');
    const tdBadge = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'tva-rate-badge';
    badge.style.background = `${color}22`;
    badge.style.color = color;
    badge.style.border = `1px solid ${color}44`;
    badge.textContent = `${r}%`;
    tdBadge.appendChild(badge);
    const tdHt = document.createElement('td');
    tdHt.textContent = fmt(v.ht);
    const tdTva = document.createElement('td');
    tdTva.style.color = color;
    tdTva.style.fontWeight = '600';
    tdTva.textContent = fmt(v.tva);
    const tdTtc = document.createElement('td');
    tdTtc.style.fontWeight = '700';
    tdTtc.textContent = fmt(v.ttc);
    tr.appendChild(tdBadge);
    tr.appendChild(tdHt);
    tr.appendChild(tdTva);
    tr.appendChild(tdTtc);
    tbody.appendChild(tr);
  });

  clearChildren(tfoot);
  const sumRow = document.createElement('tr');
  sumRow.className = 'tva-sum-row';
  const s1 = document.createElement('td');
  s1.textContent = 'Total';
  const s2 = document.createElement('td');
  s2.textContent = fmt(globalHT);
  const s3 = document.createElement('td');
  s3.style.color = 'var(--accent)';
  s3.style.fontWeight = '700';
  s3.textContent = fmt(globalTVA);
  const s4 = document.createElement('td');
  s4.style.color = 'var(--brand)';
  s4.style.fontWeight = '800';
  s4.textContent = fmt(ttc);
  sumRow.appendChild(s1);
  sumRow.appendChild(s2);
  sumRow.appendChild(s3);
  sumRow.appendChild(s4);
  tfoot.appendChild(sumRow);

  w.style.display = 'block';
}

/** UI document : mode auto-entrepreneur (TVA entreprise 0 %) — colonnes, libellés, selects */
function refreshAutoEntrepreneurDocUI() {
  const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  const ban = document.getElementById('doc-ae-vat-banner');
  if (ban) ban.style.display = ae ? 'block' : 'none';
  const artCard = document.getElementById('doc-articles-card');
  if (artCard) artCard.classList.toggle('ae-vat-mode', ae);
  const sumRow = document.getElementById('sum-financial-totals-row');
  if (sumRow) sumRow.classList.toggle('ae-vat-mode', ae);
  ['sum-ht-wrap', 'sum-tva-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = ae ? 'none' : '';
  });
  const ttcl = document.getElementById('sum-ttc-label');
  if (ttcl) ttcl.textContent = ae ? 'Total à payer' : 'Total TTC';
  document.querySelectorAll('#doc-lines .inv-line select[data-line-tva-select]').forEach(sel => {
    const row = sel.closest('.inv-line');
    const lid = row && row.dataset ? row.dataset.lid : '';
    const line = lid ? APP.docLines.find(x => x.id === lid) : null;
    sel.disabled = !!ae;
    if (ae) sel.value = '0';
    else if (line && ['0', '7', '10', '14', '20'].includes(String(line.tva)))
      sel.value = String(line.tva);
  });
}

function getTotals() {
  const remise = parseFloat(document.getElementById('doc-remise')?.value) || 0;
  const ae = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  let ht = 0,
    tva = 0;
  APP.docLines.forEach(l => {
    const lht = l.qty * l.price;
    ht += lht;
    if (!ae) tva += lht * ((l.tva || 0) / 100);
  });
  const remiseAmt = ht * (remise / 100);
  ht -= remiseAmt;
  if (!ae) tva *= 1 - remise / 100;
  const ttc = ae ? ht : ht + tva;
  return { ht, tva, ttc, remise };
}

// ── Sauvegarder document ──
// ═══════════════════════════════════════════
async function saveDoc(opts = {}) {
  const fb = document.getElementById('doc-feedback');
  const setDocFeedback = msg => {
    if (fb) fb.textContent = msg;
  };
  setDocFeedback('Enregistrement en cours...');
  const silent = !!opts.silent;
  const keepEditor = !!opts.keepEditor;
  const type = document.getElementById('doc-type').value;
  const statusRaw = document.getElementById('doc-status').value;
  const date = document.getElementById('doc-date').value;
  const clientId = document.getElementById('doc-client').value;
  const terms = document.getElementById('doc-terms').value;
  const payment = document.getElementById('doc-payment').value;
  const notes = document.getElementById('doc-notes').value;
  const remise = parseFloat(document.getElementById('doc-remise').value) || 0;
  const acompte = parseFloat(document.getElementById('doc-acompte').value) || 0;

  syncDocPriceModeFromSelect();

  if (!APP.docLines.length) {
    toast('Ajoutez au moins un article', 'err');
    setDocFeedback('Ajoutez au moins un article pour sauvegarder.');
    return null;
  }

  // Identifier le document par son id interne (champ caché) — fiable même si la ref change
  const editingId = document.getElementById('doc-id')?.value || '';
  const existing = editingId ? DB.docs.findIndex(d => d.id === editingId) : -1;
  const isNew = existing < 0;
  const prevDoc = isNew ? null : DB.docs[existing];

  // Cas métier: on édite une facture annulée et on la transforme en avoir.
  // => on doit créer un NOUVEL avoir, sans écraser la facture source.
  const isAvoirFromCancelledFacture = !!(
    prevDoc &&
    prevDoc.type === 'F' &&
    prevDoc.status === 'Annulé' &&
    type === 'AV'
  );
  const createAsNew = isNew || isAvoirFromCancelledFacture;

  if (createAsNew) applyUniqueSequentialRef(type);
  let ref = (document.getElementById('doc-ref').value || '').trim();
  if (!ref) {
    toast('Référence manquante', 'err');
    setDocFeedback('Référence manquante.');
    return null;
  }

  // Vérification doublon de référence
  if (createAsNew) {
    // Nouveau document : la ref ne doit exister nulle part
    if (docRefExistsGlobally(ref)) {
      toast('Cette référence est déjà utilisée. Modifiez-la ou cliquez sur 🔄.', 'err');
      setDocFeedback('Référence en double — modifiez la référence.');
      showDocRefHint('⚠️ Référence déjà utilisée.', true);
      return null;
    }
  } else if (prevDoc && ref !== prevDoc.ref) {
    // Édition : si la ref a changé, elle ne doit pas exister dans un autre doc
    if (DB.docs.some(d => d.ref === ref && d.id !== editingId)) {
      toast('Cette référence est déjà utilisée par un autre document.', 'err');
      setDocFeedback('Référence en double — modifiez la référence.');
      showDocRefHint('⚠️ Référence déjà utilisée par un autre document.', true);
      return null;
    }
  }

  let status = statusRaw;
  if (isAvoirFromCancelledFacture && status === 'Annulé') {
    // Un avoir nouvellement créé ne doit pas rester en "Annulé" par défaut.
    status = 'Brouillon';
    const statusEl = document.getElementById('doc-status');
    if (statusEl) {
      statusEl.value = 'Brouillon';
      if (typeof refreshThemedSelect === 'function') refreshThemedSelect('doc-status');
    }
  }
  if (status === 'Annulé' && !isAvoirFromCancelledFacture) {
    toast(
      "Un document annulé ne peut pas être sauvegardé. Utilisez l'Historique pour gérer ce document.",
      'err',
    );
    setDocFeedback("Ce document annule ne peut pas etre sauvegarde depuis cet ecran.");
    return null;
  }

  const iceVal = (DB.settings.ice || '').replace(/\D/g, '');
  if (iceVal.length !== 15) {
    const force = await showConfirm({
      title: 'ICE absent ou invalide',
      message:
        'Votre ICE vendeur est absent ou invalide.<br><br>La facture <strong>ne sera pas conforme DGI</strong>.<br>Continuer quand même ?',
      icon: '⚠️',
      okLabel: 'Continuer quand même',
      okStyle: 'danger',
      cancelLabel: 'Annuler',
    });
    if (!force) {
      nav('settings', sbItem('settings'));
      return null;
    }
  }

  const totals = getTotals();
  const client = DB.clients.find(c => c.id === clientId) || null;

  const aeSave = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  // Build TVA by rate for storage
  const byRate = {};
  APP.docLines.forEach(l => {
    const r = aeSave ? 0 : l.tva || 0;
    const lht = l.qty * l.price;
    if (!byRate[r]) byRate[r] = { ht: 0, tva: 0, ttc: 0 };
    byRate[r].ht += lht;
    byRate[r].tva += aeSave ? 0 : lht * (r / 100);
    byRate[r].ttc += aeSave ? lht : lht * (1 + r / 100);
  });
  // Aligner tvaByRate sur les totaux (getTotals / calcTotals) : remise globale proportionnelle
  if (remise > 0) {
    const factor = 1 - remise / 100;
    Object.keys(byRate).forEach(k => {
      byRate[k].ht *= factor;
      byRate[k].tva *= factor;
      byRate[k].ttc *= factor;
    });
  }

  // Préserver/charger la liaison source depuis le formulaire (si édition)
  let sourceRef = (document.getElementById('doc-source-ref')?.value || '').trim();
  let sourceId = (document.getElementById('doc-source-id')?.value || '').trim();
  let sourceType = (document.getElementById('doc-source-type')?.value || '').trim();
  if (prevDoc) {
    sourceRef = sourceRef || String(prevDoc.sourceRef || '');
    sourceId = sourceId || String(prevDoc.sourceId || '');
    sourceType = sourceType || String(prevDoc.sourceType || '');
  }

  // Cas demandé: Facture annulée -> transformée en Avoir
  if (prevDoc && prevDoc.type === 'F' && prevDoc.status === 'Annulé' && type === 'AV') {
    sourceRef = prevDoc.ref || sourceRef;
    sourceId = prevDoc.id || sourceId;
    sourceType = 'F';
  }

  const doc = {
    id: createAsNew ? 'doc_' + Date.now() : DB.docs[existing].id,
    ref,
    type,
    status,
    date,
    clientId,
    clientName: client ? client.name : 'N/A',
    terms,
    payment,
    notes,
    remise,
    acompte,
    sourceRef,
    sourceId,
    sourceType,
    convertedToRef: prevDoc?.convertedToRef || '',
    convertedToId: prevDoc?.convertedToId || '',
    priceMode:
      typeof normalizePriceMode === 'function'
        ? normalizePriceMode(APP.docPriceMode) ||
          (typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC')
        : 'TTC',
    lines: APP.docLines.map(l => (aeSave ? { ...l, tva: 0 } : { ...l })),
    tvaByRate: byRate,
    aeExempt: aeSave,
    ...totals,
    createdAt: createAsNew ? new Date().toISOString() : DB.docs[existing].createdAt,
    updatedAt: new Date().toISOString(),
  };

  // ── Gestion stock intelligente ──
  // Uniquement Facture (F) et Bon de Livraison (BL), statut Envoyé ou Payé
  const deductOnSave =
    (type === 'F' || type === 'BL') && (status === 'Envoyé' || status === 'Payé');
  const wasDeducted = prevDoc ? prevDoc.stockDeducted === true : false;

  // Anti incohérence : on garde les quantités stock avant modification
  // afin de pouvoir les restaurer si une erreur JS survient avant l'enregistrement du doc.
  const oldStockQtyById = {};
  (APP.docLines || []).forEach(l => {
    if (!l.fromStock) return;
    const a = DB.stock.find(x => x.id === l.fromStock);
    if (a) oldStockQtyById[l.fromStock] = a.qty || 0;
  });

  if (!isNew && wasDeducted) {
    // Restituer l'ancien stock avant de recalculer
    (prevDoc.lines || []).forEach(l => {
      if (l.fromStock) {
        const a = DB.stock.find(x => x.id === l.fromStock);
        if (a) {
          // Ne restituer que la quantité réellement déduite (si le clamp avait réduit)
          const restoreQty =
            typeof l.stockDeductedQty === 'number' ? l.stockDeductedQty : l.qty || 0;
          a.qty = (a.qty || 0) + restoreQty;
        }
      }
    });
  }

  const stockWarnings = [];
  let stockDeductedCount = 0;
  if (deductOnSave) {
    // Déduire le stock de manière “réversible” : on calcule la quantité réellement déduite.
    doc.lines.forEach(l => {
      if (!l.fromStock) return;
      const a = DB.stock.find(x => x.id === l.fromStock);
      if (!a) return;
      const currentQty = a.qty || 0;
      const needQty = l.qty || 0;

      const deductedQty = Math.min(currentQty, needQty);
      a.qty = Math.max(0, currentQty - deductedQty);
      l.stockDeductedQty = deductedQty;

      if (deductedQty > 0) {
        stockDeductedCount++;
        if (a.qty < 5) stockWarnings.push(`${a.name}: ${a.qty} restant(s)`);
      }
    });
  } else {
    // Si on ne déduit pas (Brouillon / Devis / autres statuts), nettoyer le marqueur.
    doc.lines.forEach(l => {
      if (l.fromStock) l.stockDeductedQty = 0;
    });
  }
  doc.stockDeducted = deductOnSave;

  try {
    if (createAsNew) {
      DB.docs.unshift(doc);
      bumpSeq(type);
    } else {
      DB.docs[existing] = doc;
    }
    // Mettre à jour le champ caché avec l'id réel — si on sauvegarde à nouveau sans recharger, c'est une mise à jour
    const docIdEl = document.getElementById('doc-id');
    if (docIdEl) docIdEl.value = doc.id;
    save('docs');
    // Envoi stock uniquement après save du doc (cohérence minimale stock <-> docs)
    save('stock');
    buildNotifications();

    const typeLabel =
      { F: 'Facture', D: 'Devis', BL: 'Bon de Livraison', AV: 'Avoir' }[type] || type;
    if (!silent) {
      toast(`${typeLabel} ${ref} sauvegardée ✓`, 'suc');
      showPostSaveActions(doc, stockDeductedCount);
    }
    setDocFeedback(`${typeLabel} enregistre avec succes.`);
    if (!keepEditor) {
      initDocLines();
      updateDocRef();
    }
    if (stockWarnings.length)
      setTimeout(() => toast('⚠️ Stock bas — ' + stockWarnings.join(', '), ''), 800);
    return doc;
  } catch (e) {
    dbgErr('[saveDoc] Erreur sauvegarde:', e);
    // Rollback stock en mémoire (en cas d'erreur avant la persistance)
    Object.entries(oldStockQtyById).forEach(([id, qty]) => {
      const a = DB.stock.find(x => String(x.id) === String(id));
      if (a) a.qty = qty;
    });
    toast('❌ Erreur lors de la sauvegarde — réessayez', 'err');
    setDocFeedback('Erreur lors de la sauvegarde. Reessayez.');
    return null;
  }
}

async function saveAndDownloadPDF() {
  const savedDoc = await saveDoc({ silent: true, keepEditor: true });
  if (!savedDoc || !savedDoc.id) return;
  const previewOpen = document.getElementById('modal-preview-pdf')?.classList.contains('open');
  let pdfOpts = {};
  if (previewOpen && typeof APP !== 'undefined' && APP.pdfPreview) {
    const bc = document.getElementById('preview-band-color');
    if (bc) APP.pdfPreview.color = bc.value;
    pdfOpts = {
      tpl: APP.pdfPreview.tpl || DB.settings.pdfTemplate || 'classic',
      color: APP.pdfPreview.color || DB.settings.bandColor || '#1a6b3c',
    };
  }
  await downloadDocPDFById(savedDoc.id, pdfOpts);
  toast(`Document ${savedDoc.ref} sauvegardé + PDF téléchargé ✓`, 'suc');
}

// ── Post-save bar ──
// ═══════════════════════════════════════════
function showPostSaveActions(doc, stockDeductedCount = 0) {
  const old = document.getElementById('post-save-bar');
  if (old) {
    clearTimeout(old._timer);
    old.remove();
  }
  const typeLabel =
    { F: 'Facture', D: 'Devis', BL: 'Bon de Livraison', AV: 'Avoir' }[doc.type] || doc.type;
  const statusColor =
    { Payé: 'var(--brand)', Envoyé: '#2563eb', Brouillon: 'var(--text2)', Annulé: 'var(--danger)' }[
      doc.status
    ] || 'var(--text2)';
  const bar = document.createElement('div');
  bar.id = 'post-save-bar';
  const _isMob = window.innerWidth <= 768;
  bar.style.cssText = `position:fixed;bottom:${_isMob ? '60px' : '0'};left:${_isMob ? '0' : 'var(--sidebar-w)'};right:0;z-index:800;background:var(--surface);border-top:2px solid var(--brand);padding:${_isMob ? '10px 12px' : '12px 24px'};display:flex;align-items:center;gap:14px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,.1)`;
  const left = document.createElement('div');
  left.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;min-width:200px';
  const ic = document.createElement('span');
  ic.style.fontSize = '22px';
  ic.textContent = { F: '📄', D: '📝', BL: '📦', AV: '↩️' }[doc.type] || '📄';
  const col = document.createElement('div');
  const t1 = document.createElement('div');
  t1.style.cssText = 'font-weight:700;font-size:14px';
  t1.textContent = `${doc.ref || ''} — ${typeLabel}`;
  const t2 = document.createElement('div');
  t2.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px';
  const sub = document.createElement('span');
  sub.style.cssText = 'font-size:12px;color:var(--text2)';
  sub.appendChild(document.createTextNode(`${doc.clientName || ''} · `));
  const st = document.createElement('span');
  st.style.color = statusColor;
  st.style.fontWeight = '600';
  st.textContent = doc.status || '';
  sub.appendChild(st);
  sub.appendChild(document.createTextNode(` · ${fmt(doc.ttc)}`));
  t2.appendChild(sub);
  if (stockDeductedCount > 0) {
    const bd = document.createElement('span');
    bd.style.cssText =
      'display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;background:rgba(9,188,138,0.12);color:var(--brand);border:1px solid rgba(9,188,138,0.25)';
    bd.textContent = `📦 Stock mis à jour — ${stockDeductedCount} article${stockDeductedCount > 1 ? 's' : ''} déduit${stockDeductedCount > 1 ? 's' : ''}`;
    t2.appendChild(bd);
  }
  col.appendChild(t1);
  col.appendChild(t2);
  left.appendChild(ic);
  left.appendChild(col);
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const bHist = document.createElement('button');
  bHist.className = 'btn btn-secondary btn-sm';
  bHist.setAttribute('data-action', 'ps-open-history');
  bHist.textContent = '📋 Historique';
  const bEd = document.createElement('button');
  bEd.className = 'btn btn-secondary btn-sm';
  bEd.setAttribute('data-action', 'ps-edit-doc');
  bEd.setAttribute('data-id', encodeURIComponent(String(doc.id || '')));
  bEd.textContent = '✏️ Modifier';
  const bCl = document.createElement('button');
  bCl.setAttribute('data-action', 'ps-close');
  bCl.style.cssText =
    'background:none;border:none;cursor:pointer;font-size:18px;color:var(--text2);padding:4px 8px';
  bCl.textContent = '✕';
  actions.appendChild(bHist);
  actions.appendChild(bEd);
  actions.appendChild(bCl);
  bar.appendChild(left);
  bar.appendChild(actions);
  bar
    .querySelector('[data-action="ps-open-history"]')
    ?.addEventListener('click', () => nav('history', sbItem('history')));
  bar.querySelector('[data-action="ps-edit-doc"]')?.addEventListener('click', e => {
    const id = decodeURIComponent(e.currentTarget.getAttribute('data-id') || '');
    editDocFromHistory(id);
  });
  bar.querySelector('[data-action="ps-close"]')?.addEventListener('click', closePostSaveBar);
  document.getElementById('main').appendChild(bar);
  bar._timer = setTimeout(closePostSaveBar, 12000);
}
function closePostSaveBar() {
  const bar = document.getElementById('post-save-bar');
  if (!bar) return;
  clearTimeout(bar._timer);
  bar.style.transform = 'translateY(100%)';
  setTimeout(() => bar.remove(), 300);
}

// ═══════════════════════════════════════════
//  POPULATE CLIENT SELECTOR

// ── Populate client selector ──
// ═══════════════════════════════════════════
function populateDocClient() {
  const sel = document.getElementById('doc-client');
  if (!sel) return;
  const cur = sel.value;
  clearChildren(sel);
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = DB.clients.length
    ? 'Sélectionner un client...'
    : 'Aucun client enregistré';
  sel.appendChild(placeholder);
  const addOpt = document.createElement('option');
  addOpt.value = '__new__';
  addOpt.textContent = '➕ Ajouter un nouveau client';
  sel.appendChild(addOpt);
  if (DB.clients.length) {
    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '──────────────────';
    sel.appendChild(sep);
    DB.clients.forEach(c => {
      const o = document.createElement('option');
      const iceOk = (c.ice || '').replace(/\D/g, '').length === 15;
      o.value = c.id;
      o.textContent = c.name + (c.ice ? ` — ICE ${c.ice}` : '  ⚠ sans ICE');
      if (c.id === cur) o.selected = true;
      sel.appendChild(o);
    });
  }
  syncGenerateFromSettings();
  if (typeof refreshThemedSelect === 'function') refreshThemedSelect('doc-client');
}

function onClientChange() {
  const sel = document.getElementById('doc-client');
  const val = sel.value;
  if (val === '__new__') {
    sel.value = '';
    openNewClientModal();
    return;
  }
  const pill = document.getElementById('client-ice-pill');
  if (!val) {
    pill.style.display = 'none';
    runDGICheck();
    return;
  }
  const client = DB.clients.find(c => c.id === val);
  if (!client) {
    pill.style.display = 'none';
    runDGICheck();
    return;
  }
  const hasICE = (client.ice || '').replace(/\D/g, '').length === 15;
  pill.style.display = 'inline-flex';
  pill.className = 'client-ice-pill ' + (hasICE ? 'ok' : 'miss');
  pill.textContent = hasICE ? '✓ ICE OK' : '⚠ ICE manquant';
  runDGICheck();
}

function syncGenerateFromSettings() {
  const s = DB.settings;
  const notesEl = document.getElementById('doc-notes');
  if (notesEl && !notesEl.value && s.footer) notesEl.placeholder = `Footer par défaut: ${s.footer}`;
  updateDocRef();
  runDGICheck();
}

// ── Validation ICE ──
// ═══════════════════════════════════════════
function validateICEInput(input) {
  const v = (input.value || '').replace(/\D/g, '');
  input.value = v;
  input.classList.remove('ice-valid', 'ice-warn', 'ice-invalid');
  if (!v) return;
  if (v.length === 15) input.classList.add('ice-valid');
  else input.classList.add('ice-warn');
  if (document.getElementById('dgi-checker')) runDGICheck();
}

// ── DGI Checker ──
// ═══════════════════════════════════════════
const DGI_CHECKS = [
  {
    id: 'ice-v',
    label: 'ICE vendeur',
    tip: '15 chiffres, art. 145 CGI',
    check: () => {
      const v = (DB.settings.ice || '').replace(/\D/g, '');
      return v.length === 15 ? 'ok' : v.length > 0 ? 'warn' : 'err';
    },
  },
  {
    id: 'if-v',
    label: 'IF vendeur',
    tip: 'Identifiant Fiscal obligatoire',
    check: () => (DB.settings.if ? 'ok' : 'err'),
  },
  {
    id: 'rc-v',
    label: 'RC vendeur',
    tip: 'Registre du Commerce obligatoire',
    check: () => (DB.settings.rc ? 'ok' : 'err'),
  },
  {
    id: 'nom-v',
    label: 'Raison sociale',
    tip: 'Nom du vendeur obligatoire',
    check: () => (DB.settings.name ? 'ok' : 'err'),
  },
  {
    id: 'ice-c',
    label: 'ICE client',
    tip: 'Obligatoire pour déduction TVA B2B',
    check: () => {
      const cid = (document.getElementById('doc-client') || {}).value;
      if (!cid || cid === '__new__') return 'warn';
      const type = (document.getElementById('doc-type') || {}).value;
      if (type === 'D' || type === 'BL') return 'ok';
      const c = DB.clients.find(x => x.id === cid);
      if (!c) return 'warn';
      const v = (c.ice || '').replace(/\D/g, '');
      return v.length === 15 ? 'ok' : v.length > 0 ? 'warn' : 'err';
    },
  },
  {
    id: 'cli',
    label: 'Client renseigné',
    tip: 'Client obligatoire sur facture',
    check: () => {
      const cid = (document.getElementById('doc-client') || {}).value;
      const type = (document.getElementById('doc-type') || {}).value;
      if (type === 'D') return 'ok';
      return cid && cid !== '__new__' ? 'ok' : 'err';
    },
  },
  {
    id: 'date',
    label: "Date d'émission",
    tip: 'Date obligatoire sur tout document',
    check: () => ((document.getElementById('doc-date') || {}).value ? 'ok' : 'err'),
  },
  {
    id: 'lignes',
    label: 'Au moins 1 article',
    tip: 'Document vide non valide',
    check: () => (APP.docLines.length > 0 ? 'ok' : 'err'),
  },
];
const DGI_LBL = { ok: '✓', warn: '⚠', err: '✗' };
function runDGICheck() {
  const list = document.getElementById('dgi-items-list');
  const badge = document.getElementById('dgi-score-badge');
  if (!list || !badge) return;
  let ok = 0,
    err = 0,
    warn = 0;
  clearChildren(list);
  DGI_CHECKS.forEach(c => {
    const s = c.check();
    if (s === 'ok') ok++;
    else if (s === 'err') err++;
    else warn++;
    const div = document.createElement('div');
    div.className = 'dgi-item ' + s;
    div.title = c.tip || '';
    const dot = document.createElement('span');
    dot.className = 'dgi-dot';
    const sp = document.createElement('span');
    sp.textContent = `${DGI_LBL[s]} ${c.label}`;
    div.appendChild(dot);
    div.appendChild(sp);
    list.appendChild(div);
  });
  badge.textContent = `${ok}/${DGI_CHECKS.length} mentions conformes`;
  badge.className = 'dgi-score ' + (err > 0 ? 'err' : warn > 0 ? 'warn' : 'ok');
}

// ═══════════════════════════════════════════
//  PREVIEW & PRINT
// ═══════════════════════════════════════════

// ── Aperçu & impression ──
// ═══════════════════════════════════════════
//  EDIT DOC FROM HISTORY
// ═══════════════════════════════════════════
function editDocFromHistory(id) {
  const d = DB.docs.find(x => x.id === id);
  if (!d) return;
  nav('generate', sbItem('generate'));
  setTimeout(() => {
    // Stocker l'id interne pour que saveDoc sache qu'il s'agit d'une modification
    const docIdEl = document.getElementById('doc-id');
    if (docIdEl) docIdEl.value = d.id;
    const srcRefEl = document.getElementById('doc-source-ref');
    if (srcRefEl) srcRefEl.value = d.sourceRef || '';
    const srcIdEl = document.getElementById('doc-source-id');
    if (srcIdEl) srcIdEl.value = d.sourceId || '';
    const srcTypeEl = document.getElementById('doc-source-type');
    if (srcTypeEl) srcTypeEl.value = d.sourceType || '';
    const originRefEl = document.getElementById('doc-origin-ref');
    if (originRefEl) originRefEl.value = d.ref || '';
    const originTypeEl = document.getElementById('doc-origin-type');
    if (originTypeEl) originTypeEl.value = d.type || '';
    const originStatusEl = document.getElementById('doc-origin-status');
    if (originStatusEl) originStatusEl.value = d.status || '';
    document.getElementById('doc-ref').value = d.ref;
    document.getElementById('doc-type').value = d.type;
    // Mettre à jour les statuts disponibles selon le type rechargé
    updateDocStatus(d.status);
    // Gérer le cas Annulé : l'afficher en lecture seule si pas déjà dans la liste
    const statusSel = document.getElementById('doc-status');
    if (d.status === 'Annulé' && !statusSel.querySelector('option[value="Annulé"]')) {
      const opt = document.createElement('option');
      opt.value = 'Annulé';
      opt.textContent = 'Annulé';
      opt.disabled = true;
      statusSel.appendChild(opt);
      statusSel.value = 'Annulé';
    }
    statusSel.value = d.status;
    statusSel.title =
      d.status === 'Annulé'
        ? "Ce document est annulé. Pour modifier le statut, utilisez les actions dans l'Historique."
        : '';
    document.getElementById('doc-date').value = d.date;
    document.getElementById('doc-terms').value = d.terms || '';
    document.getElementById('doc-payment').value = d.payment || '';
    document.getElementById('doc-notes').value = d.notes || '';
    document.getElementById('doc-remise').value = d.remise || 0;
    document.getElementById('doc-acompte').value = d.acompte || 0;
    populateDocClient();
    document.getElementById('doc-client').value = d.clientId || '';
    if (typeof refreshThemedSelect === 'function') {
      ['doc-type', 'doc-status', 'doc-client', 'doc-terms', 'doc-payment', 'doc-price-mode'].forEach(
        refreshThemedSelect,
      );
    }
    loadDocPriceModeFromSaved(d);
    APP.docLines = (d.lines || []).map(l => ({
      ...l,
      id: l.id || 'l_' + Date.now() + Math.random(),
    }));
    renderDocLines();
    calcTotals();
    if (typeof refreshAutoEntrepreneurDocUI === 'function') refreshAutoEntrepreneurDocUI();
    closePostSaveBar();
    refreshDocSourceHint();
    toast(d.status === 'Annulé' ? `⚠️ Document annulé — lecture seule` : `Édition de ${d.ref}`, '');
  }, 80);
}

function createAvoirFromCancelledFacture(id) {
  const d = DB.docs.find(x => x.id === id);
  if (!d || d.type !== 'F' || d.status !== 'Annulé') {
    toast('Action disponible uniquement pour une facture annulée', 'err');
    return;
  }
  editDocFromHistory(id);
  setTimeout(() => {
    const typeEl = document.getElementById('doc-type');
    if (typeEl) {
      typeEl.value = 'AV';
      updateDocRef();
      updateDocStatus('Brouillon');
      const statusEl = document.getElementById('doc-status');
      if (statusEl) statusEl.value = 'Brouillon';
      if (typeof refreshThemedSelect === 'function') {
        ['doc-type', 'doc-status'].forEach(refreshThemedSelect);
      }
    }
    refreshDocSourceHint();
    toast(`Avoir prêt depuis ${d.ref} — cliquez sur Sauvegarder`, 'suc');
  }, 120);
}

// ── Historique ──
// ═══════════════════════════════════════════
function populateHistClientFilter() {
  const sel = document.getElementById('hist-client');
  if (!sel) return;
  const cur = sel.value;
  clearChildren(sel);
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'Tous les clients';
  sel.appendChild(ph);
  const names = [...new Set(DB.docs.map(d => d.clientName).filter(Boolean))];
  names.forEach(n => {
    const o = document.createElement('option');
    o.value = n;
    o.textContent = n;
    if (n === cur) o.selected = true;
    sel.appendChild(o);
  });
}
function getHistFiltered() {
  const search = (document.getElementById('hist-search') || {}).value || '';
  const type = (document.getElementById('hist-type') || {}).value || '';
  const status = (document.getElementById('hist-status') || {}).value || '';
  const client = (document.getElementById('hist-client') || {}).value || '';
  const fromEl = document.getElementById('hist-date-from');
  const toEl = document.getElementById('hist-date-to');
  const from = (fromEl?._filterValue ?? fromEl?.value) || '';
  const to = (toEl?._filterValue ?? toEl?.value) || '';
  return DB.docs.filter(d => {
    const refLc = (d.ref || '').toLowerCase();
    const cliLc = (d.clientName || '').toLowerCase();
    const q = search.toLowerCase();
    if (search && !refLc.includes(q) && !cliLc.includes(q)) return false;
    if (type && d.type !== type) return false;
    if (status && d.status !== status) return false;
    if (client && d.clientName !== client) return false;
    if (from && d.date < from) return false;
    if (to && d.date > to) return false;
    return true;
  });
}

// ── Conversion Devis → Facture ──
// ═══════════════════════════════════════════
let _convSourceId = null;

// ── Maintenabilité : encapsulation de la conversion Devis → Facture ──
window.APP = window.APP || {};
window.APP.docsConversion = window.APP.docsConversion || {};
const _defineDocsConversionState = (key, getter, setter) => {
  try {
    const desc = Object.getOwnPropertyDescriptor(window.APP.docsConversion, key);
    if (desc && (desc.get || desc.set)) return;
    Object.defineProperty(window.APP.docsConversion, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: false,
    });
  } catch (_) {}
};
_defineDocsConversionState(
  'conversionSourceId',
  () => _convSourceId,
  v => {
    _convSourceId = v;
  },
);

function openConvertModal(id) {
  const d = DB.docs.find(x => x.id === id);
  if (!d || d.type !== 'D') return;
  APP.docsConversion.conversionSourceId = id;
  const nextRef = getNextRef('F');
  document.getElementById('conv-title').textContent = `Convertir ${d.ref} en Facture`;
  document.getElementById('conv-sub').textContent = `${d.clientName || 'N/A'} — ${fmt(d.ttc)}`;
  document.getElementById('conv-from-ref').textContent = d.ref;
  document.getElementById('conv-from-client').textContent = d.clientName || 'N/A';
  document.getElementById('conv-to-ref').textContent = nextRef;
  document.getElementById('conv-amount').textContent = fmt(d.ttc);
  const convLc = document.getElementById('conv-lines-count');
  if (convLc) {
    clearChildren(convLc);
    convLc.appendChild(document.createTextNode(`${(d.lines || []).length} ligne(s)`));
    const br = document.createElement('br');
    const sub = document.createElement('span');
    sub.style.color = 'var(--text3)';
    sub.textContent = 'Tous les articles repris';
    convLc.appendChild(br);
    convLc.appendChild(sub);
  }
  document.getElementById('conv-date-today').checked = true;
  document.getElementById('conv-custom-date').value = today();
  document.getElementById('conv-custom-date').style.display = 'none';
  document.getElementById('conv-keep-devis').checked = true;
  document.getElementById('conv-opt-date-wrap')?.classList.add('selected');
  document.getElementById('conv-opt-date-custom-wrap')?.classList.remove('selected');
  openModal('modal-convert');
}

function updateConvDateField() {
  const isCustom = document.getElementById('conv-date-custom').checked;
  document.getElementById('conv-custom-date').style.display = isCustom ? 'block' : 'none';
  document.getElementById('conv-opt-date-wrap')?.classList.toggle('selected', !isCustom);
  document.getElementById('conv-opt-date-custom-wrap')?.classList.toggle('selected', isCustom);
}

function confirmConvert() {
  const d = DB.docs.find(x => x.id === APP.docsConversion.conversionSourceId);
  if (!d) {
    closeModal('modal-convert');
    return;
  }
  const isCustomDate = document.getElementById('conv-date-custom').checked;
  const invoiceDate = isCustomDate
    ? document.getElementById('conv-custom-date').value || today()
    : today();
  const keepDevis = document.getElementById('conv-keep-devis').checked;
  const newRef = getNextRef('F');
  const invoice = {
    ...d,
    id: 'doc_' + Date.now(),
    ref: newRef,
    type: 'F',
    status: 'Brouillon',
    date: invoiceDate,
    sourceRef: d.ref,
    sourceId: d.id,
    sourceType: 'D',
    convertedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines: (d.lines || []).map(l => ({
      ...l,
      id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    })),
  };
  DB.docs.unshift(invoice);
  bumpSeq('F');
  if (keepDevis) {
    const srcIdx = DB.docs.findIndex(x => x.id === APP.docsConversion.conversionSourceId);
    if (srcIdx >= 0) {
      DB.docs[srcIdx].status = 'Converti';
      DB.docs[srcIdx].convertedToRef = newRef;
      DB.docs[srcIdx].convertedToId = invoice.id;
    }
  }
  save('docs');
  buildNotifications();
  closeModal('modal-convert');
  renderHistory();
  toast(`✓ Facture ${newRef} créée depuis ${d.ref}`, 'suc');
  setTimeout(() => showConvertSuccessBar(invoice, d), 300);
}

function showConvertSuccessBar(invoice, sourceDevis) {
  const old = document.getElementById('post-save-bar');
  if (old) {
    clearTimeout(old._timer);
    old.remove();
  }
  const bar = document.createElement('div');
  bar.id = 'post-save-bar';
  const _isMob2 = window.innerWidth <= 768;
  const invoiceIdJson = JSON.stringify(String(invoice.id || ''));
  bar.style.cssText = `position:fixed;bottom:${_isMob2 ? '60px' : '0'};left:${_isMob2 ? '0' : 'var(--sidebar-w)'};right:0;z-index:800;background:var(--surface);border-top:2px solid var(--brand);padding:${_isMob2 ? '10px 12px' : '12px 24px'};display:flex;align-items:center;gap:14px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,.1)`;
  const cLeft = document.createElement('div');
  cLeft.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;min-width:200px';
  const cIc = document.createElement('span');
  cIc.style.fontSize = '22px';
  cIc.textContent = '⚡';
  const cCol = document.createElement('div');
  const cT1 = document.createElement('div');
  cT1.style.cssText = 'font-weight:700;font-size:14px';
  cT1.textContent = `Conversion réussie — ${invoice.ref || ''}`;
  const cT2 = document.createElement('div');
  cT2.style.cssText = 'font-size:12px;color:var(--text2)';
  cT2.textContent = `Créée depuis ${sourceDevis.ref || ''} · ${invoice.clientName || ''} · ${fmt(invoice.ttc)}`;
  cCol.appendChild(cT1);
  cCol.appendChild(cT2);
  cLeft.appendChild(cIc);
  cLeft.appendChild(cCol);
  const cAct = document.createElement('div');
  cAct.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const bInv = document.createElement('button');
  bInv.className = 'btn btn-primary btn-sm';
  bInv.setAttribute('data-action', 'ps-open-invoice');
  bInv.setAttribute('data-id', encodeURIComponent(String(invoice.id || '')));
  bInv.textContent = '✏️ Ouvrir la facture';
  const bH2 = document.createElement('button');
  bH2.className = 'btn btn-secondary btn-sm';
  bH2.setAttribute('data-action', 'ps-open-history');
  bH2.textContent = '📋 Historique';
  const bX = document.createElement('button');
  bX.setAttribute('data-action', 'ps-close');
  bX.style.cssText =
    'background:none;border:none;cursor:pointer;font-size:18px;color:var(--text2);padding:4px 8px';
  bX.textContent = '✕';
  cAct.appendChild(bInv);
  cAct.appendChild(bH2);
  cAct.appendChild(bX);
  bar.appendChild(cLeft);
  bar.appendChild(cAct);
  bar.querySelector('[data-action="ps-open-invoice"]')?.addEventListener('click', e => {
    const id = decodeURIComponent(e.currentTarget.getAttribute('data-id') || '');
    editDocFromHistory(id);
    closePostSaveBar();
  });
  bar.querySelector('[data-action="ps-open-history"]')?.addEventListener('click', () => {
    nav('history', sbItem('history'));
    closePostSaveBar();
  });
  bar.querySelector('[data-action="ps-close"]')?.addEventListener('click', closePostSaveBar);
  document.getElementById('main').appendChild(bar);
  bar._timer = setTimeout(closePostSaveBar, 15000);
}

function renderHistory() {
  const feedback = document.getElementById('hist-feedback');
  const setFeedback = msg => {
    if (feedback) feedback.textContent = msg;
  };
  const docs = getHistFiltered();
  const total = docs.length;
  const maxPage = total > 0 ? Math.max(1, Math.ceil(total / APP.histPerPage)) : 1;
  if (APP.histPage > maxPage) APP.histPage = maxPage;
  if (APP.histPage < 1) APP.histPage = 1;
  const setEl = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setEl('hist-kpi-total', DB.docs.length);
  setEl(
    'hist-kpi-paid',
    fmt(DB.docs.filter(d => d.status === 'Payé').reduce((s, d) => s + (d.ttc || 0), 0)),
  );
  setEl(
    'hist-kpi-sent',
    fmt(DB.docs.filter(d => d.status === 'Envoyé').reduce((s, d) => s + (d.ttc || 0), 0)),
  );
  setEl('hist-kpi-draft', DB.docs.filter(d => d.status === 'Brouillon').length);
  const start = (APP.histPage - 1) * APP.histPerPage;
  const page = docs.slice(start, start + APP.histPerPage);
  const tbody = document.getElementById('history-tbody');
  const pagEl = document.getElementById('hist-pagination');
  if (!tbody) return;
  tbody.setAttribute('aria-busy', 'true');
  setFeedback('Mise a jour de la liste...');
  if (!docs.length) {
    clearChildren(tbody);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.style.cssText = 'text-align:center;padding:30px;color:var(--text2)';
    td.textContent = 'Aucun document ne correspond aux filtres actuels.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (pagEl) clearChildren(pagEl);
    const mobEmpty = document.getElementById('mob-history-list');
    if (mobEmpty) clearChildren(mobEmpty);
    tbody.setAttribute('aria-busy', 'false');
    setFeedback('Aucun resultat.');
    return;
  }
  const typeLabel = { F: 'Facture', D: 'Devis', BL: 'Bon de Livraison', AV: 'Avoir' };
  const statusClass = {
    Brouillon: 'draft',
    Envoyé: 'sent',
    Payé: 'paid',
    Annulé: 'cancelled',
    Converti: 'devis',
  };
  const nextStatusLabel = { Brouillon: '→ Envoyé', Envoyé: '→ Payé' };
  const closeHistMoreMenus = () => {
    document.querySelectorAll('.hist-more-menu.open').forEach(m => m.classList.remove('open'));
    document
      .querySelectorAll('.hist-more-wrap > .btn[aria-haspopup="menu"]')
      .forEach(b => b.setAttribute('aria-expanded', 'false'));
  };
  clearChildren(tbody);
  if (!APP._histMoreMenuBound) {
    document.addEventListener('click', e => {
      const keepOpen = e.target.closest('.hist-more-wrap');
      if (keepOpen) return;
      closeHistMoreMenus();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeHistMoreMenus();
    });
    APP._histMoreMenuBound = true;
  }
  page.forEach(d => {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    const refSp = document.createElement('span');
    refSp.className = 'hist-doc-ref';
    refSp.textContent = d.ref || '';
    td0.appendChild(refSp);
    const sourceType = d.sourceType || (d.type === 'F' && d.sourceRef ? 'D' : '');
    const sourceTitle =
      sourceType === 'F'
        ? 'Issu de la facture'
        : sourceType === 'D'
          ? 'Issu du devis'
          : 'Document source';
    if (d.sourceRef) {
      const lb = document.createElement('span');
      lb.className = 'linked-badge';
      lb.title = `${sourceTitle} ${d.sourceRef}`;
      lb.setAttribute('data-hist-linked-ref', encodeURIComponent(String(d.sourceRef || '')));
      lb.textContent = '↗ ' + (d.sourceRef || '');
      td0.appendChild(lb);
    } else if (d.convertedToRef) {
      const lb = document.createElement('span');
      lb.className = 'linked-badge linked-converted';
      lb.title = `Converti en ${d.convertedToRef}`;
      lb.setAttribute('data-hist-linked-ref', encodeURIComponent(String(d.convertedToRef || '')));
      lb.textContent = '⇒ ' + (d.convertedToRef || '');
      td0.appendChild(lb);
    }
    tr.appendChild(td0);
    const tdDate = document.createElement('td');
    tdDate.textContent = d.date || '';
    tr.appendChild(tdDate);
    const tdTyp = document.createElement('td');
    const typBadge = document.createElement('span');
    typBadge.className =
      'badge ' +
      (d.type === 'D' ? 'devis' : d.type === 'BL' ? 'bl' : d.type === 'AV' ? 'avoir' : '');
    typBadge.textContent = typeLabel[d.type] || d.type || '';
    tdTyp.appendChild(typBadge);
    tr.appendChild(tdTyp);
    const tdSt = document.createElement('td');
    const stWrap = document.createElement('div');
    stWrap.className = 'hist-status-wrap';
    const stBadge = document.createElement('span');
    stBadge.className = 'badge ' + (statusClass[d.status] || 'draft');
    stBadge.textContent = d.status || '';
    stWrap.appendChild(stBadge);
    if (nextStatusLabel[d.status]) {
      const qb = document.createElement('button');
      qb.className = 'hist-quick-status';
      qb.setAttribute('data-action', 'hist-quick-status');
      qb.setAttribute('data-id', encodeURIComponent(String(d.id || '')));
      qb.textContent = nextStatusLabel[d.status];
      stWrap.appendChild(qb);
    }
    tdSt.appendChild(stWrap);
    tr.appendChild(tdSt);
    const tdCli = document.createElement('td');
    tdCli.textContent = d.clientName || 'N/A';
    tr.appendChild(tdCli);
    const tdHt = document.createElement('td');
    tdHt.className = 'hist-num';
    tdHt.textContent = fmt(d.ht);
    tr.appendChild(tdHt);
    const tdTtc = document.createElement('td');
    tdTtc.className = 'hist-num';
    tdTtc.textContent = fmt(d.ttc);
    tr.appendChild(tdTtc);
    const tdReste = document.createElement('td');
    const reste = (d.ttc || 0) - (d.acompte || 0);
    if (d.status === 'Payé') {
      const s = document.createElement('span');
      s.className = 'hist-rest-sold hist-num';
      s.textContent = '✓ Soldé';
      tdReste.appendChild(s);
    } else if (reste > 0) {
      const s = document.createElement('span');
      s.className = 'hist-rest-pending hist-num';
      s.textContent = fmt(reste);
      tdReste.appendChild(s);
    } else {
      const s = document.createElement('span');
      s.className = 'hist-rest-ok';
      s.textContent = '✓';
      tdReste.appendChild(s);
    }
    tr.appendChild(tdReste);
    const tdAct = document.createElement('td');
    tdAct.className = 'hist-actions-cell';
    const act = document.createElement('div');
    act.className = 'hist-actions';
    const enc = encodeURIComponent(String(d.id || ''));
    const addAct = (cls, tit, tx, st, an) => {
      const b = document.createElement('button');
      b.className = cls;
      if (tit) b.title = tit;
      if (tit) b.setAttribute('aria-label', tit);
      b.textContent = tx;
      if (st) b.style.cssText = st;
      b.setAttribute('data-action', an);
      b.setAttribute('data-id', enc);
      return b;
    };

    // Primary actions (always visible): edit, print, quick status
    const bEdit = addAct('btn btn-icon btn-secondary btn-sm', 'Modifier', '✏️', null, 'hist-edit-doc');
    const bPrint = addAct('btn btn-icon btn-secondary btn-sm', 'Imprimer PDF', '🖨', null, 'hist-print-doc');
    act.appendChild(bEdit);
    act.appendChild(bPrint);
    if (nextStatusLabel[d.status]) {
      const bQuick = addAct(
        'btn btn-icon btn-secondary btn-sm',
        'Changer le statut',
        '↻',
        null,
        'hist-quick-status',
      );
      act.appendChild(bQuick);
    }

    // Secondary actions grouped in More menu
    const moreWrap = document.createElement('div');
    moreWrap.className = 'hist-more-wrap';
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'btn btn-icon btn-secondary btn-sm';
    moreBtn.title = 'Plus d’actions';
    moreBtn.setAttribute('aria-label', 'Plus d’actions');
    moreBtn.setAttribute('aria-haspopup', 'menu');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.setAttribute('aria-label', 'Ouvrir le menu Plus d actions');
    moreBtn.textContent = '⋯';
    const moreMenu = document.createElement('div');
    const menuId = `hist-more-${String(d.id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
    moreMenu.id = menuId;
    moreBtn.setAttribute('aria-controls', menuId);
    moreMenu.className = 'hist-more-menu';
    moreMenu.setAttribute('role', 'menu');
    const addMoreItem = (label, action, danger = false) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'hist-more-item' + (danger ? ' danger' : '');
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.setAttribute('data-action', action);
      item.setAttribute('data-id', enc);
      item.textContent = label;
      moreMenu.appendChild(item);
    };

    addMoreItem('⬇ Télécharger PDF', 'hist-download-doc');
    addMoreItem('🟢 Envoyer via WhatsApp', 'hist-wa-doc');
    addMoreItem('⎘ Dupliquer', 'hist-duplicate-doc');

    if (d.type === 'D' && d.status !== 'Converti') {
      addMoreItem('⚡ Convertir en Facture', 'hist-convert');
    }
    if (d.type === 'F' && d.status === 'Annulé') {
      addMoreItem('↩ Créer un avoir', 'hist-create-avoir');
    }
    if ((d.type === 'F' || d.type === 'BL') && d.status !== 'Annulé' && d.status !== 'Brouillon') {
      addMoreItem('✕ Annuler (retour stock)', 'hist-cancel-doc');
    }

    const delX = d.type === 'F' || d.type === 'BL' || d.type === 'AV' ? '✕ Annuler document' : '🗑 Supprimer';
    addMoreItem(delX, 'hist-delete-doc', true);

    moreBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !moreMenu.classList.contains('open');
      closeHistMoreMenus();
      if (willOpen) {
        moreMenu.classList.add('open');
        moreBtn.setAttribute('aria-expanded', 'true');
        moreMenu.querySelector('.hist-more-item')?.focus();
      }
    });
    moreBtn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const willOpen = !moreMenu.classList.contains('open');
        closeHistMoreMenus();
        if (willOpen) {
          moreMenu.classList.add('open');
          moreBtn.setAttribute('aria-expanded', 'true');
        }
        moreMenu.querySelector('.hist-more-item')?.focus();
      }
    });
    moreMenu.addEventListener('keydown', e => {
      const items = Array.from(moreMenu.querySelectorAll('.hist-more-item'));
      const idx = items.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        moreMenu.classList.remove('open');
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.focus();
        return;
      }
      if (e.key === 'ArrowDown' && idx >= 0) {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === 'ArrowUp' && idx >= 0) {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
      }
    });
    moreMenu.addEventListener('click', () => {
      moreMenu.classList.remove('open');
      moreBtn.setAttribute('aria-expanded', 'false');
    });
    moreWrap.appendChild(moreBtn);
    moreWrap.appendChild(moreMenu);
    act.appendChild(moreWrap);
    tdAct.appendChild(act);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });
  let mobHist = document.getElementById('mob-history-list');
  if (!mobHist) {
    mobHist = document.createElement('div');
    mobHist.id = 'mob-history-list';
    mobHist.className = 'mob-card-list';
    const wrap = document.querySelector('#page-history .tbl-wrap');
    if (wrap) wrap.after(mobHist);
  }
  clearChildren(mobHist);
  page.forEach(d => {
    const enc = encodeURIComponent(String(d.id || ''));
    const card = document.createElement('div');
    card.className = 'mob-card';
    const hdr = document.createElement('div');
    hdr.className = 'mob-card-header';
    const ttl = document.createElement('div');
    ttl.className = 'mob-card-title';
    ttl.textContent = d.ref || '';
    const sb = document.createElement('span');
    sb.className = 'badge ' + (statusClass[d.status] || 'draft');
    sb.textContent = d.status || '';
    hdr.appendChild(ttl);
    hdr.appendChild(sb);
    card.appendChild(hdr);
    const row = (lab, val) => {
      const r = document.createElement('div');
      r.className = 'mob-card-row';
      const l = document.createElement('span');
      l.className = 'mob-card-label';
      l.textContent = lab;
      const v = document.createElement('span');
      v.className = 'mob-card-val';
      v.appendChild(val);
      r.appendChild(l);
      r.appendChild(v);
      card.appendChild(r);
    };
    const typeBadgeCls =
      d.type === 'D' ? 'devis' : d.type === 'BL' ? 'bl' : d.type === 'AV' ? 'avoir' : '';
    const tb = document.createElement('span');
    tb.className = 'badge ' + typeBadgeCls;
    tb.textContent = typeLabel[d.type] || d.type || '';
    row('Type', tb);
    row('Client', document.createTextNode(d.clientName || 'Non renseigne'));
    row('Date', document.createTextNode(d.date || ''));
    const ttcN = document.createElement('span');
    ttcN.style.color = 'var(--teal)';
    ttcN.textContent = fmt(d.ttc);
    row('Total TTC', ttcN);
    const mAct = document.createElement('div');
    mAct.className = 'mob-card-actions';
    const mb = (txt, an, st) => {
      const b = document.createElement('button');
      b.className = st || 'btn btn-secondary btn-sm';
      b.setAttribute('data-action', an);
      b.setAttribute('data-id', enc);
      b.textContent = txt;
      return b;
    };
    mAct.appendChild(mb('✏️ Modifier', 'hist-edit-doc'));
    mAct.appendChild(mb('🖨 PDF', 'hist-print-doc'));
    if (nextStatusLabel[d.status]) mAct.appendChild(mb(nextStatusLabel[d.status], 'hist-quick-status'));

    const mMore = document.createElement('details');
    mMore.className = 'mob-card-more';
    const mSum = document.createElement('summary');
    mSum.textContent = '⋯ Plus';
    mMore.appendChild(mSum);
    const mList = document.createElement('div');
    mList.className = 'mob-card-more-list';
    const mbMore = (txt, an, danger = false) => {
      const b = document.createElement('button');
      b.className = danger ? 'btn btn-danger btn-sm' : 'btn btn-secondary btn-sm';
      b.setAttribute('data-action', an);
      b.setAttribute('data-id', enc);
      b.textContent = txt;
      mList.appendChild(b);
    };
    mbMore('⬇ Télécharger PDF', 'hist-download-doc');
    mbMore('🟢 WhatsApp', 'hist-wa-doc');
    mbMore('⎘ Dupliquer', 'hist-duplicate-doc');
    if (d.type === 'D' && d.status !== 'Converti') mbMore('⚡ Convertir en Facture', 'hist-convert');
    if (d.type === 'F' && d.status === 'Annulé') mbMore('↩ Créer un avoir', 'hist-create-avoir');
    if ((d.type === 'F' || d.type === 'BL') && d.status !== 'Annulé' && d.status !== 'Brouillon')
      mbMore('✕ Annuler (retour stock)', 'hist-cancel-doc');
    mbMore(d.type === 'F' || d.type === 'BL' || d.type === 'AV' ? '✕ Annuler document' : '🗑 Supprimer', 'hist-delete-doc', true);
    mMore.appendChild(mList);
    mAct.appendChild(mMore);
    card.appendChild(mAct);
    mobHist.appendChild(card);
  });
  const pages = Math.ceil(total / APP.histPerPage);
  if (pagEl) {
    clearChildren(pagEl);
    for (let i = 0; i < pages; i++) {
      const pn = i + 1;
      const btn = document.createElement('button');
      btn.className = 'pg-btn' + (pn === APP.histPage ? ' active' : '');
      btn.setAttribute('data-hist-page', String(pn));
      btn.textContent = String(pn);
      btn.addEventListener('click', () => {
        APP.histPage = pn;
        renderHistory();
      });
      pagEl.appendChild(btn);
    }
  }
  tbody.querySelectorAll('[data-hist-linked-ref]').forEach(el => {
    el.addEventListener('click', () => {
      const ref = decodeURIComponent(el.getAttribute('data-hist-linked-ref') || '');
      nav('history', sbItem('history'));
      setTimeout(() => {
        const hs = document.getElementById('hist-search');
        if (hs) hs.value = ref;
        renderHistory();
      }, 80);
    });
  });
  tbody.setAttribute('aria-busy', 'false');
  setFeedback(`${total} document(s) affiche(s).`);
}
function quickChangeStatus(id) {
  const d = DB.docs.find(x => x.id === id);
  if (!d) return;
  const flow = { Brouillon: 'Envoyé', Envoyé: 'Payé' };
  const next = flow[d.status];
  if (!next) return;
  const wasDeducted = d.stockDeducted === true;
  // Uniquement Facture et BL
  const isStockDoc = d.type === 'F' || d.type === 'BL';
  const willDeduct = isStockDoc && (next === 'Envoyé' || next === 'Payé');
  if (willDeduct && !wasDeducted) {
    const warnings = [];
    (d.lines || []).forEach(l => {
      if (!l.fromStock) return;
      const a = DB.stock.find(x => x.id === l.fromStock);
      if (!a) return;
      const currentQty = a.qty || 0;
      const needQty = l.qty || 0;
      const deductedQty = Math.min(currentQty, needQty);
      a.qty = Math.max(0, currentQty - deductedQty);
      l.stockDeductedQty = deductedQty;
      if (deductedQty > 0 && a.qty < 5) warnings.push(`${a.name}: ${a.qty} restant(s)`);
    });
    d.stockDeducted = true;
    save('stock');
    if (warnings.length) setTimeout(() => toast('⚠️ Stock bas — ' + warnings.join(', '), ''), 500);
  }
  d.status = next;
  d.updatedAt = new Date().toISOString();
  save('docs');
  renderHistory();
  buildNotifications();
  toast(`${d.ref} → ${next}`, 'suc');
}

async function cancelDoc(id) {
  const d = DB.docs.find(x => x.id === id);
  if (!d) return;
  const stockLines = (d.lines || []).filter(l => l.fromStock);
  const hasStock = stockLines.length > 0 && d.stockDeducted === true;
  const stockDetail = hasStock
    ? `<br><br>Les articles suivants seront <strong>restitués au stock</strong> :<br>${stockLines
        .map(l => {
          const a = DB.stock.find(x => x.id === l.fromStock);
          const restoreQty =
            typeof l.stockDeductedQty === 'number' ? l.stockDeductedQty : l.qty || 0;
          return `• ${a ? a.name : l.name} : +${restoreQty}`;
        })
        .join('<br>')}`
    : '';
  const ok = await showConfirm({
    title: `Annuler "${d.ref}" ?`,
    message: `Cette action passera le document en statut <strong>Annulé</strong>.${stockDetail}`,
    icon: '🚫',
    okLabel: 'Annuler le document',
    okStyle: 'danger',
  });
  if (!ok) return;
  // Restituer le stock si déduit
  try {
    if (d.stockDeducted) {
      stockLines.forEach(l => {
        const a = DB.stock.find(x => x.id === l.fromStock);
        if (a) {
          const restoreQty =
            typeof l.stockDeductedQty === 'number' ? l.stockDeductedQty : l.qty || 0;
          a.qty = (a.qty || 0) + restoreQty;
        }
      });
      d.stockDeducted = false;
      save('stock');
      if (stockLines.length) toast(`📦 Stock restitué pour ${stockLines.length} article(s)`, 'suc');
    }
    d.status = 'Annulé';
    d.updatedAt = new Date().toISOString();
    save('docs');
    renderHistory();
    buildNotifications();
    toast(`${d.ref} annulé`, '');
  } catch (e) {
    dbgErr('[cancelDoc] Erreur:', e);
    toast("❌ Erreur lors de l'annulation — réessayez", 'err');
  }
}
function resetHistFilters() {
  [
    'hist-search',
    'hist-type',
    'hist-status',
    'hist-client',
    'hist-date-from',
    'hist-date-to',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el._fp && typeof el._fp.clear === 'function') {
      el._fp.clear();
      return;
    }
    el.value = '';
  });
  APP.histPage = 1;
  renderHistory();
}
async function deleteDoc(id) {
  const d = DB.docs.find(x => x.id === id);
  if (!d) return;
  // DGI-01 : ne pas supprimer les documents légaux — passer en statut Annulé
  // (données conservées 10 ans ; restitution stock si déduit)
  if (d.type === 'F' || d.type === 'BL' || d.type === 'AV') {
    if (d.status === 'Annulé') {
      toast('Document déjà annulé — données conservées', 'suc');
      renderHistory();
      buildNotifications();
      return;
    }
    const stockLines = (d.lines || []).filter(l => l.fromStock);
    const hasStock = stockLines.length > 0 && d.stockDeducted === true;
    const stockDetail = hasStock
      ? `<br><br>Les articles suivants seront <strong>restitués au stock</strong> :<br>${stockLines
          .map(l => {
            const a = DB.stock.find(x => x.id === l.fromStock);
            const restoreQty =
              typeof l.stockDeductedQty === 'number' ? l.stockDeductedQty : l.qty || 0;
            return `• ${a ? a.name : l.name} : +${restoreQty}`;
          })
          .join('<br>')}`
      : '';
    const ok = await showConfirm({
      title: `Annuler "${d.ref}" ?`,
      message: `Cette action passera le document en statut <strong>Annulé</strong> (données conservées).${stockDetail}`,
      icon: '🚫',
      okLabel: 'Annuler le document',
      okStyle: 'danger',
    });
    if (!ok) return;
    try {
      // Restituer le stock si déduit
      if (d.stockDeducted) {
        stockLines.forEach(l => {
          const a = DB.stock.find(x => x.id === l.fromStock);
          if (a) {
            const restoreQty =
              typeof l.stockDeductedQty === 'number' ? l.stockDeductedQty : l.qty || 0;
            a.qty = (a.qty || 0) + restoreQty;
          }
        });
        d.stockDeducted = false;
        save('stock');
        if (stockLines.length)
          toast(`📦 Stock restitué pour ${stockLines.length} article(s)`, 'suc');
      }
      d.status = 'Annulé';
      d.updatedAt = new Date().toISOString();
      save('docs');
      renderHistory();
      buildNotifications();
      toast(`${d.ref} annulé (données conservées)`, '');
    } catch (e) {
      dbgErr('[deleteDoc→annule] Erreur:', e);
      toast("❌ Erreur lors de l'annulation — réessayez", 'err');
    }
    return;
  }

  const stockLines = (d.lines || []).filter(l => l.fromStock);
  const hasStock = stockLines.length > 0 && d.stockDeducted === true;
  const stockDetail = hasStock
    ? `<br><br>Les articles suivants seront <strong>restitués au stock</strong> :<br>${stockLines
        .map(l => {
          const a = DB.stock.find(x => x.id === l.fromStock);
          const restoreQty =
            typeof l.stockDeductedQty === 'number' ? l.stockDeductedQty : l.qty || 0;
          return `• ${a ? a.name : l.name} : +${restoreQty}`;
        })
        .join('<br>')}`
    : '';
  const ok = await showConfirm({
    title: `Supprimer "${d.ref}" ?`,
    message: `Cette action est <strong>irréversible</strong>.${stockDetail}`,
    icon: '🗑️',
    okLabel: 'Supprimer',
    okStyle: 'danger',
  });
  if (!ok) return;
  // Restituer le stock si déduit
  try {
    if (d.stockDeducted) {
      stockLines.forEach(l => {
        const a = DB.stock.find(x => x.id === l.fromStock);
        if (a) {
          const restoreQty =
            typeof l.stockDeductedQty === 'number' ? l.stockDeductedQty : l.qty || 0;
          a.qty = (a.qty || 0) + restoreQty;
        }
      });
      save('stock');
      if (stockLines.length) toast(`📦 Stock restitué pour ${stockLines.length} article(s)`, 'suc');
    }
    if (typeof invooSupabaseSoftDelete === 'function') invooSupabaseSoftDelete('docs', id);
    DB.docs = DB.docs.filter(x => x.id !== id);
    save('docs');
    renderHistory();
    buildNotifications();
    toast('Document supprimé', 'suc');
  } catch (e) {
    dbgErr('[deleteDoc] Erreur:', e);
    toast('❌ Erreur lors de la suppression — réessayez', 'err');
  }
}

// ════════════════════════════════════════
//  WHATSAPP : envoyer un document depuis l'Historique
// ════════════════════════════════════════
function _normalizePhoneForWhatsApp(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (!p) return '';
  if (p.startsWith('212')) return p;
  if (p.startsWith('0')) return '212' + p.slice(1);
  return '212' + p;
}

function sendDocWhatsApp(docId) {
  const d = DB.docs.find(x => x.id === docId);
  if (!d) return;

  const c = DB.clients.find(x => x.id === d.clientId);
  const phone = _normalizePhoneForWhatsApp(c?.phone);
  if (!phone) {
    toast("Client sans téléphone — impossible d'envoyer via WhatsApp", 'err');
    return;
  }

  const typeLabel =
    { F: 'Facture', D: 'Devis', BL: 'Bon de Livraison', AV: 'Avoir' }[d.type] || d.type;
  const name = c?.name || d.clientName || 'client';
  const sender = DB.settings?.name || 'INVO';

  const ht = Number(d.ht || 0);
  const tvaAmount = Number(d.tva || 0);
  const ttc = Number(d.ttc || 0);
  const acompte = Number(d.acompte || 0);
  const reste = Math.max(0, ttc - acompte);

  // Résumé lignes (WhatsApp = court ; on limite pour éviter un message trop long)
  const allLines = Array.isArray(d.lines) ? d.lines : [];
  const linesPreview = allLines.slice(0, 6).map(l => {
    const q = Number(l.qty || 0);
    const pu = Number(l.price || 0);
    const th = q * pu;
    const label = l.name || l.designation || 'Article';
    const tvaPct = l.tva == null ? null : Number(l.tva);
    return `• ${label} — ${q} x ${fmt(pu)} = ${fmt(th)}${tvaPct != null && !Number.isNaN(tvaPct) ? ` (TVA ${tvaPct}%)` : ''}`;
  });
  if (allLines.length > 6) {
    linesPreview.push(`• ... (${allLines.length - 6} autre(s) ligne(s))`);
  }

  // Templates "intelligents" : par type de document
  const headerByType = (() => {
    if (d.type === 'F')
      return `Bonjour ${name},\n\nVoici votre ${typeLabel} ${d.ref} (statut : ${d.status}).`;
    if (d.type === 'D')
      return `Bonjour ${name},\n\nVoici votre ${typeLabel} ${d.ref} (statut : ${d.status}).`;
    if (d.type === 'BL')
      return `Bonjour ${name},\n\nVoici votre ${typeLabel} ${d.ref} (statut : ${d.status}).`;
    if (d.type === 'AV')
      return `Bonjour ${name},\n\nVoici votre ${typeLabel} ${d.ref} (statut : ${d.status}).`;
    return `Bonjour ${name},\n\nDocument ${typeLabel} ${d.ref} (statut : ${d.status}).`;
  })();

  const montantBlock = [
    `Date : ${d.date}`,
    `Total HT : ${fmt(ht)}`,
    `TVA : ${fmt(tvaAmount)}`,
    `Total TTC : ${fmt(ttc)}`,
  ];

  const paiementBlock = (() => {
    const out = [];
    if (d.type === 'F' || d.type === 'BL') {
      if (acompte > 0) out.push(`Acompte : ${fmt(acompte)} · Reste à payer : ${fmt(reste)}`);
      else out.push(`Montant à payer : ${fmt(ttc)}`);
    } else if (d.type === 'D') {
      out.push(`Montant TTC : ${fmt(ttc)}`);
      if (acompte > 0) out.push(`Acompte (si prévu) : ${fmt(acompte)}`);
    } else if (d.type === 'AV') {
      out.push(`Montant TTC de l'avoir : ${fmt(ttc)}`);
      if (acompte > 0) out.push(`Acompte associé : ${fmt(acompte)}`);
    }
    if (d.payment) out.push(`Paiement : ${d.payment}`);
    return out;
  })();

  const notesBlock = d.notes ? [`Notes : ${d.notes}`] : [];
  const iceBlock = c?.ice ? [`ICE client : ${c.ice}`] : [];

  const text = [
    headerByType,
    ...(iceBlock.length ? [''] : []),
    ...iceBlock,
    ...(iceBlock.length ? [''] : []),
    ...montantBlock,
    ...(paiementBlock.length ? [''] : []),
    ...paiementBlock,
    ...(linesPreview.length ? ['', 'Articles :', ...linesPreview] : []),
    ...(notesBlock.length ? ['', ''] : []),
    ...notesBlock,
    `\nCordialement, ${sender}`,
  ]
    .filter(Boolean)
    .join('\n');

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function duplicateDoc(id) {
  const d = DB.docs.find(x => x.id === id);
  if (!d) return;
  const type = d.type;
  const newDoc = {
    ...d,
    id: 'doc_' + Date.now(),
    ref: getNextRef(type),
    status: 'Brouillon',
    date: today(),
    createdAt: new Date().toISOString(),
    stockDeducted: false,
    lines: (d.lines || []).map(l => ({
      ...l,
      id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    })),
  };
  DB.docs.unshift(newDoc);
  bumpSeq(type);
  save('docs');
  renderHistory();
  toast('Document dupliqué ✓', 'suc');
}
function exportHistXLSX() {
  const docs = getHistFiltered();
  if (!docs.length) {
    toast('Aucun document à exporter', 'err');
    return;
  }
  if (typeof XLSX === 'undefined') {
    toast('❌ Librairie Excel non chargée — vérifiez votre connexion', 'err');
    return;
  }

  try {
    // Neutralise les cellules texte pouvant être interprétées comme formules Excel.
    const safeXlsxText = v => {
      const s = String(v == null ? '' : v);
      return /^\s*[=+\-@]/.test(s) ? "'" + s : s;
    };

  // ── En-têtes ──
    const headers = [
      'Référence',
      'Date',
      'Type',
      'Statut',
      'Client',
      'ICE Client',
      'Total HT',
      'TVA',
      'Total TTC',
      'Reste à payer',
    ];

  // ── Données ──
  const rows = docs.map(d => {
    const acompte = d.acompte || 0;
      const reste = Math.max(0, (d.ttc || 0) - acompte);
    return [
        safeXlsxText(d.ref || ''),
        safeXlsxText(d.date || ''),
        safeXlsxText({ F: 'Facture', D: 'Devis', BL: 'Bon de livraison', AV: 'Avoir' }[d.type] || d.type),
        safeXlsxText(d.status || ''),
      safeXlsxText(d.clientName || ''),
        safeXlsxText(DB.clients.find(c => c.id === d.clientId)?.ice || ''),
        d.ht || 0,
      d.tva || 0,
      d.ttc || 0,
      reste,
    ];
  });

  // ── Créer le workbook SheetJS ──
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ── Largeurs des colonnes ──
  ws['!cols'] = [
      { wch: 18 }, // Référence
      { wch: 12 }, // Date
      { wch: 18 }, // Type
      { wch: 12 }, // Statut
      { wch: 28 }, // Client
      { wch: 18 }, // ICE
      { wch: 14 }, // HT
      { wch: 12 }, // TVA
      { wch: 14 }, // TTC
      { wch: 14 }, // Reste
  ];

  // ── Figer la première ligne (en-têtes) ──
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // ── Styles en-têtes (fond foncé + texte blanc + gras) ──
  const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '1A3C5E' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: {
      bottom: { style: 'medium', color: { rgb: '09BC8A' } },
      },
  };

  // ── Styles colonnes montants (droite + format nombre) ──
  const amountStyle = {
      font: { sz: 10 },
    alignment: { horizontal: 'right' },
      numFmt: '#,##0.00',
  };

  // ── Styles lignes alternées ──
  const rowStyleEven = { fill: { fgColor: { rgb: 'F8F9FA' }, patternType: 'solid' } };
  const rowStyleBadge = {
      Payé: { font: { color: { rgb: '27AE60' }, bold: true } },
      Envoyé: { font: { color: { rgb: '2980B9' }, bold: true } },
      Brouillon: { font: { color: { rgb: '888888' } } },
      Annulé: { font: { color: { rgb: 'C0392B' } } },
      Accepté: { font: { color: { rgb: '27AE60' }, bold: true } },
      Livré: { font: { color: { rgb: '09BC8A' }, bold: true } },
  };

  const range = XLSX.utils.decode_range(ws['!ref']);

  // Appliquer styles en-têtes (ligne 0)
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[addr]) continue;
    ws[addr].s = headerStyle;
  }

  // Appliquer styles sur les données
    const amountCols = new Set([6, 7, 8, 9]); // HT, TVA, TTC, Reste
    for (let r = 1; r <= range.e.r; r++) {
    const isEven = r % 2 === 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };

        if (amountCols.has(c)) {
        ws[addr].s = { ...amountStyle, ...(isEven ? rowStyleEven : {}) };
        ws[addr].t = 'n'; // forcer type numérique
        } else if (c === 3) {
          // colonne Statut
        const statusVal = ws[addr].v || '';
        ws[addr].s = { ...(rowStyleBadge[statusVal] || {}), ...(isEven ? rowStyleEven : {}) };
      } else {
        ws[addr].s = isEven ? rowStyleEven : {};
      }
    }
  }

  // ── Onglet récap TVA (factures payées - avoirs validés) ──
    const fiscals = docs.filter(
      d =>
        (d.type === 'F' && d.status === 'Payé') ||
        (d.type === 'AV' && (d.status === 'Validé' || d.status === 'Payé')),
    );
    if (fiscals.length) {
    const tvaMap = {};
    fiscals.forEach(d => {
        const sign = d.type === 'AV' ? -1 : 1;
        Object.entries(d.tvaByRate || {}).forEach(([rate, vals]) => {
          if (!tvaMap[rate]) tvaMap[rate] = { base: 0, tva: 0, ttc: 0 };
          tvaMap[rate].base += sign * (vals.ht || 0);
          tvaMap[rate].tva += sign * (vals.tva || 0);
          tvaMap[rate].ttc += sign * (vals.ttc || 0);
        });
        if (!Object.keys(d.tvaByRate || {}).length) {
        const r = Number(d.tva ?? 20);
          if (!tvaMap[r]) tvaMap[r] = { base: 0, tva: 0, ttc: 0 };
          tvaMap[r].base += sign * (d.ht || 0);
          tvaMap[r].tva += sign * (d.tva || 0);
          tvaMap[r].ttc += sign * (d.ttc || 0);
        }
      });

      const tvaHeaders = ['Taux TVA', 'Base HT', 'Montant TVA', 'Total TTC'];
    const tvaRows = Object.entries(tvaMap)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([rate, v]) => [rate + '%', v.base, v.tva, v.ttc]);
      const totalRow = [
        'TOTAL',
        tvaRows.reduce((s, r) => s + r[1], 0),
        tvaRows.reduce((s, r) => s + r[2], 0),
        tvaRows.reduce((s, r) => s + r[3], 0),
    ];

    const wsTVA = XLSX.utils.aoa_to_sheet([tvaHeaders, ...tvaRows, totalRow]);
      wsTVA['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

    // Style en-tête TVA
      for (let c = 0; c < 4; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (wsTVA[addr]) wsTVA[addr].s = headerStyle;
    }
    // Style ligne total
    const totalR = tvaRows.length + 1;
      for (let c = 0; c < 4; c++) {
        const addr = XLSX.utils.encode_cell({ r: totalR, c });
        if (wsTVA[addr])
          wsTVA[addr].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '09BC8A' }, patternType: 'solid' },
        numFmt: '#,##0.00',
      };
    }

    XLSX.utils.book_append_sheet(wb, wsTVA, 'TVA DGI');
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Historique');

  // ── Métadonnées ──
  wb.Props = {
      Title: 'Historique INVO',
    Subject: 'Export documents',
      Author: DB.settings.name || 'INVO',
    CreatedDate: new Date(),
  };

  // ── Télécharger ──
    const period = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `historique_${period}.xlsx`);
  toast(`✅ Export Excel — ${docs.length} document(s)`, 'suc');
  } catch (e) {
    dbgErr('[exportHistXLSX] Erreur:', e);
    toast('❌ Erreur export Excel — ' + (e.message || 'réessayez'), 'err');
  }
}

// Kept for backward compat (modale), but now the Reports page is the primary entry
function showSalesReport() {
  nav('reports', sbItem('reports'));
}

/**
 * Ventilation TVA par taux pour un document (cohérente avec remise et tvaByRate persisté).
 * Anciens docs sans tvaByRate : reconstitution depuis les lignes × facteur remise.
 */
function accumulateDocTvaByRateForReport(d, sign, byTva) {
  const remise = parseFloat(d.remise) || 0;
  const factor = remise > 0 ? 1 - remise / 100 : 1;
  const useByRate = d.tvaByRate && Object.keys(d.tvaByRate).length > 0;
  const aeDoc = typeof docIsAutoEntrepreneurExempt === 'function' && docIsAutoEntrepreneurExempt(d);
  if (useByRate) {
    Object.entries(d.tvaByRate).forEach(([rateStr, vals]) => {
      const r = Number(rateStr);
      if (!byTva[r]) byTva[r] = { base: 0, tva: 0 };
      byTva[r].base += sign * (vals.ht || 0);
      byTva[r].tva += sign * (vals.tva || 0);
    });
    return;
  }
  (d.lines || []).forEach(l => {
    const r = Number(l.tva ?? 20);
    const base = (l.qty || 0) * (l.price || 0) * sign * factor;
    if (!byTva[r]) byTva[r] = { base: 0, tva: 0 };
    byTva[r].base += base;
    if (!aeDoc) byTva[r].tva += base * (r / 100);
  });
}
window.accumulateDocTvaByRateForReport = accumulateDocTvaByRateForReport;

// ── Rapports / Fiscal ──
// ═══════════════════════════════════════════
let _repPeriodMonths = 1;
function _setReportsSkeletonLoading(loading) {
  ['rep-by-type', 'rep-top-clients', 'rep-tva-breakdown'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('skeleton-block', !!loading);
    el.setAttribute('aria-busy', loading ? 'true' : 'false');
  });
}
function _repDocYmd(d) {
  const s = d && d.date;
  if (!s || typeof s !== 'string') return '';
  const m = String(s)
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}
function _repCutoffYmd(months) {
  const now = new Date();
  const cut = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`;
}
function setRepPeriod(months, btn) {
  const n = parseInt(months, 10);
  _repPeriodMonths = Number.isFinite(n) && n > 0 ? n : 1;
  document.querySelectorAll('[id^="rep-btn-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderReports();
}
function renderReports(_deferred) {
  if (!document.getElementById('rep-ca')) return;
  if (!_deferred) {
    _setReportsSkeletonLoading(true);
    if (APP._repRenderRAF) cancelAnimationFrame(APP._repRenderRAF);
    APP._repRenderRAF = requestAnimationFrame(() => renderReports(true));
    return;
  }
  document.querySelectorAll('[id^="rep-btn-"]').forEach(b => {
    b.classList.toggle('active', String(b.dataset.repPeriod || '') === String(_repPeriodMonths));
  });
  const cutoffStr = _repCutoffYmd(_repPeriodMonths);
  const docs = DB.docs.filter(d => {
    const ymd = _repDocYmd(d);
    if (!ymd || ymd < cutoffStr) return false;
    if (d.type === 'F') return d.status === 'Payé';
    if (d.type === 'AV') return d.status === 'Validé' || d.status === 'Payé'; // compat anciens états
    return false;
  });
  const sign = d => (d.type === 'AV' ? -1 : 1);
  const ca = docs.reduce((a, d) => a + sign(d) * (d.ttc || 0), 0);
  const ht = docs.reduce((a, d) => a + sign(d) * (d.ht || 0), 0);
  const tva = docs.reduce((a, d) => a + sign(d) * (d.tva || 0), 0);
  const setEl = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setEl('rep-ca', fmt(ca));
  setEl('rep-ht', fmt(ht));
  setEl('rep-tva', fmt(tva));

  // Par type
  const byType = {};
  docs.forEach(d => {
    byType[d.type] = (byType[d.type] || 0) + sign(d) * (d.ttc || 0);
  });
  const typeLabels = { F: 'Facture', D: 'Devis', BL: 'Bon de Livraison', AV: 'Avoir' };
  const byTypeEl = document.getElementById('rep-by-type');
  if (byTypeEl) {
    clearChildren(byTypeEl);
    if (!Object.keys(byType).length) {
      const em = document.createElement('div');
      em.style.cssText = 'color:var(--text2);font-size:13px';
      em.textContent = 'Aucune facture payée ni avoir validé sur cette période.';
      byTypeEl.appendChild(em);
    } else {
      Object.entries(byType).forEach(([t, v]) => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px';
        const a = document.createElement('span');
        a.style.fontWeight = '600';
        a.textContent = typeLabels[t] || t;
        const b = document.createElement('span');
        b.style.cssText = 'font-family:Arial, sans-serif;font-weight:700;color:var(--brand)';
        b.textContent = fmt(v);
        row.appendChild(a);
        row.appendChild(b);
        byTypeEl.appendChild(row);
      });
    }
  }

  // Top clients
  const byClient = {};
  docs.forEach(d => {
    if (d.clientName)
      byClient[d.clientName] = (byClient[d.clientName] || 0) + sign(d) * (d.ttc || 0);
  });
  const top = Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topEl = document.getElementById('rep-top-clients');
  if (topEl) {
    clearChildren(topEl);
    if (!top.length) {
      const em = document.createElement('div');
      em.style.cssText = 'color:var(--text2);font-size:13px';
      em.textContent = 'Aucun client.';
      topEl.appendChild(em);
    } else {
      top.forEach(([n, v], i) => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px';
        const rk = document.createElement('span');
        rk.style.cssText =
          'width:20px;height:20px;border-radius:50%;background:var(--brand-light);color:var(--brand);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0';
        rk.textContent = String(i + 1);
        const nm = document.createElement('span');
        nm.style.cssText = 'flex:1;font-weight:600';
        nm.textContent = n;
        const amt = document.createElement('span');
        amt.style.cssText = 'font-family:Arial, sans-serif;font-weight:700';
        amt.textContent = fmt(v);
        row.appendChild(rk);
        row.appendChild(nm);
        row.appendChild(amt);
        topEl.appendChild(row);
      });
    }
  }

  // TVA par taux (tvaByRate après remise, ou lignes × remise pour anciens exports)
  const byTva = {};
  docs.forEach(d => {
    accumulateDocTvaByRateForReport(d, sign(d), byTva);
  });
  const tvaEl = document.getElementById('rep-tva-breakdown');
  if (tvaEl) {
    clearChildren(tvaEl);
    if (!Object.keys(byTva).length) {
      const em = document.createElement('div');
      em.style.cssText = 'color:var(--text2);font-size:13px';
      em.textContent = 'Aucune donnée.';
      tvaEl.appendChild(em);
    } else {
      const tbl = document.createElement('table');
      tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px';
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      const thR =
        'text-align:right;padding:8px 10px;background:var(--surface2);font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase';
      const h1 = document.createElement('th');
      h1.style.cssText =
        'text-align:left;padding:8px 10px;background:var(--surface2);border-radius:6px 0 0 0;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase';
      h1.textContent = 'Taux';
      const h2 = document.createElement('th');
      h2.style.cssText = thR;
      h2.textContent = 'Base HT';
      const h3 = document.createElement('th');
      h3.style.cssText = thR;
      h3.textContent = 'TVA';
      const h4 = document.createElement('th');
      h4.style.cssText = thR + ';border-radius:0 6px 0 0';
      h4.textContent = 'Total TTC';
      hr.appendChild(h1);
      hr.appendChild(h2);
      hr.appendChild(h3);
      hr.appendChild(h4);
      thead.appendChild(hr);
      tbl.appendChild(thead);
      const tb = document.createElement('tbody');
      Object.entries(byTva)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .forEach(([r, v]) => {
          const tr = document.createElement('tr');
          const c0 = document.createElement('td');
          c0.style.cssText =
            'padding:9px 10px;border-bottom:1px solid var(--border);font-weight:600';
          c0.textContent = `${r}%`;
          const c1 = document.createElement('td');
          c1.style.cssText =
            'padding:9px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:Arial, sans-serif';
          c1.textContent = fmt(v.base);
          const c2 = document.createElement('td');
          c2.style.cssText =
            'padding:9px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:Arial, sans-serif;color:var(--accent);font-weight:600';
          c2.textContent = fmt(v.tva);
          const c3 = document.createElement('td');
          c3.style.cssText =
            'padding:9px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:Arial, sans-serif;font-weight:700;color:var(--brand)';
          c3.textContent = fmt(v.base + v.tva);
          tr.appendChild(c0);
          tr.appendChild(c1);
          tr.appendChild(c2);
          tr.appendChild(c3);
          tb.appendChild(tr);
        });
      tbl.appendChild(tb);
      tvaEl.appendChild(tbl);
    }
  }
  _setReportsSkeletonLoading(false);
}
