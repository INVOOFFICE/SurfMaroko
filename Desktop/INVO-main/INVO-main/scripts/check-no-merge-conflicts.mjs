/**
 * Échoue si des marqueurs de conflit Git restent dans les sources (bloquent JS/JSON).
 * Usage : node scripts/check-no-merge-conflicts.mjs  |  npm run check:merge
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist']);
const EXT = /\.(js|mjs|cjs|html|css|json|md|txt|yml|yaml)$/i;

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (EXT.test(ent.name)) acc.push(p);
  }
}

const files = [];
walk(root, files);
function fileHasConflictMarkers(text) {
  return text.split(/\r?\n/).some(line => {
    const s = line.replace(/^\s+/, '');
    return /^(<<<<<<<|>>>>>>>)/.test(s);
  });
}

const hits = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  if (fileHasConflictMarkers(t)) hits.push(path.relative(root, f));
}

if (hits.length) {
  console.error('[check:merge] Marqueurs de conflit Git détectés (fichiers à corriger) :');
  hits.forEach(h => console.error('  -', h));
  process.exit(1);
}
console.log('[check:merge] OK — aucune ligne de marqueur de conflit Git.');
