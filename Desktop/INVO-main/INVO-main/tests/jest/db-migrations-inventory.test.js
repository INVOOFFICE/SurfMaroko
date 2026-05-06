/**
 * Garde-fou : chaque version 1..DB_VERSION doit avoir une entrée DB_MIGRATIONS[n]
 * dans js/storage.js (évite les trous silencieux au bump de schéma).
 */
const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '..', '..', 'js', 'storage.js');

describe('DB_MIGRATIONS inventory', () => {
  test('every integer 1..DB_VERSION has a corresponding migration entry', () => {
    const src = fs.readFileSync(STORAGE_PATH, 'utf8');
    const vMatch = src.match(/\bconst DB_VERSION\s*=\s*(\d+)\s*;/);
    expect(vMatch).not.toBeNull();
    const dbVersion = parseInt(vMatch[1], 10);
    expect(dbVersion).toBeGreaterThanOrEqual(1);

    for (let n = 1; n <= dbVersion; n++) {
      const entry = new RegExp(`\\n\\s*${n}\\s*:\\s*async\\s*\\(`);
      expect(src).toMatch(entry);
    }
  });
});
