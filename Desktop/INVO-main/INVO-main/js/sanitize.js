// js/sanitize.js — enveloppe DOMPurify (purify.min.js doit être chargé avant ce fichier)
/** @param {unknown} dirty @param {object} [config] — options DOMPurify @returns {string} */
function sanitizeHTML(dirty, config) {
  if (dirty == null) return '';
  const s = typeof dirty === 'string' ? dirty : String(dirty);
  if (!s) return '';
  if (typeof DOMPurify === 'undefined' || typeof DOMPurify.sanitize !== 'function') {
    console.warn('[sanitize] DOMPurify indisponible — HTML vide renvoyé');
    return '';
  }
  return DOMPurify.sanitize(s, config || {});
}

globalThis.sanitizeHTML = sanitizeHTML;
