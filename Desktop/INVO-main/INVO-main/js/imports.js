// js/imports.js — Import CSV clients & stock
function importClientsCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => {
    toast('Lecture du fichier impossible', 'err');
    input.value = '';
  };
  reader.onload = e => {
    try {
      const raw =
        typeof decodeCsvFileBytes === 'function'
          ? decodeCsvFileBytes(e.target.result)
          : new TextDecoder('utf-8', { fatal: false }).decode(
              new Uint8Array(e.target.result || []),
            );
      const text = String(raw || '').replace(/^\uFEFF/, '');
      const csvParsed =
        typeof parseCsvToRows === 'function'
          ? parseCsvToRows(text)
          : { rows: [], errors: [] };
      const lines = (csvParsed.rows || []).filter(r => r && r.some(c => String(c).trim()));
      if (!lines.length) {
        toast('Fichier vide', 'err');
        input.value = '';
        return;
      }

      const normHdr = h => {
        const s = String(h || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ');
        if (
          s === 'nom' ||
          s === 'name' ||
          s.startsWith('client') ||
          (s.includes('raison') && s.includes('sociale'))
        )
          return 'nom';
        if (s === 'ice') return 'ice';
        if (s === 'if' || s.includes('identifiant fiscal')) return 'if';
        if (s === 'rc' || s.includes('registre')) return 'rc';
        if (s === 'email' || s === 'mail') return 'email';
        if (s === 'telephone' || s === 'tel' || s === 'phone') return 'phone';
        if (s === 'ville' || s === 'city') return 'city';
        return '';
      };
      const firstCells = lines[0];
      const keys = firstCells.map(normHdr);
      const hasHeader = keys.some(
        k => k === 'nom' || k === 'ice' || k === 'email' || k === 'if' || k === 'rc',
      );
      let map = {};
      let dataLines;
      if (hasHeader) {
        firstCells.forEach((h, i) => {
          const k = normHdr(h);
          if (k && map[k] === undefined) map[k] = i;
        });
        dataLines = lines.slice(1);
      } else {
        // Compat ancien format positionnel: nom,ice,if,rc,email,phone,city
        map = { nom: 0, ice: 1, if: 2, rc: 3, email: 4, phone: 5, city: 6 };
        dataLines = lines;
      }
      const get = (cols, k) => {
        const idx = map[k];
        if (idx === undefined || cols[idx] === undefined) return '';
        return normUtf8(String(cols[idx]).trim());
      };

      let added = 0,
        skipped = 0;
      dataLines.forEach(line => {
        const cols = Array.isArray(line) ? line : [];
        const name = get(cols, 'nom');
        if (!name) {
          skipped++;
          return;
        }
        const ice = get(cols, 'ice');
        const ifNum = get(cols, 'if');
        const rc = get(cols, 'rc');
        const email = get(cols, 'email');
        const phone = get(cols, 'phone');
        const city = get(cols, 'city');
        const exists = DB.clients.some(
          c => c.name.toLowerCase() === name.toLowerCase() && (c.ice || '') === (ice || ''),
        );
        if (exists) {
          skipped++;
          return;
        }
        const cli = {
          id: 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          name,
          ice,
          rc,
          email,
          phone,
          city,
          address: '',
          notes: '',
        };
        cli['if'] = ifNum;
        DB.clients.push(cli);
        added++;
      });
      saveAll();
      renderClients();
      toast(`${added} client(s) importé(s)${skipped ? ' · ' + skipped + ' ignoré(s)' : ''}`, 'suc');
    } catch (err) {
      toast('Erreur lecture CSV', 'err');
      dbgErr(err);
    }
    input.value = '';
  };
  reader.readAsArrayBuffer(file);
}

// ── Import CSV (modal) — Clients ──
let _importClientsData = [];
window.APP = window.APP || {};
try {
  const desc = Object.getOwnPropertyDescriptor(window.APP, 'importClientsData');
  if (!desc) {
    Object.defineProperty(window.APP, 'importClientsData', {
      get: () => _importClientsData,
      set: v => {
        _importClientsData = v;
      },
      enumerable: true,
      configurable: false,
    });
  }
} catch (_) {}

