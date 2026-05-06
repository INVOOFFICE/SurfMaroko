// ═══════════════════════════════════════════
//  html-safe.js — échappement HTML & helpers DOM
//  Charger en premier (avant tout module qui touche au DOM).
// ═══════════════════════════════════════════

/**
 * Échappe les caractères HTML pour insertion en texte ou dans un attribut entre guillemets doubles.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Alias historique utilisé dans les templates (même comportement qu’escapeHtml). */
const escHtml = escapeHtml;

/**
 * Valeur d’attribut HTML (contenu texte uniquement — pas pour URLs complexes déjà validées).
 * @param {unknown} value
 * @returns {string}
 */
function escapeAttr(value) {
  return escapeHtml(value).replace(/\r/g, '&#13;').replace(/\n/g, '&#10;');
}

/** Vide un nœud sans utiliser innerHTML. */
function clearChildren(el) {
  if (el) el.replaceChildren();
}

/**
 * Crée un élément avec attributs et enfants (texte ou nœuds).
 * Les clés style peuvent être une chaîne cssText.
 * @param {string} tag
 * @param {Record<string, unknown>|null} attrs
 * @param {...(Node|string|number|null|undefined)} children
 * @returns {HTMLElement}
 */
function h(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        e.className = String(v);
        continue;
      }
      if (k === 'style' && typeof v === 'string') {
        e.style.cssText = v;
        continue;
      }
      if (k.startsWith('on') && typeof v === 'function') {
        const ev = k.slice(2);
        if (ev) e.addEventListener(ev, v);
        continue;
      }
      if (v === true) {
        e.setAttribute(k, '');
        continue;
      }
      e.setAttribute(k, String(v));
    }
  }
  for (const ch of children) {
    if (ch == null) continue;
    if (typeof ch === 'string' || typeof ch === 'number') {
      e.appendChild(document.createTextNode(String(ch)));
    } else {
      e.appendChild(ch);
    }
  }
  return e;
}

/**
 * Gabarits HTML (développeur) : innerHTML uniquement après passage par sanitizeHTML → DOMPurify.
 * Sans chaîne complète, aucun innerHTML (évite XSS si script chargé dans le mauvais ordre).
 */
function isStaticHtmlSanitizationAvailable() {
  const p = globalThis.DOMPurify;
  // DOMPurify 3.x expose l’API sur un callable (typeof === 'function'), pas un pur objet.
  return (
    typeof globalThis.sanitizeHTML === 'function' &&
    p != null &&
    typeof p.sanitize === 'function'
  );
}

function setStaticHtml(el, trustedStaticHtml) {
  if (!el) return;
  const raw = trustedStaticHtml ?? '';
  if (!isStaticHtmlSanitizationAvailable()) {
    console.error(
      '[html-safe] DOMPurify ou sanitizeHTML indisponible — innerHTML interdit (risque XSS). Gabarit non rendu.',
    );
    clearChildren(el);
    return;
  }
  // eslint-disable-next-line no-restricted-syntax -- seul point d’assignation innerHTML assaini (DOMPurify)
  el.innerHTML = globalThis.sanitizeHTML(raw);
}

function normUtf8(value) {
  try {
    return String(value ?? '').normalize('NFC');
  } catch {
    return String(value ?? '');
  }
}

const DEFAULT_HIGHLIGHT_MARK_STYLE =
  'background:rgba(9,188,138,.25);color:var(--brand);border-radius:2px;padding:0 1px';

/**
 * Segments texte / match pour surlignage (aucune balise).
 * @returns {{ type: 'text' | 'mark', value: string }[]}
 */
function highlightSegments(text, query) {
  const raw = normUtf8(text);
  if (!query || !String(query).trim()) return [{ type: 'text', value: raw }];
  const qi = String(query).toLowerCase();
  const lower = raw.toLowerCase();
  const out = [];
  let idx = lower.indexOf(qi);
  let i = 0;
  while (idx >= 0) {
    if (idx > i) out.push({ type: 'text', value: raw.slice(i, idx) });
    out.push({ type: 'mark', value: raw.slice(idx, idx + qi.length) });
    i = idx + qi.length;
    idx = lower.indexOf(qi, i);
  }
  if (i < raw.length) out.push({ type: 'text', value: raw.slice(i) });
  return out;
}

/**
 * HTML sûr avec &lt;mark&gt; pour une requête (données utilisateur échappées).
 * @param {string} markStyle — CSS inline (côté app, pas les données)
 */
function highlightQueryHtml(text, query, markStyle) {
  const style = markStyle || DEFAULT_HIGHLIGHT_MARK_STYLE;
  const open = '<mark style="' + escapeAttr(style) + '">';
  const html = highlightSegments(text, query)
    .map(s => (s.type === 'text' ? escapeHtml(s.value) : open + escapeHtml(s.value) + '</mark>'))
    .join('');
  return typeof globalThis.sanitizeHTML === 'function' ? globalThis.sanitizeHTML(html) : html;
}

/**
 * Ajoute des nœuds texte + <mark> pour le surlignage (sans innerHTML sur le parent).
 */
function appendHighlightedContent(parent, text, query, markStyle) {
  if (!parent) return;
  const style = markStyle || DEFAULT_HIGHLIGHT_MARK_STYLE;
  for (const s of highlightSegments(text, query)) {
    if (s.type === 'text') parent.appendChild(document.createTextNode(s.value));
    else {
      const m = document.createElement('mark');
      m.style.cssText = style;
      m.textContent = s.value;
      parent.appendChild(m);
    }
  }
}

globalThis.escapeHtml = escapeHtml;
globalThis.escHtml = escHtml;
globalThis.escapeAttr = escapeAttr;
globalThis.clearChildren = clearChildren;
globalThis.h = h;
globalThis.setStaticHtml = setStaticHtml;
globalThis.normUtf8 = normUtf8;
globalThis.highlightSegments = highlightSegments;
globalThis.highlightQueryHtml = highlightQueryHtml;
globalThis.appendHighlightedContent = appendHighlightedContent;
/** Compat : même nom que l’ancienne fonction globale dans ui.js */
globalThis.esc = escapeHtml;
