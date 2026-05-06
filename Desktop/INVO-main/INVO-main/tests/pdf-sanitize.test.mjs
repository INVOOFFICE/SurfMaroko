/**
 * Vérifie le durcissement anti-injection dans buildInvoiceHTML (pdf.js).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pdfJsPath = new URL('../js/pdf.js', import.meta.url);
const pdfJsCode = fs.readFileSync(pdfJsPath, 'utf8');

function loadPdfContext(overrides = {}) {
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    window: { APP: {} },
    DB: {
      settings: {
        name: 'INVOO OFFICE',
        address: 'Casablanca',
        city: 'Casablanca',
        phone: '+212600000000',
        email: 'a@b.com',
        ice: '123',
        if: '456',
        rc: '789',
        tp: '101',
        rib: 'RIB',
        bank: 'Bank',
        footer: 'Merci',
        logoData: '',
        currency: 'DH',
        logoHeightPx: 48,
      },
      clients: [],
      ...overrides.DB,
    },
    clampLogoDocHeight: v => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 48;
      return Math.min(120, Math.max(24, Math.round(n)));
    },
    docIsAutoEntrepreneurExempt: () => false,
    nombreEnLettres: () => 'cent dirhams',
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(pdfJsCode, ctx, { filename: 'pdf.js' });
  return ctx;
}

{
  const ctx = loadPdfContext();
  assert.equal(typeof ctx.buildInvoiceHTML, 'function');
}

// 1) Les champs texte user doivent être échappés dans le HTML généré.
{
  const ctx = loadPdfContext();
  const doc = {
    type: 'F',
    ref: 'F-1',
    date: '2026-03-31',
    status: 'Brouillon',
    clientId: '',
    clientName: 'Client <script>alert(1)</script>',
    lines: [
      { name: '<img src=x onerror=alert(1)>', desc: '<b>desc</b>', qty: 1, price: 10, tva: 20 },
    ],
    notes: 'note <script>alert(1)</script>',
    terms: 'CGV <i>x</i>',
    payment: 'Virement',
    ht: 10,
    tva: 2,
    ttc: 12,
    remise: 0,
    acompte: 0,
  };
  const html = ctx.buildInvoiceHTML(doc, 'classic', '#1a6b3c');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
}

// 2) logoData refuse les schémas non autorisés (ex: javascript:).
{
  const ctx = loadPdfContext({
    DB: {
      settings: {
        logoData: 'javascript:alert(1)',
      },
    },
  });
  const doc = { type: 'F', ref: 'F-2', date: '2026-03-31', lines: [], ht: 0, tva: 0, ttc: 0 };
  const html = ctx.buildInvoiceHTML(doc, 'classic', '#1a6b3c');
  assert.ok(!html.includes('javascript:alert(1)'));
}

// 3) logoData accepte data:image/* (cas attendu pour logo base64).
{
  const okData = 'data:image/png;base64,AAAA';
  const ctx = loadPdfContext({
    DB: {
      settings: {
        logoData: okData,
      },
    },
  });
  const doc = { type: 'F', ref: 'F-3', date: '2026-03-31', lines: [], ht: 0, tva: 0, ttc: 0 };
  const html = ctx.buildInvoiceHTML(doc, 'classic', '#1a6b3c');
  assert.ok(html.includes(okData));
}

// 4) pdfShowCompanyInfoWithLogo désactivé : pas de nom d’entreprise dans le bandeau (logo seul).
{
  const okData = 'data:image/png;base64,AAAA';
  const ctx = loadPdfContext({
    DB: {
      settings: {
        name: 'ACME Corp',
        logoData: okData,
        pdfShowCompanyInfoWithLogo: false,
      },
    },
  });
  const doc = { type: 'F', ref: 'F-4', date: '2026-03-31', lines: [], ht: 0, tva: 0, ttc: 0 };
  const html = ctx.buildInvoiceHTML(doc, 'classic', '#1a6b3c');
  assert.ok(html.includes(okData));
  // Bandeau sans texte : le nom reste dans le bloc « Émetteur », pas en double avec l’en-tête.
  assert.equal((html.match(/ACME Corp/g) || []).length, 1);
}

console.log('OK — tests pdf-sanitize');
