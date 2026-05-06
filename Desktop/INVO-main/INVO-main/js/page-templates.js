// ╔══════════════════════════════════════════════════╗
// ║  FICHIER GÉNÉRÉ — NE PAS MODIFIER MANUELLEMENT   ║
// ║  Source : scripts/build-page-templates.mjs        ║
// ║  Régénérer : node scripts/build-page-templates.mjs ║
// ╚══════════════════════════════════════════════════╝
// A11y (aria-hidden décoratif, type="button") : conserver si édition ponctuelle,
// ou régénérer puis réappliquer les correctifs via le script source.
//
// page-templates.js — HTML des pages (injecté dans #content)

function templatePageOverview() {
  return `<div class="page active" id="page-overview">
  <div class="page-header flex page-header-split">
    <div><h1>Tableau de bord</h1><p>Vue analytique complète — données en temps réel.</p></div>
    <div class="period-switch" role="group" aria-label="Période du tableau de bord">
      <button type="button" class="ov-period-btn active" data-ov-period="1">Ce mois</button>
      <button type="button" class="ov-period-btn" data-ov-period="3">3 mois</button>
      <button type="button" class="ov-period-btn" data-ov-period="6">6 mois</button>
      <button type="button" class="ov-period-btn" data-ov-period="12">12 mois</button>
    </div>
  </div>
  <div class="grid4 overview-kpis">
    <div class="stat-card"><div class="stat-label">CA Total TTC</div><div class="stat-val green" id="stat-ca">0 DH</div><div class="stat-sub" id="stat-ca-sub">Documents payés</div></div>
    <div class="stat-card"><div class="stat-label">Créances en cours</div><div class="stat-val amber" id="stat-pending">0 DH</div><div class="stat-sub" id="stat-pending-sub">Non encaissé</div></div>
    <div class="stat-card"><div class="stat-label">TVA collectée</div><div class="stat-val blue" id="stat-tva">0 DH</div><div class="stat-sub" id="stat-tva-sub">Sur factures payées</div></div>
    <div class="stat-card"><div class="stat-label">Documents émis</div><div class="stat-val" id="stat-docs">0</div><div class="stat-sub" id="stat-docs-sub">Sur la période</div></div>
  </div>
  <div class="grid-chart-main">
    <div class="card ov-panel ov-panel-chart card-panel">
      <div class="card-header card-header-tight"><div><div class="card-title">Chiffre d'affaires mensuel</div><div class="card-subtitle">HT vs TTC — documents payés</div></div></div>
      <div class="chart-box chart-box-lg"><canvas id="ov-chart-ca" aria-label="Graphique du chiffre d’affaires mensuel, HT et TTC"></canvas></div>
    </div>
    <div class="card ov-panel ov-panel-chart card-panel">
      <div class="card-header card-header-tight"><div class="card-title">Répartition statuts</div><div class="card-subtitle">Tous documents</div></div>
      <div class="chart-box chart-box-md"><canvas id="ov-chart-status" aria-label="Graphique de répartition des statuts des documents"></canvas></div>
      <div id="ov-status-legend" class="ov-status-legend"></div>
    </div>
  </div>
  <div class="grid-ov-bottom">
    <div class="card ov-panel card-panel"><div class="card-header card-header-spaced"><div class="card-title">Top clients</div></div><div id="ov-top-clients"></div></div>
    <div class="card ov-panel card-panel"><div class="card-header card-header-spaced"><div class="card-title">TVA à déclarer</div><div class="card-subtitle">Ce mois — par taux</div></div><div id="ov-tva-breakdown"></div></div>
    <div class="card ov-panel ov-panel-compact"><div class="card-title card-title-compact"><span aria-hidden="true">⚡</span> Alertes</div><div id="ov-alerts" class="ov-alerts"></div></div>
    <div class="card ov-panel ov-panel-compact">
      <div class="card-title card-title-compact">Accès rapide</div>
      <div class="quick-actions-col" role="group" aria-label="Accès rapide depuis le tableau de bord">
        <button type="button" class="btn btn-primary btn-sm btn-start" id="btn-qa-facture"><span aria-hidden="true">📄</span> Nouvelle Facture</button>
        <button type="button" class="btn btn-secondary btn-sm btn-start" id="btn-qa-reports"><span aria-hidden="true">📈</span> Voir Rapports</button>
        <button type="button" class="btn btn-secondary btn-sm btn-start" id="btn-new-devis"><span aria-hidden="true">📝</span> Nouveau Devis</button>
        <button type="button" class="btn btn-secondary btn-sm btn-start" id="btn-export-all-overview"><span aria-hidden="true">💾</span> Exporter Backup JSON</button>
      </div>
    </div>
  </div>
</div>`;
}

