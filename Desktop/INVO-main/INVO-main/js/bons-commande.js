// ═══════════════════════════════════════════
//  bons-commande.js  —  Achats fournisseurs + lien stock
// ═══════════════════════════════════════════

let _bcEditId = null;
/** @type {{stockId:string,name:string,barcode:string,qty:number,unitPrice:number,tva:number}[]} */
let _bcDraftLines = [];

const BC_STATUS = {
  pending: { label: 'En attente', cls: 'bc-status-pending' },
  approved: { label: 'Validé', cls: 'bc-status-approved' },
  received: { label: 'Réceptionné', cls: 'bc-status-received' },
  cancelled: { label: 'Annulé', cls: 'bc-status-cancelled' },
};

/** unitPrice enregistré = TTC ; affichage/saisie selon getGlobalPriceMode (comme paramètre documents). */
function syncBCPurchaseUnitColumnHeader() {
  const th = document.getElementById('bc-th-pu');
  if (!th) return;
  const ht = typeof getGlobalPriceMode === 'function' && getGlobalPriceMode() === 'HT';
  th.textContent = ht ? 'PU achat (HT)' : 'PU achat (TTC)';
}

function syncBCPickerPurchaseColumnHeader() {
  const th = document.getElementById('bc-picker-th-buy');
  if (!th) return;
  const ht = typeof getGlobalPriceMode === 'function' && getGlobalPriceMode() === 'HT';
  th.textContent = ht ? 'P. achat (HT)' : 'P. achat (TTC)';
}

function bcFormatPuInput(ttcStored, tva) {
  const t = parseFloat(ttcStored) || 0;
  if (t <= 0) return '';
  const d =
    typeof displayTTCForGlobalMode === 'function'
      ? displayTTCForGlobalMode(t, tva)
      : t;
  return String(Math.round(d * 100) / 100);
}

function bcParsePuInputToTtc(raw, tva) {
  return typeof parseGlobalModePriceInputToTTC === 'function'
    ? parseGlobalModePriceInputToTTC(raw, tva)
    : Math.max(0, parseFloat(raw) || 0);
}

(function _bcInitPriceModeSync() {
  window.addEventListener('invo-price-mode-change', () => {
    if (document.getElementById('modal-bon-commande')?.classList.contains('open')) renderBCEditLines();
    if (document.getElementById('modal-bc-stock-picker')?.classList.contains('open')) renderBCPicker();
  });
  window.addEventListener('storage', e => {
    if (e.key !== 'priceMode') return;
    if (document.getElementById('modal-bon-commande')?.classList.contains('open')) renderBCEditLines();
    if (document.getElementById('modal-bc-stock-picker')?.classList.contains('open')) renderBCPicker();
  });
})();

function _bcEnsureSeq() {
  if (DB.settings.seqBCmd == null || DB.settings.seqBCmd === undefined) DB.settings.seqBCmd = 1;
}

function _bcAllocRef() {
  _bcEnsureSeq();
  const num = DB.settings.seqBCmd++;
  save('settings');
  return `BCmd-${yyyy()}-${pad(num, 4)}`;
}

// Prévisualisation de la prochaine référence sans consommer la séquence
function _bcPeekRef() {
  _bcEnsureSeq();
  const num = Number(DB.settings.seqBCmd || 1);
  return `BCmd-${yyyy()}-${pad(num, 4)}`;
}

function _bcFournName(id) {
  return (DB.fournisseurs || []).find(f => String(f.id) === String(id))?.name || '—';
}

function populateBCFournSelect(selectedId) {
  const sel = document.getElementById('bc-fournisseur');
  if (!sel) return;
  const cur = selectedId || sel.value || '';
  const list = Array.isArray(DB.fournisseurs) ? DB.fournisseurs : [];
  clearChildren(sel);
  const o0 = document.createElement('option');
  o0.value = '';
  o0.textContent = list.length ? '— Choisir un fournisseur —' : '— Aucun fournisseur enregistré —';
  sel.appendChild(o0);
  list.forEach(f => {
    const o = document.createElement('option');
    o.value = String(f.id);
    o.textContent = String(f.name || '');
    sel.appendChild(o);
  });
  sel.value = cur;
  // Important: le select est thémé ; il faut rafraîchir après mise à jour des options
  if (typeof refreshThemedSelect === 'function') refreshThemedSelect('bc-fournisseur');
  syncBCSaveState();
}

