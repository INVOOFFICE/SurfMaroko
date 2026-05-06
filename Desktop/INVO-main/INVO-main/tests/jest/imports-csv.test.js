/**
 * Logique d’import CSV — alignée sur js/imports.js (clients, stock) et js/csv-parse.js.
 * Si imports.js change, mettre à jour les helpers marqués SYNC.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadParseCsvToRows() {
  const root = path.join(__dirname, '..', '..');
  const papa = fs.readFileSync(path.join(root, 'js/vendor/papaparse.min.js'), 'utf8');
  const csvParse = fs.readFileSync(path.join(root, 'js/csv-parse.js'), 'utf8');
  const ctx = { console, globalThis: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(papa, ctx, { filename: 'papaparse.min.js' });
  vm.runInContext(csvParse, ctx, { filename: 'csv-parse.js' });
  return ctx.parseCsvToRows;
}

// SYNC: js/imports.js — decodeCsvFileBytes
function decodeCsvFileBytes(buf) {
  const u8 = new Uint8Array(buf || []);
  if (!u8.length) return '';
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(u8.subarray(3));
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8.subarray(2));
  }
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
    } catch {
      try {
        return new TextDecoder('iso-8859-1').decode(slice);
      } catch {
        return text;
      }
    }
  }
  return text;
}

// SYNC: js/html-safe.js — normUtf8
function normUtf8(value) {
  try {
    return String(value ?? '').normalize('NFC');
  } catch {
    return String(value ?? '');
  }
}

// SYNC: js/imports.js — normHdr (parseImportClientsFile)
function normHdrClients(h) {
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
}

/** Reproduit le mapping client de imports.js après parseCsvToRows + filtre lignes. */
function buildClientImportPreview(rows) {
  const lines = (rows || []).filter(r => r && r.some(c => String(c).trim()));
  if (!lines.length) return { map: {}, dataLines: [], hasHeader: false, lines: [] };

  const firstCells = lines[0];
  const keys = firstCells.map(normHdrClients);
  const hasHeader = keys.some(
    k => k === 'nom' || k === 'ice' || k === 'email' || k === 'if' || k === 'rc',
  );
  let map = {};
  let dataLines;
  if (hasHeader) {
    firstCells.forEach((h, i) => {
      const k = normHdrClients(h);
      if (k && map[k] === undefined) map[k] = i;
    });
    dataLines = lines.slice(1);
  } else {
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
    parsed.push({
      name,
      ice: get(cols, 'ice'),
      ifNum: get(cols, 'if'),
      rc: get(cols, 'rc'),
      email: get(cols, 'email'),
      phone: get(cols, 'phone'),
      city: get(cols, 'city'),
    });
  });
  return { map, hasHeader, dataLines, parsed, errors };
}

/** SYNC: js/imports.js — parseQtyMode */
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
  if (!txt) return { ok: true, qty: 0, kind: 'absolute' };
  const n = parseFloat(txt);
  if (!Number.isFinite(n)) return { ok: false, error: `quantité invalide "${txt}"` };
  return { ok: true, qty: Math.max(0, n), kind: 'absolute' };
}

function parseStockRowsFromLines(lines, dbStock = [], dbFournisseurs = []) {
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
    const paRaw = get('prix_achat_ttc', get('prix_achat', '0'));
    const pvRaw = get('prix_vente_ttc', get('prix_vente', '0'));
    const pa = parseFloat(paRaw) || 0;
    const pv = parseFloat(pvRaw) || 0;
    const tva = parseFloat(get('tva', '20')) || 20;
    const seuil = parseFloat(get('seuil_alerte', '5')) || 5;
    const cb = get('code_barre', '');
    const dupInDB = cb && dbStock.find(a => a.barcode === cb);
    const fournisseurName = String(get('fournisseur', '') || '').trim();
    const fournisseurMatch = fournisseurName
      ? dbFournisseurs.find(
          f =>
            String(f.name || '')
              .trim()
              .toLowerCase() === fournisseurName.toLowerCase(),
        )
      : null;
    parsed.push({
      nom,
      barcode: normUtf8(String(cb || '').trim()),
      qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
      pa,
      pv,
      tva,
      seuil,
      fournisseurId: fournisseurMatch?.id || '',
      _dupInDB: !!dupInDB,
    });
  }
  return { parsed, errors, headerMap };
}

describe('imports.js — decodeCsvFileBytes', () => {
  test('UTF-8 avec BOM', () => {
    const enc = new TextEncoder();
    const buf = new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode('nom;ville\nA;B')]);
    expect(decodeCsvFileBytes(buf.buffer)).toBe('nom;ville\nA;B');
  });

  test('repli Windows-1252 quand UTF-8 produit des caractères de remplacement', () => {
    const bytes = new Uint8Array([0xe9]); // « é » en CP1252, octet seul invalide en UTF-8
    const win = decodeCsvFileBytes(bytes.buffer);
    expect(win).toBe('é');
  });
});

