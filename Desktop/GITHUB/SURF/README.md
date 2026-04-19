# 🌊 MarocSurf — Blog Surf au Maroc

Blog statique sur le surf au Maroc : spots, saisons, conseils débutants.

## Architecture

- **Google Sheets** → tu remplis manuellement les articles
- **code.gs** → publie automatiquement 5 articles par jour vers GitHub
- **GitHub Actions** → lance le build statique dès qu'un `surf-news.json` change
- **build-surf-pages.mjs** → génère les pages HTML statiques SEO

## Setup rapide

### 1. Google Sheet
1. Crée un Google Sheet
2. Extensions → Apps Script → colle `code.gs`
3. Lance **🔧 Setup Sheet** depuis le menu
4. Configure les **Script Properties** :
   - `GITHUB_TOKEN` : ton Personal Access Token (scope: `repo`)
   - `GITHUB_REPO` : `ton-username/ton-repo`
   - `SURF_SITE_ORIGIN` : `https://marocsurf.com`
5. Lance **⚙️ Installer triggers**

### 2. Ajouter des articles
Remplis directement les colonnes dans la feuille :
- **Titre** (obligatoire)
- **Catégorie** : Spots, Débutants, Saisons, Matériel, Culture, Techniques
- **Résumé** (obligatoire, 3-5 phrases)
- **Image URL** : URL Unsplash par exemple
- **Description complète** : texte markdown complet
- **Points clés** : séparés par `|` (ex: `Point1|Point2|Point3`)
- Laisse **Statut** = `DRAFT`

### 3. Publication automatique
Chaque jour à 9h, le script publie les 5 prochains articles DRAFT.

Tu peux aussi publier manuellement depuis le menu : **📤 Publier 5 articles maintenant**.

### 4. GitHub Actions
Le workflow `.github/workflows/build-static-surf.yml` se déclenche automatiquement dès que `surf-news.json` est modifié, puis génère toutes les pages SEO.

## Structure des fichiers

```
/
├── index.html          → Page d'accueil
├── article.html        → Template article (ne pas modifier)
├── style.css           → Design océan
├── main.js             → JS frontend
├── surf-news.json      → Base de données articles (généré par code.gs)
├── surf-news-latest.json→ 20 derniers articles (généré par build script)
├── sitemap.xml         → Sitemap SEO (généré)
├── feed.xml            → RSS Feed (généré)
├── sw.js               → Service Worker PWA
├── manifest.json       → Manifest PWA
├── scripts/
│   └── build-surf-pages.mjs  → Script de build
├── articles/           → Pages générées (ne pas modifier)
│   └── <slug>/index.html
└── .github/workflows/
    └── build-static-surf.yml
```

## Catégories disponibles

| Catégorie | Description |
|-----------|-------------|
| Spots | Descriptions et guides des spots |
| Débutants | Conseils pour commencer le surf |
| Saisons | Meilleurs moments pour surfer |
| Matériel | Planches, combinaisons, accessoires |
| Culture | Histoire et culture surf marocaine |
| Techniques | Améliorer sa technique |
| Compétitions | Événements et compétitions |
| Voyages | Itinéraires et road trips surf |