// Active/désactive le bouton Enregistrer selon la disponibilité fournisseurs/sélection
function syncBCSaveState() {
  const saveBtn = document.getElementById('btn-save-bc');
  const sel = document.getElementById('bc-fournisseur');
  if (!saveBtn || !sel) return;
  const hasFournisseurs = Array.isArray(DB.fournisseurs) && DB.fournisseurs.length > 0;
  if (!hasFournisseurs) {
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.6';
    saveBtn.style.cursor = 'not-allowed';
    saveBtn.title = 'Ajoutez d’abord un fournisseur';
    return;
  }
  saveBtn.disabled = false;
  saveBtn.style.opacity = '';
  saveBtn.style.cursor = '';
  saveBtn.title = '';
}

function renderBonsCommande() {
  if (!DB.bonsCommande) DB.bonsCommande = [];
  const search = (document.getElementById('bc-search') || {}).value?.toLowerCase().trim() || '';
  const stFilter = (document.getElementById('bc-filter-status') || {}).value || '';

  const list = DB.bonsCommande.filter(bc => {
    if (stFilter && bc.status !== stFilter) return false;
    if (search) {
      const ref = (bc.ref || '').toLowerCase();
      const fn = (bc.fournisseurName || '').toLowerCase();
      if (!ref.includes(search) && !fn.includes(search)) return false;
    }
    return true;
  });
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const pending = DB.bonsCommande.filter(b => b.status === 'pending').length;
  const approved = DB.bonsCommande.filter(b => b.status === 'approved').length;
  const received = DB.bonsCommande.filter(b => b.status === 'received').length;

  const setEl = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setEl('bc-kpi-total', String(DB.bonsCommande.length));
  setEl('bc-kpi-pending', String(pending + approved));
  setEl('bc-kpi-received', String(received));

  const tbody = document.getElementById('bc-tbody');
  const empty = document.getElementById('bc-empty');
  if (!tbody || !empty) return;

  if (!list.length) {
    clearChildren(tbody);
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  clearChildren(tbody);
  list.forEach(bc => {
    const enc = encodeURIComponent(String(bc.id || ''));
    const st = BC_STATUS[bc.status] || BC_STATUS.pending;
    const lines = bc.lines || [];
    const qtySum = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const totalTtc = lines.reduce(
      (s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
      0,
    );
    const canEdit = bc.status === 'pending';
    const canApprove = bc.status === 'pending';
    const canReceive = bc.status === 'pending' || bc.status === 'approved';
    const canCancel = bc.status === 'pending' || bc.status === 'approved';
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const d1 = document.createElement('div');
    d1.style.fontWeight = '700';
    d1.textContent = bc.ref || '—';
    const d2 = document.createElement('div');
    d2.style.cssText = 'font-size:11px;color:var(--text2)';
    d2.textContent = (bc.createdAt || '').slice(0, 10);
    td1.appendChild(d1);
    td1.appendChild(d2);
    const td2 = document.createElement('td');
    const fn = document.createElement('div');
    fn.style.fontWeight = '600';
    fn.textContent = bc.fournisseurName || '—';
    td2.appendChild(fn);
    const td3 = document.createElement('td');
    const bd = document.createElement('span');
    bd.className = `badge ${st.cls}`;
    bd.textContent = st.label;
    td3.appendChild(bd);
    const td4 = document.createElement('td');
    td4.style.fontVariantNumeric = 'tabular-nums';
    td4.textContent = `${lines.length} ligne(s) · ${qtySum} u.`;
    const td5 = document.createElement('td');
    td5.style.cssText = 'font-family:Arial,sans-serif;font-weight:600';
    td5.textContent = fmt(totalTtc);
    const td6 = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    const addBtn = (cls, lab, act) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.setAttribute('data-action', act);
      b.setAttribute('data-id', enc);
      b.textContent = lab;
      wrap.appendChild(b);
    };
    addBtn('btn btn-secondary btn-sm', 'Voir', 'bc-view');
    if (canEdit) addBtn('btn btn-secondary btn-sm', 'Modifier', 'bc-edit');
    if (canApprove) addBtn('btn btn-primary btn-sm', 'Valider', 'bc-approve');
    if (canReceive) addBtn('btn btn-primary btn-sm', 'Réceptionner', 'bc-receive');
    if (canCancel) addBtn('btn btn-danger btn-sm', 'Annuler', 'bc-cancel');
    if (canEdit) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-icon btn-secondary btn-sm';
      del.title = 'Supprimer';
      del.setAttribute('data-action', 'bc-delete');
      del.setAttribute('data-id', enc);
      del.textContent = '🗑';
      wrap.appendChild(del);
    }
    td6.appendChild(wrap);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    tr.appendChild(td6);
    tbody.appendChild(tr);
  });
}

