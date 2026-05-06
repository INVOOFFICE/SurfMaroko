/**
 * Ancien module auth (PBKDF2 / démo) retiré — garde un test minimal sur l’API globale attendue au boot.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { TextEncoder } = require('node:util');

function loadLicenseActivationMinimal() {
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'license-activation.js'), 'utf8');
  const ctx = {
    TextEncoder,
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: {},
    screen: {},
    Intl,
    crypto: {
      getRandomValues(arr) {
        arr.fill(1);
        return arr;
      },
      subtle: {
        digest(_a, buf) {
          const h = crypto.createHash('sha256');
          h.update(Buffer.from(buf));
          return Promise.resolve(h.digest().buffer);
        },
      },
    },
    globalThis: null,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'license-activation.js' });
  return ctx;
}

describe('auth / activation globals', () => {
  test('license-activation exposes stable device + hash helpers', async () => {
    const ctx = loadLicenseActivationMinimal();
    expect(typeof ctx.invooGetStableDeviceId).toBe('function');
    expect(typeof ctx.invooComputeExpectedLicenseHex).toBe('function');
    const id = await ctx.invooGetStableDeviceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(64);
  });
});
