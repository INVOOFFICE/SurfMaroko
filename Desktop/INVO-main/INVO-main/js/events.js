// ═══════════════════════════════════════════
//  events.js  —  Tous les gestionnaires d'événements
//  Chargé EN DERNIER (après app.js)
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const mobActionsSheet = document.getElementById('mob-actions-sheet');
  const mobActionsOverlay = document.getElementById('mob-actions-overlay');
  const mobActionsMenuTab = document.querySelector('.mob-tab[data-action="menu"]');

  const openMobActionsSheet = () => {
    if (!mobActionsSheet || !mobActionsOverlay) return;
    mobActionsSheet.classList.add('open');
    mobActionsOverlay.classList.add('open');
    mobActionsSheet.setAttribute('aria-hidden', 'false');
    mobActionsOverlay.setAttribute('aria-hidden', 'false');
    closeMobSidebar();
  };
  const closeMobActionsSheet = () => {
    if (!mobActionsSheet || !mobActionsOverlay) return;
    mobActionsSheet.classList.remove('open');
    mobActionsOverlay.classList.remove('open');
    mobActionsSheet.setAttribute('aria-hidden', 'true');
    mobActionsOverlay.setAttribute('aria-hidden', 'true');
  };

  // ════════════════════════════════════════
  //  NAVIGATION — Sidebar + Mobile tabbar
  // ════════════════════════════════════════
  document.querySelectorAll('.sb-item[data-page]').forEach(item => {
    item.addEventListener('click', () => nav(item.dataset.page, item));
  });

  document.querySelector('.sb-item[data-action="theme"]')?.addEventListener('click', toggleTheme);
  document.querySelector('.sb-wa')?.addEventListener('click', openWhatsApp);

  document.querySelectorAll('.mob-tab[data-page]').forEach(tab => {
    tab.addEventListener('click', () => {
      nav(tab.dataset.page, tab);
      closeMobSidebar();
      closeMobActionsSheet();
    });
  });

  mobActionsMenuTab?.addEventListener('click', openMobActionsSheet);
  document.getElementById('mob-actions-close')?.addEventListener('click', closeMobActionsSheet);
  mobActionsOverlay?.addEventListener('click', closeMobActionsSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMobActionsSheet();
  });

  document.querySelectorAll('#mob-actions-sheet [data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      nav(btn.dataset.page, btn);
      closeMobActionsSheet();
    });
  });
  document.getElementById('mob-action-theme')?.addEventListener('click', () => {
    toggleTheme();
    closeMobActionsSheet();
  });
  document.getElementById('mob-action-whatsapp')?.addEventListener('click', () => {
    openWhatsApp();
    closeMobActionsSheet();
  });
  document.getElementById('mob-action-logout')?.addEventListener('click', () => {
    document.getElementById('btn-logout-mobile')?.click();
    closeMobActionsSheet();
  });

  document
    .getElementById('mob-fab')
    ?.addEventListener('click', () =>
      nav('generate', document.querySelector('[data-page=generate]')),
    );

  // ════════════════════════════════════════
  //  TOPBAR
  // ════════════════════════════════════════
  document.querySelector('.tb-toggle')?.addEventListener('click', toggleSidebar);
  document.querySelector('.search-trigger')?.addEventListener('click', openSearch);
  document.getElementById('notif-btn')?.addEventListener('click', e => toggleNotifPanel(e));
  document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);

  // ════════════════════════════════════════
  //  RECHERCHE GLOBALE
  // ════════════════════════════════════════
  document.getElementById('search-backdrop')?.addEventListener('click', closeSearch);
  document.getElementById('search-input')?.addEventListener('input', renderSearchResults);
  document.getElementById('search-input')?.addEventListener('keydown', searchKeyNav);

  // Bouton ✕ fermer la recherche (id ou classe)
  document.getElementById('search-close')?.addEventListener('click', closeSearch);
  document.querySelector('.search-close')?.addEventListener('click', closeSearch);

  // ════════════════════════════════════════
  //  NOTIFICATIONS — fermeture panneau
  // ════════════════════════════════════════
  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    if (
      panel &&
      !panel.contains(e.target) &&
      !document.getElementById('notif-btn')?.contains(e.target)
    ) {
      panel.classList.remove('open');
      panel.style.pointerEvents = 'none';
    }
  });

  document.addEventListener('keydown', globalKeyHandler);

  // ════════════════════════════════════════
  //  ONBOARDING
  // ════════════════════════════════════════
  document.getElementById('ob-next-btn')?.addEventListener('click', obNext);
  document.getElementById('ob-skip-btn')?.addEventListener('click', skipOnboarding);

  // ════════════════════════════════════════
  //  NOTIFICATIONS
  // ════════════════════════════════════════
  document.getElementById('btn-mark-all-read')?.addEventListener('click', markAllRead);

  // ════════════════════════════════════════
  //  PAGE: GÉNÉRER DOCUMENT
  // ════════════════════════════════════════
  document.getElementById('doc-type')?.addEventListener('change', () => {
    updateDocRef();
    updateDocStatus();
    runDGICheck();
    refreshDocSourceHint();
  });
  document.getElementById('doc-status')?.addEventListener('change', () => {
    calcTotals();
    runDGICheck();
  });
  document.getElementById('doc-date')?.addEventListener('change', runDGICheck);
  document.getElementById('doc-client')?.addEventListener('change', onClientChange);
  document.getElementById('doc-remise')?.addEventListener('input', calcTotals);
  document.getElementById('doc-acompte')?.addEventListener('input', calcTotals);
  document.getElementById('doc-price-mode')?.addEventListener('change', () => {
    if (typeof onDocPriceModeChange === 'function') onDocPriceModeChange();
  });

  document.getElementById('btn-preview-doc')?.addEventListener('click', previewDoc);
  document.getElementById('btn-download-pdf')?.addEventListener('click', saveAndDownloadPDF);
  document.getElementById('btn-save-doc')?.addEventListener('click', saveDoc);
  document.getElementById('btn-save-doc-footer')?.addEventListener('click', saveDoc);
  document.getElementById('btn-add-line')?.addEventListener('click', addLine);
  document.getElementById('doc-lines-empty')?.addEventListener('click', addLine);
  document.getElementById('btn-stock-picker')?.addEventListener('click', openStockPicker);
  document.getElementById('btn-new-devis')?.addEventListener('click', newDevis);

  // Notes rapides
  document.querySelectorAll('[data-note]').forEach(btn => {
    btn.addEventListener('click', () => appendNote(btn.dataset.note));
  });

  // ════════════════════════════════════════
  //  PAGE: HISTORIQUE
  // ════════════════════════════════════════
  [
    'hist-search',
    'hist-type',
    'hist-status',
    'hist-client',
    'hist-date-from',
    'hist-date-to',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      APP.histPage = 1;
      renderHistory();
    });
  });
  document.getElementById('btn-reset-hist')?.addEventListener('click', resetHistFilters);
  document.getElementById('btn-hist-pdf-report')?.addEventListener('click', generateHistPDFReport);
  document.getElementById('btn-export-hist-xlsx')?.addEventListener('click', exportHistXLSX);

  // ── Date picker Historique (Flatpickr) ──
  (function initHistoryDatePickers() {
    const ids = ['hist-date-from', 'hist-date-to'];
    const els = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;

    // Toujours forcer en texte pour éviter les placeholders JJ/MM/AAAA
    // et avoir un rendu uniforme sur tous navigateurs.
    els.forEach((el, idx) => {
      el.setAttribute('type', 'text');
      el.setAttribute('inputmode', 'none');
      el.setAttribute('placeholder', idx === 0 ? 'Date début' : 'Date fin');
    });

    if (typeof flatpickr !== 'function') return;

    const onChange = () => {
      APP.histPage = 1;
      renderHistory();
    };
    const opts = {
      locale: flatpickr.l10ns && flatpickr.l10ns.fr ? flatpickr.l10ns.fr : undefined,
      allowInput: true,
      // Valeur interne (utilisée par le filtre) en ISO:
      dateFormat: 'Y-m-d',
      // Affichage utilisateur:
      altInput: true,
      altFormat: 'd/m/Y',
      altInputClass: 'flatpickr-alt-input',
      onChange,
      onValueUpdate: onChange,
    };

    // Stocker l’instance pour pouvoir la réinitialiser si besoin
    els.forEach(el => {
      el._fp = flatpickr(el, opts);
    });
  })();

  // ════════════════════════════════════════
  //  PAGE: RAPPORTS
  // ════════════════════════════════════════
  document.querySelectorAll('[data-rep-period]').forEach(btn => {
    btn.addEventListener('click', () => setRepPeriod(parseInt(btn.dataset.repPeriod), btn));
  });
  document.querySelectorAll('[data-ov-period]').forEach(btn => {
    btn.addEventListener('click', () => setOvPeriod(parseInt(btn.dataset.ovPeriod), btn));
  });

  // ════════════════════════════════════════
  //  PAGE: STOCK
  // ════════════════════════════════════════
  document.getElementById('stock-search')?.addEventListener('input', renderStock);
  document.getElementById('stock-cat-filter')?.addEventListener('change', renderStock);
  document.getElementById('stock-qty-filter')?.addEventListener('change', renderStock);
  document.getElementById('btn-add-article')?.addEventListener('click', openAddArticle);
  document.getElementById('btn-import-masse')?.addEventListener('click', openImportMasse);
  document.getElementById('btn-export-stock')?.addEventListener('click', exportStockCSV);
  document.getElementById('btn-stock-moves')?.addEventListener('click', openStockMoves);
  document.getElementById('btn-clear-stock')?.addEventListener('click', clearStock);

  // ════════════════════════════════════════
  //  PAGE: CLIENTS
  // ════════════════════════════════════════
  document.getElementById('client-search')?.addEventListener('input', renderClients);
  document.getElementById('btn-add-client')?.addEventListener('click', openAddClient);
  document.getElementById('btn-export-clients')?.addEventListener('click', exportClients);
  document.getElementById('client-city-filter')?.addEventListener('change', renderClients);
  document.getElementById('client-ice-filter')?.addEventListener('change', renderClients);
  document
    .getElementById('btn-import-clients-trigger')
    ?.addEventListener('click', openImportClients);

  // ════════════════════════════════════════
  //  MODAL: ARTICLE
  // ════════════════════════════════════════
  document.getElementById('btn-save-article')?.addEventListener('click', saveArticle);
  document
    .getElementById('btn-close-article')
    ?.addEventListener('click', () => closeModal('modal-article'));
  document
    .getElementById('btn-cancel-article')
    ?.addEventListener('click', () => closeModal('modal-article'));
  document.getElementById('a-sell')?.addEventListener('input', calcMarginPreview);
  document.getElementById('a-buy')?.addEventListener('input', calcMarginPreview);

  // ════════════════════════════════════════
  //  MODAL: CLIENT — type professionnel / particulier
  // ════════════════════════════════════════
  document.getElementById('btn-save-client')?.addEventListener('click', saveClient);
  document
    .getElementById('btn-close-client')
    ?.addEventListener('click', () => closeModal('modal-client'));
  document
    .getElementById('btn-cancel-client')
    ?.addEventListener('click', () => closeModal('modal-client'));
  document.getElementById('c-ice')?.addEventListener('input', function () {
    validateICEInput(this);
  });

  // Sélection type — data-attribute ET fallback IDs directs
  document.querySelectorAll('[data-client-type]').forEach(card => {
    card.addEventListener('click', () => selectNewClientType(card.dataset.clientType));
  });
  document
    .getElementById('c-card-pro')
    ?.addEventListener('click', () => selectNewClientType('professionnel'));
  document
    .getElementById('c-card-part')
    ?.addEventListener('click', () => selectNewClientType('particulier'));

  // ════════════════════════════════════════
  //  MODAL: NOUVEAU CLIENT RAPIDE (dans Générer Doc)
  // ════════════════════════════════════════
  document.getElementById('btn-save-ncq')?.addEventListener('click', saveNewClientQuick);
  document
    .getElementById('btn-close-ncq')
    ?.addEventListener('click', () => closeModal('modal-new-client-quick'));
  document
    .getElementById('btn-cancel-ncq')
    ?.addEventListener('click', () => closeModal('modal-new-client-quick'));
  document.getElementById('ncq-ice')?.addEventListener('input', function () {
    validateICEInput(this);
  });

  // Sélection type — data-attribute ET fallback IDs directs
  document.querySelectorAll('[data-ncq-type]').forEach(card => {
    card.addEventListener('click', () => selectNewClientType(card.dataset.ncqType));
  });
  document
    .getElementById('ncq-card-pro')
    ?.addEventListener('click', () => selectNewClientType('professionnel'));
  document
    .getElementById('ncq-card-part')
    ?.addEventListener('click', () => selectNewClientType('particulier'));

  // ════════════════════════════════════════
  //  MODAL: STOCK PICKER
  // ════════════════════════════════════════
  document.getElementById('btn-close-stock-picker')?.addEventListener('click', () => {
    closeBarcodeScanner();
    closeModal('modal-stock-picker');
  });
  document.getElementById('picker-search')?.addEventListener('input', renderStockPicker);
  document.getElementById('btn-open-barcode-scan')?.addEventListener('click', openBarcodeScanner);
  document.getElementById('btn-close-barcode-scan')?.addEventListener('click', closeBarcodeScanner);
  document.getElementById('btn-stop-barcode-scan')?.addEventListener('click', closeBarcodeScanner);
  document.getElementById('modal-barcode-scan')?.addEventListener('click', e => {
    if (e.target?.id === 'modal-barcode-scan') closeBarcodeScanner();
  });

  // ════════════════════════════════════════
  //  MODAL: APERÇU PDF
  // ════════════════════════════════════════
  document
    .getElementById('btn-close-preview')
    ?.addEventListener('click', () => closeModal('modal-preview-pdf'));
  document.getElementById('btn-dl-preview')?.addEventListener('click', saveAndDownloadPDF);
  const _pvBand = document.getElementById('preview-band-color');
  _pvBand?.addEventListener('input', refreshPreview);
  _pvBand?.addEventListener('change', refreshPreview);

  const _pvLogo = document.getElementById('preview-logo-height');
  _pvLogo?.addEventListener('input', () => {
    if (typeof applyPreviewLogoHeightFromControl === 'function')
      applyPreviewLogoHeightFromControl();
  });
  _pvLogo?.addEventListener('change', () => {
    save('settings');
  });

  const _pvCo = document.getElementById('preview-show-company-with-logo');
  _pvCo?.addEventListener('change', () => {
    if (typeof applyPreviewCompanyInfoFromControl === 'function')
      applyPreviewCompanyInfoFromControl();
    save('settings');
  });

  document.querySelectorAll('#preview-tpl-tabs .pvtpl-btn[data-tpl]').forEach(btn => {
    btn.addEventListener('click', () => switchPreviewTemplate(btn.dataset.tpl));
  });

  // ════════════════════════════════════════
  //  MODAL: CONVERSION DEVIS → FACTURE
  // ════════════════════════════════════════
  document.getElementById('btn-confirm-convert')?.addEventListener('click', confirmConvert);
  document
    .getElementById('btn-close-convert')
    ?.addEventListener('click', () => closeModal('modal-convert'));
  document
    .getElementById('btn-cancel-convert')
    ?.addEventListener('click', () => closeModal('modal-convert'));

  document.getElementById('conv-date-today')?.addEventListener('change', updateConvDateField);
  document.getElementById('conv-date-custom')?.addEventListener('change', updateConvDateField);
  document.getElementById('conv-custom-date')?.addEventListener('click', () => {
    const radio = document.getElementById('conv-date-custom');
    if (radio) {
      radio.checked = true;
      updateConvDateField();
    }
  });
  document.getElementById('conv-custom-date-trigger')?.addEventListener('click', () => {
    const cb = document.getElementById('conv-date-custom');
    if (cb) {
      cb.checked = true;
      updateConvDateField();
    }
  });
  document.getElementById('conv-opt-date-custom-wrap')?.addEventListener('click', () => {
    const cb = document.getElementById('conv-date-custom');
    if (cb) {
      cb.checked = true;
      updateConvDateField();
    }
  });

  // ════════════════════════════════════════
  //  MODAL: IMPORT EN MASSE
  // ════════════════════════════════════════
  document
    .getElementById('import-masse-file')
    ?.addEventListener('change', e => handleImportMasse(e.target));
  document
    .getElementById('btn-confirm-import-masse')
    ?.addEventListener('click', confirmImportMasse);
  document.getElementById('btn-close-import-masse')?.addEventListener('click', closeImportMasse);
  document.getElementById('btn-cancel-import-masse')?.addEventListener('click', closeImportMasse);
  document
    .getElementById('btn-dl-import-template')
    ?.addEventListener('click', downloadImportTemplate);

  const dropZone = document.getElementById('import-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', importDragOver);
    dropZone.addEventListener('dragleave', importDragLeave);
    dropZone.addEventListener('drop', importDrop);
    dropZone.addEventListener('click', () => document.getElementById('import-masse-file')?.click());
  }

  // ════════════════════════════════════════
  //  MODAL: MOUVEMENTS STOCK
  // ════════════════════════════════════════
  document.getElementById('btn-close-stock-moves')?.addEventListener('click', closeStockMoves);
  document.getElementById('btn-cancel-stock-moves')?.addEventListener('click', closeStockMoves);
  document.getElementById('btn-clear-stock-moves')?.addEventListener('click', clearStockMoves);
  document.getElementById('stock-moves-search')?.addEventListener('input', renderStockMoves);
  document
    .getElementById('stock-moves-action-filter')
    ?.addEventListener('change', renderStockMoves);

  // ════════════════════════════════════════
  //  MODAL: IMPORT CSV — CLIENTS
  // ════════════════════════════════════════
  document
    .getElementById('import-clients-file')
    ?.addEventListener('change', e => handleImportClients(e.target));
  document
    .getElementById('btn-confirm-import-clients')
    ?.addEventListener('click', confirmImportClients);
  document
    .getElementById('btn-close-import-clients')
    ?.addEventListener('click', closeImportClients);
  document
    .getElementById('btn-cancel-import-clients')
    ?.addEventListener('click', closeImportClients);
  document
    .getElementById('btn-dl-import-clients-template')
    ?.addEventListener('click', downloadClientsTemplate);

  const clientsDropZone = document.getElementById('import-clients-drop-zone');
  if (clientsDropZone) {
    clientsDropZone.addEventListener('dragover', importClientsDragOver);
    clientsDropZone.addEventListener('dragleave', importClientsDragLeave);
    clientsDropZone.addEventListener('drop', importClientsDrop);
    clientsDropZone.addEventListener('click', () =>
      document.getElementById('import-clients-file')?.click(),
    );
  }

  // ════════════════════════════════════════
  //  PAGE: PARAMÈTRES
  // ════════════════════════════════════════
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
  document.getElementById('btn-cancel-settings')?.addEventListener('click', loadSettings);

  document.getElementById('btn-supabase-copy-sql')?.addEventListener('click', () => {
    const pre = document.getElementById('supabase-sql-template');
    const t = pre?.textContent?.trim() || '';
    if (!t) return;
    const ok = (msg, kind) => {
      if (typeof toast === 'function') toast(msg, kind || 'suc');
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(t).then(() => ok('Script SQL copié ✓'), () => ok('Copie impossible', 'err'));
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        ok('Script SQL copié ✓');
      } catch {
        ok('Copie impossible', 'err');
      }
    }
  });
  document.getElementById('btn-supabase-connect')?.addEventListener('click', () => {
    if (typeof invooSupabaseConnect === 'function') void invooSupabaseConnect();
  });
  document.getElementById('btn-supabase-sync-now')?.addEventListener('click', () => {
    if (typeof invooSupabaseSyncNow === 'function') void invooSupabaseSyncNow();
  });
  document.getElementById('btn-supabase-disconnect')?.addEventListener('click', () => {
    if (typeof invooSupabaseDisconnect === 'function') invooSupabaseDisconnect();
  });
  document.getElementById('s-price-mode')?.addEventListener('change', e => {
    if (typeof setGlobalPriceMode === 'function') setGlobalPriceMode(e.target.value);
  });
  document
    .getElementById('btn-print-settings-preview')
    ?.addEventListener('click', printDocFromSettings);

  document.getElementById('s-ice')?.addEventListener('input', function () {
    validateICEInput(this);
  });
  document.getElementById('s-rib')?.addEventListener('input', function () {
    validateRIBInput(this);
  });

  document.getElementById('s-logo')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        let data = ev.target.result;
        if (typeof normalizeLogoDataURL === 'function') {
          data = await normalizeLogoDataURL(data);
        }
        DB.settings.logoData = data;
        const img = document.getElementById('logo-preview');
        const ph = document.getElementById('logo-placeholder');
        if (img) {
          img.src = data;
          img.style.display = 'block';
        }
        if (ph) ph.style.display = 'none';
        save('settings');
        toast('Logo enregistré (réduit si dépassant 400 px de hauteur)', 'suc');
      } catch (err) {
        console.error(err);
        toast('Impossible de traiter ce fichier image', 'err');
      }
    };
    reader.readAsDataURL(file);
  });

  function syncLogoHeightLabelFromInput(el) {
    const lab = document.getElementById('s-logo-height-val');
    if (lab && el) lab.textContent = el.value;
  }
  document
    .getElementById('s-logo-height')
    ?.addEventListener('input', e => syncLogoHeightLabelFromInput(e.target));
  document
    .getElementById('s-logo-height')
    ?.addEventListener('change', e => syncLogoHeightLabelFromInput(e.target));
  document.getElementById('page-settings')?.addEventListener('input', e => {
    if (e.target?.id === 's-logo-height') syncLogoHeightLabelFromInput(e.target);
  });

  document.getElementById('btn-remove-logo')?.addEventListener('click', () => {
    DB.settings.logoData = '';
    const fileIn = document.getElementById('s-logo');
    if (fileIn) fileIn.value = '';
    const img = document.getElementById('logo-preview');
    const ph = document.getElementById('logo-placeholder');
    if (img) {
      img.src = '';
      img.style.display = 'none';
    }
    if (ph) ph.style.display = '';
    save('settings');
    toast('Logo supprimé', 'suc');
  });

  document.getElementById('btn-export-all')?.addEventListener('click', exportBackup);
  document.getElementById('btn-export-all-overview')?.addEventListener('click', exportBackup);
  document
    .getElementById('btn-import-all')
    ?.addEventListener('click', () => document.getElementById('import-file')?.click());
  document.getElementById('import-file')?.addEventListener('change', e => handleImport(e.target));
  document.getElementById('btn-clear-data')?.addEventListener('click', clearAllData);
  document.getElementById('btn-clear-cache')?.addEventListener('click', clearCache);
  document.getElementById('btn-reload-data')?.addEventListener('click', () => location.reload());

  document.querySelectorAll('[data-toggle-setting]').forEach(el => {
    el.addEventListener('click', () => toggleSetting(el.dataset.toggleSetting, el));
  });

  document.querySelectorAll('[data-select-tpl]').forEach(card => {
    card.addEventListener('click', () => selectTemplate(card.dataset.selectTpl));
  });

  document.querySelectorAll('[data-band-color]').forEach(swatch => {
    const apply = () => setBandColor(swatch.dataset.bandColor);
    swatch.addEventListener('click', apply);
    swatch.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        apply();
      }
    });
  });
  document
    .getElementById('s-band-color')
    ?.addEventListener('input', e => setBandColor(e.target.value));
  document.getElementById('s-band-color-hex')?.addEventListener('input', syncBandHex);

  // ════════════════════════════════════════
  //  PAGE: FOURNISSEURS
  // ════════════════════════════════════════
  document.getElementById('btn-add-fourn')?.addEventListener('click', openAddFourn);
  document.getElementById('btn-add-fourn-empty')?.addEventListener('click', openAddFourn);
  document.getElementById('btn-export-fourn')?.addEventListener('click', exportFournisseurs);
  document.getElementById('btn-import-fourn')?.addEventListener('click', openImportFourn);
  document
    .getElementById('import-fourn-file')
    ?.addEventListener('change', e => handleImportFournInput(e.target));
  document
    .getElementById('btn-confirm-import-fourn')
    ?.addEventListener('click', confirmImportFourn);
  document.getElementById('btn-close-import-fourn')?.addEventListener('click', closeImportFourn);
  document.getElementById('btn-cancel-import-fourn')?.addEventListener('click', closeImportFourn);
  document
    .getElementById('btn-dl-fourn-template')
    ?.addEventListener('click', downloadFournTemplate);
  (function initFournImportDropzone() {
    const dz = document.getElementById('import-fourn-drop-zone');
    if (!dz) return;
    dz.addEventListener('dragover', importFournDragOver);
    dz.addEventListener('dragleave', importFournDragLeave);
    dz.addEventListener('drop', importFournDrop);
    dz.addEventListener('click', () => document.getElementById('import-fourn-file')?.click());
  })();
  document.getElementById('fourn-search')?.addEventListener('input', renderFournisseurs);
  document.getElementById('fourn-cat-filter')?.addEventListener('change', renderFournisseurs);
  document.getElementById('fourn-score-filter')?.addEventListener('change', renderFournisseurs);

  document.getElementById('btn-save-fourn')?.addEventListener('click', saveFourn);
  document
    .getElementById('btn-cancel-fourn')
    ?.addEventListener('click', () => closeModal('modal-fourn'));
  document
    .getElementById('btn-close-fourn')
    ?.addEventListener('click', () => closeModal('modal-fourn'));

  // Score fournisseur (cartes A/B/C)
  document.querySelectorAll('.fourn-score-card').forEach(card => {
    card.addEventListener('click', () => selectFournScore(card.dataset.score));
  });

  // ════════════════════════════════════════
  //  PAGE: BONS DE COMMANDE
  // ════════════════════════════════════════
  document.getElementById('btn-bc-new')?.addEventListener('click', openNewBC);
  document.getElementById('btn-bc-new-empty')?.addEventListener('click', openNewBC);
  document.getElementById('bc-search')?.addEventListener('input', renderBonsCommande);
  document.getElementById('bc-filter-status')?.addEventListener('change', renderBonsCommande);
  document.getElementById('btn-save-bc')?.addEventListener('click', saveBC);
  document.getElementById('bc-fournisseur')?.addEventListener('change', syncBCSaveState);
  document
    .getElementById('btn-cancel-bc')
    ?.addEventListener('click', () => closeModal('modal-bon-commande'));
  document
    .getElementById('btn-close-bc-modal')
    ?.addEventListener('click', () => closeModal('modal-bon-commande'));
  document.getElementById('btn-bc-add-stock')?.addEventListener('click', openBCPicker);
  document.getElementById('bc-picker-search')?.addEventListener('input', renderBCPicker);
  document
    .getElementById('btn-close-bc-picker')
    ?.addEventListener('click', () => closeModal('modal-bc-stock-picker'));
  document
    .getElementById('btn-close-bc-view')
    ?.addEventListener('click', () => closeModal('modal-bc-view'));
  document
    .getElementById('btn-close-bc-view-footer')
    ?.addEventListener('click', () => closeModal('modal-bc-view'));

  // ════════════════════════════════════════
  //  VUE D'ENSEMBLE — accès rapide
  // ════════════════════════════════════════
  document
    .getElementById('btn-qa-facture')
    ?.addEventListener('click', () => nav('generate', sbItem('generate')));
  document
    .getElementById('btn-qa-reports')
    ?.addEventListener('click', () => nav('reports', sbItem('reports')));

  // ════════════════════════════════════════
  //  MODAL: SALES — fermeture
  // ════════════════════════════════════════
  document
    .getElementById('btn-close-sales-modal')
    ?.addEventListener('click', () => closeModal('modal-sales'));

  // ════════════════════════════════════════
  //  MODAL CONFIRM — OK / Annuler
  // ════════════════════════════════════════
  document.getElementById('confirm-btn-ok')?.addEventListener('click', _confirmOk);
  document.getElementById('confirm-btn-cancel')?.addEventListener('click', _confirmCancel);
  document.getElementById('confirm-btn-close')?.addEventListener('click', _confirmCancel);

  // ════════════════════════════════════════
  //  DÉLÉGATION MODALES — clic overlay = fermer
  // ════════════════════════════════════════
  // Fermer uniquement quand on clique sur le fond (overlay),
  // sans bloquer les clics sur le contenu interne des modales.
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target.id);
    }
  });

  // ════════════════════════════════════════
  //  DÉLÉGATION ACTIONS DYNAMIQUES (sans onclick inline)
  // ════════════════════════════════════════
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action') || '';
    const rawId = btn.getAttribute('data-id') || '';
    const id = rawId ? decodeURIComponent(rawId) : '';
    const delta = Number(btn.getAttribute('data-delta') || 0);
    const index = Number(btn.getAttribute('data-index') || -1);

    switch (action) {
      // Stock / Articles
      case 'adjust-qty':
        if (id && Number.isFinite(delta)) adjustQty(id, delta);
        break;
      case 'edit-article':
        if (id) editArticle(id);
        break;
      case 'delete-article':
        if (id) deleteArticle(id);
        break;
      case 'add-line-from-stock':
        if (id) addLineFromStock(id);
        break;

      // Clients
      case 'edit-client':
        if (id) editClient(id);
        break;
      case 'new-doc-client':
        if (id) newDocForClient(id);
        break;
      case 'delete-client':
        if (id) deleteClient(id);
        break;

      // Fournisseurs
      case 'edit-fourn':
        if (id) editFourn(id);
        break;
      case 'delete-fourn':
        if (id) deleteFourn(id);
        break;

      // Bons de commande
      case 'bc-view':
        if (id) openViewBC(id);
        break;
      case 'bc-edit':
        if (id) openEditBC(id);
        break;
      case 'bc-approve':
        if (id) approveBC(id);
        break;
      case 'bc-receive':
        if (id) receiveBC(id);
        break;
      case 'bc-cancel':
        if (id) cancelBC(id);
        break;
      case 'bc-delete':
        if (id) deleteBC(id);
        break;
      case 'bc-remove-line':
        if (Number.isInteger(index) && index >= 0) removeBCLine(index);
        break;
      case 'bc-pick-stock':
        if (id) bcPickStock(id);
        break;

      // Historique documents
      case 'hist-convert':
        if (id) openConvertModal(id);
        break;
      case 'hist-quick-status':
        if (id) quickChangeStatus(id);
        break;
      case 'hist-cancel-doc':
        if (id) cancelDoc(id);
        break;
      case 'hist-create-avoir':
        if (id) createAvoirFromCancelledFacture(id);
        break;
      case 'hist-edit-doc':
        if (id) editDocFromHistory(id);
        break;
      case 'hist-print-doc':
        if (id) printDocById(id);
        break;
      case 'hist-download-doc':
        if (id) downloadDocPDFById(id);
        break;
      case 'hist-wa-doc':
        if (id) sendDocWhatsApp(id);
        break;
      case 'hist-duplicate-doc':
        if (id) duplicateDoc(id);
        break;
      case 'hist-delete-doc':
        if (id) deleteDoc(id);
        break;
      default:
        break;
    }
  });

  // ════════════════════════════════════════
  //  SWIPE MOBILE (sidebar)
  // ════════════════════════════════════════
  let _sx = 0,
    _sy = 0;
  document.addEventListener(
    'touchstart',
    e => {
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    'touchend',
    e => {
      const dx = e.changedTouches[0].clientX - _sx;
      const dy = Math.abs(e.changedTouches[0].clientY - _sy);
      const sb = document.getElementById('sidebar');
      if (_sx < 24 && dx > 50 && dy < 60 && window.innerWidth <= 768) openMobSidebar();
      if (sb && sb.classList.contains('mob-open') && dx < -50 && dy < 60) closeMobSidebar();
    },
    { passive: true },
  );
});