function renderBCEditLines() {
  const tbody = document.getElementById('bc-lines-edit-tbody');
  if (!tbody) return;
  clearChildren(tbody);
  syncBCPurchaseUnitColumnHeader();

  if (!_bcDraftLines.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.cssText = 'text-align:center;padding:16px;color:var(--text2)';
    td.textContent = 'Ajoutez des articles depuis le stock (bouton ci-dessus).';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    _bcDraftLines.forEach((l, i) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-bc-line', String(i));
      const tdN = document.createElement('td');
      const nm = document.createElement('div');
      nm.style.fontWeight = '600';
      nm.textContent = l.name || '';
      tdN.appendChild(nm);
      if (l.barcode) {
        const bc = document.createElement('div');
        bc.style.cssText = 'font-size:11px;color:var(--text2);font-family:monospace';
        bc.textContent = l.barcode;
        tdN.appendChild(bc);
      }
      const tdQ = document.createElement('td');
      const inQ = document.createElement('input');
      inQ.type = 'number';
      inQ.min = '0.01';
      inQ.step = 'any';
      inQ.className = 'bc-inp-qty';
      inQ.dataset.i = String(i);
      inQ.value = String(l.qty);
      inQ.style.width = '88px';
      tdQ.appendChild(inQ);
      const tdP = document.createElement('td');
      const inP = document.createElement('input');
      inP.type = 'number';
      inP.min = '0';
      inP.step = 'any';
      inP.className = 'bc-inp-price';
      inP.dataset.i = String(i);
      const lineTva = Math.min(100, Math.max(0, parseInt(String(l.tva), 10) || 0));
      inP.value = bcFormatPuInput(l.unitPrice, lineTva);
      inP.style.width = '100px';
      tdP.appendChild(inP);
      const tdT = document.createElement('td');
      const inT = document.createElement('input');
      inT.type = 'number';
      inT.min = '0';
      inT.max = '100';
      inT.step = '1';
      inT.className = 'bc-inp-tva';
      inT.dataset.i = String(i);
      inT.value = String(l.tva);
      inT.style.width = '64px';
      tdT.appendChild(inT);
      const tdR = document.createElement('td');
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn btn-icon btn-secondary btn-sm';
      rm.setAttribute('data-action', 'bc-remove-line');
      rm.dataset.index = String(i);
      rm.title = 'Retirer';
      rm.textContent = '✕';
      tdR.appendChild(rm);
      tr.appendChild(tdN);
      tr.appendChild(tdQ);
      tr.appendChild(tdP);
      tr.appendChild(tdT);
      tr.appendChild(tdR);
      tbody.appendChild(tr);
    });
  }

  tbody.querySelectorAll('.bc-inp-qty').forEach(el => {
    el.addEventListener('change', () => {
      const i = +el.dataset.i;
      _bcDraftLines[i].qty = Math.max(0.01, parseFloat(el.value) || 0.01);
    });
  });
  tbody.querySelectorAll('.bc-inp-price').forEach(el => {
    const applyPu = () => {
      const i = +el.dataset.i;
      const line = _bcDraftLines[i];
      if (!line) return;
      const tva = Math.min(100, Math.max(0, parseInt(String(line.tva), 10) || 0));
      line.unitPrice = Math.max(0, bcParsePuInputToTtc(el.value, tva));
    };
    el.addEventListener('input', applyPu);
    el.addEventListener('change', applyPu);
  });
  tbody.querySelectorAll('.bc-inp-tva').forEach(el => {
    el.addEventListener('change', () => {
      const i = +el.dataset.i;
      _bcDraftLines[i].tva = Math.min(100, Math.max(0, parseInt(el.value, 10) || 0));
      renderBCEditLines();
    });
  });
}

