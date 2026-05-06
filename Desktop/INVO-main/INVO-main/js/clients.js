// js/clients.js — Clients, ICE/RIB

/** ICE correct si exactement 15 chiffres (espaces / séparateurs ignorés). Sinon invalide. */
function validateICE(ice) {
  const digits = String(ice || '').replace(/\D/g, '');
  return digits.length === 15;
}

/** RIB marocain : 24 chiffres — nettoyage des non-chiffres, max 24. */
function validateRIBInput(input) {
  if (!input) return;
  const v = String(input.value || '')
    .replace(/\D/g, '')
    .slice(0, 24);
  input.value = v;
  input.classList.remove('ice-valid', 'ice-warn', 'ice-invalid');
  if (!v) return;
  if (v.length === 24) input.classList.add('ice-valid');
  else input.classList.add('ice-warn');
}

function renderClients() {
  const search = (document.getElementById('client-search') || {}).value || '';
  const cityFilter = (document.getElementById('client-city-filter') || {}).value || '';
  const iceFilter = (document.getElementById('client-ice-filter') || {}).value || '';
  const clients = DB.clients.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      const nm = (c.name || '').toLowerCase();
      if (
        !nm.includes(q) &&
        !(c.email || '').toLowerCase().includes(q) &&
        !(c.phone || '').includes(search)
      )
        return false;
    }
    if (cityFilter && c.city !== cityFilter) return false;
    if (iceFilter === 'with' && !c.ice) return false;
    if (iceFilter === 'without' && c.ice) return false;
    return true;
  });
  const cities = [...new Set(DB.clients.map(c => c.city).filter(Boolean))].sort();
  const citySel = document.getElementById('client-city-filter');
  if (citySel) {
    const cur = citySel.value;
    clearChildren(citySel);
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Toutes les villes';
    citySel.appendChild(ph);
    cities.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      if (v === cur) o.selected = true;
      citySel.appendChild(o);
    });
    if (typeof refreshThemedSelect === 'function') refreshThemedSelect('client-city-filter');
  }
  const setEl = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  const totalCA = DB.docs.filter(d => d.status === 'Payé').reduce((s, d) => s + (d.ttc || 0), 0);
  const withIce = DB.clients.filter(c => c.ice && c.ice.trim()).length;
  setEl('cli-kpi-count', DB.clients.length);
  setEl('cli-kpi-ca', fmt(totalCA));
  setEl('cli-kpi-ice', withIce + ' / ' + DB.clients.length);
  const tbody = document.getElementById('clients-tbody');
  const empty = document.getElementById('clients-empty');
  if (!tbody) return;
  const numZ =
    "font-family:Arial, sans-serif;font-variant-numeric:normal;font-feature-settings:'zero' 0";
  if (!clients.length) {
    clearChildren(tbody);
    if (empty) empty.style.display = 'block';
    const mobClr = document.getElementById('mob-clients-list');
    if (mobClr) clearChildren(mobClr);
    const pagEmpty = document.getElementById('clients-list-pagination');
    if (pagEmpty) {
      clearChildren(pagEmpty);
      pagEmpty.style.display = 'none';
    }
    return;
  }
  if (empty) empty.style.display = 'none';
  const filterKey = [search, cityFilter, iceFilter].join('\t');
  const pageSize = typeof LIST_PAGE_SIZE === 'number' ? LIST_PAGE_SIZE : 50;
  const pg = getListPageSlice('clients', filterKey, clients, pageSize);
  const pageRows = pg.rows;
  clearChildren(tbody);
  pageRows.forEach(c => {
    const enc = encodeURIComponent(String(c.id || ''));
    const cliDocs = DB.docs.filter(d => String(d.clientId || '') === String(c.id || ''));
    const cliCA = cliDocs.filter(d => d.status === 'Payé').reduce((s, d) => s + (d.ttc || 0), 0);
    const nbInvoices = cliDocs.filter(d => d.type === 'F').length;
    const isPro = c.type === 'professionnel';
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    const n = document.createElement('div');
    n.style.fontWeight = '600';
    n.textContent = c.name || '';
    td0.appendChild(n);
    if (c.rc) {
      const r = document.createElement('div');
      r.style.cssText = 'font-size:11px;color:var(--text2)';
      r.textContent = 'RC: ' + c.rc;
      td0.appendChild(r);
    }
    const td1 = document.createElement('td');
    if (c.ice) {
      const dv = document.createElement('div');
      dv.style.cssText =
        "font-family:Arial, sans-serif;font-size:12px;font-variant-numeric:normal;font-feature-settings:'zero' 0";
      dv.textContent = c.ice;
      const sp = document.createElement('span');
      sp.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700';
      if (validateICE(c.ice)) {
        sp.style.background = 'rgba(9,188,138,.15)';
        sp.style.color = 'var(--brand)';
        sp.textContent = 'ICE correct';
      } else {
        sp.style.background = 'rgba(240,165,0,.12)';
        sp.style.color = 'var(--gold,#F0A500)';
        sp.textContent = 'ICE invalide';
      }
      td1.appendChild(dv);
      td1.appendChild(sp);
    } else if (isPro) {
      const s1 = document.createElement('span');
      s1.style.cssText = 'color:var(--text3);font-size:12px';
      s1.textContent = 'Non renseigné';
      td1.appendChild(s1);
      td1.appendChild(document.createElement('br'));
      const s2 = document.createElement('span');
      s2.style.cssText =
        'font-size:10px;background:rgba(239,68,68,.12);color:var(--danger);padding:2px 6px;border-radius:4px;font-weight:700';
      s2.textContent = '⚠ Manquant';
      td1.appendChild(s2);
    } else {
      const s = document.createElement('span');
      s.style.cssText = 'color:var(--text3);font-size:12px';
      s.textContent = 'Particulier';
      td1.appendChild(s);
    }
    if (c.if) {
      const ife = document.createElement('div');
      ife.style.cssText = 'font-size:11px;color:var(--text2);margin-top:2px';
      ife.textContent = 'IF: ' + c.if;
      td1.appendChild(ife);
    }
    const td2 = document.createElement('td');
    if (c.email) {
      const e = document.createElement('div');
      e.textContent = c.email;
      td2.appendChild(e);
    }
    if (c.phone) {
      const p = document.createElement('div');
      p.style.color = 'var(--text2)';
      p.textContent = c.phone;
      td2.appendChild(p);
    }
    const td3 = document.createElement('td');
    td3.textContent = c.city || '-';
    const td4 = document.createElement('td');
    const nbi = document.createElement('span');
    nbi.style.cssText = `${numZ};font-weight:700`;
    nbi.textContent = String(nbInvoices);
    const fa = document.createElement('span');
    fa.style.cssText = 'font-size:11px;color:var(--text2)';
    fa.textContent = ' fact.';
    td4.appendChild(nbi);
    td4.appendChild(fa);
    const td5 = document.createElement('td');
    td5.style.cssText = `font-family:Arial, sans-serif;color:var(--brand);font-weight:600;${numZ}`;
    if (cliCA > 0) td5.textContent = fmt(cliCA);
    else {
      const em = document.createElement('span');
      em.style.cssText = 'color:var(--text3);font-size:12px;font-family:inherit';
      em.textContent = '—';
      td5.appendChild(em);
    }
    const td6 = document.createElement('td');
    const aw = document.createElement('div');
    aw.style.cssText = 'display:flex;gap:4px';
    [
      ['btn btn-icon btn-secondary btn-sm', 'Modifier', '✏️', 'edit-client'],
      ['btn btn-icon btn-secondary btn-sm', 'Nouvelle facture', '📄', 'new-doc-client'],
      ['btn btn-icon btn-danger btn-sm', 'Supprimer', '🗑', 'delete-client'],
    ].forEach(([cl, tit, tx, ac]) => {
      const b = document.createElement('button');
      b.className = cl;
      b.title = tit;
      b.textContent = tx;
      b.setAttribute('data-action', ac);
      b.setAttribute('data-id', enc);
      aw.appendChild(b);
    });
    td6.appendChild(aw);
    tr.appendChild(td0);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    tr.appendChild(td6);
    tbody.appendChild(tr);
  });
  let mobList = document.getElementById('mob-clients-list');
  const clientsPageEl = document.getElementById('page-clients');
  const tw = clientsPageEl?.querySelector('.tbl-wrap');
  if (!mobList && tw) {
    mobList = document.createElement('div');
    mobList.id = 'mob-clients-list';
    mobList.className = 'mob-card-list';
    tw.after(mobList);
  }
  if (mobList) {
    clearChildren(mobList);
    pageRows.forEach(c => {
      const enc = encodeURIComponent(String(c.id || ''));
      const cliDocs = DB.docs.filter(d => String(d.clientId || '') === String(c.id || ''));
      const cliCA = cliDocs.filter(d => d.status === 'Payé').reduce((s, d) => s + (d.ttc || 0), 0);
      const nbInvoices = cliDocs.filter(d => d.type === 'F').length;
      const isPro = c.type === 'professionnel';
      const hasIce = c.ice && validateICE(c.ice);
      const iceBadgeLabel = hasIce ? '✓ ICE' : isPro ? '⚠ Sans ICE' : '✓ Particulier';
      const card = document.createElement('div');
      card.className = 'mob-card';
      const hdr = document.createElement('div');
      hdr.className = 'mob-card-header';
      const ttl = document.createElement('div');
      ttl.className = 'mob-card-title';
      ttl.textContent = c.name || '';
      const bd = document.createElement('span');
      bd.className = 'badge ' + (hasIce ? 'paid' : isPro ? 'cancelled' : 'paid');
      bd.textContent = iceBadgeLabel;
      hdr.appendChild(ttl);
      hdr.appendChild(bd);
      card.appendChild(hdr);
      const row = (lab, val) => {
        const r = document.createElement('div');
        r.className = 'mob-card-row';
        const l = document.createElement('span');
        l.className = 'mob-card-label';
        l.textContent = lab;
        const v = document.createElement('span');
        v.className = 'mob-card-val';
        if (typeof val === 'string') v.textContent = val;
        else v.appendChild(val);
        r.appendChild(l);
        r.appendChild(v);
        card.appendChild(r);
      };
      if (c.ice) row('ICE', c.ice);
      if (c.if) row('IF', c.if);
      if (c.phone) row('Téléphone', c.phone);
      if (c.email) row('Email', c.email);
      if (c.city) row('Ville', c.city);
      row('Factures', `${nbInvoices} fact.`);
      const caSp = document.createElement('span');
      caSp.style.color = 'var(--teal)';
      caSp.textContent = cliCA > 0 ? fmt(cliCA) : '—';
      row('CA TTC', caSp);
      const act = document.createElement('div');
      act.className = 'mob-card-actions';
      [
        ['btn btn-secondary btn-sm', '✏️ Modifier', 'edit-client'],
        ['btn btn-secondary btn-sm', '📄 Facture', 'new-doc-client'],
        ['btn btn-danger btn-sm', '🗑', 'delete-client'],
      ].forEach(([cl, tx, ac]) => {
        const b = document.createElement('button');
        b.className = cl;
        b.textContent = tx;
        b.setAttribute('data-action', ac);
        b.setAttribute('data-id', enc);
        act.appendChild(b);
      });
      card.appendChild(act);
      mobList.appendChild(card);
    });
  }
  updateListPaginationUI(
    'clients-list-pagination',
    'clients',
    pg.total,
    pg.page,
    pg.totalPages,
    pageSize,
    renderClients,
  );
}
function openAddClient() {
  APP.editClientId = null;
  document.getElementById('client-modal-title').textContent = 'Nouveau Client';
  [
    'c-name',
    'c-ice',
    'c-if',
    'c-rc',
    'c-email',
    'c-phone',
    'c-address',
    'c-city',
    'c-notes',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  selectNewClientType('particulier');
  openModal('modal-client');
  setTimeout(() => document.getElementById('c-name')?.focus(), 120);
}
function editClient(id) {
  const c = DB.clients.find(x => String(x.id) === String(id));
  if (!c) return;
  APP.editClientId = id;
  document.getElementById('client-modal-title').textContent = 'Modifier';
  document.getElementById('c-name').value = c.name || '';
  const iceEl = document.getElementById('c-ice');
  if (iceEl) iceEl.value = c.ice || '';
  const ifEl = document.getElementById('c-if');
  if (ifEl) ifEl.value = c.if || '';
  const rcEl = document.getElementById('c-rc');
  if (rcEl) rcEl.value = c.rc || '';
  document.getElementById('c-email').value = c.email || '';
  document.getElementById('c-phone').value = c.phone || '';
  const addrEl = document.getElementById('c-address');
  if (addrEl) addrEl.value = c.address || '';
  document.getElementById('c-city').value = c.city || '';
  document.getElementById('c-notes').value = c.notes || '';
  selectNewClientType(c.type || 'particulier');
  openModal('modal-client');
}
async function saveClient() {
  const name = document.getElementById('c-name').value.trim();
  if (!name) {
    toast('Nom obligatoire', 'err');
    return;
  }
  const ice = document.getElementById('c-ice').value.trim();
  if (ice && !validateICE(ice)) {
    const go = await showConfirm({
      title: 'ICE invalide',
      message: `L'ICE pour ${name} doit comporter exactement 15 chiffres.\n\nContinuer quand même ?`,
      icon: '⚠️',
      okLabel: 'Continuer quand même',
      okStyle: 'danger',
    });
    if (!go) {
      document.getElementById('c-ice')?.focus();
      return;
    }
  }
  const isPro = APP.newClientType === 'professionnel';
  const now = new Date().toISOString();
  let createdAt = now;
  if (APP.editClientId) {
    const prev = DB.clients.find(x => String(x.id) === String(APP.editClientId));
    if (prev?.createdAt) createdAt = prev.createdAt;
  }
  const client = {
    id: APP.editClientId || 'cli_' + Date.now(),
    name,
    type: APP.newClientType || 'particulier',
    ice: isPro ? ice : '',
    if: isPro ? document.getElementById('c-if')?.value.trim() || '' : '',
    rc: isPro ? document.getElementById('c-rc')?.value.trim() || '' : '',
    address: isPro ? document.getElementById('c-address')?.value.trim() || '' : '',
    email: document.getElementById('c-email').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    city: document.getElementById('c-city').value.trim(),
    notes: document.getElementById('c-notes').value.trim(),
    createdAt,
    updatedAt: now,
  };
  if (APP.editClientId) {
    const idx = DB.clients.findIndex(x => String(x.id) === String(APP.editClientId));
    if (idx >= 0) DB.clients[idx] = client;
  } else {
    DB.clients.push(client);
  }
  save('clients');
  closeModal('modal-client');
  renderClients();
  populateDocClient();
  if (!APP.editClientId) {
    const sel = document.getElementById('doc-client');
    if (sel) {
      sel.value = client.id;
      onClientChange();
    }
  }
  toast(APP.editClientId ? 'Client mis à jour ✓' : 'Client ajouté ✓', 'suc');
}
async function deleteClient(id) {
  const ok = await showConfirm({
    title: 'Supprimer ce client ?',
    message:
      'Cette action est <strong>irréversible</strong>. Les documents existants ne seront pas affectés.',
    icon: '🗑️',
    okLabel: 'Supprimer',
    okStyle: 'danger',
  });
  if (!ok) return;
  if (typeof invooSupabaseSoftDelete === 'function') invooSupabaseSoftDelete('clients', id);
  DB.clients = DB.clients.filter(c => String(c.id) !== String(id));
  save('clients');
  renderClients();
  toast('Client supprimé', 'suc');
}
function newDocForClient(id) {
  nav('generate', sbItem('generate'));
  setTimeout(() => {
    populateDocClient();
    const sel = document.getElementById('doc-client');
    if (sel) sel.value = String(id);
    onClientChange();
  }, 100);
}
function exportClients() {
  if (!DB.clients.length) {
    toast('Aucun client à exporter', 'err');
    return;
  }

  const headers = [
    'Raison Sociale',
    'Type',
    'ICE',
    'IF',
    'RC',
    'TP',
    'Email',
    'Téléphone',
    'Ville',
    'Adresse',
    'Nb Factures',
    'CA Total TTC',
  ];

  const rows = DB.clients.map(c => {
    const clientDocs = DB.docs.filter(
      d => String(d.clientId || '') === String(c.id || '') && d.type === 'F' && d.status === 'Payé',
    );
    const ca = clientDocs.reduce((s, d) => s + (d.ttc || 0), 0);
    return [
      c.name || '',
      c.type || 'particulier',
      c.ice || '',
      c.if || '',
      c.rc || '',
      c.tp || '',
      c.email || '',
      c.phone || '',
      c.city || '',
      c.address || '',
      clientDocs.length,
      ca,
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 26 },
    { wch: 16 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
  ];

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { fgColor: { rgb: '1A3C5E' }, patternType: 'solid' },
    alignment: { horizontal: 'center' },
  };
  const numStyle = { numFmt: '#,##0.00', alignment: { horizontal: 'right' } };
  const ctrStyle = { alignment: { horizontal: 'center' } };
  const evenFill = { fill: { fgColor: { rgb: 'F8F9FA' }, patternType: 'solid' } };
  const iceOk = { font: { color: { rgb: '27AE60' } } };
  const iceMiss = { font: { color: { rgb: 'C0392B' } } };

  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = headerStyle;
  }

  for (let r = 1; r <= range.e.r; r++) {
    const isEven = r % 2 === 0;
    const hasICE = validateICE(rows[r - 1][2] || '');
    const base = isEven ? evenFill : {};

    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      if (c === 2) ws[addr].s = { ...(hasICE ? iceOk : iceMiss), ...base };
      else if (c === 11) ws[addr].s = { ...numStyle, ...base };
      else if (c === 10) ws[addr].s = { ...ctrStyle, ...base };
      else ws[addr].s = base;
    }
  }

  wb.Props = { Title: 'Clients INVO', Author: DB.settings.name || 'INVO', CreatedDate: new Date() };
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  XLSX.writeFile(wb, `clients_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast(`✅ Export Clients Excel — ${DB.clients.length} client(s)`, 'suc');
}

function appendNote(text) {
  const el = document.getElementById('doc-notes');
  if (!el) return;
  el.value = (el.value ? el.value + '\n' : '') + text;
  toast('Mention ajoutée', 'suc');
}

// ── Nouveau client modal ──
// ═══════════════════════════════════════════
function openNewClientModal() {
  [
    'ncq-name',
    'ncq-phone',
    'ncq-email',
    'ncq-city',
    'ncq-ice',
    'ncq-if',
    'ncq-rc',
    'ncq-address',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
      el.classList.remove('ice-valid', 'ice-warn', 'ice-invalid');
    }
  });
  selectNewClientType('particulier');
  openModal('modal-new-client-quick');
  setTimeout(() => document.getElementById('ncq-name')?.focus(), 120);
}
function selectNewClientType(type) {
  APP.newClientType = type;
  const isPro = type === 'professionnel';

  // ── Helpers ──
  const setCard = (activeId, inactiveId) => {
    const a = document.getElementById(activeId),
      i = document.getElementById(inactiveId);
    if (a) {
      a.style.border = '2px solid var(--brand)';
      a.style.background = 'var(--brand-light)';
      const l = a.querySelector('div:nth-child(2)');
      if (l) l.style.color = 'var(--brand)';
    }
    if (i) {
      i.style.border = '2px solid var(--border)';
      i.style.background = 'var(--surface2)';
      const l = i.querySelector('div:nth-child(2)');
      if (l) l.style.color = 'var(--text)';
    }
  };

  // ── Modal Nouveau Client Rapide (Générer Doc) ──
  if (isPro) setCard('ncq-card-pro', 'ncq-card-part');
  else setCard('ncq-card-part', 'ncq-card-pro');
  const pf = document.getElementById('ncq-pro-fields');
  const nl = document.getElementById('ncq-name-label');
  const ncqName = document.getElementById('ncq-name');
  if (pf) pf.style.display = isPro ? 'block' : 'none';
  if (nl) nl.textContent = isPro ? 'Raison sociale *' : 'Nom complet *';
  if (ncqName) ncqName.placeholder = isPro ? 'Société SARL' : 'Prénom Nom';

  // ── Modal Client (section Clients) ──
  if (isPro) setCard('c-card-pro', 'c-card-part');
  else setCard('c-card-part', 'c-card-pro');
  const cpf = document.getElementById('c-pro-fields');
  const cnl = document.getElementById('c-name-label');
  const cName = document.getElementById('c-name');
  if (cpf) cpf.style.display = isPro ? 'block' : 'none';
  if (cnl) cnl.textContent = isPro ? 'Raison sociale *' : 'Nom complet *';
  if (cName) cName.placeholder = isPro ? 'Société SARL' : 'Prénom Nom';
}
async function saveNewClientQuick() {
  const name = (document.getElementById('ncq-name').value || '').trim();
  if (!name) {
    toast('Le nom est obligatoire', 'err');
    document.getElementById('ncq-name').focus();
    return;
  }
  const isPro = APP.newClientType === 'professionnel';
  const ice = isPro ? (document.getElementById('ncq-ice').value || '').trim() : '';
  if (isPro && ice && !validateICE(ice)) {
    const go = await showConfirm({
      title: 'ICE invalide',
      message: `L'ICE pour ${name} doit comporter exactement 15 chiffres.\n\nContinuer quand même ?`,
      icon: '⚠️',
      okLabel: 'Continuer',
      okStyle: 'danger',
    });
    if (!go) {
      document.getElementById('ncq-ice')?.focus();
      return;
    }
  }
  const client = {
    id: 'cli_' + Date.now(),
    name,
    type: APP.newClientType,
    phone: (document.getElementById('ncq-phone').value || '').trim(),
    email: (document.getElementById('ncq-email').value || '').trim(),
    city: (document.getElementById('ncq-city').value || '').trim(),
    ice,
    if: isPro ? (document.getElementById('ncq-if').value || '').trim() : '',
    rc: isPro ? (document.getElementById('ncq-rc').value || '').trim() : '',
    address: isPro ? (document.getElementById('ncq-address').value || '').trim() : '',
    notes: '',
  };
  DB.clients.push(client);
  save('clients');
  populateDocClient();
  const sel = document.getElementById('doc-client');
  if (sel) {
    sel.value = client.id;
    onClientChange();
  }
  renderClients();
  closeModal('modal-new-client-quick');
  toast(`${isPro ? '🏢' : '👤'} ${name} ajouté et sélectionné ✓`, 'suc');
}
