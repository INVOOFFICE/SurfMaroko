/**
 * Génère js/page-templates.js à partir d’un index.html monolithique (plages ligne fixes).
 * L’index actuel est un shell : pour régénérer, restaurer l’ancien HTML depuis git
 * (`git show HEAD:index.html` avant refactor) ou ajuster les constantes RANGES.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const outPath = path.join(root, 'js', 'page-templates.js');

const lines = fs.readFileSync(indexPath, 'utf8').split(/\r?\n/);

function sliceLines(start, endInclusive) {
  return lines.slice(start - 1, endInclusive).join('\n');
}

/** Plages ligne 1-based (extrait du index.html avant refactor) */
const RANGES = {
  overview: [206, 247],
  generate: [250, 430],
  history: [433, 464],
  reports: [467, 496],
  stock: [499, 538],
  clients: [803, 833],
  fournisseurs: [836, 880],
  bonsCommande: [883, 918],
  settings: [993, 1342],
};

function escapeForTemplateLiteral(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const bodies = {};
for (const [key, [a, b]] of Object.entries(RANGES)) {
  bodies[key] = escapeForTemplateLiteral(sliceLines(a, b));
}

const header = [
  '// ╔══════════════════════════════════════════════════╗',
  '// ║  FICHIER GÉNÉRÉ — NE PAS MODIFIER MANUELLEMENT   ║',
  '// ║  Source : scripts/build-page-templates.mjs        ║',
  '// ║  Régénérer : node scripts/build-page-templates.mjs ║',
  '// ╚══════════════════════════════════════════════════╝',
  '// Généré le : ' + new Date().toISOString(),
  '',
  '// page-templates.js — HTML des pages (injecté dans #content)',
  '',
].join('\n');

const fns = Object.entries({
  Overview: 'overview',
  Generate: 'generate',
  History: 'history',
  Reports: 'reports',
  Stock: 'stock',
  Clients: 'clients',
  Fournisseurs: 'fournisseurs',
  BonsCommande: 'bonsCommande',
  Settings: 'settings',
})
  .map(
    ([name, k]) => `function templatePage${name}() {
  return \`${bodies[k]}\`;
}`,
  )
  .join('\n\n');

const footer = `
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
  ].join('\\n');
}

function injectAppPageTemplates() {
  const el = document.getElementById('content');
  if (!el) return;
  el.innerHTML = buildAppPagesHtml();
}

injectAppPageTemplates();
`;

fs.writeFileSync(outPath, header + fns + footer, 'utf8');
console.log('Wrote', outPath);
