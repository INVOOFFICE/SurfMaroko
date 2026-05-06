const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBackupValidation() {
  const root = path.join(__dirname, '..', '..');
  const code = fs.readFileSync(path.join(root, 'js/backup.js'), 'utf8');
  const ctx = {
    console,
    DB_DEFAULTS: { settings: { name: '', currency: 'DH', tva: '20' } },
    DB: { settings: {} },
    document: {
      getElementById: () => null,
      createElement: () => ({
        style: {},
        appendChild() {},
        click() {},
        href: '',
        download: '',
      }),
    },
    URL: global.URL,
    Blob: global.Blob,
    Image: function () {},
    toast: () => {},
    save: () => {},
    saveAll: () => {},
    saveTemplateSettings: () => {},
    loadTemplateSettings: () => {},
    validateICEInput: () => {},
    validateRIBInput: () => {},
    updateOPFSInfo: () => {},
    today: () => '2026-01-01',
    KEYS: { settings: 'invoo_settings' },
    APP: {
      opfs: {
        memCache: {},
        ready: false,
        dir: null,
      },
    },
    clearChildren: () => {},
    renderBackupReminderStatus: () => {},
    localStorage: { removeItem() {}, getItem() { return null; }, setItem() {} },
    location: { reload: () => {} },
    navigator: {},
    setTimeout: () => 0,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'backup.js' });
  return ctx._validateAndNormalizeBackupPayload;
}

describe('_validateAndNormalizeBackupPayload', () => {
  const validate = loadBackupValidation();

  test('rejects non-object', () => {
    expect(validate(null).ok).toBe(false);
  });

  test('accepts minimal valid payload', () => {
    const raw = {
      version: 1,
      settings: { name: 'Test', email: 'a@b.ma', currency: 'DH', tva: '20' },
      clients: [],
      stock: [],
      docs: [],
      fournisseurs: [],
      bonsCommande: [],
      stockMoves: [],
    };
    const r = validate(raw);
    expect(r.ok).toBe(true);
    expect(r.data.clients).toEqual([]);
  });
});
