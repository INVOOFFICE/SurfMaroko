// ═══════════════════════════════════════════
//  pdf.js  —  Génération PDF, templates, impression
// ═══════════════════════════════════════════

// ── Preview & download PDF (génération live) ──
// ═══════════════════════════════════════════
let _previewCurrentDoc = null;
let _previewCurrentTpl = null;
let _previewCurrentColor = null;

// ── Maintenabilité : encapsulation des états preview PDF ──
window.APP = window.APP || {};
window.APP.pdfPreview = window.APP.pdfPreview || {};
const _definePdfPreviewState = (key, getter, setter) => {
  try {
    const desc = Object.getOwnPropertyDescriptor(window.APP.pdfPreview, key);
    if (desc && (desc.get || desc.set)) return;
    Object.defineProperty(window.APP.pdfPreview, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: false,
    });
  } catch (_) {}
};
_definePdfPreviewState(
  'doc',
  () => _previewCurrentDoc,
  v => {
    _previewCurrentDoc = v;
  },
);
_definePdfPreviewState(
  'tpl',
  () => _previewCurrentTpl,
  v => {
    _previewCurrentTpl = v;
  },
);
_definePdfPreviewState(
  'color',
  () => _previewCurrentColor,
  v => {
    _previewCurrentColor = v;
  },
);

/**
 * PDF rasterisé (html2canvas → jsPDF) : compromis vitesse / qualité impression.
 * - scale ~3 : ~300 dpi effectifs sur la largeur logique 794px (A4 a 96 dpi) - suffisant pour l'impression pro.
 * - JPEG 0.97 : encode et embarque beaucoup plus vite que le PNG, taille PDF réduite, rendu texte/aplats excellent.
 *   (Monter à 0.99 ou scale 3.5 si besoin marginal de netteté ; PNG possible mais ~2–4× plus lent.)
 */
const PDF_HTML2CANVAS_SCALE = 3;
const PDF_JPEG_QUALITY = 0.97;

function buildLiveDoc() {
  // Build a doc object from the current form state
  const ref = document.getElementById('doc-ref').value || '—';
  const type = document.getElementById('doc-type').value || 'F';
  const date = document.getElementById('doc-date').value || new Date().toISOString().slice(0, 10);
  const status = document.getElementById('doc-status').value || 'Brouillon';
  const clientId = document.getElementById('doc-client').value || '';
  const client = DB.clients.find(c => c.id === clientId) || {};
  const notes = document.getElementById('doc-notes').value || '';
  const terms = document.getElementById('doc-terms').value || '';
  const payment = document.getElementById('doc-payment').value || '';
  const remise = parseFloat(document.getElementById('doc-remise').value) || 0;
  const acompte = parseFloat(document.getElementById('doc-acompte').value) || 0;
  const sourceRef = (document.getElementById('doc-source-ref')?.value || '').trim();
  const sourceType = (document.getElementById('doc-source-type')?.value || '').trim();

  const totals = getTotals();

  const aeLive = typeof isAutoEntrepreneurVAT === 'function' && isAutoEntrepreneurVAT();
  const priceModeSel = document.getElementById('doc-price-mode')?.value;
  const priceMode =
    (typeof window.normalizePriceMode === 'function'
      ? window.normalizePriceMode(priceModeSel || window.APP?.docPriceMode)
      : null) ||
    (typeof window.getGlobalPriceMode === 'function' ? window.getGlobalPriceMode() : 'TTC');
  return {
    ref,
    type,
    date,
    status,
    clientId,
    clientName: client.name || 'Client N/A',
    lines: APP.docLines.map(l => ({ ...l })),
    sourceRef,
    sourceType,
    notes,
    terms,
    payment,
    remise,
    acompte,
    ht: totals.ht,
    tva: totals.tva,
    ttc: totals.ttc,
    aeExempt: aeLive,
    priceMode,
  };
}

function previewDoc() {
  if (!APP.docLines.length) {
    toast('Ajoutez au moins un article pour prévisualiser', 'err');
    return;
  }
  APP.pdfPreview.doc = buildLiveDoc();
  APP.pdfPreview.tpl = DB.settings.pdfTemplate || 'classic';
  APP.pdfPreview.color = DB.settings.bandColor || '#1a6b3c';

  // Sync color picker & template tabs in modal
  document.getElementById('preview-band-color').value = APP.pdfPreview.color;
  syncPreviewLogoHeightControls();
  syncPreviewCompanyInfoControl();
  document.getElementById('preview-pdf-subtitle').textContent =
    APP.pdfPreview.doc.ref +
    ' — ' +
    ({ F: 'Facture', D: 'Devis', BL: 'Bon de Livraison', AV: 'Avoir' }[APP.pdfPreview.doc.type] ||
      APP.pdfPreview.doc.type);
  syncPreviewTplTabs(APP.pdfPreview.tpl);
  renderPreviewIframe();
  openModal('modal-preview-pdf');
}

/** Curseur logo (aperçu) ← valeur enregistrée */
function syncPreviewLogoHeightControls() {
  const plh = document.getElementById('preview-logo-height');
  const plhv = document.getElementById('preview-logo-height-val');
  const h =
    typeof clampLogoDocHeight === 'function'
      ? clampLogoDocHeight(DB.settings.logoHeightPx)
      : (() => {
          const n = Number(DB.settings.logoHeightPx);
          return Math.min(120, Math.max(24, Number.isFinite(n) ? Math.round(n) : 48));
        })();
  if (plh) plh.value = String(h);
  if (plhv) plhv.textContent = String(h);
}