function templatePageGenerate() {
  return `<div class="page" id="page-generate">
  <div class="page-header flex page-header-split">
    <div><h1>Générer un Nouveau Document</h1><p>Créez des factures, devis, bons de livraison ou avoirs conformes aux normes DGI.</p></div>
    <div class="doc-header-actions" role="group" aria-label="Actions sur le document en cours">
      <button type="button" class="btn btn-info-soft" id="btn-preview-doc" aria-label="Visualiser le document">
        <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Visualiser
      </button>
      <button type="button" class="btn btn-danger-soft" id="btn-download-pdf" aria-label="Télécharger le PDF">
        <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
        Télécharger PDF
      </button>
      <button type="button" class="btn btn-primary" id="btn-save-doc" aria-label="Sauvegarder le document"><span aria-hidden="true">💾</span> Sauvegarder</button>
    </div>
  </div>

  <!-- DGI Checker -->
  <div id="dgi-checker">
    <div class="dgi-checker-header">
      <div class="dgi-checker-title">
        <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Conformité DGI — vérification en temps réel
      </div>
      <span class="dgi-score err" id="dgi-score-badge" aria-live="polite" role="status">0/8 mentions conformes</span>
    </div>
    <div class="dgi-items" id="dgi-items-list" aria-live="polite"></div>
  </div>

  <!-- Champ caché : id interne du document en cours d'édition (vide = nouveau document) -->
  <input type="hidden" id="doc-id" value="">
  <!-- Champs cachés : lien éventuel vers document source (ex: avoir lié à facture) -->
  <input type="hidden" id="doc-source-ref" value="">
  <input type="hidden" id="doc-source-id" value="">
  <input type="hidden" id="doc-source-type" value="">
  <!-- Champs cachés : document d'origine en cours d'édition -->
  <input type="hidden" id="doc-origin-ref" value="">
  <input type="hidden" id="doc-origin-type" value="">
  <input type="hidden" id="doc-origin-status" value="">

  <!-- Config -->
  <div class="card card-section">
    <div class="card-header card-header-spaced"><div class="card-title"><span aria-hidden="true">⚙️</span> Configuration du Document</div></div>
    <div class="grid-doc-config" role="group" aria-label="Configuration du document">
      <div class="form-group form-group-tight">
        <label for="doc-ref">Référence</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="text" id="doc-ref" class="doc-ref-editable" placeholder="Ex: F-2025-001" maxlength="40" style="flex:1;min-width:0;" autocomplete="off" spellcheck="false">
          <button type="button" id="btn-regen-ref" title="Régénérer la référence automatiquement" style="padding:0 8px;height:var(--input-h,36px);background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-sm,4px);cursor:pointer;font-size:1rem;flex-shrink:0;" aria-label="Régénérer référence">🔄</button>
        </div>
        <span id="doc-ref-hint" style="font-size:.75rem;margin-top:3px;display:none;"></span>
      </div>
      <div class="form-group form-group-tight"><label for="doc-type">Type</label>
        <select id="doc-type" class="themed-select">
          <option value="F">Facture (F)</option><option value="D">Devis (D)</option>
          <option value="BL">Bon de Livraison (BL)</option><option value="AV">Avoir (AV)</option>
        </select>
      </div>
      <div class="form-group form-group-tight"><label for="doc-status">Statut</label>
        <select id="doc-status" class="themed-select">
          <option value="Brouillon">Brouillon</option><option value="Envoyé">Envoyé</option>
          <option value="Payé">Payé</option>
        </select>
      </div>
      <div class="form-group form-group-tight"><label for="doc-date">Date d'émission</label><input type="date" id="doc-date"></div>
      <div class="form-group form-group-tight">
        <label for="doc-client">Client <span class="client-ice-pill miss client-ice-pill-hidden" id="client-ice-pill"></span></label>
        <select id="doc-client" class="themed-select"><option value="">Sélectionner un client...</option></select>
      </div>
      <div class="form-group form-group-tight">
        <label for="doc-price-mode">Saisie du prix unitaire</label>
        <select id="doc-price-mode" class="themed-select" title="Affichage et saisie en TTC ou HT — le stockage interne des lignes reste en HT">
          <option value="TTC">Prix en TTC</option>
          <option value="HT">Prix en HT</option>
        </select>
      </div>
    </div>
    <div id="doc-source-hint-wrap" class="doc-source-hint-wrap">
      <div class="doc-source-hint-title"><span aria-hidden="true">↩</span> Document source de l’avoir</div>
      <div id="doc-source-hint-text" class="doc-source-hint-text">—</div>
    </div>
  </div>

  <!-- Articles -->
  <div class="card card-doc-articles" id="doc-articles-card">
    <div id="doc-ae-vat-banner" class="doc-ae-vat-banner">
      TVA 0% — Auto-entrepreneur (exonéré) : montants hors taxes. La mention légale figure sur le PDF. <span class="doc-ae-vat-banner-sub">TVA non applicable selon le régime de l’auto-entrepreneur (article 89 du CGI – Maroc).</span>
    </div>
    <div class="card-header card-header-articles">
      <div class="card-title"><span aria-hidden="true">📦</span> Détails des articles</div>
      <div class="doc-articles-actions" role="group" aria-label="Ajouter des lignes ou articles au document">
        <div class="spacer"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-line"><span aria-hidden="true">➕</span> Ligne libre</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-stock-picker"><span aria-hidden="true">🔍</span> Chercher dans le stock</button>
      </div>
    </div>
    <div id="doc-inv-header" class="doc-inv-header">
      <span class="doc-inv-head-label">Désignation</span>
      <span id="doc-inv-head-price" class="doc-inv-head-label">Prix U (TTC)</span>
      <span class="doc-inv-head-label">Qté</span>
      <span class="doc-inv-head-label">Total HT</span>
      <span class="doc-inv-head-label">Total TTC</span>
      <span id="doc-inv-col-tva" class="doc-inv-head-label">TVA%</span>
      <span></span>
    </div>
    <div id="doc-lines"></div>
    <button type="button" id="doc-lines-empty" class="doc-lines-empty-btn">
      Ajouter un article
      <span class="doc-lines-empty-sub">Cliquez ici ou utilisez les boutons ci-dessus.</span>
    </button>
  </div>

  <!-- Règlement + Notes -->
  <div class="grid-doc-bottom">
    <div class="card card-doc-payment">
      <div class="card-header card-header-spaced"><div class="card-title"><span aria-hidden="true">💳</span> Règlement</div></div>
      <div class="grid-payment-cols" role="group" aria-label="Conditions et mode de paiement">
        <div class="form-group form-group-tight"><label for="doc-terms">Conditions</label>
          <select id="doc-terms" class="themed-select">
            <option value="">Choisir...</option><option>Comptant</option><option>30 jours</option>
            <option>60 jours</option><option>90 jours</option><option>À réception</option>
          </select>
        </div>
        <div class="form-group form-group-tight"><label for="doc-payment">Mode de paiement</label>
          <select id="doc-payment" class="themed-select">
            <option value="">Choisir...</option><option>Espèces</option><option>Chèque</option>
            <option>Virement bancaire</option><option>Effet de commerce</option><option>Carte bancaire</option>
          </select>
        </div>
      </div>
      <div class="form-group form-group-stack"><label for="doc-acompte">Avance / Acompte (DH)</label><input type="number" inputmode="decimal" id="doc-acompte" placeholder="0" min="0" step="0.01"></div>
      <div class="form-group form-group-stack">
        <label for="doc-remise">Remise globale (%)</label>
        <input type="number" inputmode="decimal" id="doc-remise" placeholder="0" min="0" max="100" step="0.01">
      </div>
    </div>
    <div class="card card-doc-notes">
      <div class="card-header card-header-notes"><div class="card-title"><span aria-hidden="true">📝</span> Notes & Mentions</div><div class="doc-note-presets" role="group" aria-label="Mentions légales prédéfinies pour les notes du document"><button type="button" class="btn btn-sm btn-note-preset" data-note="Escompte de règlement : néant.">Escompte</button><button type="button" class="btn btn-sm btn-note-preset" data-note="Pénalités de retard : taux légal en vigueur.">Pénalités</button><button type="button" class="btn btn-sm btn-note-preset" data-note="Indemnité forfaitaire pour frais de recouvrement : 40 DH.">Recouvrement</button></div></div>
      <textarea id="doc-notes" rows="4" placeholder="Conditions particulieres, mentions legales, notes..." class="doc-notes-input" aria-label="Notes du document"></textarea>
    </div>
  </div>
  <p id="doc-feedback" class="doc-feedback" aria-live="polite"></p>

  <!-- ── RÉSUMÉ FINANCIER avec TVA par taux ── -->
  <div class="card card-financial-summary">
    <div class="financial-summary-header">
      <div class="card-title financial-summary-title"><span aria-hidden="true">💰</span> Résumé Financier</div>
      <button type="button" class="btn btn-primary btn-save-footer" id="btn-save-doc-footer" aria-label="Sauvegarder le document"><span aria-hidden="true">💾</span> Sauvegarder</button>
    </div>

    <!-- Totaux globaux en ligne -->
    <div id="sum-financial-totals-row" class="financial-totals-row">
      <div id="sum-ht-wrap" class="financial-total-col">
        <div class="financial-total-label">Total HT</div>
        <div id="sum-ht" class="financial-total-value">0,00 DH</div>
      </div>
      <div id="sum-tva-wrap" class="financial-total-col">
        <div class="financial-total-label">TVA Totale</div>
        <div id="sum-tva" class="financial-total-value financial-total-value-info">0,00 DH</div>
      </div>
      <div id="sum-ttc-wrap" class="financial-total-col financial-total-col-highlight">
        <div id="sum-ttc-label" class="financial-total-label financial-total-label-brand">Total TTC</div>
        <div id="sum-ttc" class="financial-total-value financial-total-value-strong financial-total-value-brand">0,00 DH</div>
      </div>
      <div id="sum-reste-block" class="financial-total-col financial-total-col-last">
        <div id="sum-reste-label" class="financial-total-label">Reste à payer</div>
        <div id="sum-reste" class="financial-total-value financial-total-value-brand">0,00 DH</div>
      </div>
    </div>
    <div id="sum-arrete" class="sum-arrete-box">
      <span class="sum-arrete-strong">Le présent document est arrêté à la somme de </span><span id="sum-arrete-text" class="sum-arrete-text"></span>
    </div>

    <!-- Tableau TVA par taux — DGI obligatoire -->
    <div id="tva-by-rate-wrap" class="tva-rate-wrap">
      <div class="tva-rate-head">
        <span>Détail TVA par taux</span>
        <span class="tva-rate-badge"><span aria-hidden="true">✓</span> Obligatoire DGI</span>
      </div>
      <div class="tbl-wrap">
        <table class="tva-breakdown-table">
          <thead>
            <tr>
              <th>Taux TVA</th>
              <th>Base HT</th>
              <th>Montant TVA</th>
              <th>Total TTC</th>
            </tr>
          </thead>
          <tbody id="tva-by-rate-body"></tbody>
          <tfoot id="tva-by-rate-foot"></tfoot>
        </table>
      </div>
    </div>
  </div>
</div>`;
}

