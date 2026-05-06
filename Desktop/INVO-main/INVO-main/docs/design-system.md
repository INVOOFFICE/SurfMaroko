# Mini Design System

## Architecture (CSS)

- `css/tokens.css` — variables `:root` / `[data-theme='dark']`
- `css/components-core.css` — boutons, formulaires de base, modales, badges/alertes, coquille réglages
- `css/pages/layout-shell.css` — `#app`, sidebar, topbar
- `css/pages/auth.css` — écran licence / connexion
- `css/pages/surfaces-doc.css` — cartes, grilles, génération document, import, aperçus métier
- `css/pages/tables-widgets.css` — tableaux, `.page`, flatpickr, lignes facture, `tselect`, extensions réglages
- `css/pages/app-chrome.css` — toasts, pagination, overview, DGI, ICE, autocomplete (TVS etc.)
- `css/pages/help-search-skeleton.css` — aide, recherche globale, squelettes de chargement
- `css/pages/panels-charts-domain.css` — notifications, onboarding, graphiques, BC, fournisseurs, charges
- `css/pages/pdf-preview.css` — en-tête modale aperçu PDF + media `max-width: 1024px`
- `css/pages/templates-mobile-static.css` — cartes template PDF, barres mobile (tabbar, FAB…)
- `css/pages/responsive.css` — media queries regroupées (`768px`, `480px`, etc.)
- `css/style.css` — en-tête `@import` puis **base** uniquement (reset, `html/body`, inputs, scrollbar, labels…)

## Tokens

- Colors and semantic surfaces are defined in `css/tokens.css` under `:root`.
- Core tokens used across UI:
  - `--brand`, `--teal`, `--gold`, `--danger`, `--info`
  - `--bg`, `--bg2`, `--bg3`, `--bg4`
  - `--surface`, `--surface2`
  - `--text`, `--text2`, `--text3`, `--text4`
  - `--border`, `--border2`
  - `--radius`, `--ring`, `--ring-danger`

## Core Components

- Buttons:
  - Base: `.btn`
  - Variants: `.btn-primary`, `.btn-secondary`, `.btn-danger`
  - Sizes: `.btn-sm`, `.btn-icon`
- Form fields:
  - Layout: `.form-group`, `.field-row`, `.field-row.c2`, `.field-row.c3`
  - Input validation hooks: `.auth-input-error`, `.auth-input-success`
- Feedback:
  - Alerts: `.alert`, `.alert.info`
  - Badges: `.badge` + status variants (`.paid`, `.sent`, `.draft`, `.cancelled`, etc.)
  - Toasts: `#toast`, `.toast-item`
- Modals:
  - Structure: `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-close`
  - Sizes: `.modal-lg`, `.modal-xl`
- Menus and custom selects:
  - `.tselect`, `.tselect-trigger`, `.tselect-menu`, `.tselect-option`
  - Search/menu items: `.search-item`, `.hist-more-menu`

## Rules

- Avoid inline style attributes in HTML templates.
- Prefer reusable utility/component classes over one-off styling.
- Extend variants by class composition (base + modifier), not by re-defining base blocks.
- Keep canonical primitives in `css/components-core.css` (avoid duplicating `.btn`, `.modal`, `.field-row`, etc. in `style.css`).