/** Case « infos entreprise + logo » (aperçu) ← valeur enregistrée */
function syncPreviewCompanyInfoControl() {
  const cb = document.getElementById('preview-show-company-with-logo');
  if (cb) cb.checked = DB.settings.pdfShowCompanyInfoWithLogo !== false;
}

function applyPreviewCompanyInfoFromControl() {
  const cb = document.getElementById('preview-show-company-with-logo');
  if (!cb) return;
  DB.settings.pdfShowCompanyInfoWithLogo = !!cb.checked;
  const sCb = document.getElementById('s-pdf-show-company-with-logo');
  if (sCb) sCb.checked = !!cb.checked;
  renderPreviewIframe();
}

/** Ajustement live du logo depuis la modale d’aperçu : met à jour les paramètres et l’iframe */
function applyPreviewLogoHeightFromControl() {
  const plh = document.getElementById('preview-logo-height');
  if (!plh) return;
  const h =
    typeof clampLogoDocHeight === 'function'
      ? clampLogoDocHeight(plh.value)
      : Math.min(120, Math.max(24, parseInt(plh.value, 10) || 48));
  DB.settings.logoHeightPx = h;
  const plhv = document.getElementById('preview-logo-height-val');
  if (plhv) plhv.textContent = String(h);
  const s = document.getElementById('s-logo-height');
  const sv = document.getElementById('s-logo-height-val');
  if (s) s.value = String(h);
  if (sv) sv.textContent = String(h);
  renderPreviewIframe();
}

function renderPreviewIframe() {
  const html = buildInvoiceHTML(APP.pdfPreview.doc, APP.pdfPreview.tpl, APP.pdfPreview.color);
  const iframe = document.getElementById('preview-iframe');
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  // Auto-height + vérif. taille logo affichée (fidèle au curseur)
  setTimeout(() => {
    try {
      const h = doc.body.scrollHeight;
      iframe.style.height = Math.max(500, h + 40) + 'px';
      const img = doc.querySelector('img.invoice-logo');
      const lab = document.getElementById('preview-logo-height-val');
      if (img && lab) {
        const rendered = Math.round(img.getBoundingClientRect().height);
        const target =
          typeof clampLogoDocHeight === 'function'
            ? clampLogoDocHeight(DB.settings.logoHeightPx)
            : Math.min(120, Math.max(24, parseInt(String(DB.settings.logoHeightPx), 10) || 48));
        lab.textContent = String(target);
        lab.title =
          rendered > 0
            ? `Hauteur cible : ${target} px — rendu dans l’aperçu : ${rendered} px (même échelle que le PDF)`
            : '';
      }
    } catch (e) {}
  }, 120);
  document.getElementById('preview-tpl-label').textContent =
    'Template : ' +
    ({ classic: 'Classic', modern: 'Modern', minimal: 'Minimal', executive: 'Executive' }[
      APP.pdfPreview.tpl
    ] || APP.pdfPreview.tpl);
}

function switchPreviewTemplate(tpl) {
  APP.pdfPreview.tpl = tpl;
  syncPreviewTplTabs(tpl);
  renderPreviewIframe();
}

function syncPreviewTplTabs(tpl) {
  document.querySelectorAll('.pvtpl-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tpl === tpl);
  });
}

function refreshPreview() {
  APP.pdfPreview.color = document.getElementById('preview-band-color').value;
  renderPreviewIframe();
}

async function downloadDocPDF() {
  const docObj = APP.pdfPreview.doc || buildLiveDoc();
  if (!docObj.lines || !docObj.lines.length) {
    toast('Ajoutez au moins un article', 'err');
    return;
  }
  const tpl = APP.pdfPreview.tpl || DB.settings.pdfTemplate || 'classic';
  const color = APP.pdfPreview.color || DB.settings.bandColor || '#1a6b3c';

  showPdfSpinner('Génération PDF…');
  try {
    await _generateAndDownloadPDF(docObj, tpl, color);
  } catch (e) {
    console.error('[PDF] Erreur génération:', e);
    toast('❌ ' + (e.message || 'Erreur PDF — réessayez'), 'err');
  } finally {
    hidePdfSpinner();
  }
}

