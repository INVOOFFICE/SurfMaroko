// js/products.js — Stock, articles, mouvements, KPIs
// ── Stock ──
// ═══════════════════════════════════════════

// ── Modal article : prix (affichage/saisie selon getGlobalPriceMode — stockage toujours TTC)
// ═══════════════════════════════════════════

function getArticleTvaRate(article) {
  const def = parseInt(DB.settings?.tva, 10) || 20;
  if (!article) return def;
  const t = parseInt(article.tva, 10);
  return Number.isFinite(t) && t >= 0 ? t : def;
}

/** TVA utilisée pour convertir les prix du formulaire (article en édition ou défaut). */
function getCurrentArticleTvaForModal() {
  if (APP.editArticleId) {
    const a = DB.stock.find(x => String(x.id) === String(APP.editArticleId));
    if (a) return getArticleTvaRate(a);
  }
  return parseInt(DB.settings?.tva, 10) || 20;
}

function formatArticlePriceForInput(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return '';
  return String(Math.round(x * 100) / 100);
}

/**
 * Interprète la saisie des champs prix selon le mode global et retourne le montant TTC à stocker.
 */
function parsePriceInputToStoredTTC(raw, tvaPercent) {
  return typeof parseGlobalModePriceInputToTTC === 'function'
    ? parseGlobalModePriceInputToTTC(raw, tvaPercent)
    : parseFloat(raw) || 0;
}

function updateArticlePriceHints(buyTtc, sellTtc, mode) {
  const hb = document.getElementById('a-buy-hint');
  const hs = document.getElementById('a-sell-hint');
  const cur = typeof CUR === 'function' ? CUR() : 'DH';
  const bT = parseFloat(buyTtc) || 0;
  const sT = parseFloat(sellTtc) || 0;
  if (mode === 'HT') {
    if (hb) {
      hb.hidden = bT <= 0;
      if (!hb.hidden) hb.textContent = `≈ ${fmt(bT)} ${cur} TTC`;
    }
    if (hs) {
      hs.hidden = sT <= 0;
      if (!hs.hidden) hs.textContent = `≈ ${fmt(sT)} ${cur} TTC`;
    }
  } else {
    if (hb) hb.hidden = true;
    if (hs) hs.hidden = true;
  }
}

/** Affiche buy/sell à partir des montants TTC stockés ; met à jour libellés et hints. */
function fillArticlePriceFieldsFromTtc(buyTtc, sellTtc, tvaPercent) {
  const mode = typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC';
  const tva = parseInt(tvaPercent, 10) || 0;
  const lbBuy = document.getElementById('label-a-buy');
  const lbSell = document.getElementById('label-a-sell');
  const suf = mode === 'HT' ? '(HT)' : '(TTC)';
  if (lbBuy) lbBuy.textContent = `Prix d'achat ${suf}`;
  if (lbSell) lbSell.textContent = `Prix de vente ${suf}`;

  const bT = parseFloat(buyTtc) || 0;
  const sT = parseFloat(sellTtc) || 0;
  const buyEl = document.getElementById('a-buy');
  const sellEl = document.getElementById('a-sell');
  if (buyEl) {
    const disp =
      bT === 0
        ? 0
        : typeof displayTTCForGlobalMode === 'function'
          ? displayTTCForGlobalMode(bT, tva)
          : mode === 'HT'
            ? convertTTCtoHT(bT, tva)
            : bT;
    buyEl.value = bT === 0 ? '' : formatArticlePriceForInput(disp);
  }
  if (sellEl) {
    const disp =
      sT === 0
        ? 0
        : typeof displayTTCForGlobalMode === 'function'
          ? displayTTCForGlobalMode(sT, tva)
          : mode === 'HT'
            ? convertTTCtoHT(sT, tva)
            : sT;
    sellEl.value = sT === 0 ? '' : formatArticlePriceForInput(disp);
  }
  updateArticlePriceHints(bT, sT, mode);
}

/** Si le mode global change pendant que le modal est ouvert : conserver la sémantique (via TTC) puis réafficher. */
function syncArticleModalAfterPriceModeChange() {
  const tva = getCurrentArticleTvaForModal();
  const buyTtc = parsePriceInputToStoredTTC(document.getElementById('a-buy')?.value, tva);
  const sellTtc = parsePriceInputToStoredTTC(document.getElementById('a-sell')?.value, tva);
  fillArticlePriceFieldsFromTtc(buyTtc, sellTtc, tva);
  calcMarginPreview();
}

(function initArticlePriceModeSync() {
  window.addEventListener('invo-price-mode-change', () => {
    if (document.getElementById('modal-article')?.classList.contains('open')) syncArticleModalAfterPriceModeChange();
    if (document.getElementById('modal-stock-picker')?.classList.contains('open')) renderStockPicker();
  });
  window.addEventListener('storage', e => {
    if (e.key === 'priceMode' && document.getElementById('modal-article')?.classList.contains('open')) {
      syncArticleModalAfterPriceModeChange();
    }
    if (e.key === 'priceMode' && document.getElementById('modal-stock-picker')?.classList.contains('open')) {
      renderStockPicker();
    }
  });
})();

