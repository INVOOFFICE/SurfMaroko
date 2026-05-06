/**
 * Moteur fiscal document — miroir de la logique dans js/docs.js (calcTotals, getTotals,
 * getLineTTC, setLineFromUnitTTC) et cohérence avec js/storage.js (_computeTvaByRateFromDocLines).
 */

/** @param {{ qty?: number, price?: number, tva?: number }} l */
function lineHT(l) {
  return Number(l.qty || 0) * Number(l.price || 0);
}

/**
 * Équivalent calcTotals() sans DOM : agrège lignes, applique remise globale (%), mode AE.
 */
function computeCalcTotalsStyle(lines, remisePct, ae) {
  let globalHT = 0;
  let globalTVA = 0;
  const byRate = {};

  for (const l of lines) {
    const lht = lineHT(l);
    const ratePct = ae ? 0 : Number(l.tva || 0);
    const lineTVA = lht * (ratePct / 100);
    globalHT += lht;
    globalTVA += lineTVA;
    if (!byRate[ratePct]) byRate[ratePct] = { ht: 0, tva: 0, ttc: 0 };
    byRate[ratePct].ht += lht;
    byRate[ratePct].tva += lineTVA;
    byRate[ratePct].ttc += lht + lineTVA;
  }

  if (remisePct > 0) {
    const factor = 1 - remisePct / 100;
    globalHT *= factor;
    globalTVA *= factor;
    for (const k of Object.keys(byRate)) {
      byRate[k].ht *= factor;
      byRate[k].tva *= factor;
      byRate[k].ttc *= factor;
    }
  }

  const ttc = globalHT + globalTVA;
  return { ht: globalHT, tva: globalTVA, ttc, byRate };
}

/** Équivalent getTotals() sans DOM (docs.js). */
function computeGetTotalsStyle(lines, remisePct, ae) {
  let ht = 0;
  let tva = 0;
  for (const l of lines) {
    const lht = lineHT(l);
    ht += lht;
    if (!ae) tva += lht * ((Number(l.tva) || 0) / 100);
  }
  const remiseAmt = ht * (remisePct / 100);
  ht -= remiseAmt;
  if (!ae) tva *= 1 - remisePct / 100;
  const ttc = ae ? ht : ht + tva;
  return { ht, tva, ttc };
}

function docAeExemptFromSettings(aeFlag, settingsTva) {
  if (aeFlag === true) return true;
  if (aeFlag === false) return false;
  return parseInt(String(settingsTva ?? '20'), 10) === 0;
}

/** Miroir storage.js _computeTvaByRateFromDocLines (persisté dans doc.tvaByRate). */
function computeTvaByRateFromDoc(doc, settingsTva) {
  const remise = parseFloat(doc.remise) || 0;
  const aeSave = docAeExemptFromSettings(doc.aeExempt, settingsTva);
  const byRate = {};
  for (const l of doc.lines || []) {
    const r = aeSave ? 0 : Number(l.tva || 0);
    const lht = Number(l.qty || 0) * Number(l.price || 0);
    if (!byRate[r]) byRate[r] = { ht: 0, tva: 0, ttc: 0 };
    byRate[r].ht += lht;
    byRate[r].tva += aeSave ? 0 : lht * (r / 100);
    byRate[r].ttc += aeSave ? lht : lht * (1 + r / 100);
  }
  if (remise > 0) {
    const factor = 1 - remise / 100;
    for (const k of Object.keys(byRate)) {
      byRate[k].ht *= factor;
      byRate[k].tva *= factor;
      byRate[k].ttc *= factor;
    }
  }
  return byRate;
}

function getLineTTC(line, ae) {
  const qty = Number(line?.qty || 0);
  const price = Number(line?.price || 0);
  const rate = ae ? 0 : Number(line?.tva || 0);
  const ht = qty * price;
  return ht + (ht * rate) / 100;
}

function setLineFromUnitTTC(line, unitTTC, ae) {
  const rate = ae ? 0 : Number(line?.tva || 0);
  const denom = 1 + rate / 100;
  const ttc = Number(unitTTC) || 0;
  line.price = denom > 0 ? ttc / denom : 0;
}

function getLineUnitTTC(line, ae) {
  const rate = ae ? 0 : Number(line?.tva || 0);
  const htUnit = Number(line?.price || 0);
  return htUnit + (htUnit * rate) / 100;
}