function removeBCLine(i) {
  _bcDraftLines.splice(i, 1);
  renderBCEditLines();
}

function openNewBC() {
  _bcEditId = null;
  _bcDraftLines = [];
  document.getElementById('bc-modal-title').textContent = 'Nouveau bon de commande';
  // Montrer une référence prévisionnelle immédiatement (la vraie est allouée à l'enregistrement)
  document.getElementById('bc-ref-display').textContent = _bcPeekRef() + ' (prévision)';
  document.getElementById('bc-notes').value = '';
  populateBCFournSelect('');
  renderBCEditLines();
  openModal('modal-bon-commande');
  if (!(Array.isArray(DB.fournisseurs) && DB.fournisseurs.length)) {
    toast('Ajoutez d’abord un fournisseur pour créer un bon', 'err');
  }
  syncBCSaveState();
}

function openEditBC(id) {
  const bc = (DB.bonsCommande || []).find(x => String(x.id) === String(id));
  if (!bc || bc.status !== 'pending') {
    toast('Modification impossible pour ce statut', 'err');
    return;
  }
  _bcEditId = id;
  _bcDraftLines = (bc.lines || []).map(l => ({
    stockId: l.stockId || '',
    name: l.name || '',
    barcode: l.barcode || '',
    qty: Number(l.qty) || 1,
    unitPrice: Number(l.unitPrice) || 0,
    tva: Number(l.tva) || 20,
  }));
  document.getElementById('bc-modal-title').textContent = 'Modifier le bon de commande';
  document.getElementById('bc-ref-display').textContent = bc.ref || '—';
  document.getElementById('bc-notes').value = bc.notes || '';
  populateBCFournSelect(bc.fournisseurId || '');
  renderBCEditLines();
  openModal('modal-bon-commande');
  syncBCSaveState();
}