(function initStockListPriceModeSync() {
  const refresh = () => {
    if (document.getElementById('page-stock')?.classList.contains('active')) renderStock();
  };
  window.addEventListener('invo-price-mode-change', refresh);
  window.addEventListener('storage', e => {
    if (e.key === 'priceMode') refresh();
  });
})();

function syncStockListPriceHeaders() {
  const m = typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC';
  const suf = m === 'HT' ? '(HT)' : '(TTC)';
  const tb = document.getElementById('stock-th-buy');
  const ts = document.getElementById('stock-th-sell');
  if (tb) tb.textContent = `Prix achat ${suf}`;
  if (ts) ts.textContent = `Prix vente ${suf}`;
}

function renderStock() {
  const search = (document.getElementById('stock-search') || {}).value || '';
  const catFilter = (document.getElementById('stock-cat-filter') || {}).value || '';
  const qtyFilter = (document.getElementById('stock-qty-filter') || {}).value || '';
  const items = DB.stock.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      const nm = (a.name || '').toLowerCase();
      const bc = String(a.barcode || '');
      const cat = (a.category || '').toLowerCase();
      if (!nm.includes(q) && !bc.includes(search) && !cat.includes(q)) return false;
    }
    if (catFilter && a.category !== catFilter) return false;
    if (qtyFilter === 'low' && !((a.qty || 0) < 5 && (a.qty || 0) > 0)) return false;
    if (qtyFilter === 'zero' && (a.qty || 0) !== 0) return false;
    if (qtyFilter === 'ok' && (a.qty || 0) < 5) return false;
    return true;
  });
  const cats = [...new Set(DB.stock.map(a => a.category).filter(Boolean))];
  const catSel = document.getElementById('stock-cat-filter');
  if (catSel) {
    const cur = catSel.value;
    clearChildren(catSel);
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Toutes catégories';
    catSel.appendChild(ph);
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      if (c === cur) o.selected = true;
      catSel.appendChild(o);
    });
    if (typeof refreshThemedSelect === 'function') refreshThemedSelect('stock-cat-filter');
  }
  const totalValBuy = DB.stock.reduce((s, a) => s + (a.buy || 0) * (a.qty || 0), 0);
  const totalValSell = DB.stock.reduce((s, a) => s + (a.sell || 0) * (a.qty || 0), 0);
  const lowItems = DB.stock.filter(a => (a.qty || 0) < 5);
  const setEl = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setEl('stk-kpi-count', DB.stock.length);
  setEl('stk-kpi-val-buy', fmt(totalValBuy));
  setEl('stk-kpi-val-sell', fmt(totalValSell));
  setEl('stk-kpi-low', lowItems.length);
  setEl(
    'stk-kpi-low-names',
    lowItems
      .slice(0, 3)
      .map(a => a.name)
      .join(', ') + (lowItems.length > 3 ? '...' : ''),
  );
  const tbody = document.getElementById('stock-tbody');
  const empty = document.getElementById('stock-empty');
  if (!tbody) return;
  syncStockListPriceHeaders();
  if (!items.length) {
    clearChildren(tbody);
    if (empty) empty.style.display = 'block';
    const mobClr = document.getElementById('mob-stock-list');
    if (mobClr) clearChildren(mobClr);
    const pagEmpty = document.getElementById('stock-list-pagination');
    if (pagEmpty) {
      clearChildren(pagEmpty);
      pagEmpty.style.display = 'none';
    }
    return;
  }
  if (empty) empty.style.display = 'none';
  const filterKey = [search, catFilter, qtyFilter].join('\t');
  const pageSize = typeof LIST_PAGE_SIZE === 'number' ? LIST_PAGE_SIZE : 50;
  const pg = getListPageSlice('stock', filterKey, items, pageSize);
  const pageRows = pg.rows;
  clearChildren(tbody);
  pageRows.forEach(a => {
    const rowTva = getArticleTvaRate(a);
    const buyShown =
      typeof displayTTCForGlobalMode === 'function'
        ? displayTTCForGlobalMode(a.buy || 0, rowTva)
        : parseFloat(a.buy) || 0;
    const sellShown =
      typeof displayTTCForGlobalMode === 'function'
        ? displayTTCForGlobalMode(a.sell || 0, rowTva)
        : parseFloat(a.sell) || 0;
    const marginShown = sellShown - buyShown;
    const marginPct = buyShown > 0 ? ((marginShown / buyShown) * 100).toFixed(0) + '%' : '∞';
    const qty = a.qty || 0;
    const qtyColor = qty === 0 ? 'var(--danger)' : qty < 5 ? 'var(--accent)' : 'var(--text)';
    const enc = encodeURIComponent(String(a.id || ''));
    const fournName =
      a.fournisseurName ||
      (DB.fournisseurs || []).find(f => String(f.id) === String(a.fournisseurId || ''))?.name ||
      '';
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    const n = document.createElement('div');
    n.style.fontWeight = '600';
    n.textContent = a.name || '';
    td0.appendChild(n);
    if (a.desc) {
      const ds = document.createElement('div');
      ds.style.cssText = 'font-size:11px;color:var(--text2)';
      ds.textContent = a.desc;
      td0.appendChild(ds);
    }
    const td1 = document.createElement('td');
    const bc = document.createElement('span');
    bc.className = 'nzero';
    bc.style.fontSize = '12px';
    bc.textContent = a.barcode || '-';
    td1.appendChild(bc);
    const td2 = document.createElement('td');
    td2.textContent = a.category || '-';
    const td3 = document.createElement('td');
    if (fournName) {
      const sp = document.createElement('span');
      sp.style.cssText =
        'font-size:11px;background:rgba(9,188,138,.1);color:var(--brand);padding:2px 7px;border-radius:4px;white-space:nowrap';
      sp.textContent = fournName;
      td3.appendChild(sp);
    } else {
      const sp = document.createElement('span');
      sp.style.cssText = 'color:var(--text3);font-size:12px';
      sp.textContent = '—';
      td3.appendChild(sp);
    }
    const td4 = document.createElement('td');
    const qw = document.createElement('div');
    qw.style.cssText = 'display:flex;align-items:center;gap:6px';
    const b1 = document.createElement('button');
    b1.setAttribute('data-action', 'adjust-qty');
    b1.setAttribute('data-id', enc);
    b1.setAttribute('data-delta', '-1');
    b1.style.cssText =
      'width:22px;height:22px;background:var(--danger-light);color:var(--danger);border:1px solid rgba(239,68,68,.25);border-radius:5px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0';
    b1.textContent = '−';
    const qs = document.createElement('span');
    qs.style.cssText = `font-weight:700;color:${qtyColor};min-width:28px;text-align:center`;
    qs.textContent = String(qty);
    const b2 = document.createElement('button');
    b2.setAttribute('data-action', 'adjust-qty');
    b2.setAttribute('data-id', enc);
    b2.setAttribute('data-delta', '1');
    b2.style.cssText =
      'width:22px;height:22px;background:var(--brand-light);color:var(--brand);border:1px solid rgba(9,188,138,.25);border-radius:5px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0';
    b2.textContent = '+';
    qw.appendChild(b1);
    qw.appendChild(qs);
    qw.appendChild(b2);
    if (qty === 0) {
      const bd = document.createElement('span');
      bd.className = 'badge cancelled';
      bd.style.cssText = 'font-size:10px;padding:2px 6px;margin-left:4px';
      bd.textContent = 'Rupture';
      qw.appendChild(bd);
    } else if (qty < 5) {
      const bd = document.createElement('span');
      bd.className = 'badge';
      bd.style.cssText =
        'background:rgba(240,165,0,.15);color:var(--accent);border:1px solid rgba(240,165,0,.3);font-size:10px;padding:2px 6px;margin-left:4px';
      bd.textContent = 'Bas';
      qw.appendChild(bd);
    }
    td4.appendChild(qw);
    const td5 = document.createElement('td');
    td5.className = 'nzero';
    td5.textContent = fmt(buyShown);
    const td6 = document.createElement('td');
    td6.className = 'nzero';
    td6.style.cssText = 'color:var(--brand);font-weight:600';
    td6.textContent = fmt(sellShown);
    const td7 = document.createElement('td');
    const m1 = document.createElement('span');
    m1.style.cssText = `font-weight:600;color:${marginShown >= 0 ? 'var(--brand)' : 'var(--danger)'}`;
    m1.textContent = (marginShown >= 0 ? '+' : '') + fmt(marginShown);
    const m2 = document.createElement('span');
    m2.style.cssText = 'font-size:11px;color:var(--text2)';
    m2.textContent = ` (${marginPct})`;
    td7.appendChild(m1);
    td7.appendChild(m2);
    const td8 = document.createElement('td');
    const aw = document.createElement('div');
    aw.style.cssText = 'display:flex;gap:4px';
    const e1 = document.createElement('button');
    e1.className = 'btn btn-icon btn-secondary btn-sm';
    e1.title = 'Modifier';
    e1.setAttribute('data-action', 'edit-article');
    e1.setAttribute('data-id', enc);
    e1.textContent = '✏️';
    const e2 = document.createElement('button');
    e2.className = 'btn btn-icon btn-danger btn-sm';
    e2.title = 'Supprimer';
    e2.setAttribute('data-action', 'delete-article');
    e2.setAttribute('data-id', enc);
    e2.textContent = '🗑';
    aw.appendChild(e1);
    aw.appendChild(e2);
    td8.appendChild(aw);
    tr.appendChild(td0);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    tr.appendChild(td6);
    tr.appendChild(td7);
    tr.appendChild(td8);
    tbody.appendChild(tr);
  });
  let mobStk = document.getElementById('mob-stock-list');
  if (!mobStk) {
    mobStk = document.createElement('div');
    mobStk.id = 'mob-stock-list';
    mobStk.className = 'mob-card-list';
    const wrap = document.querySelector('#page-stock .tbl-wrap');
    if (wrap) wrap.after(mobStk);
  }
  clearChildren(mobStk);
  pageRows.forEach(a => {
    const rowTvaM = getArticleTvaRate(a);
    const buyShownM =
      typeof displayTTCForGlobalMode === 'function'
        ? displayTTCForGlobalMode(a.buy || 0, rowTvaM)
        : parseFloat(a.buy) || 0;
    const sellShownM =
      typeof displayTTCForGlobalMode === 'function'
        ? displayTTCForGlobalMode(a.sell || 0, rowTvaM)
        : parseFloat(a.sell) || 0;
    const marginShownM = sellShownM - buyShownM;
    const qty = a.qty || 0;
    const qtyColor = qty === 0 ? 'var(--danger)' : qty < 5 ? 'var(--gold)' : 'var(--teal)';
    const enc = encodeURIComponent(String(a.id || ''));
    const pmSuf =
      typeof getGlobalPriceMode === 'function' && getGlobalPriceMode() === 'HT' ? '(HT)' : '(TTC)';
    const card = document.createElement('div');
    card.className = 'mob-card';
    const hdr = document.createElement('div');
    hdr.className = 'mob-card-header';
    const ttl = document.createElement('div');
    ttl.className = 'mob-card-title';
    ttl.textContent = a.name || '';
    const stb = document.createElement('span');
    stb.className = qty === 0 ? 'badge cancelled' : qty < 5 ? 'badge avoir' : 'badge paid';
    stb.textContent = qty === 0 ? 'Rupture' : qty < 5 ? 'Stock bas' : 'OK';
    hdr.appendChild(ttl);
    hdr.appendChild(stb);
    card.appendChild(hdr);
    if (a.category) {
      const r = document.createElement('div');
      r.className = 'mob-card-row';
      const l = document.createElement('span');
      l.className = 'mob-card-label';
      l.textContent = 'Catégorie';
      const v = document.createElement('span');
      v.className = 'mob-card-val';
      v.textContent = a.category;
      r.appendChild(l);
      r.appendChild(v);
      card.appendChild(r);
    }
    const rQ = document.createElement('div');
    rQ.className = 'mob-card-row';
    const lQ = document.createElement('span');
    lQ.className = 'mob-card-label';
    lQ.textContent = 'Quantité';
    const vQ = document.createElement('span');
    vQ.className = 'mob-card-val';
    vQ.style.cssText = 'display:flex;align-items:center;gap:8px';
    const bM = document.createElement('button');
    bM.setAttribute('data-action', 'adjust-qty');
    bM.setAttribute('data-id', enc);
    bM.setAttribute('data-delta', '-1');
    bM.style.cssText =
      'width:28px;height:28px;background:var(--danger-light);color:var(--danger);border:1px solid rgba(239,68,68,.25);border-radius:7px;font-size:16px;cursor:pointer';
    bM.textContent = '−';
    const qSp = document.createElement('span');
    qSp.style.cssText = `font-weight:700;color:${qtyColor};min-width:24px;text-align:center`;
    qSp.textContent = String(qty);
    const bP = document.createElement('button');
    bP.setAttribute('data-action', 'adjust-qty');
    bP.setAttribute('data-id', enc);
    bP.setAttribute('data-delta', '1');
    bP.style.cssText =
      'width:28px;height:28px;background:var(--brand-light);color:var(--brand);border:1px solid rgba(9,188,138,.25);border-radius:7px;font-size:16px;cursor:pointer';
    bP.textContent = '+';
    vQ.appendChild(bM);
    vQ.appendChild(qSp);
    vQ.appendChild(bP);
    rQ.appendChild(lQ);
    rQ.appendChild(vQ);
    card.appendChild(rQ);
    const rPa = document.createElement('div');
    rPa.className = 'mob-card-row';
    const lA = document.createElement('span');
    lA.className = 'mob-card-label';
    lA.textContent = `Prix achat ${pmSuf}`;
    const vA = document.createElement('span');
    vA.className = 'mob-card-val';
    vA.textContent = fmt(buyShownM);
    rPa.appendChild(lA);
    rPa.appendChild(vA);
    card.appendChild(rPa);
    const rPv = document.createElement('div');
    rPv.className = 'mob-card-row';
    const lP = document.createElement('span');
    lP.className = 'mob-card-label';
    lP.textContent = `Prix vente ${pmSuf}`;
    const vP = document.createElement('span');
    vP.className = 'mob-card-val';
    vP.style.color = 'var(--teal)';
    vP.textContent = fmt(sellShownM);
    rPv.appendChild(lP);
    rPv.appendChild(vP);
    card.appendChild(rPv);
    const rMg = document.createElement('div');
    rMg.className = 'mob-card-row';
    const lM = document.createElement('span');
    lM.className = 'mob-card-label';
    lM.textContent = 'Marge';
    const vM = document.createElement('span');
    vM.className = 'mob-card-val';
    vM.style.color = marginShownM >= 0 ? 'var(--teal)' : 'var(--danger)';
    vM.textContent = (marginShownM >= 0 ? '+' : '') + fmt(marginShownM);
    rMg.appendChild(lM);
    rMg.appendChild(vM);
    card.appendChild(rMg);
    const act = document.createElement('div');
    act.className = 'mob-card-actions';
    const bE = document.createElement('button');
    bE.className = 'btn btn-secondary btn-sm';
    bE.setAttribute('data-action', 'edit-article');
    bE.setAttribute('data-id', enc);
    bE.textContent = '✏️ Modifier';
    const bD = document.createElement('button');
    bD.className = 'btn btn-danger btn-sm';
    bD.setAttribute('data-action', 'delete-article');
    bD.setAttribute('data-id', enc);
    bD.textContent = '🗑';
    act.appendChild(bE);
    act.appendChild(bD);
    card.appendChild(act);
    mobStk.appendChild(card);
  });
  updateListPaginationUI(
    'stock-list-pagination',
    'stock',
    pg.total,
    pg.page,
    pg.totalPages,
    pageSize,
    renderStock,
  );
}
function adjustQty(id, delta) {
  const idx = DB.stock.findIndex(a => String(a.id) === String(id));
  if (idx < 0) return;
  const newQty = Math.max(0, (DB.stock[idx].qty || 0) + delta);
  DB.stock[idx].qty = newQty;
  DB.stock[idx].updatedAt = new Date().toISOString();
  save('stock');
  renderStock();
  toast(`${DB.stock[idx].name}: ${newQty} unité(s)`, newQty === 0 ? 'err' : 'suc');
}
function populateFournisseurSelect(selectedId) {
  const sel = document.getElementById('a-fournisseur');
  if (!sel) return;
  const raw = DB.fournisseurs;
  const list = Array.isArray(raw) ? raw : [];
  const selStr = selectedId != null && selectedId !== '' ? String(selectedId) : '';
  clearChildren(sel);
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = '— Aucun fournisseur —';
  sel.appendChild(ph);
  list
    .filter(f => f && f.id != null)
    .slice()
    .sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' }),
    )
    .forEach(f => {
      const id = String(f.id);
      const o = document.createElement('option');
      o.value = id;
      o.textContent = String(f.name || '').trim() || 'Fournisseur ' + id.slice(-6);
      if (id === selStr) o.selected = true;
      sel.appendChild(o);
    });
  // Le select est un « themed select » : après changement des options, rafraîchir le menu visuel
  if (typeof refreshThemedSelect === 'function') refreshThemedSelect('a-fournisseur');
}
function openAddArticle() {
  APP.editArticleId = null;
  document.getElementById('article-modal-title').textContent = 'Ajouter un article';
  ['a-name', 'a-barcode', 'a-category', 'a-desc'].forEach(
    id => (document.getElementById(id).value = ''),
  );
  document.getElementById('a-qty').value = 0;
  document.getElementById('margin-preview').style.display = 'none';
  populateFournisseurSelect('');
  const tvaNew = parseInt(DB.settings?.tva, 10) || 20;
  fillArticlePriceFieldsFromTtc(0, 0, tvaNew);
  openModal('modal-article');
}
function editArticle(id) {
  const a = DB.stock.find(x => String(x.id) === String(id));
  if (!a) return;
  APP.editArticleId = id;
  document.getElementById('article-modal-title').textContent = 'Modifier';
  document.getElementById('a-name').value = a.name || '';
  document.getElementById('a-barcode').value = a.barcode || '';
  document.getElementById('a-category').value = a.category || '';
  document.getElementById('a-qty').value = a.qty || 0;
  document.getElementById('a-desc').value = a.desc || '';
  populateFournisseurSelect(a.fournisseurId || '');
  fillArticlePriceFieldsFromTtc(a.buy || 0, a.sell || 0, getArticleTvaRate(a));
  calcMarginPreview();
  openModal('modal-article');
}
function calcMarginPreview() {
  const tva = getCurrentArticleTvaForModal();
  const buy = parsePriceInputToStoredTTC(document.getElementById('a-buy')?.value, tva);
  const sell = parsePriceInputToStoredTTC(document.getElementById('a-sell')?.value, tva);
  const mode = typeof getGlobalPriceMode === 'function' ? getGlobalPriceMode() : 'TTC';
  updateArticlePriceHints(buy, sell, mode);
  const prev = document.getElementById('margin-preview');
  if (sell > 0) {
    prev.style.display = 'flex';
    document.getElementById('margin-val').textContent =
      `+${fmt(sell - buy)} (${buy > 0 ? (((sell - buy) / buy) * 100).toFixed(0) : '∞'}%)`;
  } else prev.style.display = 'none';
}
function saveArticle() {
  const name = normUtf8(document.getElementById('a-name').value.trim());
  if (!name) {
    toast('Nom obligatoire', 'err');
    return;
  }
  const fournId = document.getElementById('a-fournisseur')?.value || '';
  const prevArticle = APP.editArticleId
    ? DB.stock.find(x => String(x.id) === String(APP.editArticleId))
    : null;
  const finalTva = getArticleTvaRate(prevArticle);
  const buyTtc = parsePriceInputToStoredTTC(document.getElementById('a-buy').value, finalTva);
  const sellTtc = parsePriceInputToStoredTTC(document.getElementById('a-sell').value, finalTva);
  const now = new Date().toISOString();
  let createdAt = now;
  if (APP.editArticleId) {
    const prev = DB.stock.find(x => String(x.id) === String(APP.editArticleId));
    if (prev?.createdAt) createdAt = prev.createdAt;
  }
  const article = {
    id: APP.editArticleId || 'art_' + Date.now(),
    name,
    barcode: normUtf8(document.getElementById('a-barcode').value.trim() || ''),
    category: normUtf8(document.getElementById('a-category').value.trim() || ''),
    qty: parseFloat(document.getElementById('a-qty').value) || 0,
    buy: buyTtc,
    sell: sellTtc,
    tva: finalTva,
    desc: normUtf8(document.getElementById('a-desc').value.trim() || ''),
    fournisseurId: fournId,
    fournisseurName:
      (DB.fournisseurs || []).find(f => String(f.id) === String(fournId || ''))?.name || '',
    createdAt,
    updatedAt: now,
  };
  if (APP.editArticleId) {
    const idx = DB.stock.findIndex(x => String(x.id) === String(APP.editArticleId));
    if (idx >= 0) DB.stock[idx] = article;
  } else {
    DB.stock.push(article);
  }
  save('stock');
  closeModal('modal-article');
  renderStock();
  toast(APP.editArticleId ? 'Article mis à jour ✓' : 'Article ajouté ✓', 'suc');
}
async function deleteArticle(id) {
  const ok = await showConfirm({
    title: 'Supprimer cet article ?',
    message: 'Cette action est <strong>irréversible</strong>.',
    icon: '🗑️',
    okLabel: 'Supprimer',
    okStyle: 'danger',
  });
  if (!ok) return;
  if (typeof invooSupabaseSoftDelete === 'function') invooSupabaseSoftDelete('stock', id);
  DB.stock = DB.stock.filter(a => String(a.id) !== String(id));
  save('stock');
  renderStock();
  toast('Article supprimé', 'suc');
}
async function clearStock() {
  const ok = await showConfirm({
    title: 'Supprimer TOUS les articles ?',
    message: 'Tout votre catalogue sera effacé. Cette action est <strong>irréversible</strong>.',
    icon: '⚠️',
    okLabel: 'Tout supprimer',
    okStyle: 'danger',
  });
  if (!ok) return;
  if (typeof invooSupabaseSoftDelete === 'function') {
    for (const a of DB.stock) {
      if (a?.id != null) invooSupabaseSoftDelete('stock', a.id);
    }
  }
  DB.stock = [];
  save('stock');
  renderStock();
  toast('Stock vidé', 'suc');
}

