// ═══════════════════════════════════════════
//  fournisseurs.js  —  CRUD Fournisseurs
//  Rendu, ajout, modification, suppression,
//  import / export CSV, filtres
// ═══════════════════════════════════════════

let _editFournId = null;
let _importFournData = [];

// ════════════════════════════════════════
//  RENDU PRINCIPAL
// ════════════════════════════════════════

function renderFournisseurs() {
  const search = (document.getElementById('fourn-search')?.value || '').toLowerCase();
  const catFilter = document.getElementById('fourn-cat-filter')?.value || '';
  const scoreFilter = document.getElementById('fourn-score-filter')?.value || '';

  // ── Filtrer ──
  let list = (DB.fournisseurs || []).filter(f => {
    const matchSearch =
      !search ||
      (f.name || '').toLowerCase().includes(search) ||
      (f.category || '').toLowerCase().includes(search) ||
      (f.city || '').toLowerCase().includes(search);
    const matchCat = !catFilter || f.category === catFilter;
    const matchScore = !scoreFilter || f.score === scoreFilter;
    return matchSearch && matchCat && matchScore;
  });

  // ── KPIs ──
  const all = DB.fournisseurs || [];
  const _fk = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  _fk('fourn-kpi-count', String(all.length));
  _fk('fourn-kpi-a', String(all.filter(f => f.score === 'A').length));
  _fk('fourn-kpi-b', String(all.filter(f => f.score === 'B').length));
  _fk('fourn-kpi-c', String(all.filter(f => f.score === 'C').length));

  // ── Mettre à jour le filtre catégories ──
  const cats = [...new Set(all.map(f => f.category).filter(Boolean))].sort();
  const catSel = document.getElementById('fourn-cat-filter');
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
    if (typeof refreshThemedSelect === 'function') refreshThemedSelect('fourn-cat-filter');
  }

  const grid = document.getElementById('fourn-grid');
  const empty = document.getElementById('fourn-empty');
  if (!list.length) {
    if (grid) clearChildren(grid);
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (!grid) return;

  const scoreLabel = { A: 'Fiable', B: 'Correct', C: 'À surveiller' };
  const scoreIcon = { A: '🟢', B: '🔵', C: '🟠' };

  clearChildren(grid);
  list.forEach(f => {
    const score = f.score === 'A' || f.score === 'B' || f.score === 'C' ? f.score : 'B';
    const initials = (f.name || '?')
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const iceDigits = (f.ice || '').replace(/\D/g, '');
    const iceOk = validateICE(f.ice);

    const iceWrap = document.createElement('div');
    if (!iceDigits.length) {
      const sp = document.createElement('span');
      sp.className = 'client-ice-pill miss';
      sp.textContent = '⚠ Sans ICE';
      iceWrap.appendChild(sp);
    } else if (iceOk) {
      const sp = document.createElement('span');
      sp.className = 'client-ice-pill ok';
      sp.textContent = 'ICE correct';
      iceWrap.appendChild(sp);
    } else {
      const sp = document.createElement('span');
      sp.className = 'client-ice-pill miss';
      sp.title = 'L\u2019ICE doit comporter exactement 15 chiffres.';
      sp.textContent = 'ICE invalide';
      iceWrap.appendChild(sp);
    }

    const detailsCol = h('div', {
      style:
        'display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--text2);margin-bottom:12px',
    });
    if (f.email) detailsCol.appendChild(h('div', null, `✉️ ${f.email}`));
    if (f.phone) detailsCol.appendChild(h('div', null, `📞 ${f.phone}`));
    if (f.city) detailsCol.appendChild(h('div', null, `📍 ${f.city}`));
    detailsCol.appendChild(iceWrap);
    if (f.notes) {
      detailsCol.appendChild(
        h(
          'div',
          {
            style:
              'font-style:italic;color:var(--text3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
            title: f.notes,
          },
          `💬 ${f.notes}`,
        ),
      );
    }

    const scoreBadge = h(
      'span',
      { className: `fourn-score ${score}` },
      `${scoreIcon[score] || '🔵'} ${scoreLabel[score] || 'Correct'}`,
    );
    const head = h(
      'div',
      { style: 'display:flex;align-items:flex-start;gap:12px;margin-bottom:10px' },
      h('div', { className: 'fourn-avatar' }, initials),
      h(
        'div',
        { style: 'flex:1;min-width:0' },
        h(
          'div',
          {
            style:
              'font-weight:700;font-size:14px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
          },
          f.name || '',
        ),
        h('div', { style: 'font-size:11px;color:var(--text2);margin-top:2px' }, f.category || '—'),
      ),
      scoreBadge,
    );

    const fid = encodeURIComponent(String(f.id || ''));
    const actions = h(
      'div',
      { style: 'display:flex;gap:8px' },
      h(
        'button',
        {
          className: 'btn btn-secondary btn-sm',
          style: 'flex:1;justify-content:center',
          'data-action': 'edit-fourn',
          'data-id': fid,
        },
        '✏️ Modifier',
      ),
      h(
        'button',
        { className: 'btn btn-danger btn-sm', 'data-action': 'delete-fourn', 'data-id': fid },
        '🗑',
      ),
    );

    const card = h(
      'div',
      { className: 'fourn-card', 'data-id': String(f.id || '') },
      head,
      detailsCol,
      actions,
    );
    grid.appendChild(card);
  });
}