function templatePageHistory() {
  return `<div class="page" id="page-history">
  <div class="page-header"><h1>Historique des documents</h1><p>Consultez et gérez tous vos documents sauvegardés.</p></div>
  <div class="grid4 hist-kpis">
    <div class="stat-card"><div class="stat-label">Total documents</div><div class="stat-val blue" id="hist-kpi-total">0</div></div>
    <div class="stat-card"><div class="stat-label">CA encaissé (Payé)</div><div class="stat-val green" id="hist-kpi-paid">0 DH</div></div>
    <div class="stat-card"><div class="stat-label">En attente (Envoyé)</div><div class="stat-val amber" id="hist-kpi-sent">0 DH</div></div>
    <div class="stat-card"><div class="stat-label">Brouillons</div><div class="stat-val" id="hist-kpi-draft">0</div></div>
  </div>
  <div class="card hist-filters-card">
    <div id="hist-filters-row" role="group" aria-label="Filtres de l’historique des documents">
      <div class="form-group hist-filter-main"><label for="hist-search">Recherche</label><input type="text" id="hist-search" placeholder="Référence, client..."></div>
      <div class="form-group hist-filter-group"><label for="hist-type">Type</label><select id="hist-type"><option value="">Tous</option><option value="F">Facture</option><option value="D">Devis</option><option value="BL">BL</option><option value="AV">Avoir</option></select></div>
      <div class="form-group hist-filter-group"><label for="hist-status">Statut</label><select id="hist-status"><option value="">Tous</option><option>Brouillon</option><option>Envoyé</option><option>Payé</option><option>Annulé</option><option>Converti</option><option>Accepté</option><option>Refusé</option><option>Expiré</option><option>Livré</option><option>Validé</option></select></div>
      <div class="form-group hist-filter-group"><label for="hist-client">Client</label><select id="hist-client"><option value="">Tous</option></select></div>
      <div class="form-group hist-filter-group"><label for="hist-date-from">À partir de</label><input type="date" id="hist-date-from" placeholder="JJ/MM/AAAA"></div>
      <div class="form-group hist-filter-group"><label for="hist-date-to">Jusqu'à</label><input type="date" id="hist-date-to" placeholder="JJ/MM/AAAA"></div>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-hist">Réinitialiser</button>
    </div>
    <p id="hist-feedback" class="hist-feedback" aria-live="polite"></p>
  </div>
  <div class="tbl-wrap">
    <table><thead><tr><th>N°</th><th>Date</th><th>Type</th><th>Statut</th><th>Client</th><th>Total HT</th><th>Total TTC</th><th>Reste à payer</th><th>Actions</th></tr></thead>
    <tbody id="history-tbody"></tbody></table>
  </div>
  <div class="hist-footer-actions">
    <div class="hist-footer-buttons" role="group" aria-label="Exports de l’historique des documents">
      <button type="button" class="btn btn-primary btn-sm" id="btn-hist-pdf-report"><span aria-hidden="true">📊</span> Générer Rapport PDF</button>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-export-hist-xlsx"><span aria-hidden="true">📄</span> Exporter Excel</button>
    </div>
    <div id="hist-pagination" class="pagination"></div>
  </div>
</div>`;
}

function templatePageReports() {
  return `<div class="page" id="page-reports">
  <div class="page-header flex page-header-split">
    <div><h1>Rapports &amp; Fiscal</h1><p>État des ventes, TVA à déclarer et analyses par période.</p></div>
    <div class="period-switch" role="group" aria-label="Période des rapports fiscaux">
      <button type="button" class="ov-period-btn active" id="rep-btn-1" data-rep-period="1">Ce mois</button>
      <button type="button" class="ov-period-btn" id="rep-btn-3" data-rep-period="3">3 mois</button>
      <button type="button" class="ov-period-btn" id="rep-btn-6" data-rep-period="6">6 mois</button>
      <button type="button" class="ov-period-btn" id="rep-btn-12" data-rep-period="12">12 mois</button>
    </div>
  </div>
  <div class="grid3 reports-kpis">
    <div class="stat-card"><div class="stat-label">CA TTC (Payé)</div><div class="stat-val green" id="rep-ca">0 DH</div></div>
    <div class="stat-card"><div class="stat-label">Total HT</div><div class="stat-val" id="rep-ht">0 DH</div></div>
    <div class="stat-card"><div class="stat-label">TVA collectée</div><div class="stat-val blue" id="rep-tva">0 DH</div></div>
  </div>
  <div class="grid-report-split">
    <div class="card card-panel">
      <div class="card-title card-title-spaced">Répartition par type</div>
      <div id="rep-by-type"></div>
    </div>
    <div class="card card-panel">
      <div class="card-title card-title-spaced">Top 5 clients</div>
      <div id="rep-top-clients"></div>
    </div>
  </div>
  <div class="card card-panel reports-tva-panel">
    <div class="card-title card-title-spaced">TVA à déclarer — par taux</div>
    <div id="rep-tva-breakdown"></div>
  </div>
</div>`;
}

function templatePageStock() {
  return `<div class="page" id="page-stock">
  <div class="page-header flex page-header-split">
    <div class="page-header-main">
      <h1>Gestion du Stock</h1>
      <p>Gérez vos articles, quantités et prix ici.</p>
    </div>
    <div class="page-header-actions" role="group" aria-label="Actions sur le stock">
      <button type="button" class="btn btn-primary" id="btn-add-article"><span aria-hidden="true">➕</span> Ajouter un article</button>
      <button type="button" class="btn btn-secondary btn-inline-icon" id="btn-import-masse" title="CSV : mêmes champs que le tableau Stock. Aperçu obligatoire, contrôle des doublons (code-barres), fournisseur relié à la liste Fournisseurs si le nom correspond." aria-label="Importer le stock depuis un fichier CSV (aperçu obligatoire)">
        <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import CSV (aperçu)
      </button>
      <button type="button" class="btn btn-secondary" id="btn-export-stock" title="Télécharge un fichier .csv (UTF-8, séparateur ;). Mêmes infos que le tableau + marge et valeur stock. Réouvrable dans Excel."><span aria-hidden="true">📊</span> Exporter CSV</button>
    </div>
  </div>
  <div class="grid4 stock-kpis">
    <div class="stat-card"><div class="stat-label">Total articles</div><div class="stat-val blue" id="stk-kpi-count">0</div></div>
    <div class="stat-card"><div class="stat-label">Valeur stock (achat)</div><div class="stat-val green" id="stk-kpi-val-buy">0 DH</div></div>
    <div class="stat-card"><div class="stat-label">Valeur stock (vente)</div><div class="stat-val green" id="stk-kpi-val-sell">0 DH</div></div>
    <div class="stat-card"><div class="stat-label">Articles en rupture</div><div class="stat-val red" id="stk-kpi-low">0</div><div class="stat-sub stock-kpi-sub" id="stk-kpi-low-names"></div></div>
  </div>
  <div class="stock-filters-row" role="group" aria-label="Filtres du stock">
    <div class="stock-filter-main"><input type="text" id="stock-search" placeholder="Rechercher un article, code-barres…" autocomplete="off" aria-label="Rechercher un article ou un code-barres"></div>
    <select id="stock-cat-filter" aria-label="Filtrer par catégorie d’articles"><option value="">Toutes catégories</option></select>
    <select id="stock-qty-filter" aria-label="Filtrer par niveau de quantité en stock">
      <option value="">Tous les stocks</option>
      <option value="low">Stock bas (moins de 5)</option>
      <option value="zero">Rupture (0)</option>
      <option value="ok">Stock OK</option>
    </select>
    <button type="button" class="btn btn-secondary btn-sm" id="btn-stock-moves"><span aria-hidden="true">🧾</span> Mouvements</button>
    <button type="button" class="btn btn-danger btn-sm" id="btn-clear-stock"><span aria-hidden="true">🗑</span> Tout supprimer</button>
  </div>
  <div class="tbl-wrap">
    <table><thead><tr><th>Article</th><th>Code barre</th><th>Catégorie</th><th>Fournisseur</th><th>Quantité</th><th id="stock-th-buy">Prix achat (TTC)</th><th id="stock-th-sell">Prix vente (TTC)</th><th>Marge</th><th>Actions</th></tr></thead>
    <tbody id="stock-tbody"></tbody></table>
  </div>
  <div id="stock-list-pagination" class="list-pagination-wrap" aria-label="Pagination stock"></div>
  <div id="stock-empty" class="empty-state"><h3>Aucun article en stock</h3><p>Ajoutez votre premier article pour commencer.</p></div>
</div>`;
}