function openImportClients() {
  APP.importClientsData = [];
  document.getElementById('import-clients-preview-wrap')?.style &&
    (document.getElementById('import-clients-preview-wrap').style.display = 'none');
  document.getElementById('import-clients-errors-wrap')?.style &&
    (document.getElementById('import-clients-errors-wrap').style.display = 'none');
  document.getElementById('btn-confirm-import-clients')?.style &&
    (document.getElementById('btn-confirm-import-clients').style.display = 'none');
  if (document.getElementById('import-clients-file'))
    document.getElementById('import-clients-file').value = '';

  const dz = document.getElementById('import-clients-drop-zone');
  if (dz) {
    dz.style.borderColor = 'var(--border2)';
    dz.style.background = '';
  }

  window.openModal('modal-import-clients');
}

function closeImportClients() {
  window.closeModal('modal-import-clients');
}

function importClientsDragOver(e) {
  e.preventDefault();
  const dz = document.getElementById('import-clients-drop-zone');
  if (dz) {
    dz.style.borderColor = 'var(--brand)';
    dz.style.background = 'var(--brand-light)';
  }
}

function importClientsDragLeave(e) {
  e.preventDefault();
  const dz = document.getElementById('import-clients-drop-zone');
  if (dz) {
    dz.style.borderColor = 'var(--border2)';
    dz.style.background = '';
  }
}

function importClientsDrop(e) {
  e.preventDefault();
  importClientsDragLeave(e);
  const file = e.dataTransfer?.files?.[0];
  if (file) parseImportClientsFile(file);
}

function handleImportClients(input) {
  const file = input?.files?.[0];
  if (file) parseImportClientsFile(file);
}