function openViewBC(id) {
  const bc = (DB.bonsCommande || []).find(x => String(x.id) === String(id));
  if (!bc) return;
  const st = BC_STATUS[bc.status] || BC_STATUS.pending;
  const lines = bc.lines || [];
  const totalTtc = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const puHead =
    typeof getGlobalPriceMode === 'function' && getGlobalPriceMode() === 'HT' ? 'PU achat (HT)' : 'PU achat (TTC)';
  const vb = document.getElementById('bc-view-body');
  if (vb) {
    clearChildren(vb);
    const head = document.createElement('div');
    head.style.marginBottom = '14px';
    const l1 = document.createElement('div');
    l1.style.cssText = 'font-size:13px;color:var(--text2)';
    l1.textContent = 'Référence';
    const ref = document.createElement('div');
    ref.style.cssText = 'font-weight:800;font-size:16px';
    ref.textContent = bc.ref || '';
    const bd = document.createElement('div');
    bd.style.marginTop = '8px';
    const bdg = document.createElement('span');
    bdg.className = `badge ${st.cls}`;
    bdg.textContent = st.label;
    bd.appendChild(bdg);
    const fr = document.createElement('div');
    fr.style.marginTop = '10px';
    fr.style.fontSize = '13px';
    fr.appendChild(document.createTextNode('Fournisseur : '));
    const fn = document.createElement('strong');
    fn.textContent = bc.fournisseurName || '—';
    fr.appendChild(fn);
    head.appendChild(l1);
    head.appendChild(ref);
    head.appendChild(bd);
    head.appendChild(fr);
    if (bc.notes) {
      const n = document.createElement('div');
      n.style.cssText = 'margin-top:8px;font-size:12px;color:var(--text2)';
      n.textContent = bc.notes;
      head.appendChild(n);
    }
    if (bc.receivedAt) {
      const r = document.createElement('div');
      r.style.cssText = 'margin-top:8px;font-size:12px;color:var(--teal)';
      r.textContent = `Réception : ${bc.receivedAt.slice(0, 10)}`;
      head.appendChild(r);
    }
    vb.appendChild(head);
    const tw = document.createElement('div');
    tw.className = 'tbl-wrap';
    const tbl = document.createElement('table');
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    ['Article', 'Qté', puHead, 'TVA', 'Total TTC'].forEach(t => {
      const th = document.createElement('th');
      th.textContent = t;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    tbl.appendChild(thead);
    const tb = document.createElement('tbody');
    lines.forEach(l => {
      const q = Number(l.qty) || 0;
      const p = Number(l.unitPrice) || 0;
      const ltva = Number(l.tva) || 20;
      const pShown =
        typeof displayTTCForGlobalMode === 'function' ? displayTTCForGlobalMode(p, ltva) : p;
      const tr = document.createElement('tr');
      const tdN = document.createElement('td');
      const nm = document.createElement('div');
      nm.style.fontWeight = '600';
      nm.textContent = l.name || '';
      tdN.appendChild(nm);
      if (l.stockId) {
        const lk = document.createElement('div');
        lk.style.cssText = 'font-size:10px;color:var(--text3)';
        lk.textContent = 'Lien stock ✓';
        tdN.appendChild(lk);
      }
      const tdQ = document.createElement('td');
      tdQ.textContent = String(q);
      const tdP = document.createElement('td');
      tdP.style.fontFamily = 'Arial,sans-serif';
      tdP.textContent = fmt(pShown);
      const tdT = document.createElement('td');
      tdT.textContent = `${l.tva ?? 20}%`;
      const tdTot = document.createElement('td');
      tdTot.style.cssText = 'font-family:Arial,sans-serif;font-weight:600';
      tdTot.textContent = fmt(q * p);
      tr.appendChild(tdN);
      tr.appendChild(tdQ);
      tr.appendChild(tdP);
      tr.appendChild(tdT);
      tr.appendChild(tdTot);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    tw.appendChild(tbl);
    vb.appendChild(tw);
    const tot = document.createElement('div');
    tot.style.cssText = 'margin-top:12px;font-weight:700';
    tot.textContent = `Total TTC : ${fmt(totalTtc)}`;
    vb.appendChild(tot);
  }
  openModal('modal-bc-view');
}

function saveBC() {
  const fournId = document.getElementById('bc-fournisseur')?.value || '';
  if (!fournId) {
    toast('Choisissez un fournisseur', 'err');
    return;
  }
  if (!_bcDraftLines.length) {
    toast('Ajoutez au moins un article depuis le stock', 'err');
    return;
  }
  const fourn = (DB.fournisseurs || []).find(f => String(f.id) === String(fournId));
  const notes = document.getElementById('bc-notes')?.value?.trim() || '';
  const now = new Date().toISOString();
  const lines = _bcDraftLines.map(l => ({
    stockId: l.stockId,
    name: l.name,
    barcode: l.barcode || '',
    qty: Number(l.qty) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    tva: Number(l.tva) || 20,
  }));

  if (!DB.bonsCommande) DB.bonsCommande = [];

  if (_bcEditId) {
    const idx = DB.bonsCommande.findIndex(x => String(x.id) === String(_bcEditId));
    if (idx < 0) return;
    DB.bonsCommande[idx] = {
      ...DB.bonsCommande[idx],
      fournisseurId: fournId,
      fournisseurName: fourn?.name || '',
      notes,
      lines,
      updatedAt: now,
    };
    save('bonsCommande');
    toast('Bon de commande enregistré ✓', 'suc');
  } else {
    const bc = {
      id: 'bc_' + Date.now(),
      ref: _bcAllocRef(),
      fournisseurId: fournId,
      fournisseurName: fourn?.name || '',
      status: 'pending',
      notes,
      lines,
      createdAt: now,
      updatedAt: now,
      receivedAt: null,
    };
    DB.bonsCommande.unshift(bc);
    save('bonsCommande');
    toast('Bon de commande créé ✓', 'suc');
  }
  closeModal('modal-bon-commande');
  renderBonsCommande();
}

function approveBC(id) {
  const bc = (DB.bonsCommande || []).find(x => String(x.id) === String(id));
  if (!bc || bc.status !== 'pending') return;
  bc.status = 'approved';
  bc.updatedAt = new Date().toISOString();
  save('bonsCommande');
  renderBonsCommande();
  toast('Bon validé', 'suc');
}

async function receiveBC(id) {
  const bc = (DB.bonsCommande || []).find(x => String(x.id) === String(id));
  if (!bc || (bc.status !== 'pending' && bc.status !== 'approved')) return;
  const ok = await showConfirm({
    title: 'Réceptionner la commande ?',
    message:
      'Les quantités seront <strong>ajoutées au stock</strong> pour chaque article lié. Les prix d’achat seront mis à jour si renseignés.<br><br>Confirmer la réception ?',
    icon: '📦',
    okLabel: 'Réceptionner',
    okStyle: 'primary',
  });
  if (!ok) return;

  const lines = bc.lines || [];
  for (const l of lines) {
    const q = Number(l.qty) || 0;
    if (q <= 0) continue;
    if (l.stockId) {
      const art = DB.stock.find(x => String(x.id) === String(l.stockId));
      if (art) {
        art.qty = (Number(art.qty) || 0) + q;
        const pu = Number(l.unitPrice);
        if (pu > 0) art.buy = pu;
        if (bc.fournisseurId) {
          art.fournisseurId = bc.fournisseurId;
          art.fournisseurName = bc.fournisseurName || art.fournisseurName || '';
        }
        art.updatedAt = new Date().toISOString();
      }
    }
  }
  bc.status = 'received';
  bc.receivedAt = new Date().toISOString();
  bc.updatedAt = bc.receivedAt;
  save('stock');
  save('bonsCommande');
  renderBonsCommande();
  if (document.getElementById('page-stock')?.classList.contains('active')) renderStock();
  toast('Stock mis à jour — commande réceptionnée ✓', 'suc');
}

async function cancelBC(id) {
  const bc = (DB.bonsCommande || []).find(x => String(x.id) === String(id));
  if (!bc || (bc.status !== 'pending' && bc.status !== 'approved')) return;
  const ok = await showConfirm({
    title: 'Annuler ce bon ?',
    message: 'Le bon passera au statut <strong>Annulé</strong>.',
    icon: '⚠️',
    okLabel: 'Annuler le bon',
    okStyle: 'danger',
  });
  if (!ok) return;
  bc.status = 'cancelled';
  bc.updatedAt = new Date().toISOString();
  save('bonsCommande');
  renderBonsCommande();
  toast('Bon annulé', 'suc');
}

async function deleteBC(id) {
  const bc = (DB.bonsCommande || []).find(x => String(x.id) === String(id));
  if (!bc || bc.status !== 'pending') return;
  const ok = await showConfirm({
    title: 'Supprimer ce bon ?',
    message: 'Cette action est définitive.',
    icon: '🗑',
    okLabel: 'Supprimer',
    okStyle: 'danger',
  });
  if (!ok) return;
  if (typeof invooSupabaseSoftDelete === 'function') invooSupabaseSoftDelete('bonsCommande', id);
  DB.bonsCommande = DB.bonsCommande.filter(x => String(x.id) !== String(id));
  save('bonsCommande');
  renderBonsCommande();
  toast('Bon supprimé', 'suc');
}

function openBCPicker() {
  const fournId = document.getElementById('bc-fournisseur')?.value || '';
  if (!fournId) {
    toast('Choisissez d’abord un fournisseur', 'err');
    return;
  }
  const inp = document.getElementById('bc-picker-search');
  if (inp) inp.value = '';
  renderBCPicker();
  openModal('modal-bc-stock-picker');
}

function renderBCPicker() {
  syncBCPickerPurchaseColumnHeader();
  const search =
    (document.getElementById('bc-picker-search') || {}).value?.toLowerCase().trim() || '';
  const fournId = document.getElementById('bc-fournisseur')?.value || '';
  const tbody = document.getElementById('bc-picker-tbody');
  if (!tbody) return;

  let items = DB.stock.filter(a => {
    if (fournId && a.fournisseurId && String(a.fournisseurId) !== String(fournId)) return false;
    if (
      !search ||
      (a.name || '').toLowerCase().includes(search) ||
      (a.barcode || '').toLowerCase().includes(search) ||
      (a.category || '').toLowerCase().includes(search)
    )
      return true;
    return false;
  });

  if (!items.length && fournId) {
    items = DB.stock.filter(a => {
      if (
        !search ||
        (a.name || '').toLowerCase().includes(search) ||
        (a.barcode || '').toLowerCase().includes(search) ||
        (a.category || '').toLowerCase().includes(search)
      )
        return true;
      return false;
    });
  }

  clearChildren(tbody);
  const markPick = 'background:rgba(26,107,60,.15);color:var(--brand);border-radius:2px';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.cssText = 'text-align:center;padding:20px;color:var(--text2)';
    td.textContent =
      'Aucun article. Créez des articles dans le stock ou élargissez le fournisseur.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach(a => {
    const low = (a.qty || 0) < 5;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const dName = document.createElement('div');
    dName.style.fontWeight = '600';
    appendHighlightedContent(dName, a.name || '', search, markPick);
    td1.appendChild(dName);
    if (a.barcode) {
      const dBc = document.createElement('div');
      dBc.style.cssText = 'font-size:11px;color:var(--text2);font-family:monospace';
      appendHighlightedContent(dBc, a.barcode, search, markPick);
      td1.appendChild(dBc);
    }
    const td2 = document.createElement('td');
    td2.textContent = a.category || '—';
    const td3 = document.createElement('td');
    const sp = document.createElement('span');
    sp.style.fontWeight = '700';
    sp.style.color = low ? 'var(--accent)' : 'var(--text)';
    sp.textContent = String(a.qty || 0);
    td3.appendChild(sp);
    const td4 = document.createElement('td');
    td4.style.fontFamily = 'Arial,sans-serif';
    const btva = Number.isFinite(Number(a.tva)) ? Number(a.tva) : 20;
    const buyShown =
      typeof displayTTCForGlobalMode === 'function'
        ? displayTTCForGlobalMode(a.buy || 0, btva)
        : a.buy || 0;
    td4.textContent = fmt(buyShown);
    const td5 = document.createElement('td');
    td5.textContent = `${Number.isFinite(Number(a.tva)) ? Number(a.tva) : 20}%`;
    const td6 = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-primary';
    btn.setAttribute('data-action', 'bc-pick-stock');
    btn.setAttribute('data-id', encodeURIComponent(String(a.id || '')));
    btn.textContent = 'Ajouter';
    td6.appendChild(btn);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    tr.appendChild(td6);
    tbody.appendChild(tr);
  });
}

function bcPickStock(id) {
  const a = DB.stock.find(x => String(x.id) === String(id));
  if (!a) return;
  const existing = _bcDraftLines.find(l => String(l.stockId) === String(id));
  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + 1;
    renderBCEditLines();
    toast(`${a.name} × ${existing.qty}`, 'suc');
  } else {
    _bcDraftLines.push({
      stockId: a.id,
      name: a.name || '',
      barcode: a.barcode || '',
      qty: 1,
      unitPrice: Number(a.buy) || 0,
      tva: Number(a.tva) || 20,
    });
    renderBCEditLines();
    toast(`${a.name} ajouté ✓`, 'suc');
  }
  renderBCPicker();
  closeModal('modal-bc-stock-picker');
}