function templatePageClients() {
  return `<div class="page" id="page-clients">
  <div class="page-header flex page-header-split">
    <div><h1>Gestion des Clients</h1><p>Gérez vos relations clients et leurs informations de facturation.</p></div>
    <div class="page-header-actions" role="group" aria-label="Actions sur les clients">
      <button type="button" class="btn btn-primary" id="btn-add-client"><span aria-hidden="true">➕</span> Nouveau Client</button>
      <button type="button" class="btn btn-secondary btn-inline-icon" id="btn-import-clients-trigger" title="CSV : mêmes champs que le tableau Clients. Détection encodage (UTF-8 ou Windows-1252). Doublons nom+ICE ignorés." aria-label="Importer les clients depuis un fichier CSV">
        <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import CSV
      </button>
      <button type="button" class="btn btn-secondary" id="btn-export-clients" title="Télécharge un fichier Excel .xlsx (clients)."><span aria-hidden="true">📊</span> Exporter</button>
    </div>
  </div>
  <div class="grid3 section-kpis">
    <div class="stat-card"><div class="stat-label">Total clients</div><div class="stat-val blue" id="cli-kpi-count">0</div></div>
    <div class="stat-card"><div class="stat-label">CA Total (encaissé)</div><div class="stat-val green" id="cli-kpi-ca">0 DH</div></div>
    <div class="stat-card"><div class="stat-label">Clients avec ICE</div><div class="stat-val green" id="cli-kpi-ice">0</div><div class="stat-sub">conformité DGI</div></div>
  </div>
  <div class="section-filters" role="group" aria-label="Filtres de la liste clients">
    <div class="filter-main"><input type="text" id="client-search" placeholder="Rechercher un client…" autocomplete="off" aria-label="Rechercher un client"></div>
    <select id="client-city-filter" aria-label="Filtrer les clients par ville"><option value="">Toutes les villes</option></select>
    <select id="client-ice-filter" aria-label="Filtrer les clients par présence d’ICE">
      <option value="">Tous</option><option value="with">Avec ICE</option><option value="without">Sans ICE</option>
    </select>
  </div>
  <div class="tbl-wrap">
    <table><thead><tr><th>Client</th><th>ICE / IF</th><th>Contact</th><th>Ville</th><th>Factures</th><th>CA TTC</th><th>Actions</th></tr></thead>
    <tbody id="clients-tbody"></tbody></table>
  </div>
  <div id="clients-list-pagination" class="list-pagination-wrap" aria-label="Pagination clients"></div>
  <div id="clients-empty" class="empty-state"><h3>Aucun client enregistré</h3><p>Ajoutez votre premier client.</p></div>
</div>`;
}

function templatePageFournisseurs() {
  return `<div class="page" id="page-fournisseurs">
  <div class="page-header flex page-header-split">
    <div class="page-header-main">
      <h1>Gestion des Fournisseurs</h1>
      <p>Gérez vos fournisseurs, leurs informations légales et leur score de fiabilité.</p>
    </div>
    <div class="page-header-actions" role="group" aria-label="Actions sur les fournisseurs">
      <button type="button" class="btn btn-primary" id="btn-add-fourn"><span aria-hidden="true">➕</span> Nouveau Fournisseur</button>
      <button type="button" class="btn btn-secondary btn-inline-icon" id="btn-import-fourn" title="CSV : mêmes champs que la fiche fournisseur. Aperçu obligatoire, doublons nom+ICE signalés, mise à jour par id." aria-label="Importer les fournisseurs depuis un fichier CSV (aperçu obligatoire)">
        <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import CSV (aperçu)
      </button>
      <button type="button" class="btn btn-secondary" id="btn-export-fourn" title="Fichier .csv (UTF-8, séparateur ;). Réouvrable dans Excel."><span aria-hidden="true">📊</span> Exporter CSV</button>
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid4 fournisseurs-kpis">
    <div class="stat-card"><div class="stat-label">Total fournisseurs</div><div class="stat-val blue" id="fourn-kpi-count">0</div></div>
    <div class="stat-card"><div class="stat-label"><span aria-hidden="true">🟢</span> Fiables (A)</div><div class="stat-val green" id="fourn-kpi-a">0</div></div>
    <div class="stat-card"><div class="stat-label"><span aria-hidden="true">🔵</span> Corrects (B)</div><div class="stat-val" id="fourn-kpi-b">0</div></div>
    <div class="stat-card"><div class="stat-label"><span aria-hidden="true">🟠</span> À surveiller (C)</div><div class="stat-val stat-val-accent" id="fourn-kpi-c">0</div></div>
  </div>

  <!-- Filtres -->
  <div class="section-filters section-filters-lg" role="group" aria-label="Filtres fournisseurs">
    <div class="filter-main"><input type="text" id="fourn-search" placeholder="Rechercher un fournisseur…" autocomplete="off" aria-label="Rechercher un fournisseur"></div>
    <select id="fourn-cat-filter" aria-label="Filtrer par catégorie de fournisseur"><option value="">Toutes catégories</option></select>
    <select id="fourn-score-filter" aria-label="Filtrer par score de fiabilité">
      <option value="">Tous les scores</option>
      <option value="A">A — Fiable</option>
      <option value="B">B — Correct</option>
      <option value="C">C — À surveiller</option>
    </select>
  </div>

  <!-- Grille cartes -->
  <div id="fourn-grid" class="fourn-grid"></div>
  <div id="fourn-empty" class="empty-state">
    <div class="empty-icon" aria-hidden="true">🏭</div>
    <h3>Aucun fournisseur enregistré</h3>
    <p>Ajoutez votre premier fournisseur pour commencer.</p>
    <button type="button" class="btn btn-primary btn-mt12" id="btn-add-fourn-empty"><span aria-hidden="true">➕</span> Ajouter un fournisseur</button>
  </div>
</div>`;
}

function templatePageBonsCommande() {
  return `<div class="page" id="page-bons-commande">
  <div class="page-header flex page-header-split">
    <div>
      <h1>Bons de commande</h1>
      <p>Commandes fournisseurs liées au stock : à la réception, les quantités sont ajoutées automatiquement aux articles.</p>
    </div>
    <button type="button" class="btn btn-primary" id="btn-bc-new"><span aria-hidden="true">➕</span> Nouveau bon</button>
  </div>
  <div class="grid3 section-kpis">
    <div class="stat-card"><div class="stat-label">Total bons</div><div class="stat-val blue" id="bc-kpi-total">0</div></div>
    <div class="stat-card"><div class="stat-label">En cours (attente / validé)</div><div class="stat-val stat-val-gold" id="bc-kpi-pending">0</div></div>
    <div class="stat-card"><div class="stat-label">Réceptionnés</div><div class="stat-val green" id="bc-kpi-received">0</div></div>
  </div>
  <div class="section-filters" role="group" aria-label="Filtres des bons de commande">
    <div class="filter-main"><input type="text" id="bc-search" placeholder="Référence ou fournisseur…" autocomplete="off" aria-label="Rechercher par référence ou fournisseur"></div>
    <select id="bc-filter-status" class="bc-filter-status" aria-label="Filtrer par statut du bon de commande">
      <option value="">Tous les statuts</option>
      <option value="pending">En attente</option>
      <option value="approved">Validé</option>
      <option value="received">Réceptionné</option>
      <option value="cancelled">Annulé</option>
    </select>
  </div>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Réf. / Date</th><th>Fournisseur</th><th>Statut</th><th>Lignes</th><th>Total TTC</th><th>Actions</th></tr></thead>
      <tbody id="bc-tbody"></tbody>
    </table>
  </div>
  <div id="bc-empty" class="empty-state">
    <div class="empty-icon" aria-hidden="true">📋</div>
    <h3>Aucun bon de commande</h3>
    <p>Créez un bon pour un fournisseur et ajoutez des articles du stock (ou tous les articles si besoin).</p>
    <button type="button" class="btn btn-primary btn-mt12" id="btn-bc-new-empty"><span aria-hidden="true">➕</span> Nouveau bon</button>
  </div>
</div>`;
}