function openStockMoves() {
  renderStockMoves();
  openModal('modal-stock-moves');
}

function closeStockMoves() {
  closeModal('modal-stock-moves');
}

function renderStockMoves() {
  const q = ((document.getElementById('stock-moves-search') || {}).value || '')
    .toLowerCase()
    .trim();
  const action = ((document.getElementById('stock-moves-action-filter') || {}).value || '').trim();
  const moves = (Array.isArray(DB.stockMoves) ? DB.stockMoves : []).filter(m => {
    if (action && (m.action || '') !== action) return false;
    if (!q) return true;
    const name = String(m.articleName || '').toLowerCase();
    const barcode = String(m.barcode || '').toLowerCase();
    return name.includes(q) || barcode.includes(q);
  });

  const tbody = document.getElementById('stock-moves-tbody');
  const empty = document.getElementById('stock-moves-empty');
  if (!tbody || !empty) return;
  if (!moves.length) {
    clearChildren(tbody);
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const label = { import: 'Import', replace: 'Remplacement', adjust: 'Ajustement' };
  clearChildren(tbody);
  moves.slice(0, 500).forEach(m => {
    const d = new Date(m.at || Date.now());
    const dateStr = Number.isNaN(d.getTime()) ? String(m.at || '—') : d.toLocaleString('fr-FR');
    const oldQty = Number(m.oldQty || 0);
    const newQty = Number(m.newQty || 0);
    const delta = typeof m.delta === 'number' ? m.delta : newQty - oldQty;
    const deltaTxt = (delta > 0 ? '+' : '') + delta;
    const deltaColor = delta > 0 ? 'var(--brand)' : delta < 0 ? 'var(--danger)' : 'var(--text2)';
    const tr = document.createElement('tr');
    const t0 = document.createElement('td');
    t0.style.fontSize = '12px';
    t0.textContent = dateStr;
    const t1 = document.createElement('td');
    const b = document.createElement('span');
    b.className =
      'badge ' + (m.action === 'adjust' ? 'avoir' : m.action === 'replace' ? 'sent' : 'paid');
    b.textContent = label[m.action] || m.action || '—';
    t1.appendChild(b);
    const t2 = document.createElement('td');
    t2.style.fontWeight = '600';
    t2.textContent = m.articleName || '—';
    const t3 = document.createElement('td');
    const nz = document.createElement('span');
    nz.className = 'nzero';
    nz.textContent = m.barcode || '—';
    t3.appendChild(nz);
    const t4 = document.createElement('td');
    t4.textContent = String(oldQty);
    const t5 = document.createElement('td');
    t5.textContent = String(newQty);
    const t6 = document.createElement('td');
    t6.style.color = deltaColor;
    t6.style.fontWeight = '700';
    t6.textContent = deltaTxt;
    tr.appendChild(t0);
    tr.appendChild(t1);
    tr.appendChild(t2);
    tr.appendChild(t3);
    tr.appendChild(t4);
    tr.appendChild(t5);
    tr.appendChild(t6);
    tbody.appendChild(tr);
  });
}

async function clearStockMoves() {
  const count = (DB.stockMoves || []).length;
  if (!count) {
    toast('Aucun mouvement à supprimer', '');
    return;
  }
  const ok = await showConfirm({
    title: 'Vider l’historique des mouvements ?',
    message: `${count} mouvement(s) seront supprimés.`,
    icon: '🗑️',
    okLabel: 'Vider',
    okStyle: 'danger',
  });
  if (!ok) return;
  DB.stockMoves = [];
  save('stockMoves');
  renderStockMoves();
  toast('Historique des mouvements vidé ✓', 'suc');
}
/** Export du stock en CSV (séparateur ; — Excel FR, BOM UTF-8) */
function exportStockCSV() {
  if (!DB.stock.length) {
    toast('Aucun article à exporter', 'err');
    return;
  }

  const headers = [
    'Désignation',
    'Code barre',
    'Catégorie',
    'Fournisseur',
    'Quantité',
    'Prix achat TTC',
    'Prix vente',
    'Marge',
    'Marge %',
    'TVA %',
    'Valeur stock (achat TTC)',
  ];

  const rows = DB.stock.map(a => {
    const buy = a.buy || 0;
    const sell = a.sell || 0;
    const qty = a.qty || 0;
    const marge = sell - buy;
    const margeP = buy > 0 ? Math.round((marge / buy) * 100) : 0;
    const fourn =
      a.fournisseurName ||
      (DB.fournisseurs || []).find(f => String(f.id) === String(a.fournisseurId || ''))?.name ||
      '';
    return [
      a.name || '',
      a.barcode || '',
      a.category || '',
      fourn,
      qty,
      buy,
      sell,
      marge,
      margeP,
      a.tva || 20,
      qty * buy,
    ];
  });

  const sep = ';';
  const esc = v => {
    const s = v == null ? '' : String(v);
    if (/[;\n\r"]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const line = arr => arr.map(esc).join(sep);

  const totalQty = rows.reduce((s, r) => s + Number(r[4] || 0), 0);
  const totalVal = rows.reduce((s, r) => s + Number(r[10] || 0), 0);
  const totalLine = line(['TOTAL', '', '', '', totalQty, '', '', '', '', '', totalVal]);

  const body = [line(headers), ...rows.map(line), totalLine].join('\r\n');
  const csv = '\uFEFF' + body;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`✅ Export CSV — ${DB.stock.length} article(s)`, 'suc');
}

// Stock picker
let _barcodeScanStream = null;
let _barcodeScanTimer = null;
let _barcodeDetector = null;

function openStockPicker() {
  closeBarcodeScanner();
  const ps = document.getElementById('picker-search');
  if (ps) ps.value = '';
  renderStockPicker();
  openModal('modal-stock-picker');
}
function syncStockPickerPriceColumnHeader() {
  const th = document.getElementById('picker-th-price');
  if (!th) return;
  const m = typeof getEffectiveDocPriceMode === 'function' ? getEffectiveDocPriceMode() : 'TTC';
  th.textContent = m === 'HT' ? 'Prix vente (HT)' : 'Prix vente (TTC)';
}

function renderStockPicker() {
  syncStockPickerPriceColumnHeader();
  const psEl = document.getElementById('picker-search');
  const search = (psEl?.value || '').toLowerCase().trim();

  // Filtrer : nom OU code barre OU catégorie
  const items = DB.stock.filter(
    a =>
      !search ||
      (a.name || '').toLowerCase().includes(search) ||
      (a.barcode || '').toLowerCase().includes(search) ||
      (a.category || '').toLowerCase().includes(search),
  );

  const ptBody = document.getElementById('picker-tbody');
  if (!ptBody) return;
  clearChildren(ptBody);
  const markPick =
    'background:rgba(9,188,138,.25);color:var(--brand);border-radius:2px;padding:0 1px';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.cssText = 'text-align:center;padding:20px;color:var(--text2)';
    td.textContent = 'Aucun article trouvé.';
    tr.appendChild(td);
    ptBody.appendChild(tr);
    return;
  }
  items.forEach(a => {
    const low = (a.qty || 0) < 5,
      zero = (a.qty || 0) === 0;
    const barcodeMatch = search && (a.barcode || '').toLowerCase().includes(search);
    const nameMatch = search && (a.name || '').toLowerCase().includes(search);
    const tr = document.createElement('tr');
    if (zero) tr.style.opacity = '.5';
    const td0 = document.createElement('td');
    const dName = document.createElement('div');
    dName.style.fontWeight = '600';
    if (nameMatch) appendHighlightedContent(dName, a.name, search, markPick);
    else dName.textContent = normUtf8(a.name);
    td0.appendChild(dName);
    if (a.barcode) {
      const dBc = document.createElement('div');
      dBc.style.cssText = `font-size:11px;color:${barcodeMatch ? 'var(--brand)' : 'var(--text2)'};margin-top:2px;font-family:monospace;letter-spacing:.04em`;
      if (barcodeMatch) dBc.appendChild(document.createTextNode('📷 '));
      if (barcodeMatch) appendHighlightedContent(dBc, a.barcode, search, markPick);
      else dBc.appendChild(document.createTextNode(a.barcode));
      td0.appendChild(dBc);
    }
    const td1 = document.createElement('td');
    td1.textContent = a.category || '-';
    const td2 = document.createElement('td');
    const sp = document.createElement('span');
    sp.style.fontWeight = '700';
    sp.style.color = zero ? 'var(--danger)' : low ? 'var(--accent)' : 'var(--text)';
    sp.textContent = String(a.qty || 0);
    td2.appendChild(sp);
    if (low && !zero) {
      const w = document.createElement('span');
      w.style.cssText = 'font-size:10px;color:var(--accent)';
      w.textContent = ' ⚠️';
      td2.appendChild(w);
    }
    const td3 = document.createElement('td');
    td3.style.fontFamily = 'Arial,sans-serif';
    const pTva = Number.isFinite(Number(a.tva)) ? Number(a.tva) : 20;
    const sellShown =
      typeof displayTTCForDocLineMode === 'function'
        ? displayTTCForDocLineMode(a.sell || 0, pTva)
        : a.sell || 0;
    td3.textContent = fmt(sellShown);
    const td4 = document.createElement('td');
    td4.textContent = `${Number.isFinite(Number(a.tva)) ? Number(a.tva) : 20}%`;
    const td5 = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-primary';
    btn.setAttribute('data-action', 'add-line-from-stock');
    btn.setAttribute('data-id', encodeURIComponent(String(a.id || '')));
    if (zero) btn.disabled = true;
    btn.textContent = zero ? 'Épuisé' : 'Ajouter';
    td5.appendChild(btn);
    tr.appendChild(td0);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    ptBody.appendChild(tr);
  });
}

function addLineFromStock(id) {
  const a = DB.stock.find(x => String(x.id) === String(id));
  if (!a) return;
  const existing = APP.docLines.find(l => String(l.fromStock) === String(id));
  if (existing) {
    existing.qty += 1;
    renderDocLines();
    calcTotals();
    toast(`${a.name} × ${existing.qty}`, 'suc');
  } else {
    addLine(a);
    toast(`${a.name} ajouté ✓`, 'suc');
  }
  renderStockPicker();
}

async function openBarcodeScanner() {
  const statusEl = document.getElementById('barcode-scan-status');
  const video = document.getElementById('barcode-video');
  if (!video) {
    toast('Scanner indisponible', 'err');
    return;
  }
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    toast('Caméra non disponible sur cet appareil', 'err');
    return;
  }
  if (typeof BarcodeDetector === 'undefined') {
    if (statusEl)
      statusEl.textContent =
        'BarcodeDetector non supporté sur ce navigateur. Utilisez la recherche manuelle.';
    openModal('modal-barcode-scan');
    return;
  }
  try {
    _barcodeDetector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar'],
    });
  } catch (_) {
    _barcodeDetector = new BarcodeDetector();
  }
  try {
    if (statusEl) statusEl.textContent = 'Demande d’accès caméra…';
    _barcodeScanStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    video.srcObject = _barcodeScanStream;
    openModal('modal-barcode-scan');
    if (statusEl) statusEl.textContent = 'Scannez le code barre…';
    if (_barcodeScanTimer) clearInterval(_barcodeScanTimer);
    _barcodeScanTimer = setInterval(async () => {
      try {
        if (!video.videoWidth || !video.videoHeight || !_barcodeDetector) return;
        const res = await _barcodeDetector.detect(video);
        if (res && res.length) {
          const code = String(res[0].rawValue || '').trim();
          if (code) {
            const inp = document.getElementById('picker-search');
            if (inp) inp.value = code;
            renderStockPicker();
            toast(`Code barre détecté: ${code}`, 'suc');
            closeBarcodeScanner();
          }
        }
      } catch (_) {}
    }, 220);
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Impossible d’ouvrir la caméra.';
    toast('Accès caméra refusé ou indisponible', 'err');
  }
}