function parseImportClientsFile(file) {
  const reader = new FileReader();
  reader.onerror = () => toast('Lecture du fichier impossible', 'err');
  reader.onload = e => {
    try {
      const raw =
        typeof decodeCsvFileBytes === 'function'
          ? decodeCsvFileBytes(e.target.result)
          : new TextDecoder('utf-8', { fatal: false }).decode(
              new Uint8Array(e.target.result || []),
            );

      let text = String(raw || '').replace(/^\uFEFF/, '');
      const csvParsed =
        typeof parseCsvToRows === 'function'
          ? parseCsvToRows(text)
          : { rows: [], errors: [] };
      const lines = (csvParsed.rows || []).filter(r => r && r.some(c => String(c).trim()));
      if (!lines.length) {
        toast('Fichier vide', 'err');
        return;
      }

      const normHdr = h => {
        const s = String(h || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ');
        if (
          s === 'nom' ||
          s === 'name' ||
          s.startsWith('client') ||
          (s.includes('raison') && s.includes('sociale'))
        )
          return 'nom';
        if (s === 'ice') return 'ice';
        if (s === 'if' || s.includes('identifiant fiscal')) return 'if';
        if (s === 'rc' || s.includes('registre')) return 'rc';
        if (s === 'email' || s === 'mail') return 'email';
        if (s === 'telephone' || s === 'tel' || s === 'phone') return 'phone';
        if (s === 'ville' || s === 'city') return 'city';
        return '';
      };

      const firstCells = lines[0];
      const keys = firstCells.map(normHdr);
      const hasHeader = keys.some(
        k => k === 'nom' || k === 'ice' || k === 'email' || k === 'if' || k === 'rc',
      );

      let map = {};
      let dataLines;
      if (hasHeader) {
        firstCells.forEach((h, i) => {
          const k = normHdr(h);
          if (k && map[k] === undefined) map[k] = i;
        });
        dataLines = lines.slice(1);
      } else {
        // Compat ancien format positionnel : nom,ice,if,rc,email,phone,city
        map = { nom: 0, ice: 1, if: 2, rc: 3, email: 4, phone: 5, city: 6 };
        dataLines = lines;
      }

      const get = (cols, k) => {
        const idx = map[k];
        if (idx === undefined || cols[idx] === undefined) return '';
        return normUtf8(String(cols[idx]).trim());
      };

      const parsed = [];
      const errors = [];

      dataLines.forEach((line, lineIdx) => {
        const cols = Array.isArray(line) ? line : [];
        const name = get(cols, 'nom');
        if (!name) {
          errors.push(`Ligne ${lineIdx + 2} : nom manquant, ignorée`);
          return;
        }

        const ice = get(cols, 'ice');
        const ifNum = get(cols, 'if');
        const rc = get(cols, 'rc');
        const email = get(cols, 'email');
        const phone = get(cols, 'phone');
        const city = get(cols, 'city');

        const exists = DB.clients.some(
          c =>
            String(c.name || '').toLowerCase() === String(name || '').toLowerCase() &&
            (c.ice || '') === (ice || ''),
        );

        parsed.push({
          name,
          ice,
          ifNum,
          rc,
          email,
          phone,
          city,
          _exists: exists,
        });
      });

      APP.importClientsData = parsed;

      // Render preview
      const tbody = document.getElementById('import-clients-preview-tbody');
      if (tbody) {
        clearChildren(tbody);
        parsed.forEach(r => {
          const tr = document.createElement('tr');
          const td0 = document.createElement('td');
          const bd = document.createElement('span');
          bd.className = 'badge';
          if (r._exists) {
            bd.style.cssText =
              'background:rgba(240,165,0,0.15);color:#fbbf24;border:1px solid rgba(240,165,0,0.3)';
            bd.textContent = '⚠️ Existe';
          } else {
            bd.className = 'badge paid';
            bd.textContent = '✓ Nouveau';
          }
          td0.appendChild(bd);
          const cells = [
            r.name,
            r.ice || '—',
            r.ifNum || '—',
            r.rc || '—',
            r.email || '—',
            r.phone || '—',
            r.city || '—',
          ];
          tr.appendChild(td0);
          cells.forEach((txt, i) => {
            const td = document.createElement('td');
            if (i === 0) td.style.fontWeight = '600';
            td.textContent = txt;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }

      const countEl = document.getElementById('import-clients-preview-count');
      if (countEl) countEl.textContent = String(parsed.length);

      if (document.getElementById('import-clients-preview-wrap')) {
        document.getElementById('import-clients-preview-wrap').style.display = 'block';
      }
      if (document.getElementById('btn-confirm-import-clients')) {
        document.getElementById('btn-confirm-import-clients').style.display = 'inline-flex';
      }

      if (errors.length) {
        const errWrap = document.getElementById('import-clients-errors-wrap');
        if (errWrap) errWrap.style.display = 'block';
        const errList = document.getElementById('import-clients-errors-list');
        if (errList) {
          clearChildren(errList);
          errors.forEach(er => {
            const d = document.createElement('div');
            d.textContent = '• ' + er;
            errList.appendChild(d);
          });
        }
      } else {
        const errWrap = document.getElementById('import-clients-errors-wrap');
        if (errWrap) errWrap.style.display = 'none';
      }

      // Nettoyer la valeur du champ input
      const fileInput = document.getElementById('import-clients-file');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      toast('Erreur lecture CSV', 'err');
      dbgErr(err);
    }
  };

  reader.readAsArrayBuffer(file);
}

function confirmImportClients() {
  if (!APP.importClientsData || !APP.importClientsData.length) return;

  const overwrite = !!document.getElementById('import-overwrite-clients')?.checked;
  let added = 0,
    updated = 0,
    skipped = 0;
  const ts = Date.now();

  APP.importClientsData.forEach((r, idx) => {
    const existing = DB.clients.find(
      c =>
        String(c.name || '').toLowerCase() === String(r.name || '').toLowerCase() &&
        (c.ice || '') === (r.ice || ''),
    );

    if (existing) {
      if (!overwrite) {
        skipped++;
        return;
      }
      existing.name = r.name;
      existing.ice = r.ice;
      existing['if'] = r.ifNum;
      existing.rc = r.rc;
      existing.email = r.email;
      existing.phone = r.phone;
      existing.city = r.city;
      updated++;
    } else {
      DB.clients.push({
        id: 'cli_' + ts + '_' + idx + '_' + Math.random().toString(36).slice(2, 8),
        name: r.name,
        type: 'particulier',
        ice: r.ice,
        rc: r.rc,
        email: r.email,
        phone: r.phone,
        city: r.city,
        address: '',
        notes: '',
      });
      DB.clients[DB.clients.length - 1]['if'] = r.ifNum;
      added++;
    }
  });

  save('clients');
  renderClients();
  populateDocClient();
  closeImportClients();

  let msg = `Import terminé : ${added} ajouté(s)`;
  if (updated) msg += `, ${updated} mis à jour`;
  if (skipped) msg += `, ${skipped} ignoré(s) (doublon)`;
  toast(msg + ' ✓', 'suc');
}

function downloadClientsTemplate() {
  const csv =
    'nom,ice,if,rc,email,telephone,ville\n' +
    'Client Exemple SARL,123456789012345,12345678,54321,contact@exemple.ma,0522000000,Casablanca\n' +
    'Client Particulier,,,,nom.prenom@email.com,0611223344,Rabat';
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_import_clients.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Modèle clients téléchargé ✓', 'suc');
}
// ── Import en masse ──
// ═══════════════════════════════════════════
let _importMasseData = [];
let _importMasseParseErrors = [];

// ── Maintenabilité : exposition d'état pour migration progressive
window.APP = window.APP || {};
try {
  const desc = Object.getOwnPropertyDescriptor(window.APP, 'importMasseData');
  if (!desc) {
    Object.defineProperty(window.APP, 'importMasseData', {
      get: () => _importMasseData,
      set: v => {
        _importMasseData = v;
      },
      enumerable: true,
      configurable: false,
    });
  }
} catch (_) {}

function getImportStockMode() {
  const checked = document.querySelector('input[name="import-stock-mode"]:checked');
  const v = (checked && checked.value) || 'skip';
  return v === 'replace' || v === 'adjust' ? v : 'skip';
}

function parseQtyMode(raw, mode, existingQty) {
  const txt = String(raw ?? '')
    .trim()
    .replace(',', '.');
  const baseQty = Number(existingQty || 0);
  if (mode === 'adjust') {
    if (!txt) return { ok: true, qty: baseQty, kind: 'absolute' };
    const m = txt.match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const delta = parseFloat(m[2]) * (m[1] === '-' ? -1 : 1);
      return { ok: true, qty: Math.max(0, baseQty + delta), kind: 'delta', delta };
    }
    const n = parseFloat(txt);
    if (Number.isFinite(n)) return { ok: true, qty: Math.max(0, n), kind: 'absolute' };
    return { ok: false, error: `quantité invalide "${txt}" (attendu: +X, -X ou X)` };
  }
  // replace / skip (création) : quantité numérique simple
  if (!txt) return { ok: true, qty: 0, kind: 'absolute' };
  const n = parseFloat(txt);
  if (!Number.isFinite(n)) return { ok: false, error: `quantité invalide "${txt}"` };
  return { ok: true, qty: Math.max(0, n), kind: 'absolute' };
}

function logStockMove(entry) {
  if (!Array.isArray(DB.stockMoves)) DB.stockMoves = [];
  DB.stockMoves.unshift({
    id: 'sm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(),
    ...entry,
  });
  if (DB.stockMoves.length > 5000) DB.stockMoves.length = 5000;
}

function openImportMasse() {
  APP.importMasseData = [];
  _importMasseParseErrors = [];
  document.getElementById('import-preview-wrap').style.display = 'none';
  document.getElementById('btn-confirm-import-masse').style.display = 'none';
  document.getElementById('import-masse-file').value = '';
  document.getElementById('import-drop-zone').style.borderColor = 'var(--border2)';
  const skipOpt = document.getElementById('import-stock-mode-skip');
  if (skipOpt) skipOpt.checked = true;
  window.openModal('modal-import-masse');
}

function closeImportMasse() {
  window.closeModal('modal-import-masse');
}

function importDragOver(e) {
  e.preventDefault();
  document.getElementById('import-drop-zone').style.borderColor = 'var(--brand)';
  document.getElementById('import-drop-zone').style.background = 'var(--brand-light)';
}

function importDragLeave(e) {
  document.getElementById('import-drop-zone').style.borderColor = 'var(--border2)';
  document.getElementById('import-drop-zone').style.background = '';
}

function importDrop(e) {
  e.preventDefault();
  importDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (file) parseImportMasseFile(file);
}

function handleImportMasse(input) {
  const file = input.files[0];
  if (file) parseImportMasseFile(file);
}

/**
 * Décode les octets d’un CSV : UTF-8 (BOM si présent), UTF-16 LE, ou Windows-1252
 * (Excel « CSV séparateur » sur Windows français enregistre souvent en ANSI / 1252).
 */
function decodeCsvFileBytes(buf) {
  const u8 = new Uint8Array(buf || []);
  if (!u8.length) return '';
  // UTF-8 avec BOM
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(u8.subarray(3));
  }
  // UTF-16 LE BOM
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8.subarray(2));
  }
  // UTF-16 BE BOM
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(u8.subarray(2));
  }
  const slice = u8;
  const utf8 = new TextDecoder('utf-8', { fatal: false });
  let text = utf8.decode(slice);
  let hasReplacement = false;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) {
      hasReplacement = true;
      break;
    }
  }
  if (hasReplacement) {
    try {
      return new TextDecoder('windows-1252').decode(slice);
    } catch (_) {
      try {
        return new TextDecoder('iso-8859-1').decode(slice);
      } catch (_) {}
    }
  }
  return text;
}

