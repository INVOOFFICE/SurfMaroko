// ═══════════════════════════════════════════
//  price-mode.js — Mode de saisie PU factures (TTC / HT)
//  Stockage global : localStorage priceMode ("TTC" | "HT").
//  Le moteur document reste en HT (line.price) ; ce module ne fait que la préférence UI.
// ═══════════════════════════════════════════

const PRICE_MODE_LS_KEY = 'priceMode';

/**
 * @param {unknown} v
 * @returns {'TTC'|'HT'|null}
 */
function normalizePriceMode(v) {
  if (v === 'HT' || v === 'TTC') return v;
  return null;
}

/**
 * Préférence globale (paramètres). Défaut : "TTC" (comportement historique).
 * @returns {'TTC'|'HT'}
 */
function getGlobalPriceMode() {
  try {
    const fromDb =
      typeof DB !== 'undefined' && DB.settings && normalizePriceMode(DB.settings.globalPriceMode);
    if (fromDb) return fromDb;
    const raw = localStorage.getItem(PRICE_MODE_LS_KEY);
    return normalizePriceMode(raw) || 'TTC';
  } catch {
    return 'TTC';
  }
}

/**
 * @param {unknown} mode
 * @returns {'TTC'|'HT'}
 */
function setGlobalPriceMode(mode) {
  const m = normalizePriceMode(mode) || 'TTC';
  try {
    if (typeof DB !== 'undefined' && DB.settings) {
      DB.settings.globalPriceMode = m;
      if (typeof save === 'function') save('settings');
    }
  } catch (_) {
    /* ignore */
  }
  try {
    localStorage.setItem(PRICE_MODE_LS_KEY, m);
  } catch (_) {
    /* ignore quota / private mode */
  }
  try {
    window.dispatchEvent(new CustomEvent('invo-price-mode-change', { detail: { mode: m } }));
  } catch (_) {
    /* ignore */
  }
  return m;
}

/**
 * Conversions catalogue (prix articles stockés en TTC).
 * @param {number|string} ttc
 * @param {number|string} tva  Taux en % (ex. 20)
 */
function convertTTCtoHT(ttc, tva) {
  const t = parseFloat(ttc) || 0;
  const rate = parseFloat(tva) || 0;
  const denom = 1 + rate / 100;
  return denom > 0 ? t / denom : 0;
}

/**
 * @param {number|string} ht
 * @param {number|string} tva  Taux en %
 */
function convertHTtoTTC(ht, tva) {
  const h = parseFloat(ht) || 0;
  const rate = parseFloat(tva) || 0;
  return h * (1 + rate / 100);
}

/**
 * Montant TTC connu → valeur affichée dans un champ selon le mode (TTC = tel quel, HT = décomposition).
 */
function displayTTCAsModeValue(ttcAmount, tvaPercent, mode) {
  const t = parseFloat(ttcAmount) || 0;
  const tva = parseInt(tvaPercent, 10) || 0;
  const m = normalizePriceMode(mode) || 'TTC';
  if (m === 'HT') return convertTTCtoHT(t, tva);
  return t;
}

/**
 * Saisie utilisateur → montant TTC à persister (catalogue, bons de commande, etc.).
 */
function parseModePriceInputToTTC(raw, tvaPercent, mode) {
  const v = parseFloat(raw) || 0;
  const tva = parseInt(tvaPercent, 10) || 0;
  const m = normalizePriceMode(mode) || 'TTC';
  if (m === 'HT') return convertHTtoTTC(v, tva);
  return v;
}

function displayTTCForGlobalMode(ttcAmount, tvaPercent) {
  return displayTTCAsModeValue(ttcAmount, tvaPercent, getGlobalPriceMode());
}

function parseGlobalModePriceInputToTTC(raw, tvaPercent) {
  return parseModePriceInputToTTC(raw, tvaPercent, getGlobalPriceMode());
}

/** Aligné sur le document en cours (sélecteur doc-price-mode), ex. picker stock depuis une facture. */
function displayTTCForDocLineMode(ttcAmount, tvaPercent) {
  return displayTTCAsModeValue(ttcAmount, tvaPercent, getEffectiveDocPriceMode());
}

/**
 * Mode effectif pour la ligne en cours d’édition : priorité au document (APP.docPriceMode),
 * sinon préférence globale.
 * @returns {'TTC'|'HT'}
 */
function getEffectiveDocPriceMode() {
  const app = typeof window !== 'undefined' ? window.APP : null;
  const d = app && app.docPriceMode;
  if (d === 'TTC' || d === 'HT') return d;
  return getGlobalPriceMode();
}

window.normalizePriceMode = normalizePriceMode;
window.getGlobalPriceMode = getGlobalPriceMode;
window.setGlobalPriceMode = setGlobalPriceMode;
window.getEffectiveDocPriceMode = getEffectiveDocPriceMode;
window.convertTTCtoHT = convertTTCtoHT;
window.convertHTtoTTC = convertHTtoTTC;
window.displayTTCAsModeValue = displayTTCAsModeValue;
window.parseModePriceInputToTTC = parseModePriceInputToTTC;
window.displayTTCForGlobalMode = displayTTCForGlobalMode;
window.parseGlobalModePriceInputToTTC = parseGlobalModePriceInputToTTC;
window.displayTTCForDocLineMode = displayTTCForDocLineMode;
