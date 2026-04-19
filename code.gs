/**
 * ============================================================================
 * MAROCSURF BLOG — Google Sheets → GitHub Pages
 * ============================================================================
 *
 * Comment ça marche :
 * - Tu remplis MANUELLEMENT les articles dans la feuille Google Sheet (une ligne = un article).
 * - Chaque jour à 9h, le script publie les 5 prochains articles "DRAFT" vers GitHub.
 * - GitHub Actions lance le build statique automatiquement.
 *
 * Setup :
 * 1. Google Sheet → Extensions → Apps Script → colle ce fichier.
 * 2. Renseigne les Script Properties (voir liste ci-dessous).
 * 3. Lance "Setup Sheet" depuis le menu pour créer les colonnes.
 * 4. Lance "Install triggers" pour activer la publication quotidienne.
 *
 * Script Properties nécessaires :
 *   GITHUB_TOKEN     → Personal Access Token GitHub (scope: repo)
 *   GITHUB_REPO      → "ton-username/ton-repo" (ex: INVOOFFICE/SurfMaroko)
 *   SURF_SITE_ORIGIN → "https://marocsurf.com" (ton domaine)
 *   WEBHOOK_URL      → (optionnel) URL webhook de notification
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
var SURF_CONFIG = {
  SHEET_NAME: 'SurfArticles',
  GITHUB_BRANCH: 'main',
  GITHUB_NEWS_JSON_PATH: 'surf-news.json',
  ARTICLES_PER_DAY: 5,          // Nombre d'articles publiés par jour
  SEO_TITLE_MAX: 70,
  META_DESC_MAX: 160,

  // Catégories disponibles pour le blog surf Maroc
  CATEGORIES: [
    'Spots',
    'Beginners',
    'Seasons',
    'Gear',
    'Culture',
    'Competitions',
    'Travel',
    'Techniques',
  ],

  SITE: {
    name: 'MoroccoSurf',
    description: 'The Morocco surf blog — spots, seasons, beginner tips.',
    topics: ['Spots', 'Beginners', 'Seasons', 'Gear', 'Culture', 'Techniques'],
    // canonicalOrigin sera remplacé par SURF_SITE_ORIGIN depuis les Properties
    canonicalOrigin: '',
    defaultOgImage: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&h=630&fit=crop&q=80',
  }
};

// ── COLONNES DE LA FEUILLE ───────────────────────────────────────────────────
// Tu remplis ces colonnes à la main dans Google Sheets
var SURF_COLS = [
  'ID',              // A — généré automatiquement
  'Titre',           // B — OBLIGATOIRE : titre de l'article
  'Catégorie',       // C — choisir dans CATEGORIES (ex: Spots, Débutants…)
  'Image URL',       // D — URL d'une image (Unsplash recommandé)
  'URL Source',      // E — lien vers la source si applicable (optionnel)
  'Résumé',          // F — OBLIGATOIRE : 3-5 phrases de résumé
  'Description complète', // G — texte complet de l'article (markdown supporté)
  'Pourquoi important',   // H — pourquoi ce spot/conseil est important
  'Points clés',          // I — liste de points clés, séparés par | (ex: Point1|Point2|Point3)
  'Mots-clés',       // J — mots-clés SEO séparés par virgule
  'SEO Titre',       // K — (optionnel) titre SEO alternatif
  'Meta Description',// L — (optionnel) description SEO
  'Slug',            // M — généré automatiquement depuis le titre
  'Statut',          // N — DRAFT (pas publié) → PUBLISHED (publié)
  'Date ajout',      // O — date de création de la ligne
  'Date publication',// P — date de publication effective
];

var SURF_COL = SURF_COLS.reduce(function(acc, name, i) {
  acc[name] = i + 1;
  return acc;
}, {});

var STATUS_DRAFT = 'DRAFT';
var STATUS_PUBLISHED = 'PUBLISHED';
var STATUS_SKIP = 'SKIP'; // Pour ignorer définitivement un article

// ── HELPERS ───────────────────────────────────────────────────────────────────

function surf_getProp_(key) {
  return String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
}

function surf_safeUi_() {
  try { return SpreadsheetApp.getUi(); } catch(e) { return null; }
}

function surf_notify_(msg) {
  var ui = surf_safeUi_();
  if (ui) ui.alert(msg);
  else Logger.log(msg);
}

function surf_getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function surf_getSheet_() {
  var ss = surf_getSpreadsheet_();
  var sh = ss.getSheetByName(SURF_CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SURF_CONFIG.SHEET_NAME);
  surf_ensureHeader_(sh);
  return sh;
}

function surf_ensureHeader_(sh) {
  var range = sh.getRange(1, 1, 1, SURF_COLS.length);
  var row = range.getValues()[0];
  var ok = SURF_COLS.every(function(h, i) { return String(row[i] || '').trim() === h; });
  if (!ok) {
    range.setValues([SURF_COLS]);
    sh.setFrozenRows(1);
    // Format de la ligne de header
    range.setBackground('#0369a1');
    range.setFontColor('#ffffff');
    range.setFontWeight('bold');
    // Largeur des colonnes
    sh.setColumnWidth(2, 320); // Titre
    sh.setColumnWidth(6, 400); // Résumé
    sh.setColumnWidth(7, 400); // Description
  }
}

function surf_slugify_(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' et ')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'article';
}

function surf_nowIso_() {
  return new Date().toISOString();
}

function surf_clampChars_(raw, max) {
  var s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '') + '…';
}

function surf_generateId_() {
  return 'surf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── MENU ─────────────────────────────────────────────────────────────────────

function onOpen() {
  var ui = surf_safeUi_();
  if (!ui) return;
  ui.createMenu('🌊 MarocSurf')
    .addItem('🔧 Setup Sheet (première fois)', 'surf_setupSheet')
    .addSeparator()
    .addItem('📤 Publier 5 articles maintenant', 'surf_publishDailyBatch')
    .addItem('📤 Publier TOUS les articles DRAFT', 'surf_publishAll')
    .addItem('👁️ Aperçu du prochain batch', 'surf_previewNextBatch')
    .addSeparator()
    .addItem('⚙️ Installer triggers (publication quotidienne)', 'surf_installTriggers')
    .addItem('📊 Statut des triggers', 'surf_triggerStatus')
    .addItem('🗑️ Supprimer les triggers', 'surf_removeTriggers')
    .addSeparator()
    .addItem('📝 Ajouter un article exemple', 'surf_addExampleArticle')
    .addItem('🔄 Re-générer slugs manquants', 'surf_regenerateSlugs')
    .addToUi();
}

// ── SETUP ─────────────────────────────────────────────────────────────────────

function surf_setupSheet() {
  var sh = surf_getSheet_();
  sh.clearContents();
  sh.getRange(1, 1, 1, SURF_COLS.length).setValues([SURF_COLS]);
  sh.setFrozenRows(1);
  var header = sh.getRange(1, 1, 1, SURF_COLS.length);
  header.setBackground('#0369a1');
  header.setFontColor('#ffffff');
  header.setFontWeight('bold');
  sh.setColumnWidth(2, 320);
  sh.setColumnWidth(6, 400);
  sh.setColumnWidth(7, 400);
  surf_notify_('✅ Feuille MarocSurf prête ! Tu peux maintenant remplir tes articles.\n\nColonnes OBLIGATOIRES : Titre, Catégorie, Résumé\nColonnes optionnelles : toutes les autres\n\nStatut initial : laisse DRAFT pour que l\'article soit publié automatiquement.');
}

// ── ARTICLE EXAMPLE ──────────────────────────────────────────────────────────

function surf_addExampleArticle() {
  var sh = surf_getSheet_();
  var slug = surf_slugify_('Anchor Point Le Meilleur Spot de Surf au Maroc');
  var row = [
    surf_generateId_(),
    'Anchor Point : Le Meilleur Spot de Surf au Maroc',
    'Spots',
    'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&h=630&fit=crop&q=80',
    'https://example.com/anchor-point',
    'Anchor Point à Taghazout est sans doute le spot de surf le plus emblématique du Maroc. Réputé pour ses vagues longues et puissantes, il attire des surfeurs du monde entier entre octobre et avril. Ce point break offre des rides exceptionnels de plus de 300 mètres lors des bons swells.',
    '## Présentation du spot\n\nAnchor Point se situe à environ 15 km au nord d\'Agadir, dans le village de Taghazout. C\'est un point break droit qui casse sur un fond rocheux. La vague est longue, rapide et creuse — idéale pour les riders intermédiaires à avancés.\n\n## Conditions optimales\n\nLa meilleure saison va de **novembre à mars**, avec des houles atlantiques régulières de 1,5 à 4 mètres. Le vent offshore souffle le matin, ce qui donne des conditions parfaites tôt dans la journée.\n\n## Niveau recommandé\n\nIntermédiaire à avancé. Les débutants seront mieux servis sur les beach breaks de Taghazout même.',
    'Anchor Point est le coeur battant du surf marocain. Il représente un patrimoine culturel et sportif majeur pour la région de Souss-Massa et attire un tourisme surf international qui bénéficie aux communautés locales.',
    'Vague longue droite jusqu\'à 300m|Fond rocheux — prévoir des boots|Meilleur le matin avec vent offshore|Saison principale : novembre-mars|Niveau intermédiaire à avancé|Village de Taghazout à 2 min à pied',
    'anchor point, taghazout, surf maroc, point break, spot surf maroc, meilleur spot maroc',
    'Anchor Point Taghazout — Guide Complet du Spot Mythique',
    'Tout sur Anchor Point à Taghazout : conditions, niveau requis, saison idéale et conseils pratiques pour surfer ce spot légendaire du Maroc.',
    slug,
    STATUS_DRAFT,
    surf_nowIso_(),
    '',
  ];
  sh.appendRow(row);
  surf_notify_('✅ Article exemple ajouté ! Statut = DRAFT. Il sera publié lors du prochain batch quotidien.');
}

// ── READ ROWS ─────────────────────────────────────────────────────────────────

function surf_readAllRows_() {
  var sh = surf_getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var data = sh.getRange(2, 1, last - 1, SURF_COLS.length).getValues();
  return data.map(function(row, idx) {
    return {
      _rowIndex: idx + 2,
      id: String(row[SURF_COL['ID'] - 1] || '').trim(),
      title: String(row[SURF_COL['Titre'] - 1] || '').trim(),
      category: String(row[SURF_COL['Catégorie'] - 1] || '').trim() || 'Surf',
      image: String(row[SURF_COL['Image URL'] - 1] || '').trim(),
      sourceUrl: String(row[SURF_COL['URL Source'] - 1] || '').trim(),
      summary: String(row[SURF_COL['Résumé'] - 1] || '').trim(),
      description: String(row[SURF_COL['Description complète'] - 1] || '').trim(),
      whyItMatters: String(row[SURF_COL['Pourquoi important'] - 1] || '').trim(),
      bulletsRaw: String(row[SURF_COL['Points clés'] - 1] || '').trim(),
      keywords: String(row[SURF_COL['Mots-clés'] - 1] || '').trim(),
      seoTitle: String(row[SURF_COL['SEO Titre'] - 1] || '').trim(),
      metaDescription: String(row[SURF_COL['Meta Description'] - 1] || '').trim(),
      slug: String(row[SURF_COL['Slug'] - 1] || '').trim(),
      status: String(row[SURF_COL['Statut'] - 1] || STATUS_DRAFT).trim().toUpperCase(),
      addedAt: String(row[SURF_COL['Date ajout'] - 1] || '').trim(),
      publishedAt: String(row[SURF_COL['Date publication'] - 1] || '').trim(),
    };
  }).filter(function(r) { return r.title; }); // ignorer les lignes vides
}

function surf_getDraftRows_() {
  return surf_readAllRows_().filter(function(r) { return r.status === STATUS_DRAFT; });
}

function surf_getPublishedRows_() {
  return surf_readAllRows_().filter(function(r) { return r.status === STATUS_PUBLISHED; });
}

// ── NORMALIZE ARTICLE ─────────────────────────────────────────────────────────

function surf_normalizeArticle_(row) {
  var title = row.title;
  var slug = row.slug || surf_slugify_(title);
  var now = surf_nowIso_();

  // Bullets: séparés par | dans la cellule
  var bullets = row.bulletsRaw
    ? row.bulletsRaw.split('|').map(function(b) { return b.trim(); }).filter(Boolean)
    : [];

  // Auto-generate meta if empty
  var summary = row.summary || '';
  var metaDesc = row.metaDescription || surf_clampChars_(summary, SURF_CONFIG.META_DESC_MAX);
  var seoTitle = row.seoTitle || surf_clampChars_(title, SURF_CONFIG.SEO_TITLE_MAX);
  var keywords = row.keywords || row.category;

  return {
    id: row.id || surf_generateId_(),
    title: title,
    seoTitle: seoTitle,
    slug: slug,
    category: row.category || 'Surf',
    image: row.image || '',
    imageAlt: title + ' — MarocSurf',
    url: row.sourceUrl || '',
    sourceUrl: row.sourceUrl || '',
    publishedAt: row.publishedAt || now,
    summary: summary,
    description: row.description || summary,
    intro: surf_clampChars_(summary, 400),
    dek: surf_clampChars_(summary, 180),
    whyItMatters: row.whyItMatters || summary,
    bullets: bullets,
    metaDescription: metaDesc,
    keywords: keywords,
    source: 'MarocSurf',
  };
}

// ── MARK AS PUBLISHED ─────────────────────────────────────────────────────────

function surf_markPublished_(sh, rowIndex, now) {
  sh.getRange(rowIndex, SURF_COL['Statut']).setValue(STATUS_PUBLISHED);
  sh.getRange(rowIndex, SURF_COL['Date publication']).setValue(now);
}

// ── REGENERATE SLUGS ──────────────────────────────────────────────────────────

function surf_regenerateSlugs() {
  var sh = surf_getSheet_();
  var rows = surf_readAllRows_();
  var count = 0;
  rows.forEach(function(row) {
    if (!row.slug && row.title) {
      var slug = surf_slugify_(row.title);
      sh.getRange(row._rowIndex, SURF_COL['Slug']).setValue(slug);
      count++;
    }
    // Also ensure ID exists
    if (!row.id) {
      sh.getRange(row._rowIndex, SURF_COL['ID']).setValue(surf_generateId_());
    }
  });
  surf_notify_('✅ ' + count + ' slugs régénérés.');
}

// ── PREVIEW NEXT BATCH ────────────────────────────────────────────────────────

function surf_previewNextBatch() {
  var drafts = surf_getDraftRows_();
  var next = drafts.slice(0, SURF_CONFIG.ARTICLES_PER_DAY);
  if (!next.length) {
    surf_notify_('📭 Aucun article DRAFT à publier. Ajoute des articles avec le statut DRAFT !');
    return;
  }
  var lines = next.map(function(r, i) {
    return (i + 1) + '. ' + r.title + ' [' + (r.category || 'Surf') + ']';
  });
  surf_notify_('📋 Prochain batch (' + next.length + ' articles) :\n\n' + lines.join('\n'));
}

// ── BUILD NEWS JSON ───────────────────────────────────────────────────────────

function surf_buildNewsJson_(publishedArticles) {
  var origin = surf_getProp_('SURF_SITE_ORIGIN') || SURF_CONFIG.SITE.canonicalOrigin;
  var site = Object.assign({}, SURF_CONFIG.SITE, {
    canonicalOrigin: origin.replace(/\/+$/, ''),
  });
  return JSON.stringify({ site: site, articles: publishedArticles }, null, 2) + '\n';
}

// ── GITHUB PUSH ───────────────────────────────────────────────────────────────

function surf_getGithubFileSha_(token, repo, filePath, branch) {
  var url = 'https://api.github.com/repos/' + repo + '/contents/' + filePath + '?ref=' + branch;
  try {
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText()).sha || null;
    }
  } catch(e) { Logger.log('SHA fetch error: ' + e); }
  return null;
}

function surf_pushToGithub_(content, filePath, commitMessage) {
  var token = surf_getProp_('GITHUB_TOKEN');
  var repo  = surf_getProp_('GITHUB_REPO');
  var branch = SURF_CONFIG.GITHUB_BRANCH;

  if (!token || !repo) {
    Logger.log('❌ GITHUB_TOKEN ou GITHUB_REPO manquant dans Script Properties.');
    return false;
  }

  var sha = surf_getGithubFileSha_(token, repo, filePath, branch);
  var encoded = Utilities.base64Encode(Utilities.newBlob(content).getBytes());

  var payload = { message: commitMessage, content: encoded, branch: branch };
  if (sha) payload.sha = sha;

  var url = 'https://api.github.com/repos/' + repo + '/contents/' + filePath;
  var res = UrlFetchApp.fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: 'token ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code === 200 || code === 201) {
    Logger.log('✅ Push GitHub OK: ' + filePath);
    return true;
  } else {
    Logger.log('❌ Push GitHub ERROR ' + code + ': ' + res.getContentText().slice(0, 300));
    return false;
  }
}

// ── PUBLISH DAILY BATCH (5 articles) ─────────────────────────────────────────

function surf_publishDailyBatch() {
  var sh = surf_getSheet_();
  var drafts = surf_getDraftRows_();

  if (!drafts.length) {
    Logger.log('📭 Aucun article DRAFT à publier aujourd\'hui.');
    surf_notify_('📭 Aucun article DRAFT à publier. Ajoute des articles dans la feuille !');
    return;
  }

  // Prendre les N prochains DRAFT
  var batch = drafts.slice(0, SURF_CONFIG.ARTICLES_PER_DAY);
  var now = surf_nowIso_();

  // Normaliser les articles du batch
  var newArticles = batch.map(function(row) {
    var article = surf_normalizeArticle_(row);
    article.publishedAt = now;
    return article;
  });

  // Récupérer les articles déjà publiés
  var publishedRows = surf_getPublishedRows_();
  var existingArticles = publishedRows.map(function(row) {
    return surf_normalizeArticle_(row);
  });

  // Combiner : nouveaux + existants (nouveaux en premier)
  var allArticles = newArticles.concat(existingArticles);

  // Générer le JSON
  var newsJson = surf_buildNewsJson_(allArticles);

  // Pousser vers GitHub
  var commitMsg = 'chore: publish ' + batch.length + ' surf articles';
  var success = surf_pushToGithub_(newsJson, SURF_CONFIG.GITHUB_NEWS_JSON_PATH, commitMsg);

  if (success) {
    // Marquer comme PUBLISHED dans le Sheet
    batch.forEach(function(row) {
      surf_markPublished_(sh, row._rowIndex, now);
    });

    var titles = batch.map(function(r) { return '• ' + r.title; }).join('\n');
    var msg = '✅ ' + batch.length + ' articles publiés avec succès !\n\n' + titles;
    Logger.log(msg);
    surf_notify_(msg);

    // Notification webhook (optionnel)
    surf_sendWebhook_(batch.length, batch[0] && batch[0].title);
  } else {
    surf_notify_('❌ Erreur lors du push GitHub. Vérifie GITHUB_TOKEN et GITHUB_REPO dans Script Properties.');
  }
}

// ── PUBLISH ALL DRAFTS ────────────────────────────────────────────────────────

function surf_publishAll() {
  var sh = surf_getSheet_();
  var ui = surf_safeUi_();
  var drafts = surf_getDraftRows_();

  if (!drafts.length) {
    surf_notify_('📭 Aucun article DRAFT à publier.');
    return;
  }

  // Confirmation
  if (ui) {
    var resp = ui.alert('Publier TOUS les articles ?', 'Cela va publier ' + drafts.length + ' articles DRAFT en une seule fois. Continuer ?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
  }

  var now = surf_nowIso_();
  var newArticles = drafts.map(function(row) {
    var article = surf_normalizeArticle_(row);
    article.publishedAt = now;
    return article;
  });

  var newsJson = surf_buildNewsJson_(newArticles);
  var commitMsg = 'chore: publish all ' + drafts.length + ' surf articles';
  var success = surf_pushToGithub_(newsJson, SURF_CONFIG.GITHUB_NEWS_JSON_PATH, commitMsg);

  if (success) {
    drafts.forEach(function(row) { surf_markPublished_(sh, row._rowIndex, now); });
    surf_notify_('✅ ' + drafts.length + ' articles publiés !');
  } else {
    surf_notify_('❌ Erreur GitHub. Vérifie tes Script Properties.');
  }
}

// ── WEBHOOK (optionnel) ────────────────────────────────────────────────────────

function surf_sendWebhook_(count, firstTitle) {
  var url = surf_getProp_('WEBHOOK_URL');
  if (!url) return;
  try {
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        text: '🌊 MarocSurf : ' + count + ' article(s) publié(s). Premier : "' + (firstTitle || '') + '"',
      }),
      muteHttpExceptions: true,
    });
  } catch(e) { Logger.log('Webhook error: ' + e); }
}

// ── SURF TRIP TELEGRAM WEBHOOK ──────────────────────────────────────────────────

function surf_sendToTelegram_(name, whatsapp, message, originPage) {
  var botToken = surf_getProp_('TELEGRAM_BOT_TOKEN');
  var chatId = surf_getProp_('TELEGRAM_CHAT_ID');

  if (!botToken || !chatId) {
    Logger.log('Telegram credentials missing.');
    return { status: 'error', message: 'Telegram configuration is missing in Script Properties.' };
  }

  var text = "🏄‍♂️ *New Surf Trip Request*\n\n" +
             "👤 *Name:* " + name + "\n" +
             "📱 *WhatsApp:* " + whatsapp + "\n" +
             "💬 *Message:*\n" + message;

  var url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  var payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  };

  try {
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 200 || code === 201) {
      return { status: 'ok' };
    } else {
      Logger.log("Telegram Error: " + res.getContentText());
      return { status: 'error', message: 'Failed to dispatch to Telegram.' };
    }
  } catch(e) {
    Logger.log("Telegram Exception: " + e);
    return { status: 'error', message: 'Telegram request failed.' };
  }
}

// Web App POST endpoint (deploy as: Execute as Me, Anyone)
function doPost(e) {
  var result = { status: 'error', message: 'Unknown error.' };
  try {
    var body = e.postData.contents;
    var data = JSON.parse(body);
    if (data.action === 'surftrip') {
      var name = String(data.name || '').trim();
      var wa = String(data.whatsapp || '').trim();
      var msg = String(data.message || '').trim();
      var page = String(data.page || '').trim();

      if (!name || !wa || !msg) {
        result = { status: 'error', message: 'All fields are required.' };
      } else {
        result = surf_sendToTelegram_(name, wa, msg, page);
      }
    } else {
      result = { status: 'error', message: 'Unknown action.' };
    }
  } catch(ex) {
    result = { status: 'error', message: 'Invalid JSON payload.' };
  }

  // Permet le fonctionnement sans problème CORS avec fetch preflight
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Simple fallback for accidental GET requests
function doGet(e) {
  return ContentService.createTextOutput("MoroccoSurf Service Webhook is active. Use POST to submit requests.");
}

// ── TRIGGERS ──────────────────────────────────────────────────────────────────

function surf_installTriggers() {
  // Supprimer les anciens triggers MarocSurf
  surf_removeTriggers();

  // Publication quotidienne à 9h
  ScriptApp.newTrigger('surf_publishDailyBatch')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();

  surf_notify_('✅ Trigger installé !\n\nPublication automatique : chaque jour à 9h00\nNombre d\'articles par jour : ' + SURF_CONFIG.ARTICLES_PER_DAY + '\n\nAssure-toi d\'avoir des articles avec le statut DRAFT dans la feuille.');
}

function surf_triggerStatus() {
  var all = ScriptApp.getProjectTriggers();
  if (!all.length) {
    surf_notify_('⚠️ Aucun trigger installé. Lance "Installer triggers" pour activer la publication automatique.');
    return;
  }
  var lines = all.map(function(t) {
    return '• ' + t.getHandlerFunction() + ' [' + t.getEventType() + ']';
  });
  surf_notify_('📊 Triggers actifs :\n' + lines.join('\n'));
}

function surf_removeTriggers() {
  var targets = ['surf_publishDailyBatch', 'surf_publishAll'];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (targets.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
}
