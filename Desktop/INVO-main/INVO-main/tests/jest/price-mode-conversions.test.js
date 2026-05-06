/**
 * Miroir des formules js/price-mode.js (convertTTCtoHT / convertHTtoTTC / parse/display).
 * Garantit la cohérence numérique du système TTC ↔ HT.
 */

function convertTTCtoHT(ttc, tva) {
  const t = parseFloat(ttc) || 0;
  const rate = parseFloat(tva) || 0;
  const denom = 1 + rate / 100;
  return denom > 0 ? t / denom : 0;
}

function convertHTtoTTC(ht, tva) {
  const h = parseFloat(ht) || 0;
  const rate = parseFloat(tva) || 0;
  return h * (1 + rate / 100);
}

function parseModePriceInputToTTC(raw, tvaPercent, mode) {
  const v = parseFloat(raw) || 0;
  const tva = parseInt(tvaPercent, 10) || 0;
  if (mode === 'HT') return convertHTtoTTC(v, tva);
  return v;
}

function displayTTCAsModeValue(ttcAmount, tvaPercent, mode) {
  const t = parseFloat(ttcAmount) || 0;
  const tva = parseInt(tvaPercent, 10) || 0;
  if (mode === 'HT') return convertTTCtoHT(t, tva);
  return t;
}

describe('price-mode conversions', () => {
  test('TVA 20 % : aller-retour TTC → HT → TTC', () => {
    expect(convertTTCtoHT(120, 20)).toBeCloseTo(100, 10);
    expect(convertHTtoTTC(100, 20)).toBeCloseTo(120, 10);
  });

  test('TVA 0 % : identité', () => {
    expect(convertTTCtoHT(50, 0)).toBe(50);
    expect(convertHTtoTTC(50, 0)).toBe(50);
  });

  test('saisie HT 100 + TVA 20 → stockage TTC 120', () => {
    expect(parseModePriceInputToTTC('100', 20, 'HT')).toBeCloseTo(120, 10);
    expect(parseModePriceInputToTTC('100', 20, 'TTC')).toBe(100);
  });

  test('affichage mode HT depuis TTC 120 TVA 20 → 100', () => {
    expect(displayTTCAsModeValue(120, 20, 'HT')).toBeCloseTo(100, 10);
    expect(displayTTCAsModeValue(120, 20, 'TTC')).toBe(120);
  });
});