function closeBarcodeScanner() {
  if (_barcodeScanTimer) {
    clearInterval(_barcodeScanTimer);
    _barcodeScanTimer = null;
  }
  if (_barcodeScanStream) {
    _barcodeScanStream.getTracks().forEach(t => t.stop());
    _barcodeScanStream = null;
  }
  const video = document.getElementById('barcode-video');
  if (video && video.srcObject) video.srcObject = null;
  closeModal('modal-barcode-scan');
}

function updateStockKPIs() {
  const totalValBuy = DB.stock.reduce((s, a) => s + (a.buy || 0) * (a.qty || 0), 0);
  const totalValSell = DB.stock.reduce((s, a) => s + (a.sell || 0) * (a.qty || 0), 0);
  const lowItems = DB.stock.filter(a => (a.qty || 0) < 5);
  const setEl = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setEl('stk-kpi-count', DB.stock.length);
  setEl('stk-kpi-val-buy', fmt(totalValBuy));
  setEl('stk-kpi-val-sell', fmt(totalValSell));
  setEl('stk-kpi-low', lowItems.length);
  setEl(
    'stk-kpi-low-names',
    lowItems
      .slice(0, 3)
      .map(a => a.name)
      .join(', ') + (lowItems.length > 3 ? '...' : ''),
  );
}
