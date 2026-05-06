# INVOOFFICE (dépôt invo-depl)

Application web **statique** de facturation (cible Maroc / DGI) : **HTML, CSS et JavaScript sans framework**, données **locales** (navigateur), installable en **PWA**.

## Prérequis

- **Node.js ≥ 18** (voir `package.json` → `engines`)

## Installation

```bash
npm install
```

Le script `postinstall` exécute `scripts/vendor-copy.mjs` (copie des dépendances nécessaires sous `js/vendor/` et ressources associées).

## Scripts npm

| Commande               | Rôle                               |
| ---------------------- | ---------------------------------- |
| `npm run lint`         | ESLint sur le dépôt                |
| `npm run test:jest`    | Tests Jest                         |
| `npm test`             | Suite `tests/run-tests.mjs` (Node) |
| `npm run format`       | Prettier (écriture)                |
| `npm run format:check` | Prettier (vérification seulement)  |
| `npm run audit`        | `npm audit --production` (dépendances runtime) |
| `npm run check:merge`  | Détecte les marqueurs de conflit Git (`<<<<<<<` / `>>>>>>>`) dans les sources |

## Lancer l’application en local

L’app est servie comme **fichiers statiques** : ouvrez la racine du projet avec un serveur HTTP local (évite les limitations de `file://` pour le service worker et la PWA).

Exemples :

```bash
npx --yes serve .
```

Puis ouvrez l’URL affichée (souvent `http://localhost:3000`) et chargez `index.html`.

## Déploiement

Déployez le **contenu à la racine du site** (même structure que ce dépôt : `index.html`, `manifest.json`, `sw.js`, dossiers `css/`, `js/`, `icons/`, etc.). Aucun build obligatoire avant publication si vous ne modifiez pas les sources générées.

## Documentation complémentaire

- `docs/design-system.md` — structure CSS et composants
- `docs/AMELIORATIONS-CONTINUES.txt` — backlog et analyse continue
- `docs/AUDIT-ETAT-SANS-SECURITE.txt` — audit d’état, scores, roadmap vers 9/10  
  (`docs/AUDIT-ETAT.txt` renvoie vers ce fichier)

## Regénérer les gabarits de pages

Le HTML injecté dans l’app est produit dans `js/page-templates.js`. Si votre chaîne utilise le script de build :

```bash
node scripts/build-page-templates.mjs
```

Voir les commentaires en tête de `scripts/build-page-templates.mjs` pour le contexte (shell vs index monolithique).

## Arborescence utile

| Élément         | Rôle                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| `index.html`    | Coquille PWA, modales globales, chargement des scripts                          |
| `js/`           | Logique métier, `page-templates.js`, `storage.js`, `sw-register.js` côté client |
| `css/`          | Tokens, composants, pages (voir `docs/design-system.md`)                        |
| `sw.js`         | Service worker et précache                                                      |
| `manifest.json` | PWA (nom, icônes, `start_url`)                                                  |
| `tests/`        | Tests Node / Jest selon configuration                                           |
| `scripts/`      | Utilitaires build et copie vendors                                              |
| `docs/`         | Design system, audit, améliorations continues                                   |

---

## Checklist release (à cocher avant mise en production)

1. **Qualité** : `npm run lint` et `npm run test:jest` au vert.
2. **Dépendances** : `npm run audit` — examiner les alertes (notamment `xlsx` / SheetJS) avant publication.
3. **Service worker** : dans `sw.js`, si vous modifiez les fichiers en précache ou la liste `PRECACHE_ASSETS`, **incrémentez** `CACHE_NAME` (ex. `invo-v6` → `invo-v7`) pour forcer la mise à jour chez les utilisateurs.
4. **Données locales** : dans `js/storage.js`, toute **évolution de schéma** OPFS / stockage doit passer par une **montée de `DB_VERSION`** et une **migration** testée ; ne pas changer la version sans migration.
5. **Fumée PWA** : installation ou rechargement, ouverture hors ligne, action métier critique (ex. ouvrir l’app, accéder à un écran principal).

**Licence / activation** : la vérification de clé est entièrement locale. Le matériau cryptographique est visible dans le JavaScript (limite des applications sans serveur). Ce mécanisme vise un usage personnel ou interne sur poste contrôlé.

Les valeurs **actuelles** au moment de la rédaction de ce README sont indicatives : vérifiez toujours dans le code (`CACHE_NAME`, `DB_VERSION`).