// ════════════════════════════════════════
//  SÉLECTEUR SCORE VISUEL (cartes A/B/C)
// ════════════════════════════════════════
function selectFournScore(score) {
  const sel = document.getElementById('f-score');
  if (sel) sel.value = score;
  document.querySelectorAll('.fourn-score-card').forEach(card => {
    const isActive = card.dataset.score === score;
    const colors = { A: 'var(--brand)', B: '#3B82F6', C: '#F0A500' };
    const bgs = { A: 'rgba(9,188,138,.08)', B: 'rgba(59,130,246,.08)', C: 'rgba(240,165,0,.08)' };
    if (isActive) {
      card.style.border = `2px solid ${colors[score] || 'var(--brand)'}`;
      card.style.background = bgs[score] || 'var(--brand-light)';
      const lbl = card.querySelector('div:nth-child(2)');
      if (lbl) lbl.style.color = colors[score] || 'var(--brand)';
    } else {
      card.style.border = '2px solid var(--border)';
      card.style.background = 'var(--surface2)';
      const lbl = card.querySelector('div:nth-child(2)');
      if (lbl) lbl.style.color = 'var(--text)';
    }
  });
}

// ════════════════════════════════════════
//  OUVRIR MODAL — Nouveau / Modifier
// ════════════════════════════════════════

