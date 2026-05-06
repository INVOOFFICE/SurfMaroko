/**
 * Vérifie la cohérence du calcul tvaByRate + remise (aligné sur storage.js / docs.js).
 * Exécuter : npm test
 */
import assert from 'node:assert/strict';

function docAeExempt(doc, settingsTva) {
  if (doc.aeExempt === true) return true;
  if (doc.aeExempt === false) return false;
  return parseInt(String(settingsTva ?? '20'), 10) === 0;
}

function computeTvaByRateFromDocLines(doc, settingsTva) {
  const remise = parseFloat(doc.remise) || 0;
  const aeSave = docAeExempt(doc, settingsTva);
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

// Sans remise : une ligne 100 HT @ 20 % → HT 100, TVA 20, TTC 120
{
  const doc = { remise: 0, aeExempt: false, lines: [{ qty: 1, price: 100, tva: 20 }] };
  const br = computeTvaByRateFromDocLines(doc, '20');
  assert.equal(br[20].ht, 100);
  assert.equal(br[20].tva, 20);
  assert.equal(br[20].ttc, 120);
}

// Remise 10 % : même ligne → HT 90, TVA 18, TTC 108
{
  const doc = { remise: 10, aeExempt: false, lines: [{ qty: 1, price: 100, tva: 20 }] };
  const br = computeTvaByRateFromDocLines(doc, '20');
  assert.ok(Math.abs(br[20].ht - 90) < 0.001);
  assert.ok(Math.abs(br[20].tva - 18) < 0.001);
  assert.ok(Math.abs(br[20].ttc - 108) < 0.001);
}

// Multi-taux + remise 5 %
{
  const doc = {
    remise: 5,
    aeExempt: false,
    lines: [
      { qty: 2, price: 50, tva: 20 },
      { qty: 1, price: 100, tva: 10 },
    ],
  };
  const br = computeTvaByRateFromDocLines(doc, '20');
  const ht20 = 100 * 0.95;
  const ht10 = 100 * 0.95;
  assert.ok(Math.abs(br[20].ht - ht20) < 0.001);
  assert.ok(Math.abs(br[10].ht - ht10) < 0.001);
  assert.ok(Math.abs(br[20].tva - ht20 * 0.2) < 0.001);
  assert.ok(Math.abs(br[10].tva - ht10 * 0.1) < 0.001);
}

console.log('OK — tests tva-by-rate');