async function _generateAndDownloadPDF(docObj, tpl, color) {
  const htmlStr = buildInvoiceHTML(docObj, tpl, color);

  setPdfSpinnerStep('Rendu du document…', 15);

  // Vérifier que les librairies PDF sont disponibles
  if (typeof html2canvas === 'undefined')
    throw new Error('html2canvas non chargé — vérifiez votre connexion internet.');
  if (!window.jspdf?.jsPDF)
    throw new Error('jsPDF non chargé — vérifiez votre connexion internet.');

  // Create hidden iframe to render the HTML
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);

  // Helper : s'assurer que l'iframe est retirée même si une erreur survient
  const cleanupIframe = () => {
    try {
      if (iframe.parentNode) document.body.removeChild(iframe);
    } catch {}
  };

  try {
    {
      const idoc = iframe.contentDocument || iframe.contentWindow.document;
      idoc.open();
      idoc.write(htmlStr);
      idoc.close();
    }
    const idoc = iframe.contentDocument || iframe.contentWindow.document;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    setPdfSpinnerStep('Chargement des polices…', 28);
    try {
      await Promise.race([
        idoc.fonts?.ready ?? Promise.resolve(),
        new Promise(r => setTimeout(r, 1500)),
      ]);
    } catch (_) {}
    const imgs = idoc.querySelectorAll?.('img') || [];
    await Promise.all(
      [...imgs].map(
        img =>
          new Promise(res => {
            if (img.complete) return res();
            img.addEventListener('load', res, { once: true });
            img.addEventListener('error', res, { once: true });
          }),
      ),
    );
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const body = idoc.body;

    // Use html2canvas to render
    // Force la page à la hauteur A4 exacte (794×1123px) pour que le footer soit en bas
    const pageWrapEl = idoc.querySelector('.page-wrap');
    const contentH = pageWrapEl ? pageWrapEl.scrollHeight : body.scrollHeight;
    // On capture au minimum 1123px (une page A4 @96dpi) — jamais moins
    const captureH = Math.max(1123, contentH);
    if (pageWrapEl) pageWrapEl.style.minHeight = captureH + 'px';
    idoc.body.style.height = captureH + 'px';

    setPdfSpinnerStep('Capture de la page…', 55);
    const canvas = await html2canvas(body, {
      scale: PDF_HTML2CANVAS_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: captureH,
      windowWidth: 794,
      windowHeight: captureH,
      scrollY: 0,
      scrollX: 0,
      logging: false,
      imageTimeout: 0,
    });

    cleanupIframe();

    setPdfSpinnerStep('Assemblage du PDF…', 80);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Convert canvas px to mm
    const imgH = (canvas.height * pageW) / canvas.width;

    // SEUIL : on n'ajoute une page que si le contenu restant dépasse 5mm
    const MIN_SLICE = 5;

    const rasterToPdf = cvs => cvs.toDataURL('image/jpeg', PDF_JPEG_QUALITY);

    if (imgH <= pageH + MIN_SLICE) {
      pdf.addImage(rasterToPdf(canvas), 'JPEG', 0, 0, pageW, Math.min(imgH, pageH), undefined, 'FAST');
    } else {
      // Multi-pages : découper proprement
      let yPosMM = 0;
      let remainMM = imgH;
      let pageIndex = 0;

      while (remainMM > MIN_SLICE) {
        if (pageIndex > 0) pdf.addPage();
        const sliceHmm = Math.min(pageH, remainMM);
        const sliceHpx = (sliceHmm / imgH) * canvas.height;
        const srcYpx = (yPosMM / imgH) * canvas.height;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sliceHpx);
        const ctx = sliceCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, srcYpx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);

        pdf.addImage(rasterToPdf(sliceCanvas), 'JPEG', 0, 0, pageW, sliceHmm, undefined, 'FAST');

        yPosMM += pageH;
        remainMM -= pageH;
        pageIndex++;
      }
    }

    setPdfSpinnerStep('Finalisation…', 95);
    const filename = (docObj.ref || 'document').replace(/[^a-zA-Z0-9\-_]/g, '_') + '.pdf';
    pdf.save(filename);
    setPdfSpinnerStep('PDF prêt !', 100);
    await new Promise(r => setTimeout(r, 400));
    toast('✅ PDF téléchargé : ' + filename, 'suc');
  } catch (e) {
    cleanupIframe();
    throw e; // Remonter l'erreur au caller (downloadDocPDF) qui affiche le toast
  }
}

async function downloadDocPDFById(id, opts = {}) {
  const d = DB.docs.find(x => x.id === id);
  if (!d) {
    toast('Document introuvable', 'err');
    return;
  }
  const tpl = opts.tpl ?? DB.settings.pdfTemplate ?? 'classic';
  const color = opts.color ?? DB.settings.bandColor ?? '#1a6b3c';
  showPdfSpinner('Génération PDF…');
  try {
    await _generateAndDownloadPDF(d, tpl, color);
  } catch (e) {
    console.error(e);
    toast('Erreur PDF', 'err');
  } finally {
    hidePdfSpinner();
  }
}

// ── Templates PDF & band color ──
// ═══════════════════════════════════════════
const PDF_TEMPLATES = {
  classic: {
    name: 'Classic',
    headerBg: c => c,
    headerLayout: 'full', // logo left, info right
    accentColor: c => c,
    footerBg: c => c,
    borderRadius: '0px',
    tableHeaderStyle: c => `background:${c};color:#fff;`,
    pageStyle: '',
  },
  modern: {
    name: 'Modern',
    headerBg: c => c,
    headerLayout: 'split',
    accentColor: c => c,
    footerBg: '#f1f5f9',
    borderRadius: '8px',
    tableHeaderStyle: c => `background:${c};color:#fff;`,
    pageStyle: 'font-family:Arial,sans-serif',
  },
  minimal: {
    name: 'Minimal',
    headerBg: () => '#ffffff',
    headerLayout: 'minimal',
    accentColor: c => c,
    footerBg: '#ffffff',
    borderRadius: '0px',
    tableHeaderStyle: c => `background:${c};color:#fff;border-radius:0`,
    pageStyle: '',
  },
  executive: {
    name: 'Executive',
    headerBg: c => `linear-gradient(135deg,${c},${shadeColor(c, -30)})`,
    headerLayout: 'executive',
    accentColor: c => c,
    footerBg: c => `${c}22`,
    borderRadius: '4px',
    tableHeaderStyle: c =>
      `background:linear-gradient(90deg,${c},${shadeColor(c, -20)});color:#fff;`,
    pageStyle: '',
  },
};