function templatePageSettings() {
  return `<div class="page" id="page-settings">
  <div class="page-header flex settings-header">
    <div><h1>Paramètres de l'Entreprise</h1><p>Informations légales et personnalisation documents.</p></div>
    <div class="settings-header-actions" role="group" aria-label="Enregistrer ou annuler les paramètres">
      <button type="button" class="btn btn-secondary" id="btn-cancel-settings">Annuler</button>
      <button type="button" class="btn btn-primary" id="btn-save-settings" aria-label="Enregistrer les paramètres"><span aria-hidden="true">💾</span> Sauvegarder</button>
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-header"><div class="settings-section-icon ssi-company" aria-hidden="true">🏢</div><div><div class="settings-section-title">Informations d'Entreprise</div></div></div>
    <div class="settings-section-body">
      <div id="settings-score-bar" class="settings-score-bar"></div>
      <div class="field-row c2"><div class="form-group"><label for="s-name">Nom ou Raison Sociale</label><input id="s-name" name="settings-company-name" autocomplete="organization" placeholder="INVOO OFFICE SARL"></div><div class="form-group"><label for="s-email">Email</label><input id="s-email" name="settings-email" type="email" inputmode="email" autocomplete="email" placeholder="contact@entreprise.ma"></div></div>
      <div class="field-row c2"><div class="form-group"><label for="s-phone">Téléphone</label><input id="s-phone" name="settings-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+212 6XX XX XX XX"></div><div class="form-group"><label for="s-city">Ville</label><input id="s-city" name="settings-city" autocomplete="address-level2" placeholder="Casablanca"></div></div>
      <div class="form-group"><label for="s-address">Adresse du siège social</label><input id="s-address" name="settings-address" autocomplete="street-address" placeholder="N° Rue, Quartier, Ville"></div>
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-header"><div class="settings-section-icon ssi-bank" aria-hidden="true">🏦</div><div><div class="settings-section-title">Coordonnées Bancaires</div></div></div>
    <div class="settings-section-body">
      <div class="field-row c3"><div class="form-group"><label for="s-bank">Banque</label><input id="s-bank" name="settings-bank" placeholder="Attijariwafa Bank"></div><div class="form-group"><label for="s-branch">Agence</label><input id="s-branch" name="settings-branch" placeholder="Agence Guéliz"></div><div class="form-group"><label for="s-rib">RIB <span class="settings-help-inline settings-help-inline-strong">(24 chiffres)</span></label><input id="s-rib" name="settings-rib" type="text" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="000000000000000000000000" title="RIB marocain : 24 chiffres consécutifs (les espaces sont retirés automatiquement)."></div></div>
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-header"><div class="settings-section-icon ssi-legal" aria-hidden="true">🏛</div><div><div class="settings-section-title">Informations légales DGI</div></div></div>
    <div class="settings-section-body">
      <div class="field-row c3">
        <div class="form-group"><label for="s-ice">ICE (Identifiant Commun de l'Entreprise)</label><input id="s-ice" name="settings-ice" placeholder="000000000000000" maxlength="15" pattern="\\d{15}" inputmode="numeric"></div>
        <div class="form-group"><label for="s-if">IF (Identifiant Fiscal)</label><input id="s-if" name="settings-if" placeholder="00000000" maxlength="8" pattern="\\d{1,8}" inputmode="numeric"></div>
        <div class="form-group"><label for="s-rc">RC (Registre du Commerce)</label><input id="s-rc" name="settings-rc" placeholder="00000" maxlength="6" pattern="\\d{1,6}" inputmode="numeric"></div>
      </div>
      <div class="field-row c3">
        <div class="form-group"><label for="s-tp">TP (Taxe Professionnelle)</label><input id="s-tp" name="settings-tp" placeholder="00000000" maxlength="8" pattern="\\d{1,8}" inputmode="numeric"></div>
        <div class="form-group"><label for="s-cnss">CNSS</label><input id="s-cnss" name="settings-cnss" placeholder="0000000" maxlength="7" pattern="\\d{1,7}" inputmode="numeric"></div>
        <div class="form-group"><label for="s-currency">Devise</label><select id="s-currency" name="settings-currency"><option value="DH">Dirham (DH)</option><option value="EUR">Euro (€)</option><option value="USD">Dollar ($)</option></select></div>
      </div>
      <div class="form-group settings-tva-group"><label for="s-tva">TVA par défaut</label>
        <select id="s-tva" name="settings-tva"><option value="20">20% Taux Normal</option><option value="14">14% Réduit</option><option value="10">10% Réduit</option><option value="7">7% Réduit</option><option value="0">0% — Auto-entrepreneur (exonéré TVA)</option></select>
      </div>
      <div class="form-group settings-price-mode-group"><label for="s-price-mode">Saisie du prix unitaire (documents)</label>
        <select id="s-price-mode" name="settings-price-mode" title="Valeur par défaut pour les nouveaux documents ; modifiable sur chaque document">
          <option value="TTC">Prix en TTC</option>
          <option value="HT">Prix en HT</option>
        </select>
        <p class="settings-help-inline">Enregistré automatiquement. Défaut des nouveaux documents.</p>
      </div>
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-header"><div class="settings-section-icon ssi-seq" aria-hidden="true">🔢</div><div><div class="settings-section-title">Séquences de Numérotation</div></div></div>
    <div class="settings-section-body">
      <div class="grid-settings-4 settings-seq-grid">
        <div class="form-group"><label for="s-seq-f">Prochaine Facture</label><input id="s-seq-f" name="settings-seq-f" type="number" inputmode="numeric" placeholder="1"></div>
        <div class="form-group"><label for="s-seq-d">Prochain Devis</label><input id="s-seq-d" name="settings-seq-d" type="number" inputmode="numeric" placeholder="1"></div>
        <div class="form-group"><label for="s-seq-bl">Prochain BL</label><input id="s-seq-bl" name="settings-seq-bl" type="number" inputmode="numeric" placeholder="1"></div>
        <div class="form-group"><label for="s-seq-av">Prochain Avoir</label><input id="s-seq-av" name="settings-seq-av" type="number" inputmode="numeric" placeholder="1"></div>
      </div>
      <div class="alert info">Exemple : <strong>F-2026-0010</strong></div>
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-header"><div class="settings-section-icon ssi-footer" aria-hidden="true">📄</div><div><div class="settings-section-title">Pied de Page (Footer)</div></div></div>
    <div class="settings-section-body">
      <label for="s-footer" class="sr-only">Texte du pied de page des documents</label>
      <textarea id="s-footer" name="settings-footer" rows="3" placeholder="Merci de votre confiance..."></textarea>
    </div>
  </div>

  <div class="settings-section">
    <div class="settings-section-header"><div class="settings-section-icon ssi-logo" aria-hidden="true">🖼️</div><div><div class="settings-section-title">Logo de l'Entreprise</div><div class="settings-subtitle">Apparaît sur vos factures et devis</div></div></div>
    <div class="settings-section-body">
      <div class="settings-logo-row">
        <div class="settings-logo-preview-wrap">
          <img id="logo-preview" src="" alt="Logo" class="settings-logo-preview">
          <span id="logo-placeholder" class="settings-logo-placeholder" aria-hidden="true">🖼️</span>
        </div>
        <div class="settings-logo-actions">
          <label class="btn btn-secondary settings-logo-picker-btn">
            <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Choisir un logo
            <input type="file" id="s-logo" accept="image/*" class="settings-file-hidden">
          </label>
          <button type="button" class="btn btn-secondary settings-logo-remove-btn" id="btn-remove-logo">
            <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Supprimer le logo
          </button>
        </div>
      </div>
      <div class="form-group settings-logo-height-group">
        <label for="s-logo-height">Hauteur du logo dans les documents (PDF / impression)</label>
        <div class="settings-logo-height-row">
          <input type="range" id="s-logo-height" min="24" max="120" step="1" value="48" class="settings-logo-height-range" oninput="var el=document.getElementById('s-logo-height-val');if(el)el.textContent=this.value">
          <span id="s-logo-height-val" class="settings-logo-height-val">48</span>
          <span class="settings-logo-height-unit">px</span>
        </div>
        <p class="settings-logo-height-help">La largeur s’ajuste automatiquement pour conserver les proportions. À l’enregistrement, l’image est limitée à <strong>400 px</strong> de hauteur maximum (qualité et poids du fichier). Cliquez sur <strong>Enregistrer les paramètres</strong> pour appliquer la hauteur du logo aux PDF.</p>
      </div>
      <div class="form-group settings-pdf-company-with-logo">
        <label class="ui-toggle settings-pdf-toggle" for="s-pdf-show-company-with-logo">
          <input type="checkbox" id="s-pdf-show-company-with-logo" class="ui-toggle-input" role="switch" checked>
          <span class="ui-toggle-track" aria-hidden="true"></span>
          <span class="settings-pdf-toggle-text">Afficher les informations de l’entreprise avec le logo</span>
        </label>
        <p class="settings-logo-height-help">Désactivé : seul le logo apparaît dans le bandeau d’en-tête des PDF (nom, adresse, téléphone et e-mail sont masqués dans ce bandeau — le bloc « Émetteur » en dessous reste inchangé).</p>
      </div>
    </div>
  </div>

  <!-- ══ TEMPLATES PDF ══ -->
  <div class="settings-section">
    <div class="settings-section-header"><div class="settings-section-icon ssi-template" aria-hidden="true">🎨</div><div><div class="settings-section-title">Templates de Document PDF</div><div class="settings-subtitle">Choisissez le style visuel de vos factures, devis et bons de livraison</div></div></div>
    <div class="settings-section-body">

      <!-- Template selector -->
      <div class="grid-settings-4 settings-template-grid" role="group" aria-label="Choisir le modèle de document PDF">

        <!-- Template 1 : Classic -->
        <div class="tpl-card tpl-card-active" id="tpl-card-classic" data-select-tpl="classic">
          <div class="tpl-preview" id="tpl-prev-classic">
            <div class="tpl-prev-header tpl-accent-classic"></div>
            <div class="tpl-prev-line"></div>
            <div class="tpl-prev-band tpl-accent-classic"></div>
            <div class="tpl-prev-rows">
              <div class="tpl-prev-row"></div><div class="tpl-prev-row"></div>
            </div>
            <div class="tpl-prev-footer tpl-accent-classic"></div>
          </div>
          <div class="tpl-name">Classic</div>
          <div class="tpl-desc">En-tête coloré, lignes épurées</div>
          <div class="tpl-active-badge" id="badge-classic"><span aria-hidden="true">✓</span> Actif</div>
        </div>

        <!-- Template 2 : Modern -->
        <div class="tpl-card" id="tpl-card-modern" data-select-tpl="modern">
          <div class="tpl-preview" id="tpl-prev-modern">
            <div class="tpl-modern-top">
              <div class="tpl-modern-main"></div>
              <div class="tpl-modern-side"></div>
            </div>
            <div class="tpl-prev-line"></div>
            <div class="tpl-prev-band tpl-accent-modern"></div>
            <div class="tpl-prev-rows">
              <div class="tpl-prev-row"></div><div class="tpl-prev-row"></div>
            </div>
            <div class="tpl-modern-bottom"></div>
          </div>
          <div class="tpl-name">Modern</div>
          <div class="tpl-desc">Bicolore, typographie forte</div>
          <div class="tpl-active-badge tpl-active-badge-hidden" id="badge-modern"><span aria-hidden="true">✓</span> Actif</div>
        </div>

        <!-- Template 3 : Minimal -->
        <div class="tpl-card" id="tpl-card-minimal" data-select-tpl="minimal">
          <div class="tpl-preview" id="tpl-prev-minimal">
            <div class="tpl-minimal-top"></div>
            <div class="tpl-prev-line"></div>
            <div class="tpl-prev-line tpl-prev-line-w55"></div>
            <div class="tpl-minimal-divider"></div>
            <div class="tpl-prev-band tpl-accent-minimal"></div>
            <div class="tpl-prev-rows">
              <div class="tpl-prev-row"></div><div class="tpl-prev-row"></div>
            </div>
          </div>
          <div class="tpl-name">Minimal</div>
          <div class="tpl-desc">Sobre, noir & blanc</div>
          <div class="tpl-active-badge tpl-active-badge-hidden" id="badge-minimal"><span aria-hidden="true">✓</span> Actif</div>
        </div>

        <!-- Template 4 : Executive -->
        <div class="tpl-card" id="tpl-card-executive" data-select-tpl="executive">
          <div class="tpl-preview" id="tpl-prev-executive">
            <div class="tpl-exec-top"></div>
            <div class="tpl-prev-line tpl-prev-line-w60"></div>
            <div class="tpl-prev-band tpl-accent-executive"></div>
            <div class="tpl-prev-rows">
              <div class="tpl-prev-row"></div><div class="tpl-prev-row"></div>
            </div>
            <div class="tpl-exec-bottom-wrap"><div class="tpl-exec-bottom"></div></div>
          </div>
          <div class="tpl-name">Executive</div>
          <div class="tpl-desc">Gradient violet, prestige</div>
          <div class="tpl-active-badge tpl-active-badge-hidden" id="badge-executive"><span aria-hidden="true">✓</span> Actif</div>
        </div>
      </div>

      <!-- Couleur de bande personnalisable -->
      <div class="settings-band-box">
        <div class="settings-band-title">
          <span aria-hidden="true">🎨</span> Couleur de la bande "Désignation / Qté / PU HT / Montant"
        </div>
        <div class="settings-band-row">
          <div class="settings-band-inputs" role="group" aria-label="Couleur de la bande du tableau des lignes">
            <input type="color" id="s-band-color" value="#1a6b3c" class="settings-band-color-input" aria-label="Choisir la couleur de la bande (sélecteur visuel)">
            <input type="text" id="s-band-color-hex" value="#1a6b3c"  placeholder="#1a6b3c" class="settings-band-color-hex" aria-label="Code couleur hexadécimal de la bande (ex. #1a6b3c)">
          </div>
          <div class="settings-band-swatches" role="group" aria-label="Nuanciers prédéfinis pour la bande du tableau">
            <div class="band-color-swatch band-color-dgi" data-band-color="#1a6b3c" title="Vert DGI" role="button" tabindex="0" aria-label="Appliquer la couleur Vert DGI"></div>
            <div class="band-color-swatch band-color-modern" data-band-color="#2563eb" title="Bleu Modern" role="button" tabindex="0" aria-label="Appliquer la couleur Bleu Modern"></div>
            <div class="band-color-swatch band-color-minimal" data-band-color="#374151" title="Gris Minimal" role="button" tabindex="0" aria-label="Appliquer la couleur Gris Minimal"></div>
            <div class="band-color-swatch band-color-executive" data-band-color="#7c3aed" title="Violet Executive" role="button" tabindex="0" aria-label="Appliquer la couleur Violet Executive"></div>
            <div class="band-color-swatch band-color-amber" data-band-color="#b45309" title="Ambre" role="button" tabindex="0" aria-label="Appliquer la couleur Ambre"></div>
            <div class="band-color-swatch band-color-red" data-band-color="#be123c" title="Rouge" role="button" tabindex="0" aria-label="Appliquer la couleur Rouge"></div>
            <div class="band-color-swatch band-color-cyan" data-band-color="#0e7490" title="Cyan" role="button" tabindex="0" aria-label="Appliquer la couleur Cyan"></div>
            <div class="band-color-swatch band-color-black" data-band-color="#000000" title="Noir" role="button" tabindex="0" aria-label="Appliquer la couleur Noir"></div>
          </div>
        </div>

        <!-- Live preview bande -->
        <div class="settings-band-preview-wrap">
          <div class="settings-band-preview-label">Aperçu de la bande :</div>
          <div id="band-live-preview" class="settings-band-live-preview">
            <span class="settings-band-col-des">Désignation</span>
            <span class="settings-band-col-qty">Qté</span>
            <span class="settings-band-col-price">PU HT</span>
            <span class="settings-band-col-vat">TVA</span>
            <span class="settings-band-col-amount">Montant HT</span>
          </div>
        </div>
      </div>

      <!-- Bouton Imprimer PDF de test -->
      <div class="settings-preview-actions">
        <button type="button" class="btn btn-primary settings-preview-print-btn" id="btn-print-settings-preview">
          <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          Aperçu PDF / Imprimer
        </button>
        <span class="settings-preview-hint">Génère une facture de démonstration avec le template sélectionné</span>
      </div>

    </div>
  </div>

  <!-- ══ LICENCE / ACTIVATION ══ -->
  <div class="settings-section">
    <div class="settings-section-header">
      <div class="settings-section-icon settings-icon-activation" aria-hidden="true">🔑</div>
      <div>
        <div class="settings-section-title">Licence &amp; appareil</div>
        <div class="settings-subtitle">Activation locale (hors ligne)</div>
      </div>
    </div>
    <div class="settings-section-body">
      <div id="settings-activation-status" class="settings-activation-status"></div>
    </div>
  </div>

  <!-- ══ CONFIDENTIALITÉ (RGPD / transparence) ══ -->
  <div class="settings-section">
    <div class="settings-section-header">
      <div class="settings-section-icon settings-icon-privacy" aria-hidden="true">🔒</div>
      <div>
        <div class="settings-section-title">Données personnelles</div>
        <div class="settings-subtitle">Transparence — stockage local</div>
      </div>
    </div>
    <div class="settings-section-body">
      <p class="settings-paragraph settings-paragraph-gap-12">
        INVOO OFFICE enregistre vos données <strong>dans ce navigateur</strong> (stockage local / OPFS). Aucun serveur central INVOO OFFICE ne reçoit vos factures ni votre liste de clients.
      </p>
      <p class="settings-paragraph settings-paragraph-gap-12">
        L’<strong>activation</strong> s’effectue en local : vous pouvez ouvrir WhatsApp depuis l’écran d’activation pour envoyer votre e-mail et votre identifiant appareil au support ; aucun envoi automatique n’est effectué par l’application.
      </p>
      <p class="settings-paragraph settings-paragraph-gap-14">
        Vous pouvez <strong>exporter</strong> vos données (JSON / Excel / CSV) ou les <strong>effacer</strong> via les données du site dans les paramètres du navigateur, ou la fonction d’effacement prévue dans l’app.
      </p>
      <a class="btn btn-secondary btn-sm" href="privacy.html" target="_blank" rel="noopener noreferrer">Politique de confidentialité (détail)</a>
    </div>
  </div>

  <!-- ══ SYNC SUPABASE (OPTIONNEL) ══ -->
  <div class="settings-section settings-supabase-section">
    <div class="settings-section-header">
      <div class="settings-section-icon settings-icon-supabase" aria-hidden="true">☁️</div>
      <div>
        <div class="settings-section-title">Sync multi-appareils — Supabase</div>
        <div class="settings-subtitle">Optionnel — votre propre projet Supabase (jamais activé sans votre accord)</div>
      </div>
    </div>
    <div class="settings-section-body">
      <label class="ui-toggle settings-supabase-toggle" for="s-supabase-sync-enabled">
        <input type="checkbox" class="ui-toggle-input" id="s-supabase-sync-enabled" name="supabase-sync-enabled" aria-describedby="supabase-sync-help">
        <span class="ui-toggle-track" aria-hidden="true"></span>
        <span class="settings-pdf-toggle-text">Activer la synchronisation cloud (Supabase)</span>
      </label>
      <p id="supabase-sync-help" class="settings-paragraph settings-supabase-help">
        Lorsque cette option est activée, vous pouvez connecter l’app à <strong>votre</strong> base Supabase pour fusionner <strong>toutes les préférences enregistrées dans Paramètres</strong> (entreprise, banque, légal DGI, modèle PDF, logo, compteurs, rappels backup, mode TTC/HT, etc.), ainsi que clients, documents, stock, fournisseurs, bons de commande et mouvements de stock entre appareils. Seuls l’URL projet, la clé <strong>anon</strong> et l’interrupteur « activer la sync » restent <strong>locaux à l’appareil</strong> (jamais envoyés dans le JSON synchronisé). Rien n’est envoyé tant que vous n’avez pas saisi l’URL et la clé <strong>anon</strong> et cliqué sur « Connecter ».
      </p>

      <div class="settings-supabase-steps">
        <div class="settings-mini-title">Comment configurer ?</div>
        <ol class="settings-supabase-ol">
          <li>Créez un compte gratuit sur <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a></li>
          <li>Créez un projet → <strong>SQL Editor</strong> → exécutez le script ci-dessous (une fois)</li>
          <li><strong>Database → Publications</strong> : ajoutez chaque table <code>invoo_rt_*</code> à <code>supabase_realtime</code> (mises à jour instantanées entre appareils)</li>
          <li><strong>Settings → API</strong> : copiez <strong>Project URL</strong> et <strong>anon public</strong> key</li>
          <li>Collez-les ci-dessous puis <strong>Connecter &amp; synchroniser</strong></li>
        </ol>
      </div>

      <div class="settings-supabase-privacy">
        <div class="settings-mini-title">Confidentialité des données</div>
        <p class="settings-paragraph">
          La synchronisation envoie les enregistrements en JSON dans la colonne <code>data</code> (jsonb), y compris l’ensemble des <strong>paramètres métier</strong> (coordonnées, RIB, ICE/IF/RC, logo, rappels backup, etc.). Pour un usage personnel sur un <strong>projet privé</strong>, c’est généralement acceptable. Un administrateur du projet Supabase peut lire ces données. N’utilisez <strong>jamais</strong> la clé <code>service_role</code> dans l’application.
        </p>
      </div>

      <div class="settings-mini-title">Script SQL — à exécuter une seule fois dans Supabase → SQL Editor</div>
      <div class="settings-supabase-sql-wrap">
        <pre id="supabase-sql-template" class="settings-supabase-sql" readonly>-- INVOO OFFICE — tables de sync (id + jsonb + soft delete)
create table if not exists public.invoo_rt_clients (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  updated_at timestamptz not null default now()
);
create table if not exists public.invoo_rt_docs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  updated_at timestamptz not null default now()
);
create table if not exists public.invoo_rt_stock (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  updated_at timestamptz not null default now()
);
create table if not exists public.invoo_rt_fournisseurs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  updated_at timestamptz not null default now()
);
create table if not exists public.invoo_rt_bons_commande (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  updated_at timestamptz not null default now()
);
create table if not exists public.invoo_rt_stock_moves (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  updated_at timestamptz not null default now()
);
create table if not exists public.invoo_rt_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  updated_at timestamptz not null default now()
);
alter table public.invoo_rt_clients enable row level security;
alter table public.invoo_rt_docs enable row level security;
alter table public.invoo_rt_stock enable row level security;
alter table public.invoo_rt_fournisseurs enable row level security;
alter table public.invoo_rt_bons_commande enable row level security;
alter table public.invoo_rt_stock_moves enable row level security;
alter table public.invoo_rt_settings enable row level security;
create policy "invoo_rt_clients_anon" on public.invoo_rt_clients for all using (true) with check (true);
create policy "invoo_rt_docs_anon" on public.invoo_rt_docs for all using (true) with check (true);
create policy "invoo_rt_stock_anon" on public.invoo_rt_stock for all using (true) with check (true);
create policy "invoo_rt_fournisseurs_anon" on public.invoo_rt_fournisseurs for all using (true) with check (true);
create policy "invoo_rt_bons_commande_anon" on public.invoo_rt_bons_commande for all using (true) with check (true);
create policy "invoo_rt_stock_moves_anon" on public.invoo_rt_stock_moves for all using (true) with check (true);
create policy "invoo_rt_settings_anon" on public.invoo_rt_settings for all using (true) with check (true);
-- Realtime : répéter pour chaque table (ou via l’interface Publications)
alter publication supabase_realtime add table public.invoo_rt_clients;
alter publication supabase_realtime add table public.invoo_rt_docs;
alter publication supabase_realtime add table public.invoo_rt_stock;
alter publication supabase_realtime add table public.invoo_rt_fournisseurs;
alter publication supabase_realtime add table public.invoo_rt_bons_commande;
alter publication supabase_realtime add table public.invoo_rt_stock_moves;
alter publication supabase_realtime add table public.invoo_rt_settings;</pre>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-supabase-copy-sql">Copier le script</button>
      </div>

      <div class="field-row c1 settings-supabase-fields">
        <div class="form-group">
          <label for="s-supabase-url">Project URL <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" class="settings-help-inline">Ouvrir Supabase</a></label>
          <input type="url" id="s-supabase-url" name="supabase-url" placeholder="https://xxxxxxxxxxxx.supabase.co" autocomplete="off" spellcheck="false">
        </div>
        <div class="form-group">
          <label for="s-supabase-anon-key">Clé API (anon public)</label>
          <input type="password" id="s-supabase-anon-key" name="supabase-anon-key" placeholder="eyJhbGciOiJIUzI1NiIs…" autocomplete="off" spellcheck="false">
          <p class="settings-logo-height-help">Utilisez la clé <strong>anon</strong> — jamais la clé <code>service_role</code>.</p>
        </div>
      </div>

      <div class="settings-supabase-actions">
        <button type="button" class="btn btn-primary" id="btn-supabase-connect">Connecter &amp; synchroniser</button>
        <button type="button" class="btn btn-secondary" id="btn-supabase-sync-now">Synchroniser maintenant</button>
        <button type="button" class="btn btn-secondary" id="btn-supabase-disconnect">Déconnecter</button>
      </div>
      <p class="settings-supabase-status-line">État : <strong id="supabase-sync-status">Non configuré</strong></p>
    </div>
  </div>

  <!-- ══ SAUVEGARDE & RESTAURATION ══ -->
  <div class="settings-section settings-backup-section">
    <div class="settings-section-header settings-backup-header">
      <div class="settings-section-icon settings-icon-backup" aria-hidden="true">💾</div>
      <div>
        <div class="settings-section-title settings-backup-title">Sauvegarde & Restauration</div>
        <div class="settings-subtitle">Stockage OPFS actif — données illimitées</div>
      </div>
      <div class="settings-backup-header-right">
        <span id="opfs-status-badge" class="opfs-status-badge">
          <span class="opfs-status-dot"></span>
          OPFS Actif
        </span>
      </div>
    </div>
    <div class="settings-section-body">
      <!-- Info banner -->
      <div class="settings-backup-info-banner">
        <div class="settings-backup-info-icon" aria-hidden="true">🗄️</div>
        <div>
          <div class="settings-backup-info-title">Stockage automatique dans ce navigateur, sans limite d'espace.</div>
          <div class="settings-backup-info-text">Pensez à exporter une sauvegarde pour transférer vos données sur un autre appareil.</div>
          <div id="opfs-storage-info" class="settings-backup-storage-info">Calcul en cours...</div>
        </div>
      </div>

      <!-- Sauvegarde Portable -->
      <div class="settings-backup-portable">
        <div class="settings-backup-block-title"><span aria-hidden="true">📦</span> Sauvegarde Portable</div>
        <div class="settings-backup-portable-card">
          <div class="settings-backup-portable-card-title">Exportez vos données en fichier JSON</div>
          <div class="settings-backup-portable-card-text">Pour les sauvegarder sur une clé USB, les transférer sur un autre appareil, ou les archiver. <strong class="settings-backup-strong">Importer sauvegarde</strong> lit exactement le fichier produit par <strong class="settings-backup-strong">Exporter Backup JSON</strong> (même format JSON).</div>
        </div>
        <div class="settings-backup-actions">
          <button type="button" class="btn btn-primary settings-icon-btn" id="btn-export-all">
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exporter Backup JSON (.json)
          </button>
          <button type="button" class="btn btn-secondary settings-icon-btn" id="btn-import-all">
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Importer sauvegarde
          </button>
          <input type="file" id="import-file" accept=".json" class="settings-file-hidden" aria-label="Choisir un fichier de sauvegarde JSON à importer (même format qu’Exporter Backup JSON)">
        </div>
        <div class="settings-backup-reminder-card">
          <div class="settings-backup-reminder-title"><span aria-hidden="true">📅</span> Rappel mensuel (popup backup)</div>
          <div class="settings-backup-reminder-text">Indiquez le <strong>jour du mois</strong> où une fenêtre propose automatiquement de télécharger le backup JSON (ex. <strong>15</strong> = chaque mois le 15, à l’ouverture de l’app). Mettez <strong>0</strong> pour désactiver.</div>
          <div class="settings-backup-reminder-row">
            <label for="s-backup-monthly-day" class="settings-backup-reminder-label">Jour du mois (0–31)</label>
            <input type="number" id="s-backup-monthly-day" min="0" max="31" placeholder="0" class="settings-backup-reminder-input">
            <span class="settings-backup-reminder-note">0 = désactivé · les mois plus courts utilisent le dernier jour (ex. 31 → 28 ou 29 en février)</span>
          </div>
        </div>
        <div id="backup-reminder-status" class="settings-backup-reminder-status"></div>
      </div>

      <!-- Warning -->
      <div class="settings-backup-warning">
        <div class="settings-backup-warning-icon" aria-hidden="true">⚠️</div>
        <div class="settings-backup-warning-text">
          <strong class="settings-backup-gold">Données liées à ce navigateur.</strong> Si vous changez d'ordinateur, de navigateur, ou réinstallez Chrome, vos données seront perdues. <strong>Exportez régulièrement une sauvegarde</strong> et gardez-la en lieu sûr.
        </div>
      </div>

      <!-- Cache + Danger zone -->
      <div class="settings-backup-cache-zone">

        <!-- Vider le cache -->
        <div class="settings-backup-cache-card">
          <div class="settings-backup-cache-row">
            <div>
              <div class="settings-backup-cache-title">
                <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                Vider le cache
              </div>
              <div class="settings-backup-cache-text">Recharge les données depuis le stockage sans rien supprimer.<br>Utile si des modifications ne s'affichent pas correctement.</div>
            </div>
            <button type="button" class="btn settings-backup-cache-btn" id="btn-clear-cache">
              <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              Vider le cache &amp; Recharger
            </button>
          </div>
        </div>

        <div class="settings-backup-danger-title">Zone Dangereuse</div>
        <button type="button" class="btn btn-secondary settings-icon-btn" id="btn-reload-data">
            <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Recharger les données
          </button>
        <button type="button" class="btn btn-danger settings-icon-btn" id="btn-clear-data">
          <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Effacer toutes les données
        </button>
      </div>
    </div>
  </div>
</div>`;
}
function buildAppPagesHtml() {
  return [
    templatePageOverview(),
    templatePageGenerate(),
    templatePageHistory(),
    templatePageReports(),
    templatePageStock(),
    templatePageClients(),
    templatePageFournisseurs(),
    templatePageBonsCommande(),
    templatePageSettings(),
  ].join('\n');
}

function injectAppPageTemplates() {
  const el = document.getElementById('content');
  if (!el) return;
  // Gabarit statique embarqué — setStaticHtml/DOMPurify supprimeraient les oninput (paramètres, aperçu PDF).
  // eslint-disable-next-line no-restricted-syntax -- gabarits build internes uniquement (build-page-templates.mjs)
  el.innerHTML = buildAppPagesHtml();
}

injectAppPageTemplates();