function parseImportMasseFile(file) {
  const reader = new FileReader();
  reader.onerror = function () {
    toast('Lecture du fichier impossible', 'err');
  };
  reader.onload = function (e) {
    // Décodage multi-encodage (UTF-8 + repli Windows-1252 pour Excel)
    let text = decodeCsvFileBytes(e.target.result);
    text = String(text || '').replace(/^\uFEFF/, '');
    const csvParsed =
      typeof parseCsvToRows === 'function'
        ? parseCsvToRows(text)
        : { rows: [], errors: [] };
    const lines = (csvParsed.rows || []).filter(r => r && r.some(c => String(c).trim()));
    if (!lines.length) {
      toast('Fichier vide', 'err');
      return;
    }

    const headerCells = lines[0] || [];
    const headers = headerCells.map(h =>
      String(h || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z_]/g, ''),
    );
    const headerMap = {};
    [
      'nom',
      'code_barre',
      'categorie',
      'fournisseur',
      'quantite',
      'prix_achat_ttc',
      'prix_vente_ttc',
      'tva',
      'unite',
      'seuil_alerte',
    ].forEach(k => {
      const idx = headers.findIndex(h => h === k || h === k.replace('_', ''));
      if (idx >= 0) headerMap[k] = idx;
    });

    const parsed = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = Array.isArray(lines[i]) ? lines[i] : [];
      const nom = normUtf8(
        String(
          headerMap['nom'] !== undefined ? cols[headerMap['nom']] || '' : cols[0] || '',
        ).trim(),
      );
      if (!nom) {
        errors.push(`Ligne ${i + 1} : nom manquant, ignorée`);
        continue;
      }

      const get = (k, def = '') => {
        const idx = headerMap[k];
        return idx !== undefined && cols[idx] !== undefined ? cols[idx] : def;
      };
      const qtyRaw = String(get('quantite', '0') || '').trim();
      const qty = parseFloat(String(qtyRaw).replace(',', '.'));
      // Compatibilité ascendante : anciens CSV (prix_achat/prix_vente) toujours acceptés.
      const paRaw = get('prix_achat_ttc', get('prix_achat', '0'));
      const pvRaw = get('prix_vente_ttc', get('prix_vente', '0'));
      const pa = parseFloat(paRaw) || 0;
      const pv = parseFloat(pvRaw) || 0;
      const tva = parseFloat(get('tva', '20')) || 20;
      const seuil = parseFloat(get('seuil_alerte', '5')) || 5;

      // Check duplicate barcode in current DB
      const cb = get('code_barre', '');
      const dupInDB = cb && DB.stock.find(a => a.barcode === cb);
      const fournisseurName = String(get('fournisseur', '') || '').trim();
      // Résoudre l'id fournisseur depuis le nom (insensible à la casse, espaces bords)
      const fournisseurMatch = fournisseurName
        ? (DB.fournisseurs || []).find(
            f =>
              String(f.name || '')
                .trim()
                .toLowerCase() === fournisseurName.toLowerCase(),
          )
        : null;
      parsed.push({
        nom,
        barcode: normUtf8(String(cb || '').trim()),
        categorie: normUtf8(String(get('categorie', '') || '').trim()),
        fournisseurName: fournisseurName ? normUtf8(fournisseurName) : '',
        fournisseurId: fournisseurMatch?.id || '',
        qtyRaw,
        qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
        pa,
        pv,
        tva,
        unite: get('unite', 'pièce'),
        seuil,
        _dupInDB: !!dupInDB,
        _valid: !!nom,
      });
    }

    APP.importMasseData = parsed;

    // Render preview
    const tbody = document.getElementById('import-preview-tbody');
    clearChildren(tbody);
    parsed.forEach(r => {
      const tr = document.createElement('tr');
      const td0 = document.createElement('td');
      const bd = document.createElement('span');
      bd.className = 'badge';
      if (r._dupInDB) {
        bd.style.cssText =
          'background:rgba(240,165,0,0.15);color:#fbbf24;border:1px solid rgba(240,165,0,0.3)';
        bd.textContent = '⚠️ Existe';
      } else {
        bd.className = 'badge paid';
        bd.textContent = '✓ Nouveau';
      }
      td0.appendChild(bd);
      tr.appendChild(td0);
      const td1 = document.createElement('td');
      td1.style.fontWeight = '600';
      td1.textContent = r.nom;
      tr.appendChild(td1);
      const td2 = document.createElement('td');
      td2.style.cssText = 'font-family:monospace;font-size:12px';
      td2.textContent = r.barcode || '—';
      tr.appendChild(td2);
      const td3 = document.createElement('td');
      td3.textContent = r.categorie || '—';
      tr.appendChild(td3);
      const td4 = document.createElement('td');
      if (r.fournisseurName) {
        const sp = document.createElement('span');
        sp.style.cssText =
          'font-size:11px;background:rgba(9,188,138,.1);color:var(--brand);padding:2px 6px;border-radius:4px';
        sp.textContent = r.fournisseurName;
        td4.appendChild(sp);
      } else td4.textContent = '—';
      tr.appendChild(td4);
      const td5 = document.createElement('td');
      td5.textContent = r.qtyRaw || '0';
      tr.appendChild(td5);
      const td6 = document.createElement('td');
      td6.textContent = r.pa ? r.pa.toFixed(2) + ' DH' : '—';
      tr.appendChild(td6);
      const td7 = document.createElement('td');
      td7.textContent = r.pv ? r.pv.toFixed(2) + ' DH' : '—';
      tr.appendChild(td7);
      const td8 = document.createElement('td');
      td8.textContent = `${r.tva}%`;
      tr.appendChild(td8);
      tbody.appendChild(tr);
    });

    document.getElementById('import-preview-count').textContent = parsed.length;
    document.getElementById('import-preview-wrap').style.display = 'block';
    document.getElementById('btn-confirm-import-masse').style.display = 'inline-flex';

    _importMasseParseErrors = errors.slice();
    if (errors.length) {
      document.getElementById('import-errors-wrap').style.display = 'block';
      const impErr = document.getElementById('import-errors-list');
      if (impErr) {
        clearChildren(impErr);
        errors.forEach(e => {
          const d = document.createElement('div');
          d.textContent = '• ' + e;
          impErr.appendChild(d);
        });
      }
    } else {
      document.getElementById('import-errors-wrap').style.display = 'none';
    }
  };
  reader.readAsArrayBuffer(file);
}
function confirmImportMasse() {
  if (!APP.importMasseData.length) return;
  const mode = getImportStockMode(); // skip | replace | adjust
  let added = 0,
    updated = 0,
    skipped = 0,
    errors = _importMasseParseErrors.length;
  const errorLines = [];
  const ts = Date.now();

  APP.importMasseData.forEach((r, idx) => {
    const existing = r.barcode ? DB.stock.find(a => a.barcode === r.barcode) : null;
    if (existing && mode === 'skip') {
      skipped++;
      return;
    }
    if (existing && mode === 'replace') {
      const qtyRes = parseQtyMode(r.qtyRaw, 'replace', existing.qty || 0);
      if (!qtyRes.ok) {
        errors++;
        errorLines.push(`Ligne ${idx + 2} (${r.nom}) : ${qtyRes.error}`);
        return;
      }
      const oldQty = Number(existing.qty || 0);
      existing.name = r.nom;
      existing.category = r.categorie;
      existing.qty = qtyRes.qty;
      existing.buy = r.pa;
      existing.sell = r.pv;
      existing.tva = r.tva;
      existing.desc = existing.desc || '';
      existing.fournisseurId = r.fournisseurId || existing.fournisseurId || '';
      existing.fournisseurName = r.fournisseurName || existing.fournisseurName || '';
      logStockMove({
        action: 'replace',
        source: 'import',
        articleId: existing.id,
        articleName: existing.name,
        barcode: existing.barcode || '',
        oldQty,
        newQty: existing.qty,
      });
      updated++;
      return;
    }
    if (existing && mode === 'adjust') {
      const qtyRes = parseQtyMode(r.qtyRaw, 'adjust', existing.qty || 0);
      if (!qtyRes.ok) {
        errors++;
        errorLines.push(`Ligne ${idx + 2} (${r.nom}) : ${qtyRes.error}`);
        return;
      }
      const oldQty = Number(existing.qty || 0);
      existing.name = r.nom;
      existing.category = r.categorie;
      existing.qty = qtyRes.qty;
      existing.buy = r.pa;
      existing.sell = r.pv;
      existing.tva = r.tva;
      existing.desc = existing.desc || '';
      existing.fournisseurId = r.fournisseurId || existing.fournisseurId || '';
      existing.fournisseurName = r.fournisseurName || existing.fournisseurName || '';
      logStockMove({
        action: 'adjust',
        source: 'import',
        articleId: existing.id,
        articleName: existing.name,
        barcode: existing.barcode || '',
        oldQty,
        newQty: existing.qty,
        delta: Number(existing.qty) - Number(oldQty),
      });
      updated++;
      return;
    }

    if (!existing) {
      const qtyRes = parseQtyMode(r.qtyRaw, mode === 'adjust' ? 'adjust' : 'replace', 0);
      if (!qtyRes.ok) {
        errors++;
        errorLines.push(`Ligne ${idx + 2} (${r.nom}) : ${qtyRes.error}`);
        return;
      }
      DB.stock.push({
        id: 'art_' + ts + '_' + idx + '_' + Math.random().toString(36).slice(2, 8),
        name: r.nom,
        barcode: r.barcode,
        category: r.categorie,
        qty: qtyRes.qty,
        buy: r.pa,
        sell: r.pv,
        tva: r.tva,
        desc: '',
        fournisseurId: r.fournisseurId || '',
        fournisseurName: r.fournisseurName || '',
      });
      const created = DB.stock[DB.stock.length - 1];
      logStockMove({
        action: 'import',
        source: 'import',
        articleId: created.id,
        articleName: created.name,
        barcode: created.barcode || '',
        oldQty: 0,
        newQty: created.qty,
      });
      added++;
    }
  });

  save('stock');
  save('stockMoves');
  closeImportMasse();
  renderStock();
  updateStockKPIs();

  let msg = `Import terminé : ${added} ajouté(s)`;
  if (updated) msg += `, ${updated} mis à jour`;
  if (skipped) msg += `, ${skipped} ignoré(s)`;
  if (errors) msg += `, ${errors} erreur(s)`;
  toast(msg + ' ✓', 'suc');
  if (errorLines.length) {
    const preview = errorLines.slice(0, 4).join('<br>');
    toast(`⚠️ Lignes ignorées :<br>${preview}${errorLines.length > 4 ? '<br>…' : ''}`, 'err');
  }
}

function downloadImportTemplate() {
  const csv =
    'nom,code_barre,categorie,fournisseur,quantite,prix_achat_ttc,prix_vente_ttc,tva,unite,seuil_alerte\nProduit Exemple,1234567890,Ma Catégorie,Fournisseur SARL,100,50.00,85.00,20,pièce,5\nArticle Test,,Textile,,30,20.00,45.00,0,mètre,10';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_import_stock.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Modèle téléchargé ✓', 'suc');
}

// ════════════════════════════════════════
//  RAPPORT PDF HISTORIQUE — btn-hist-pdf-report

// ════════════════════════════════════════
//  RAPPORT PDF HISTORIQUE — btn-hist-pdf-report