function shadeColor(hex, pct) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + pct));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
  const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function selectTemplate(tpl) {
  DB.settings.pdfTemplate = tpl;
  ['classic', 'modern', 'minimal', 'executive'].forEach(t => {
    const card = document.getElementById('tpl-card-' + t);
    const badge = document.getElementById('badge-' + t);
    if (!card) return;
    if (t === tpl) {
      card.style.border = '2px solid var(--teal)';
      card.style.background = 'rgba(9,188,138,0.08)';
      if (badge) badge.style.display = 'inline-flex';
    } else {
      card.style.border = '2px solid var(--border2)';
      card.style.background = 'var(--surface)';
      if (badge) badge.style.display = 'none';
    }
  });
  // Update template default band colors
  const defaults = {
    classic: '#1a6b3c',
    modern: '#2563eb',
    minimal: '#374151',
    executive: '#7c3aed',
  };
  if (!DB.settings._userBandColor) {
    const col = defaults[tpl] || '#1a6b3c';
    document.getElementById('s-band-color').value = col;
    document.getElementById('s-band-color-hex').value = col;
    updateBandPreview();
  }
}

function updateBandPreview() {
  const col = document.getElementById('s-band-color').value;
  document.getElementById('s-band-color-hex').value = col;
  const prev = document.getElementById('band-live-preview');
  if (prev) prev.style.background = col;
  DB.settings.bandColor = col;
}

function syncBandHex() {
  const hex = document.getElementById('s-band-color-hex').value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    document.getElementById('s-band-color').value = hex;
    const prev = document.getElementById('band-live-preview');
    if (prev) prev.style.background = hex;
    DB.settings.bandColor = hex;
    DB.settings._userBandColor = true;
  }
}

function setBandColor(hex) {
  document.getElementById('s-band-color').value = hex;
  document.getElementById('s-band-color-hex').value = hex;
  const prev = document.getElementById('band-live-preview');
  if (prev) prev.style.background = hex;
  DB.settings.bandColor = hex;
  DB.settings._userBandColor = true;
}

function loadTemplateSettings() {
  const tpl = DB.settings.pdfTemplate || 'classic';
  selectTemplate(tpl);
  const bandColor = DB.settings.bandColor || '#1a6b3c';
  document.getElementById('s-band-color').value = bandColor;
  document.getElementById('s-band-color-hex').value = bandColor;
  const prev = document.getElementById('band-live-preview');
  if (prev) prev.style.background = bandColor;
}

function saveTemplateSettings() {
  DB.settings.pdfTemplate = DB.settings.pdfTemplate || 'classic';
  DB.settings.bandColor = document.getElementById('s-band-color').value || '#1a6b3c';
}

// ══ BUILD PDF INVOICE HTML ══
/** Mention légale auto-entrepreneur exonéré de TVA (Maroc) */
const AE_CGI_LEGAL_LINE =
  "TVA non applicable selon le régime de l'auto-entrepreneur (article 89 du CGI – Maroc)";

