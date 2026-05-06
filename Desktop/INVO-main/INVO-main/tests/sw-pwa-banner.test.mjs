/**
 * Tests PWA (sw-register.js) : bannière native + filet manuel.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const swPath = new URL('../sw-register.js', import.meta.url);
const swCode = fs.readFileSync(swPath, 'utf8');

function createMockDom() {
  const registry = Object.create(null);

  function register(el) {
    if (el && el.id) registry[el.id] = el;
  }

  function unregister(el) {
    if (el && el.id && registry[el.id] === el) delete registry[el.id];
  }

  class MockEl {
    constructor(tag) {
      this.tagName = String(tag || '').toUpperCase();
      this._id = '';
      this.style = {
        cssText: '',
        setProperty() {},
        display: '',
      };
      this.children = [];
      this.parentNode = null;
      this._listeners = Object.create(null);
      this._inner = '';
      this._btnInstall = {
        addEventListener: (ev, fn) => {
          this._listeners['btn-install'] = fn;
        },
      };
      this._manualInstall = {
        addEventListener: (ev, fn) => {
          this._listeners['manual-install'] = fn;
        },
      };
    }
    get id() {
      return this._id;
    }
    set id(v) {
      this._id = v || '';
      if (this._id) register(this);
    }
    set innerHTML(_v) {
      // Les handlers attachent sur #auth-install-btn — références stables.
    }
    get innerHTML() {
      return this._inner;
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      register(child);
      return child;
    }
    remove() {
      unregister(this);
      if (this.parentNode) {
        const i = this.parentNode.children.indexOf(this);
        if (i >= 0) this.parentNode.children.splice(i, 1);
      }
      this.parentNode = null;
    }
    querySelector(sel) {
      if (sel === '#auth-install-btn') return this._btnInstall;
      if (sel === '#auth-install-manual-install') return this._manualInstall;
      return null;
    }
    addEventListener() {}
  }

  const authCardBody = new MockEl('div');
  authCardBody.id = 'auth-card-body';
  const authScreen = new MockEl('div');
  authScreen.id = 'auth-screen';

  const obsCallbacks = [];
  class MockMutationObserver {
    constructor(cb) {
      this._cb = cb;
    }
    observe() {
      obsCallbacks.push(this._cb);
    }
    disconnect() {
      const idx = obsCallbacks.indexOf(this._cb);
      if (idx >= 0) obsCallbacks.splice(idx, 1);
    }
  }

  function flushMutations() {
    const cbs = obsCallbacks.slice();
    for (const cb of cbs) {
      try {
        cb([], null);
      } catch {
        /* mock DOM — erreurs d’observer ignorées */
      }
    }
  }

  const document = {
    readyState: 'complete',
    documentElement: new MockEl('html'),
    getElementById(id) {
      return registry[id] ?? null;
    },
    createElement(tag) {
      return new MockEl(tag);
    },
    body: {
      appendChild() {},
    },
  };

  return { registry, authCardBody, authScreen, document, MockMutationObserver, flushMutations };
}

function loadSwRegister(overrides = {}) {
  const noop = () => {};
  const dom = createMockDom();
  const listeners = Object.create(null);
  let reloadCount = 0;
  const ctx = {
    console: {
      ...console,
      info: noop,
      log: noop,
      warn: noop,
      error: noop,
    },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    location: {
      href: 'https://example.test/app/index.html',
      reload() {
        reloadCount++;
      },
    },
    navigator: { userAgent: overrides.userAgent || 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' },
    localStorage: {
      _s: Object.create(null),
      getItem(k) {
        return this._s[k] ?? null;
      },
      setItem(k, v) {
        this._s[k] = String(v);
      },
    },
    sessionStorage: {
      _s: Object.create(null),
      getItem(k) {
        return this._s[k] ?? null;
      },
      setItem(k, v) {
        this._s[k] = String(v);
      },
    },
    document: dom.document,
    MutationObserver: dom.MockMutationObserver,
    __INVOO_TEST_PWA_MANUAL_HINT_MS__:
      overrides.manualHintMs !== undefined ? overrides.manualHintMs : -1,
    matchMedia(q) {
      return {
        matches: !!overrides.matchMediaMatches?.[q],
        media: q,
      };
    },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.window.isSecureContext = false;
  ctx.window.addEventListener = (ev, fn) => {
    if (!listeners[ev]) listeners[ev] = [];
    listeners[ev].push(fn);
  };
  ctx.window._invooPwaManualHintTid = null;
  ctx.window._authInstallBannerObs = null;

  ctx.showNetworkBanner = noop;
  ctx.showUpdateToast = noop;

  vm.createContext(ctx);
  vm.runInContext(swCode, ctx, { filename: 'sw-register.js' });

  // sw-register.js remet window._pwaInstallPrompt à null au chargement — réappliquer pour les tests.
  ctx.window._pwaInstallPrompt = overrides._pwaInstallPrompt ?? null;

  return {
    ctx,
    dom,
    reloadCount: () => reloadCount,
  };
}

// 1) Bannière native : montée dans #auth-card-body si prompt présent + écran auth présent.
{
  const { ctx, dom } = loadSwRegister({
    _pwaInstallPrompt: { prompt: () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) },
  });
  assert.equal(typeof ctx._showAuthInstallBanner, 'function');
  ctx._showAuthInstallBanner();
  const banner = ctx.document.getElementById('auth-install-banner');
  assert.ok(banner);
  assert.ok(dom.authCardBody.children.includes(banner));
}

// 2) Sans prompt : pas de bannière native.
{
  const { ctx } = loadSwRegister({ _pwaInstallPrompt: null });
  ctx._showAuthInstallBanner();
  assert.equal(ctx.document.getElementById('auth-install-banner'), null);
}

// 3) Observer : si le DOM auth arrive après l’appel, la bannière est montée au flush.
{
  const { ctx, dom } = loadSwRegister({
    _pwaInstallPrompt: { prompt: () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) },
  });
  // Retirer auth-screen du registre pour simuler arrivée tardive
  delete dom.registry['auth-screen'];
  delete dom.registry['auth-card-body'];
  ctx._showAuthInstallBanner();
  assert.equal(ctx.document.getElementById('auth-install-banner'), null);
  dom.authScreen.id = 'auth-screen';
  dom.authCardBody.id = 'auth-card-body';
  dom.flushMutations();
  assert.ok(ctx.document.getElementById('auth-install-banner'));
}

// 4) Hint manuel : après délai court (hook test), bloc #auth-install-manual-hint ajouté.
{
  const { ctx, dom } = loadSwRegister({
    _pwaInstallPrompt: null,
    manualHintMs: 10,
  });
  ctx._tryShowAuthPwaManualHint();
  await new Promise(r => setTimeout(r, 40));
  const hint = ctx.document.getElementById('auth-install-manual-hint');
  assert.ok(hint);
  assert.ok(dom.authCardBody.children.includes(hint));
}

// 5) iOS : pas de hint manuel.
{
  const { ctx } = loadSwRegister({
    _pwaInstallPrompt: null,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    manualHintMs: 10,
  });
  ctx._tryShowAuthPwaManualHint();
  await new Promise(r => setTimeout(r, 40));
  assert.equal(ctx.document.getElementById('auth-install-manual-hint'), null);
}

console.log('OK — tests sw-pwa-banner');
