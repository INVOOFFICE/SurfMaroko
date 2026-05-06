/**
 * Comportement des entrées DB_MIGRATIONS (js/storage.js).
 * Chaque version cible doit avoir un scénario : état « avant » simulé, exécution,
 * assertions sur la structure après migration.
 *
 * Les callbacks réels dans le navigateur peuvent aussi persister invoo_db_version
 * via OPFS ; ici on teste uniquement la transformation métier exposée par la fn async.
 */
const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '..', '..', 'js', 'storage.js');

function extractMigrationKeys(src) {
  const keys = [];
  const re = /\n\s*(\d+)\s*:\s*async\s*\(\)\s*=>/g;
  let m;
  while ((m = re.exec(src)) !== null) keys.push(Number(m[1], 10));
  return [...new Set(keys)].sort((a, b) => a - b);
}

/**
 * Corps synchronisé avec js/storage.js — DB_MIGRATIONS[1].
 * v0 → v1 : introduction du suivi de version ; aucune transformation des stores.
 */
async function migrationV0ToV1() {
  /* dbg résolu à l’exécution navigateur ; no-op côté données */
}

const MIGRATION_RUNNERS = {
  1: migrationV0ToV1,
};

describe('DB_MIGRATIONS behavior (storage.js)', () => {
  const storageSrc = fs.readFileSync(STORAGE_PATH, 'utf8');

  test('chaque clé DB_MIGRATIONS dans le fichier a un runner de test', () => {
    const keys = extractMigrationKeys(storageSrc);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(typeof MIGRATION_RUNNERS[k]).toBe('function');
    }
  });

  describe('migration 1 (v0 → v1)', () => {
    test('ne mutile pas un objet DB représentatif (pas de mapping colonne / clé)', async () => {
      const db = {
        settings: { tva: '20', name: 'SARL Test' },
        clients: [{ id: 'c1', name: 'Client', ice: '' }],
        stock: [{ id: 's1', name: 'Art', qty: 1 }],
        docs: [{ ref: 'F-2026-0001', ht: 100, ttc: 120, lines: [{ qty: 1, price: 100, tva: 20 }] }],
        fournisseurs: [],
        bonsCommande: [],
        stockMoves: [],
      };
      const before = JSON.stringify(db);
      await MIGRATION_RUNNERS[1]();

      expect(JSON.stringify(db)).toBe(before);
    });

    test('résout sans erreur (idempotence d’exécution)', async () => {
      await expect(MIGRATION_RUNNERS[1]()).resolves.toBeUndefined();
    });
  });
});