function buildInvoiceHTML(doc, tpl, bandColor) {
  const _escHtml = v =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const _safeImgSrc = v => {
    const src = String(v || '').trim();
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;
    if (/^https?:\/\//i.test(src)) return src;
    if (/^blob:/i.test(src)) return src;
    return '';
  };
  const _safeNum = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  const s0 = DB.settings || {};
  const s = {
    ...s0,
    name: _escHtml(s0.name || ''),
    address: _escHtml(s0.address || ''),
    city: _escHtml(s0.city || ''),
    phone: _escHtml(s0.phone || ''),
    email: _escHtml(s0.email || ''),
    ice: _escHtml(s0.ice || ''),
    if: _escHtml(s0.if || ''),
    rc: _escHtml(s0.rc || ''),
    tp: _escHtml(s0.tp || ''),
    rib: _escHtml(s0.rib || ''),
    bank: _escHtml(s0.bank || ''),
    footer: _escHtml(s0.footer || ''),
    logoData: _safeImgSrc(s0.logoData || ''),
    currency: _escHtml(s0.currency || 'DH'),
  };
  doc = {
    ...doc,
    ref: _escHtml(doc?.ref || ''),
    date: _escHtml(doc?.date || ''),
    status: _escHtml(doc?.status || ''),
    clientName: _escHtml(doc?.clientName || ''),
    sourceRef: _escHtml(doc?.sourceRef || ''),
    sourceType: _escHtml(doc?.sourceType || ''),
    notes: _escHtml(doc?.notes || ''),
    terms: _escHtml(doc?.terms || ''),
    payment: _escHtml(doc?.payment || ''),
    ht: _safeNum(doc?.ht, 0),
    tva: _safeNum(doc?.tva, 0),
    ttc: _safeNum(doc?.ttc, 0),
    remise: _safeNum(doc?.remise, 0),
    acompte: _safeNum(doc?.acompte, 0),
    priceMode: doc?.priceMode,
    lines: Array.isArray(doc?.lines)
      ? doc.lines.map(l => ({
          ...l,
          name: _escHtml(l?.name || ''),
          desc: _escHtml(l?.desc || ''),
          qty: _safeNum(l?.qty, 0),
          price: _safeNum(l?.price, 0),
          tva: _safeNum(l?.tva, 0),
        }))
      : [],
  };
  const showCompanyInfo = s0.pdfShowCompanyInfoWithLogo !== false;
  const logoH =
    typeof clampLogoDocHeight === 'function'
      ? clampLogoDocHeight(s.logoHeightPx)
      : (() => {
          const n = Number(s.logoHeightPx);
          return Math.min(120, Math.max(24, Number.isFinite(n) ? Math.round(n) : 48));
        })();
  /** Hauteur imposée via --invoice-logo-h + .invoice-logo (évite max-width:100% qui réduisait la hauteur réelle) */
  const t = PDF_TEMPLATES[tpl] || PDF_TEMPLATES.classic;
  const bc = bandColor || s.bandColor || '#1a6b3c';
  const cur = s.currency || 'DH';
  const fmtN = v =>
    Number(v || 0)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const aeDoc =
    typeof docIsAutoEntrepreneurExempt === 'function' && docIsAutoEntrepreneurExempt(doc);
  const puInputMode =
    typeof window.normalizePriceMode === 'function'
      ? window.normalizePriceMode(doc?.priceMode) ||
        (typeof window.getGlobalPriceMode === 'function' ? window.getGlobalPriceMode() : 'TTC')
      : 'TTC';
  const puShowUnitAsHT = puInputMode === 'HT';
  const typeLabel = _escHtml(
    { F: 'FACTURE', D: 'DEVIS', BL: 'BON DE LIVRAISON', AV: 'AVOIR' }[doc.type] ||
      doc.type ||
      'DOCUMENT',
  );
  const sourceLabel =
    doc.sourceType === 'F'
      ? 'Facture d’origine'
      : doc.sourceType === 'D'
        ? 'Devis source'
        : 'Document source';
  const sourceLine =
    doc.type === 'AV' && doc.sourceRef
      ? `<div style="font-size:12px;color:#b91c1c;margin-top:4px"><strong>${sourceLabel} :</strong> ${doc.sourceRef}</div>`
      : '';

  function _buildHeaderHTML() {
    const companyLight = showCompanyInfo
      ? `<div style="font-size:20px;font-weight:800;color:#111;letter-spacing:-.5px">${s.name || 'Votre Entreprise'}</div>
            <div style="font-size:11px;color:#555;margin-top:3px">${[s.address, s.city].filter(Boolean).join(' — ')}</div>
            <div style="font-size:11px;color:#555">${[s.phone, s.email].filter(Boolean).join(' · ')}</div>`
      : '';
    const companyBand = showCompanyInfo
      ? `<div style="font-size:18px;font-weight:800;color:#fff">${s.name || 'Votre Entreprise'}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.75);margin-top:3px">${[s.address, s.city].filter(Boolean).join(' · ')}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.75)">${[s.phone, s.email].filter(Boolean).join(' · ')}</div>`
      : '';
    const companyExec = showCompanyInfo
      ? `<div style="font-size:19px;font-weight:800;color:#fff">${s.name || 'Votre Entreprise'}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.8);margin-top:2px">${[s.address, s.city].filter(Boolean).join(' · ')}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.8)">${[s.phone, s.email].filter(Boolean).join(' · ')}</div>`
      : '';

    if (tpl === 'minimal') {
      const minLeftStyle =
        !showCompanyInfo && s.logoData
          ? 'vertical-align:middle;text-align:center;'
          : 'vertical-align:top;';
      return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;padding-bottom:14px">
        <tr>
          <td style="${minLeftStyle}">
            ${s.logoData ? `<img src="${s.logoData}" alt="" class="invoice-logo" style="margin-bottom:6px">` : ''}
            ${companyLight}
          </td>
          <td style="text-align:right;vertical-align:top">
            <div style="font-size:28px;font-weight:900;color:${bc};letter-spacing:-1px">${typeLabel}</div>
            <div style="font-size:13px;color:#444;margin-top:4px"><strong>N° :</strong> ${doc.ref}</div>
            <div style="font-size:13px;color:#444"><strong>Date :</strong> ${doc.date}</div>
            ${sourceLine}
          </td>
        </tr>
      </table>`;
    }

    if (tpl === 'modern') {
      const modLeftExtra = !showCompanyInfo && s.logoData ? 'text-align:center;' : '';
      return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0">
        <tr>
          <td style="background:${bc};padding:18px 22px;border-radius:8px 0 0 8px;vertical-align:middle;width:60%;${modLeftExtra}">
            ${s.logoData ? `<img src="${s.logoData}" alt="" class="invoice-logo" style="margin-bottom:6px">` : ''}
            ${companyBand}
          </td>
          <td style="background:${shadeColor(bc, -40)};padding:18px 22px;border-radius:0 8px 8px 0;text-align:right;vertical-align:middle">
            <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-1px">${typeLabel}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:6px"><strong>Référence :</strong> ${doc.ref}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.85)"><strong>Date :</strong> ${doc.date}</div>
            ${sourceLine.replace('#b91c1c', 'rgba(255,255,255,0.92)').replace('font-size:12px;color:rgba(255,255,255,0.92);margin-top:4px', 'font-size:12px;color:rgba(255,255,255,0.92);margin-top:4px')}
          </td>
        </tr>
      </table>
      <div style="height:8px"></div>`;
    }

    if (tpl === 'executive') {
      const grad = `linear-gradient(135deg,${bc},${shadeColor(bc, -30)})`;
      const execLeft =
        !showCompanyInfo && s.logoData
          ? 'display:flex;flex-direction:column;align-items:center;text-align:center;'
          : '';
      return `
      <div style="background:${grad};border-radius:8px;padding:20px 24px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
        <div style="${execLeft}">
          ${s.logoData ? `<img src="${s.logoData}" alt="" class="invoice-logo" style="margin-bottom:8px">` : ''}
          ${companyExec}
        </div>
        <div style="text-align:right">
          <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;text-shadow:0 2px 8px rgba(0,0,0,0.2)">${typeLabel}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:5px">${doc.ref}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75)">${doc.date}</div>
          ${sourceLine.replace('#b91c1c', 'rgba(255,255,255,0.9)').replace('font-size:12px;color:rgba(255,255,255,0.9);margin-top:4px', 'font-size:11px;color:rgba(255,255,255,0.9);margin-top:4px')}
        </div>
      </div>`;
    }

    const classicLeft =
      !showCompanyInfo && s.logoData
        ? 'display:flex;flex-direction:column;align-items:center;text-align:center;'
        : '';
    return `
      <div style="background:${bc};padding:16px 22px;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <div style="${classicLeft}">
          ${s.logoData ? `<img src="${s.logoData}" alt="" class="invoice-logo" style="margin-bottom:6px">` : ''}
          ${companyBand}
        </div>
        <div style="text-align:right">
          <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px">${typeLabel}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:6px">N° ${doc.ref}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85)">Date : ${doc.date}</div>
          ${sourceLine.replace('#b91c1c', 'rgba(255,255,255,0.95)').replace('font-size:12px;color:rgba(255,255,255,0.95);margin-top:4px', 'font-size:11px;color:rgba(255,255,255,0.95);margin-top:4px')}
        </div>
      </div>`;
  }

  function _buildClientBlockHTML() {
    const clientRaw = DB.clients.find(c => c.id === doc.clientId) || {
      name: doc.clientName || 'N/A',
    };
    const client = {
      name: _escHtml(clientRaw.name || ''),
      ice: _escHtml(clientRaw.ice || ''),
      if: _escHtml(clientRaw.if || ''),
      rc: _escHtml(clientRaw.rc || ''),
      address: _escHtml(clientRaw.address || ''),
      city: _escHtml(clientRaw.city || ''),
      phone: _escHtml(clientRaw.phone || ''),
    };
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px">
      <tr>
        <td style="width:48%;vertical-align:top;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px">
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Émetteur</div>
          <div style="font-size:12px;font-weight:700;color:#111">${s.name || '—'}</div>
          ${s.ice ? `<div style="font-size:11px;color:#555">ICE : ${s.ice}</div>` : ''}
          ${s.if ? `<div style="font-size:11px;color:#555">IF : ${s.if}</div>` : ''}
          ${s.rc ? `<div style="font-size:11px;color:#555">RC : ${s.rc}</div>` : ''}
          ${s.tp ? `<div style="font-size:11px;color:#555">TP : ${s.tp}</div>` : ''}
          ${s.address ? `<div style="font-size:11px;color:#555;margin-top:4px">${s.address}${s.city ? ', ' + s.city : ''}</div>` : ''}
        </td>
        <td style="width:4%"></td>
        <td style="width:48%;vertical-align:top;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;background:#f9fafb">
          <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Destinataire</div>
          <div style="font-size:12px;font-weight:700;color:#111">${client.name || '—'}</div>
          ${client.ice ? `<div style="font-size:11px;color:#555">ICE : ${client.ice}</div>` : ''}
          ${client.if ? `<div style="font-size:11px;color:#555">IF : ${client.if}</div>` : ''}
          ${client.rc ? `<div style="font-size:11px;color:#555">RC : ${client.rc}</div>` : ''}
          ${client.address ? `<div style="font-size:11px;color:#555;margin-top:4px">${client.address}${client.city ? ', ' + client.city : ''}</div>` : ''}
          ${client.phone ? `<div style="font-size:11px;color:#555">Tél : ${client.phone}</div>` : ''}
        </td>
      </tr>
    </table>`;
  }

  function _buildLinesHTML() {
    const tableHeaderStyle = t.tableHeaderStyle(bc);
    if (aeDoc) {
      const linesHTML = (doc.lines || [])
        .map((l, i) => {
          const qty = Number(l.qty || 1);
          const unitHT = Number(l.price || 0);
          const lineTotal = qty * unitHT;
          return `
    <tr style="background:${i % 2 === 1 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #f0f0f0">${l.name || '—'}${l.desc ? `<div style="font-size:10px;color:#888">${l.desc}</div>` : ''}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;border-bottom:1px solid #f0f0f0">${fmtN(unitHT)} ${cur}</td>
      <td style="padding:8px 10px;text-align:center;font-size:12px;border-bottom:1px solid #f0f0f0">${qty}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:${bc};border-bottom:1px solid #f0f0f0">${fmtN(lineTotal)} ${cur}</td>
    </tr>`;
        })
        .join('');
      return {
        tableHeaderStyle,
        linesHTML,
        colgroup: `<colgroup>
        <col style="width:42%">
        <col style="width:20%">
        <col style="width:12%">
        <col style="width:26%">
      </colgroup>`,
        theadRow: `
        <th style="${tableHeaderStyle}padding:9px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Désignation</th>
        <th style="${tableHeaderStyle}padding:9px 10px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Prix unitaire (HT)</th>
        <th style="${tableHeaderStyle}padding:9px 10px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Qté</th>
        <th style="${tableHeaderStyle}padding:9px 10px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Total</th>`,
      };
    }
    const linesHTML = (doc.lines || [])
      .map((l, i) => {
        const qty = Number(l.qty || 1);
        const unitHT = Number(l.price || 0);
        const tvaRate = Number(l.tva || 0);
        const unitTTC = unitHT * (1 + tvaRate / 100);
        const unitShown = puShowUnitAsHT ? unitHT : unitTTC;
        const totalHT = qty * unitHT;
        const totalTTC = totalHT * (1 + tvaRate / 100);
        return `
    <tr style="background:${i % 2 === 1 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #f0f0f0">${l.name || '—'}${l.desc ? `<div style="font-size:10px;color:#888">${l.desc}</div>` : ''}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;border-bottom:1px solid #f0f0f0">${fmtN(unitShown)} ${cur}</td>
      <td style="padding:8px 10px;text-align:center;font-size:12px;border-bottom:1px solid #f0f0f0">${qty}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;border-bottom:1px solid #f0f0f0">${fmtN(totalHT)} ${cur}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:${bc};border-bottom:1px solid #f0f0f0">${fmtN(totalTTC)} ${cur}</td>
    </tr>`;
      })
      .join('');
    return {
      tableHeaderStyle,
      linesHTML,
      colgroup: `<colgroup>
        <col style="width:32%">
        <col style="width:15%">
        <col style="width:10%">
        <col style="width:20%">
        <col style="width:23%">
      </colgroup>`,
      theadRow: `
          <th style="${tableHeaderStyle}padding:9px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Désignation</th>
          <th style="${tableHeaderStyle}padding:9px 10px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Prix U ${puShowUnitAsHT ? '(HT)' : '(TTC)'}</th>
          <th style="${tableHeaderStyle}padding:9px 10px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Qté</th>
          <th style="${tableHeaderStyle}padding:9px 10px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Total HT</th>
          <th style="${tableHeaderStyle}padding:9px 10px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Total TTC</th>`,
    };
  }

  function _buildTotalsHTML() {
    const ht = doc.ht || 0;
    const tva = doc.tva || 0;
    const ttc = doc.ttc || 0;
    const remise = doc.remise || 0;
    const acompte = doc.acompte || 0;

    if (aeDoc) {
      const payAmount = doc.type === 'F' && acompte > 0 ? ttc - acompte : ttc;
      const arreteText = payAmount > 0 ? nombreEnLettres(payAmount, cur) : '';
      const payLabel = doc.type === 'AV' ? 'Montant à rembourser' : 'Total à payer';
      const legalBlock = `
    <div style="margin-top:12px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:6px;font-size:10px;color:#334155;line-height:1.5;background:#f8fafc;font-weight:600">
      ${AE_CGI_LEGAL_LINE}
    </div>`;
      return `
    <table cellpadding="0" cellspacing="0" style="margin-left:auto;margin-top:10px;min-width:240px">
      <tr style="background:${bc}">
        <td style="padding:10px 16px;font-size:14px;font-weight:800;color:#fff;border-radius:4px 0 0 4px">${payLabel} :</td>
        <td style="padding:10px 16px;text-align:right;font-size:15px;font-weight:900;color:#fff;border-radius:0 4px 4px 0">${fmtN(Math.max(payAmount, 0))} ${cur}</td>
      </tr>
    </table>
    ${arreteText ? `<div style="margin-top:10px;padding:8px 14px;background:${bc}11;border:1px solid ${bc}44;border-radius:6px;font-size:11px;color:#333;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:700">Le présent document est arrêté à la somme de </span><span style="font-style:italic">${arreteText}</span></div>` : ''}
    ${legalBlock}
  `;
    }

    const arreteText = ttc > 0 ? nombreEnLettres(ttc, cur) : '';

    return `
    <table cellpadding="0" cellspacing="0" style="margin-left:auto;margin-top:10px;min-width:220px">
      ${remise > 0 ? `<tr><td style="padding:4px 10px;font-size:12px;color:#555">Remise :</td><td style="padding:4px 10px;text-align:right;font-size:12px">- ${fmtN(remise)} ${cur}</td></tr>` : ''}
      <tr><td style="padding:4px 10px;font-size:12px;color:#555">Total HT :</td><td style="padding:4px 10px;text-align:right;font-size:12px;font-weight:600">${fmtN(ht)} ${cur}</td></tr>
      <tr><td style="padding:4px 10px;font-size:12px;color:#555">TVA :</td><td style="padding:4px 10px;text-align:right;font-size:12px">${fmtN(tva)} ${cur}</td></tr>
      <tr style="background:${bc}">
        <td style="padding:8px 14px;font-size:13px;font-weight:800;color:#fff;border-radius:4px 0 0 4px">Total TTC :</td>
        <td style="padding:8px 14px;text-align:right;font-size:14px;font-weight:900;color:#fff;border-radius:0 4px 4px 0">${fmtN(ttc)} ${cur}</td>
      </tr>
      ${acompte > 0 ? `<tr><td style="padding:4px 10px;font-size:12px;color:#555">Acompte :</td><td style="padding:4px 10px;text-align:right;font-size:12px">- ${fmtN(acompte)} ${cur}</td></tr><tr><td style="padding:4px 10px;font-size:13px;font-weight:700;color:#111">Reste à payer :</td><td style="padding:4px 10px;text-align:right;font-size:13px;font-weight:700;color:${bc}">${fmtN(ttc - acompte)} ${cur}</td></tr>` : ''}
    </table>
    ${arreteText ? `<div style="margin-top:10px;padding:8px 14px;background:${bc}11;border:1px solid ${bc}44;border-radius:6px;font-size:11px;color:#333;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:700">Le présent document est arrêté à la somme de </span><span style="font-style:italic">${arreteText}</span></div>` : ''}
  `;
  }

  function _buildFooterHTML() {
    const footerLegal = `ICE: ${s.ice || '—'} · IF: ${s.if || '—'} · RC: ${s.rc || '—'} · TP: ${s.tp || '—'}`;
    const bankInfo = s.rib ? `Banque: ${s.bank || ''} · RIB: ${s.rib}` : '';
    const footerStyle =
      tpl === 'executive'
        ? `background:${bc}22;border-top:3px solid ${bc};`
        : tpl === 'minimal'
          ? `border-top:2px solid ${bc};`
          : tpl === 'modern'
            ? `background:#f8fafc;border-top:2px solid ${bc};`
            : `background:${bc};color:#fff;`;
    const footerTextColor = tpl === 'classic' ? '#fff' : '#555';

    return `
    <div style="padding:10px 16px;border-radius:4px;${footerStyle}">
      <div style="text-align:center;font-size:10px;color:${footerTextColor};margin-bottom:3px">${s.footer || 'Merci de votre confiance.'}</div>
      <div style="text-align:center;font-size:9px;color:${footerTextColor};opacity:.8">${footerLegal}</div>
      ${bankInfo ? `<div style="text-align:center;font-size:9px;color:${footerTextColor};opacity:.8;margin-top:2px">${bankInfo}</div>` : ''}
    </div>`;
  }

  const headerHTML = _buildHeaderHTML();
  const clientBlock = _buildClientBlockHTML();
  const { linesHTML, theadRow, colgroup } = _buildLinesHTML();
  const totalsHTML = _buildTotalsHTML();
  const footerHTML = _buildFooterHTML();

  return `<!DOCTYPE html>
<html lang="fr" style="--invoice-logo-h:${logoH}px"><head><meta charset="UTF-8">
<meta name="viewport" content="width=794">
<title>${typeLabel} ${doc.ref}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:794px;background:#fff;font-family:Arial,sans-serif;font-size:13px;color:#222}
  img.invoice-logo{
    height:var(--invoice-logo-h);
    width:auto;
    display:block;
    flex-shrink:0;
  }
  /* La page fait exactement 1123px de haut (A4 @96dpi) */
  /* Le wrapper principal occupe toute la page avec le footer collé en bas */
  .page-wrap{
    min-height:1083px; /* 1123px - 40px de padding */
    padding:28px 32px 0 32px;
    position:relative;
    display:flex;
    flex-direction:column;
  }
  .page-content{flex:1}
  .page-footer{
    margin-top:auto;
    padding-top:12px;
    padding-bottom:12px;
  }
  @page{size:A4;margin:0}
  @media print{
    html,body{width:210mm}
    .page-wrap{min-height:267mm;padding:10mm 14mm 0 14mm}
  }
  table{border-collapse:collapse}
</style>
</head><body>
<div class="page-wrap">
  <div class="page-content">
    ${headerHTML}
    ${clientBlock}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:0;table-layout:fixed">
      ${colgroup}
      <thead>
        <tr>
          ${theadRow}
        </tr>
      </thead>
      <tbody>${linesHTML}</tbody>
    </table>
    ${totalsHTML}
    ${doc.notes ? `<div style="margin-top:16px;padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#555"><strong>Notes :</strong> ${doc.notes}</div>` : ''}
    ${
      doc.terms || doc.payment
        ? `<div style="margin-top:16px;padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#555">
      <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Règlement</div>
      ${doc.terms ? `<div style="margin-bottom:${doc.payment ? '6px' : '0'}"><strong>Conditions :</strong> ${doc.terms}</div>` : ''}
      ${doc.payment ? `<div><strong>Mode de paiement :</strong> ${doc.payment}</div>` : ''}
    </div>`
        : ''
    }
  </div>
  <div class="page-footer">
    ${footerHTML}
  </div>
</div>
</body></html>`;
}