function near(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

describe('fiscal calculations — document totals', () => {
  test('ligne unique 100 HT @ 20 % sans remise', () => {
    const lines = [{ qty: 1, price: 100, tva: 20 }];
    const a = computeCalcTotalsStyle(lines, 0, false);
    expect(a.ht).toBe(100);
    expect(a.tva).toBe(20);
    expect(a.ttc).toBe(120);
    expect(a.byRate[20].ttc).toBe(120);
  });

  test('remise 10 % sur même ligne (facteur global HT/TVA)', () => {
    const lines = [{ qty: 1, price: 100, tva: 20 }];
    const a = computeCalcTotalsStyle(lines, 10, false);
    expect(near(a.ht, 90)).toBe(true);
    expect(near(a.tva, 18)).toBe(true);
    expect(near(a.ttc, 108)).toBe(true);
  });

  test('calcTotals et getTotals coïncident (remise incluse)', () => {
    const lines = [
      { qty: 2, price: 50, tva: 20 },
      { qty: 1, price: 100, tva: 10 },
    ];
    for (const r of [0, 5, 12.5, 100]) {
      for (const ae of [false, true]) {
        const c = computeCalcTotalsStyle(lines, r, ae);
        const g = computeGetTotalsStyle(lines, r, ae);
        expect(near(c.ht, g.ht)).toBe(true);
        expect(near(c.tva, g.tva)).toBe(true);
        expect(near(c.ttc, g.ttc)).toBe(true);
      }
    }
  });

  test('remise 100 % — tout à zéro sauf cohérence TTC', () => {
    const lines = [{ qty: 3, price: 40, tva: 20 }];
    const a = computeCalcTotalsStyle(lines, 100, false);
    expect(a.ht).toBe(0);
    expect(a.tva).toBe(0);
    expect(a.ttc).toBe(0);
  });

  test('lignes vides ou montants nuls', () => {
    const lines = [
      { qty: 0, price: 100, tva: 20 },
      { qty: 2, price: 0, tva: 20 },
    ];
    const a = computeCalcTotalsStyle(lines, 0, false);
    expect(a.ht).toBe(0);
    expect(a.tva).toBe(0);
    expect(a.ttc).toBe(0);
  });

  test('mode auto-entrepreneur (AE) : TVA nulle, TTC = HT après remise', () => {
    const lines = [{ qty: 10, price: 25, tva: 20 }];
    const a = computeCalcTotalsStyle(lines, 0, true);
    expect(a.tva).toBe(0);
    expect(a.ht).toBe(250);
    expect(a.ttc).toBe(250);
    const b = computeCalcTotalsStyle(lines, 20, true);
    expect(near(b.ht, 200)).toBe(true);
    expect(b.tva).toBe(0);
    expect(near(b.ttc, 200)).toBe(true);
  });

  test('multi-taux + petite remise', () => {
    const lines = [
      { qty: 1, price: 1000, tva: 20 },
      { qty: 1, price: 500, tva: 7 },
    ];
    const a = computeCalcTotalsStyle(lines, 2.5, false);
    const rawHt = 1500;
    const rawTva = 200 + 35;
    const f = 0.975;
    expect(near(a.ht, rawHt * f)).toBe(true);
    expect(near(a.tva, rawTva * f)).toBe(true);
    expect(near(a.ttc, a.ht + a.tva)).toBe(true);
    expect(near(a.byRate[20].ht, 1000 * f)).toBe(true);
    expect(near(a.byRate[7].ht, 500 * f)).toBe(true);
  });

  test('taux 0 % explicite (hors mode AE) : TVA nulle, TTC = HT', () => {
    const lines = [
      { qty: 3, price: 100, tva: 0 },
      { qty: 1, price: 50, tva: 0 },
    ];
    const a = computeCalcTotalsStyle(lines, 0, false);
    expect(a.ht).toBe(350);
    expect(a.tva).toBe(0);
    expect(a.ttc).toBe(350);
    expect(a.byRate[0].ttc).toBe(350);
  });

  test('mélange 0 %, 7 % et 20 %', () => {
    const lines = [
      { qty: 1, price: 200, tva: 0 },
      { qty: 1, price: 100, tva: 7 },
      { qty: 2, price: 50, tva: 20 },
    ];
    const a = computeCalcTotalsStyle(lines, 0, false);
    expect(near(a.byRate[0].ht, 200)).toBe(true);
    expect(near(a.byRate[7].tva, 7)).toBe(true);
    expect(near(a.byRate[20].tva, 20)).toBe(true);
    expect(near(a.ht, 400)).toBe(true);
    expect(near(a.tva, 27)).toBe(true);
    expect(near(a.ttc, 427)).toBe(true);
  });

  test('remise > 100 % (ex. 150 %) : HT/TVA/TTC négatifs — comportement moteur actuel', () => {
    const lines = [{ qty: 1, price: 100, tva: 20 }];
    const a = computeCalcTotalsStyle(lines, 150, false);
    expect(near(a.ht, -50)).toBe(true);
    expect(near(a.tva, -10)).toBe(true);
    expect(near(a.ttc, -60)).toBe(true);
  });
});

describe('fiscal calculations — tvaByRate (storage / saveDoc)', () => {
  test('aligné avec buckets calcTotals pour document typique', () => {
    const doc = {
      remise: 5,
      aeExempt: false,
      lines: [
        { qty: 2, price: 50, tva: 20 },
        { qty: 1, price: 100, tva: 10 },
      ],
    };
    const fromStorage = computeTvaByRateFromDoc(doc, '20');
    const fromTotals = computeCalcTotalsStyle(doc.lines, doc.remise, false).byRate;
    for (const k of Object.keys(fromTotals)) {
      const r = Number(k);
      expect(near(fromStorage[r].ht, fromTotals[r].ht)).toBe(true);
      expect(near(fromStorage[r].tva, fromTotals[r].tva)).toBe(true);
      expect(near(fromStorage[r].ttc, fromTotals[r].ttc)).toBe(true);
    }
  });

  test('aeExempt true force taux 0 côté persistance', () => {
    const doc = {
      remise: 0,
      aeExempt: true,
      lines: [{ qty: 1, price: 100, tva: 20 }],
    };
    const br = computeTvaByRateFromDoc(doc, '20');
    expect(br[0]).toBeDefined();
    expect(br[20]).toBeUndefined();
    expect(br[0].ht).toBe(100);
    expect(br[0].tva).toBe(0);
    expect(br[0].ttc).toBe(100);
  });

  test('legacy : settings TVA 0 % sans aeExempt explicite → traité comme exonéré', () => {
    const doc = {
      remise: 0,
      lines: [{ qty: 1, price: 80, tva: 20 }],
    };
    const br = computeTvaByRateFromDoc(doc, '0');
    expect(br[0].ht).toBe(80);
    expect(br[0].tva).toBe(0);
  });
});

/** Agrégat rapport historique — js/invoices.js (generateHistPDFReport). */
function aggregateHistKpis(docs) {
  const totalHT = docs.reduce((s, d) => s + (d.ht || 0), 0);
  const totalTTC = docs.reduce((s, d) => s + (d.ttc || 0), 0);
  const totalTVA = totalTTC - totalHT;
  return { totalHT, totalTTC, totalTVA };
}

describe('fiscal calculations — rapport historique (invoices.js)', () => {
  test('totaux : TVA = somme TTC − somme HT', () => {
    const docs = [
      { ht: 100, ttc: 120 },
      { ht: 50, ttc: 50 },
      { ht: 200, ttc: 224 },
    ];
    const k = aggregateHistKpis(docs);
    expect(near(k.totalHT, 350)).toBe(true);
    expect(near(k.totalTTC, 394)).toBe(true);
    expect(near(k.totalTVA, 44)).toBe(true);
  });

  test('documents vides ou montants absents → zéro', () => {
    expect(aggregateHistKpis([]).totalHT).toBe(0);
    expect(aggregateHistKpis([{ date: '2026-01-01' }]).totalTVA).toBe(0);
  });
});

describe('fiscal calculations — ligne PU HT / TTC', () => {
  test('getLineTTC', () => {
    expect(getLineTTC({ qty: 2, price: 50, tva: 20 }, false)).toBe(120);
    expect(getLineTTC({ qty: 1, price: 100, tva: 0 }, false)).toBe(100);
    expect(getLineTTC({ qty: 1, price: 100, tva: 20 }, true)).toBe(100);
  });

  test('setLineFromUnitTTC : TTC → HT stocké dans price', () => {
    const line = { qty: 1, tva: 20 };
    setLineFromUnitTTC(line, 120, false);
    expect(near(line.price, 100)).toBe(true);
    expect(getLineUnitTTC(line, false)).toBeCloseTo(120, 10);
  });

  test('setLineFromUnitTTC en mode AE', () => {
    const line = { qty: 1, tva: 20 };
    setLineFromUnitTTC(line, 99, true);
    expect(line.price).toBe(99);
  });
});