function openAddFourn() {
  _editFournId = null;
  document.getElementById('fourn-modal-title').textContent = 'Nouveau Fournisseur';
  [
    'f-name',
    'f-category',
    'f-ice',
    'f-if',
    'f-email',
    'f-phone',
    'f-city',
    'f-address',
    'f-notes',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-score').value = 'A';
  selectFournScore('A');
  openModal('modal-fourn');
  setTimeout(() => document.getElementById('f-name')?.focus(), 120);
}

function editFourn(id) {
  const f = (DB.fournisseurs || []).find(x => String(x.id) === String(id));
  if (!f) return;
  _editFournId = id;

  document.getElementById('fourn-modal-title').textContent = 'Modifier Fournisseur';
  document.getElementById('f-name').value = f.name || '';
  document.getElementById('f-category').value = f.category || '';
  document.getElementById('f-ice').value = f.ice || '';
  document.getElementById('f-if').value = f.if || '';
  document.getElementById('f-email').value = f.email || '';
  document.getElementById('f-phone').value = f.phone || '';
  document.getElementById('f-city').value = f.city || '';
  document.getElementById('f-address').value = f.address || '';
  document.getElementById('f-notes').value = f.notes || '';
  document.getElementById('f-score').value = f.score || 'A';
  selectFournScore(f.score || 'A');

  openModal('modal-fourn');
  setTimeout(() => document.getElementById('f-name')?.focus(), 120);
}

// ════════════════════════════════════════
//  SAUVEGARDER
// ════════════════════════════════════════

function saveFourn() {
  const name = (document.getElementById('f-name')?.value || '').trim();
  if (!name) {
    toast('Le nom du fournisseur est obligatoire', 'err');
    document.getElementById('f-name')?.focus();
    return;
  }

  const wasEditing = !!_editFournId;

  const fourn = {
    id: _editFournId || 'fourn_' + Date.now(),
    name,
    category: document.getElementById('f-category')?.value.trim() || '',
    ice: document.getElementById('f-ice')?.value.trim() || '',
    if: document.getElementById('f-if')?.value.trim() || '',
    email: document.getElementById('f-email')?.value.trim() || '',
    phone: document.getElementById('f-phone')?.value.trim() || '',
    city: document.getElementById('f-city')?.value.trim() || '',
    address: document.getElementById('f-address')?.value.trim() || '',
    notes: document.getElementById('f-notes')?.value.trim() || '',
    score: document.getElementById('f-score')?.value || 'A',
    createdAt: _editFournId
      ? DB.fournisseurs.find(x => String(x.id) === String(_editFournId))?.createdAt ||
        new Date().toISOString()
      : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!DB.fournisseurs) DB.fournisseurs = [];

  if (_editFournId) {
    const idx = DB.fournisseurs.findIndex(x => String(x.id) === String(_editFournId));
    if (idx >= 0) DB.fournisseurs[idx] = fourn;
  } else {
    DB.fournisseurs.unshift(fourn);
  }

  save('fournisseurs');
  closeModal('modal-fourn');
  renderFournisseurs();
  toast(_editFournId ? '✅ Fournisseur mis à jour' : '✅ Fournisseur ajouté', 'suc');
  _editFournId = null;

  // Rafraîchir la liste du select « Fournisseur » si le modal article est ouvert
  if (
    typeof populateFournisseurSelect === 'function' &&
    document.getElementById('modal-article')?.classList.contains('open')
  ) {
    const selectId = wasEditing ? document.getElementById('a-fournisseur')?.value || '' : fourn.id;
    populateFournisseurSelect(selectId);
  }
}

// ════════════════════════════════════════
//  SUPPRIMER
// ════════════════════════════════════════

async function deleteFourn(id) {
  const f = (DB.fournisseurs || []).find(x => String(x.id) === String(id));
  if (!f) return;

  const ok = await showConfirm({
    title: `Supprimer "${f.name}" ?`,
    message: 'Cette action est <strong>irréversible</strong>.',
    icon: '🗑️',
    okLabel: 'Supprimer',
    okStyle: 'danger',
  });
  if (!ok) return;

  if (typeof invooSupabaseSoftDelete === 'function') invooSupabaseSoftDelete('fournisseurs', id);
  DB.fournisseurs = DB.fournisseurs.filter(x => String(x.id) !== String(id));
  save('fournisseurs');
  renderFournisseurs();
  toast('Fournisseur supprimé', 'suc');
}

// ════════════════════════════════════════
//  EXPORT CSV (séparateur ; — Excel FR, BOM UTF-8)
//  En-têtes : id,nom,categorie,score,ice,if,email,telephone,ville,adresse,notes
// ════════════════════════════════════════

function exportFournisseurs() {
  const list = DB.fournisseurs || [];
  if (!list.length) {
    toast('Aucun fournisseur à exporter', 'err');
    return;
  }

  const headers = [
    'id',
    'nom',
    'categorie',
    'score',
    'ice',
    'if',
    'email',
    'telephone',
    'ville',
    'adresse',
    'notes',
  ];
  const rows = list.map(f => [
    f.id || '',
    f.name || '',
    f.category || '',
    f.score || 'A',
    f.ice || '',
    f.if || '',
    f.email || '',
    f.phone || '',
    f.city || '',
    f.address || '',
    f.notes || '',
  ]);

  const sep = ';';
  const esc = v => {
    const s = v == null ? '' : String(v);
    if (/[;\n\r"]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const line = arr => arr.map(esc).join(sep);
  const body = [line(headers), ...rows.map(line)].join('\r\n');
  const csv = '\uFEFF' + body;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fournisseurs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`✅ Export CSV — ${list.length} fournisseur(s)`, 'suc');
}

// ════════════════════════════════════════
//  IMPORT CSV — modal, aperçu (decodeCsvFileBytes dans imports.js)
// ════════════════════════════════════════

function openImportFourn() {
  _importFournData = [];
  const w = document.getElementById('import-fourn-preview-wrap');
  if (w) w.style.display = 'none';
  const btn = document.getElementById('btn-confirm-import-fourn');
  if (btn) btn.style.display = 'none';
  const f = document.getElementById('import-fourn-file');
  if (f) f.value = '';
  const dz = document.getElementById('import-fourn-drop-zone');
  if (dz) {
    dz.style.borderColor = 'var(--border2)';
    dz.style.background = '';
  }
  const ew = document.getElementById('import-fourn-errors-wrap');
  if (ew) ew.style.display = 'none';
    window.openModal('modal-import-fourn');
}

function closeImportFourn() {
    window.closeModal('modal-import-fourn');
}

function importFournDragOver(e) {
  e.preventDefault();
  const dz = document.getElementById('import-fourn-drop-zone');
  if (dz) {
    dz.style.borderColor = 'var(--brand)';
    dz.style.background = 'var(--brand-light)';
  }
}

function importFournDragLeave(e) {
  e.preventDefault();
  const dz = document.getElementById('import-fourn-drop-zone');
  if (dz) {
    dz.style.borderColor = 'var(--border2)';
    dz.style.background = '';
  }
}

function importFournDrop(e) {
  e.preventDefault();
  importFournDragLeave(e);
  const file = e.dataTransfer?.files?.[0];
  if (file) parseImportFournFile(file);
}

function handleImportFournInput(input) {
  const file = input?.files?.[0];
  if (file) parseImportFournFile(file);
}

function downloadFournTemplate() {
  const line = 'id,nom,categorie,score,ice,if,email,telephone,ville,adresse,notes';
  const ex1 = ',ACME SARL,Matériel,A,,,contact@acme.ma,0522123456,Casablanca,Bureau centre,';
  const ex2 = ',Textile Nord,B,C,123456789012345,,,,,';
  const csv = '\uFEFF' + [line, ex1, ex2].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_import_fournisseurs.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Modèle téléchargé ✓', 'suc');
}

function buildFournImportRowsFromText(text) {
  const errors = [];
  const str = String(text || '').replace(/^\uFEFF/, '');
  const parsed =
    typeof parseCsvToRows === 'function'
      ? parseCsvToRows(str)
      : { rows: [], errors: [{ message: 'parseCsvToRows indisponible' }] };
  const allRows = parsed.rows || [];
  if (parsed.errors && parsed.errors.length) {
    parsed.errors.slice(0, 12).forEach(e => {
      if (e && e.message) errors.push(`CSV : ${e.message}`);
    });
  }
  const lines = allRows.filter(r => r && r.some(c => String(c).trim()));
  if (!lines.length) return { rows: [], errors: errors.length ? errors : ['Fichier vide'] };

  const firstCells = lines[0];
  const headerKeys = firstCells.map(_fournNormalizeHeaderKey);
  const hasHeader = headerKeys.some(k => ['nom', 'categorie', 'score', 'ice', 'id'].includes(k));

  let colIndex = {};
  let dataLines;
  if (hasHeader) {
    firstCells.forEach((cell, i) => {
      const k = _fournNormalizeHeaderKey(cell);
      if (k && colIndex[k] === undefined) colIndex[k] = i;
    });
    dataLines = lines.slice(1);
  } else {
    const n = firstCells.length;
    if (n >= 11) {
      colIndex = {
        id: 0,
        nom: 1,
        categorie: 2,
        score: 3,
        ice: 4,
        if: 5,
        email: 6,
        telephone: 7,
        ville: 8,
        adresse: 9,
        notes: 10,
      };
    } else {
      colIndex = {
        nom: 0,
        categorie: 1,
        score: 2,
        ice: 3,
        if: 4,
        email: 5,
        telephone: 6,
        ville: 7,
        adresse: 8,
        notes: 9,
      };
    }
    dataLines = lines;
  }

  const get = (cols, key) => {
    const idx = colIndex[key];
    if (idx === undefined || cols[idx] === undefined) return '';
    return typeof normUtf8 === 'function'
      ? normUtf8(String(cols[idx]).trim())
      : String(cols[idx]).trim();
  };

  const rows = [];
  dataLines.forEach((line, idx) => {
    const cols = Array.isArray(line) ? line : [];
    if (!cols.some(c => String(c).trim())) return;
    const nom = get(cols, 'nom');
    if (!nom) {
      errors.push(`Ligne ${idx + 2} : nom manquant, ignorée`);
      return;
    }

    const ice = get(cols, 'ice');
    const idIncoming = get(cols, 'id');

    const payload = {
      name: nom,
      category: get(cols, 'categorie'),
      ice,
      if: get(cols, 'if'),
      email: get(cols, 'email'),
      phone: get(cols, 'telephone'),
      city: get(cols, 'ville'),
      address: get(cols, 'adresse'),
      notes: get(cols, 'notes'),
      score: _fournParseScoreCell(get(cols, 'score')),
    };

    let _status = 'new';
    if (idIncoming && (DB.fournisseurs || []).some(f => String(f.id) === String(idIncoming))) {
      _status = 'update';
    } else {
      const dup = (DB.fournisseurs || []).some(
        f =>
          String(f.name || '')
            .trim()
            .toLowerCase() === nom.toLowerCase() &&
          String(f.ice || '').trim() === String(ice || '').trim(),
      );
      if (dup) _status = 'dup';
    }

    rows.push({
      ...payload,
      idIncoming,
      _status,
    });
  });

  return { rows, errors };
}

function parseImportFournFile(file) {
  const reader = new FileReader();
  reader.onerror = () => toast('Lecture du fichier impossible', 'err');
  reader.onload = e => {
    try {
      let text =
        typeof decodeCsvFileBytes === 'function'
          ? decodeCsvFileBytes(e.target.result)
          : new TextDecoder('utf-8', { fatal: false }).decode(
              new Uint8Array(e.target.result || []),
            );
      const { rows, errors } = buildFournImportRowsFromText(text);
      _importFournData = rows;

      const tbody = document.getElementById('import-fourn-preview-tbody');
      if (tbody) {
        clearChildren(tbody);
        rows.forEach(r => {
          const tr = document.createElement('tr');
          const td0 = document.createElement('td');
          const badge = document.createElement('span');
          badge.className = 'badge';
          if (r._status === 'update') {
            badge.style.cssText =
              'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)';
            badge.textContent = '↻ Mise à jour';
          } else if (r._status === 'dup') {
            badge.style.cssText =
              'background:rgba(240,165,0,0.15);color:#fbbf24;border:1px solid rgba(240,165,0,0.3)';
            badge.textContent = '⚠️ Doublon';
          } else {
            badge.classList.add('paid');
            badge.textContent = '✓ Nouveau';
          }
          td0.appendChild(badge);
          tr.appendChild(td0);
          const addTd = (text, css) => {
            const td = document.createElement('td');
            if (css) td.style.cssText = css;
            td.textContent = text;
            tr.appendChild(td);
          };
          addTd(r.name || '', 'font-weight:600');
          addTd(r.category || '—');
          addTd(String(r.score ?? ''));
          addTd(r.ice || '—', 'font-family:Arial,sans-serif;font-size:12px');
          addTd(r.email || '—');
          addTd(r.phone || '—');
          addTd(r.city || '—');
          tbody.appendChild(tr);
        });
      }

      const cnt = document.getElementById('import-fourn-preview-count');
      if (cnt) cnt.textContent = String(rows.length);
      const wrap = document.getElementById('import-fourn-preview-wrap');
      if (wrap) wrap.style.display = 'block';
      const btn = document.getElementById('btn-confirm-import-fourn');
      if (btn) btn.style.display = rows.length ? 'inline-flex' : 'none';

      if (errors.length) {
        const ew = document.getElementById('import-fourn-errors-wrap');
        const el = document.getElementById('import-fourn-errors-list');
        if (ew) ew.style.display = 'block';
        if (el) {
          clearChildren(el);
          errors.forEach(er => {
            const row = document.createElement('div');
            row.textContent = '• ' + er;
            el.appendChild(row);
          });
        }
      } else {
        const ew = document.getElementById('import-fourn-errors-wrap');
        if (ew) ew.style.display = 'none';
      }
    } catch (err) {
      toast('Erreur lecture CSV', 'err');
      if (typeof dbgErr === 'function') dbgErr(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function confirmImportFourn() {
  if (!_importFournData.length) return;
  if (!DB.fournisseurs) DB.fournisseurs = [];

  let added = 0;
  let updated = 0;
  let skipped = 0;

  _importFournData.forEach(r => {
    const payload = {
      name: r.name,
      category: r.category,
      ice: r.ice,
      if: r.if,
      email: r.email,
      phone: r.phone,
      city: r.city,
      address: r.address,
      notes: r.notes,
      score: r.score,
      updatedAt: new Date().toISOString(),
    };

    if (r._status === 'dup') {
      skipped++;
      return;
    }

    if (r._status === 'update' && r.idIncoming) {
      const ix = DB.fournisseurs.findIndex(f => String(f.id) === String(r.idIncoming));
      if (ix >= 0) {
        const prev = DB.fournisseurs[ix];
        DB.fournisseurs[ix] = {
          ...prev,
          ...payload,
          id: prev.id,
          createdAt: prev.createdAt || payload.updatedAt,
        };
        updated++;
      }
      return;
    }

    if (r._status === 'new') {
      DB.fournisseurs.push({
        id: 'fourn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        ...payload,
        createdAt: new Date().toISOString(),
      });
      added++;
    }
  });

  save('fournisseurs');
  renderFournisseurs();
  toast(
    `${added} ajouté(s)${updated ? ' · ' + updated + ' mis à jour' : ''}${skipped ? ' · ' + skipped + ' ignoré(s) (doublons)' : ''}`,
    'suc',
  );
  closeImportFourn();
  if (
    typeof populateFournisseurSelect === 'function' &&
    document.getElementById('modal-article')?.classList.contains('open')
  ) {
    populateFournisseurSelect(document.getElementById('a-fournisseur')?.value || '');
  }
}

function _fournNormalizeHeaderKey(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  if ((s.includes('raison') && s.includes('sociale')) || s === 'nom' || s === 'name') return 'nom';
  if (s === 'categorie' || s === 'category' || s.includes('categor')) return 'categorie';
  if (s === 'score') return 'score';
  if (s === 'ice') return 'ice';
  if (s === 'if' || s.includes('identifiant')) return 'if';
  if (s === 'email') return 'email';
  if (s.includes('telephone') || s === 'tel' || s === 'phone') return 'telephone';
  if (s === 'ville' || s === 'city') return 'ville';
  if (s === 'adresse' || s === 'address') return 'adresse';
  if (s === 'notes' || s === 'remarques') return 'notes';
  if (s === 'id') return 'id';
  return '';
}

function _fournParseScoreCell(v) {
  const t = String(v || '')
    .trim()
    .toUpperCase();
  if (t.startsWith('A')) return 'A';
  if (t.startsWith('B')) return 'B';
  if (t.startsWith('C')) return 'C';
  if (t === 'A' || t === 'B' || t === 'C') return t;
  return 'A';
}