function printDocFromSettings() {
  const tpl = DB.settings.pdfTemplate || 'classic';
  const bandColor =
    document.getElementById('s-band-color').value || DB.settings.bandColor || '#1a6b3c';
  const s = DB.settings;
  // Build a demo doc
  const demoDoc = {
    ref: 'F-2026-0001',
    type: 'F',
    date: new Date().toISOString().slice(0, 10),
    clientId: DB.clients[0]?.id || '',
    clientName: DB.clients[0]?.name || 'Client Démo SARL',
    lines: [
      {
        name: 'Prestation de conseil',
        desc: 'Audit et recommandations',
        qty: 2,
        price: 1500,
        tva: 20,
      },
      { name: 'Développement logiciel', desc: 'Module facturation', qty: 1, price: 8500, tva: 20 },
      { name: 'Formation utilisateurs', qty: 3, price: 600, tva: 20 },
    ],
    ht: 14200,
    tva: 2840,
    ttc: 17040,
    remise: 0,
    acompte: 0,
    footer: s.footer || 'Merci de votre confiance.',
    notes: 'Paiement à 30 jours. Tout retard de paiement entraîne des pénalités.',
  };
  const html = buildInvoiceHTML(demoDoc, tpl, bandColor);
  const win = window.open('', '_blank');
  if (!win) {
    toast('Popup bloqué — autorisez les popups pour ce site puis réessayez', 'err');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

function printDocById(id) {
  const doc = DB.docs.find(x => x.id === id);
  if (!doc) {
    toast('Document introuvable', 'err');
    return;
  }
  const tpl = DB.settings.pdfTemplate || 'classic';
  const bandColor = DB.settings.bandColor || '#1a6b3c';
  const html = buildInvoiceHTML(doc, tpl, bandColor);
  const win = window.open('', '_blank');
  if (!win) {
    toast('Popup bloqué — autorisez les popups pour ce site puis réessayez', 'err');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
  toast('Ouverture aperçu PDF…', 'suc');
}