describe('imports.js — clients CSV (logique parseImportClientsFile)', () => {
  const parseCsvToRows = loadParseCsvToRows();

  test('en-têtes détectés + séparateur point-virgule', () => {
    const text = 'Nom;ICE;Email\nAcme;111;acme@test.ma';
    const { rows } = parseCsvToRows(text);
    const { parsed, hasHeader } = buildClientImportPreview(rows);
    expect(hasHeader).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Acme');
    expect(parsed[0].ice).toBe('111');
    expect(parsed[0].email).toBe('acme@test.ma');
  });

  test('sans en-tête : format positionnel (7 colonnes)', () => {
    const text = 'Dupont;222333444555666;12345;99999;x@y.ma;0611223344;Rabat';
    const { rows } = parseCsvToRows(text);
    const { parsed, hasHeader } = buildClientImportPreview(rows);
    expect(hasHeader).toBe(false);
    expect(parsed[0].name).toBe('Dupont');
    expect(parsed[0].ice).toBe('222333444555666');
    expect(parsed[0].city).toBe('Rabat');
  });

  test('colonnes optionnelles manquantes → chaînes vides', () => {
    const text = 'nom,ice\nSeul,';
    const { rows } = parseCsvToRows(text);
    const { parsed } = buildClientImportPreview(rows);
    expect(parsed[0].email).toBe('');
    expect(parsed[0].phone).toBe('');
  });

  test('ligne sans nom : erreur et exclue du parse', () => {
    const text = 'nom,email\n,foo@test.ma\nOK,';
    const { rows } = parseCsvToRows(text);
    const { parsed, errors } = buildClientImportPreview(rows);
    expect(errors.length).toBe(1);
    expect(parsed.map(p => p.name)).toEqual(['OK']);
  });

  test('BOM Unicode après décodage tableau : ignoré comme dans imports.js', () => {
    const text = '\uFEFFnom;ville\nX;Y';
    const cleaned = String(text || '').replace(/^\uFEFF/, '');
    const { rows } = parseCsvToRows(cleaned);
    const { parsed } = buildClientImportPreview(rows);
    expect(parsed[0].name).toBe('X');
  });
});

describe('imports.js — stock CSV (logique parseImportMasseFile)', () => {
  const parseCsvToRows = loadParseCsvToRows();

  test('ligne type modèle : nom, code-barres, quantités, prix, TVA', () => {
    const csv =
      'nom,code_barre,categorie,fournisseur,quantite,prix_achat_ttc,prix_vente_ttc,tva\n' +
      'Article A,BC123,Cat,,10,5,12,20';
    const { rows } = parseCsvToRows(csv);
    const lines = (rows || []).filter(r => r && r.some(c => String(c).trim()));
    const { parsed, errors } = parseStockRowsFromLines(lines, [], []);
    expect(errors.length).toBe(0);
    expect(parsed[0].nom).toBe('Article A');
    expect(parsed[0].barcode).toBe('BC123');
    expect(parsed[0].qty).toBe(10);
    expect(parsed[0].pa).toBe(5);
    expect(parsed[0].pv).toBe(12);
    expect(parsed[0].tva).toBe(20);
  });

  test('en-têtes partiels : valeurs par défaut TVA et seuil', () => {
    const csv = 'nom,quantite\nProd,2';
    const { rows } = parseCsvToRows(csv);
    const lines = (rows || []).filter(r => r && r.some(c => String(c).trim()));
    const { parsed } = parseStockRowsFromLines(lines, [], []);
    expect(parsed[0].tva).toBe(20);
    expect(parsed[0].seuil).toBe(5);
  });

  test('doublon code-barres vs DB', () => {
    const csv = 'nom,code_barre,quantite\nX,BBB,1';
    const { rows } = parseCsvToRows(csv);
    const lines = (rows || []).filter(r => r && r.some(c => String(c).trim()));
    const { parsed } = parseStockRowsFromLines(lines, [{ barcode: 'BBB', name: 'Old' }], []);
    expect(parsed[0]._dupInDB).toBe(true);
  });

  test('fournisseur résolu par nom (insensible à la casse)', () => {
    const csv = 'nom,fournisseur,quantite\nY,  FOURN X  ,1';
    const { rows } = parseCsvToRows(csv);
    const lines = (rows || []).filter(r => r && r.some(c => String(c).trim()));
    const { parsed } = parseStockRowsFromLines(lines, [], [{ id: 'f1', name: 'FOURN X' }]);
    expect(parsed[0].fournisseurId).toBe('f1');
  });
});

describe('imports.js — parseQtyMode', () => {
  test('mode replace : nombre et virgule décimale', () => {
    expect(parseQtyMode('3,5', 'skip', 0)).toEqual(
      expect.objectContaining({ ok: true, qty: 3.5, kind: 'absolute' }),
    );
  });

  test('mode adjust : delta + et -', () => {
    expect(parseQtyMode('+4', 'adjust', 10)).toEqual(
      expect.objectContaining({ ok: true, qty: 14, kind: 'delta' }),
    );
    expect(parseQtyMode('- 2', 'adjust', 10)).toEqual(
      expect.objectContaining({ ok: true, qty: 8, kind: 'delta' }),
    );
  });

  test('valeur invalide → ok false', () => {
    expect(parseQtyMode('abc', 'skip', 0).ok).toBe(false);
    expect(parseQtyMode('abc', 'adjust', 5).ok).toBe(false);
  });
});
