const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { TextEncoder } = require('node:util');

function loadLicenseActivation() {
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'license-activation.js'), 'utf8');
  const ctx = {
    TextEncoder,
    console,
    localStorage: {
      _m: new Map(),
      getItem(k) {
        return this._m.has(k) ? this._m.get(k) : null;
      },
      setItem(k, v) {
        this._m.set(k, String(v));
      },
    },
    navigator: { userAgent: 'test', language: 'fr', platform: 'win' },
    screen: { width: 1920, height: 1080, colorDepth: 24 },
    Intl,
    crypto: {
      getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = (i + 7) % 256;
        return arr;
      },
      subtle: {
        digest(algo, buf) {
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

describe('license-activation', () => {
  test('normalize email', () => {
    const ctx = loadLicenseActivation();
    expect(ctx.invooNormalizeActivationEmail('  Test@EXAMPLE.com ')).toBe('test@example.com');
  });

  test('expected license hex is deterministic', async () => {
    const ctx = loadLicenseActivation();
    const a = await ctx.invooComputeExpectedLicenseHex('a@b.ma', 'device123');
    const b = await ctx.invooComputeExpectedLicenseHex('a@b.ma', 'device123');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  test('license key match ignores case and spaces', () => {
    const ctx = loadLicenseActivation();
    expect(ctx.invooLicenseKeysMatch('Ab01  ', 'ab01')).toBe(true);
    expect(ctx.invooLicenseKeysMatch('aa', 'bb')).toBe(false);
  });
});
