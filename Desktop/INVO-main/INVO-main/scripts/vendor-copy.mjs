/**
 * Copie les dépendances npm vers js/vendor/ et assets/ pour chargement 100% local (hors-ligne au 1er chargement).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function cp(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('[vendor-copy] missing:', src);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function cpr(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn('[vendor-copy] missing dir:', srcDir);
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
}

// ── JS (UMD / IIFE) ──
cp(
  path.join(root, 'node_modules/jspdf/dist/jspdf.umd.min.js'),
  path.join(root, 'js/vendor/jspdf.umd.min.js'),
);
cp(
  path.join(root, 'node_modules/html2canvas/dist/html2canvas.min.js'),
  path.join(root, 'js/vendor/html2canvas.min.js'),
);
cp(
  path.join(root, 'node_modules/chart.js/dist/chart.umd.js'),
  path.join(root, 'js/vendor/chart.umd.min.js'),
);
cp(
  path.join(root, 'node_modules/xlsx/dist/xlsx.full.min.js'),
  path.join(root, 'js/vendor/xlsx.full.min.js'),
);
cp(
  path.join(root, 'node_modules/flatpickr/dist/flatpickr.min.js'),
  path.join(root, 'js/vendor/flatpickr.min.js'),
);
cp(
  path.join(root, 'node_modules/flatpickr/dist/flatpickr.min.css'),
  path.join(root, 'js/vendor/flatpickr.min.css'),
);
cp(
  path.join(root, 'node_modules/flatpickr/dist/l10n/fr.js'),
  path.join(root, 'js/vendor/flatpickr-fr.js'),
);
cp(
  path.join(root, 'node_modules/dompurify/dist/purify.min.js'),
  path.join(root, 'js/vendor/purify.min.js'),
);
cp(
  path.join(root, 'node_modules/papaparse/papaparse.min.js'),
  path.join(root, 'js/vendor/papaparse.min.js'),
);
cp(
  path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),
  path.join(root, 'js/vendor/supabase.umd.js'),
);

// ── Polices (Fontsource) — chemins relatifs ./files/ dans index.css ──
const fontSrc = path.join(root, 'node_modules/@fontsource/plus-jakarta-sans');
const fontDest = path.join(root, 'assets/fonts/plus-jakarta-sans');
cpr(path.join(fontSrc, 'files'), path.join(fontDest, 'files'));
cp(path.join(fontSrc, 'index.css'), path.join(fontDest, 'index.css'));

console.log('[vendor-copy] OK');
