/**
 * Réduit index.html au shell : #content vide, modales déplacées après #app.
 * À exécuter une fois après extraction des templates (build-page-templates.mjs).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

const lines = fs.readFileSync(indexPath, 'utf8').split(/\r?\n/);

const head = lines.slice(0, 202).join('\n');
const shellMain = `
    <div id="content"></div>
${lines[1344]}
${lines[1345]}`;

const modalsFromContent = [
  lines.slice(540, 800).join('\n'),
  lines.slice(919, 990).join('\n'),
].join('\n\n');

const tail = lines.slice(1347).join('\n');

const out = `${head}${shellMain}

${modalsFromContent}

${tail}`;

fs.writeFileSync(indexPath, out, 'utf8');
console.log('Patched', indexPath);
