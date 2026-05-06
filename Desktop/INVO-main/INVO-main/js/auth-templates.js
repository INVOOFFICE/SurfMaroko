// auth-templates.js — gabarits écran activation (auth.js) — passer par setStaticHtml + DOMPurify

const AUTH_BRAND_LOGO_SRC = 'icons/icon-512.png';
function authBrandLogoBlock(marginBottom = '16px') {
  const cls = marginBottom === '14px' ? 'auth-brand-logo auth-brand-logo-mb-14' : 'auth-brand-logo';
  return `<img src="${AUTH_BRAND_LOGO_SRC}" alt="INVOO OFFICE" width="72" height="72" loading="eager" decoding="async" class="${cls}">`;
}

/**
 * @param {{ deviceId: string, prefilledEmail?: string, prefilledPhone?: string, demoExpired?: boolean, showDemoOption?: boolean }} p
 */
function buildActivationHTML(p) {
  const deviceId = escapeAttr(p.deviceId || '');
  const emailVal = escapeAttr(p.prefilledEmail || '');
  const phoneVal = escapeAttr(p.prefilledPhone || '');
  const demoExpired = !!p.demoExpired;
  const showDemo = !!p.showDemoOption;
  const demoBlock = showDemo
    ? `
        <button type="button" data-auth-action="start-demo" class="auth-btn-demo auth-btn-demo-extended">
          <span class="auth-demo-emoji">⏱️</span>
          <span class="auth-demo-copy">
            <span class="auth-demo-title">Essai gratuit 1 heure</span>
            <span class="auth-demo-subtitle">Toutes les fonctions · Une session par navigateur</span>
          </span>
        </button>
        <div class="auth-demo-divider">ou activez avec une clé ci-dessous</div>
      `
    : '';
  const demoEndedHint = demoExpired
    ? `<div class="auth-demo-ended-hint">Votre essai gratuit est terminé. Activez l’application avec une clé de licence ou contactez le support.</div>`
    : '';
  return `
    <div class="auth-login-card auth-login-card-activation">
      <div class="auth-card-header auth-card-header-activation">
        ${authBrandLogoBlock('14px')}
        <div class="auth-card-title-lg">Activation INVOO OFFICE</div>
        <div class="auth-card-subtitle-light">Licence locale — aucune donnée envoyée automatiquement</div>
      </div>
      <div id="auth-card-body" class="auth-card-body">
        ${demoBlock}
        ${demoEndedHint}
        <div id="activation-step-1" class="auth-form-grid">
          <div class="auth-field-wrap auth-field-wrap-gap">
            <label for="activation-email" class="auth-field-label">E-mail</label>
            <input id="activation-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="vous@exemple.ma" value="${emailVal}" required
              aria-describedby="activation-email-help activation-email-error"
              class="auth-input">
            <div id="activation-email-help" class="auth-field-help">Utilisez l’e-mail lié à votre licence.</div>
            <div id="activation-email-error" class="auth-field-error" aria-live="polite"></div>
          </div>
          <div class="auth-field-wrap auth-field-wrap-gap">
            <label for="activation-phone" class="auth-field-label">Numéro WhatsApp</label>
            <input id="activation-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="06…, 07… ou +212 6…" value="${phoneVal}" required
              aria-describedby="activation-phone-help activation-phone-error"
              class="auth-input">
            <div id="activation-phone-help" class="auth-field-help">Format accepté : 06..., 07... ou +212...</div>
            <div id="activation-phone-error" class="auth-field-error" aria-live="polite"></div>
          </div>
          <input id="activation-device-id" type="hidden" value="${deviceId}">
        </div>
        <div id="activation-error" role="alert" aria-live="assertive" class="auth-error-box"></div>
        <button type="button" data-auth-action="send-whatsapp" class="btn btn-secondary auth-btn-full auth-btn-inline">
          <span>📲</span> Envoyer via WhatsApp
        </button>
        <div id="activation-step-2" class="auth-act-step-2" aria-hidden="true">
          <div class="auth-field-wrap auth-field-wrap-gap">
            <label for="activation-license-key" class="auth-field-label">Clé de licence</label>
            <input id="activation-license-key" name="licenseKey" type="text" spellcheck="false" autocapitalize="none" autocomplete="off" placeholder="64 caractères hexadécimaux" required
              aria-describedby="activation-license-help activation-license-key-error"
              class="auth-input auth-input-mono">
            <div id="activation-license-help" class="auth-field-help">Collez la clé reçue sur WhatsApp, sans modifier les caractères.</div>
            <div id="activation-license-key-error" class="auth-field-error" aria-live="polite"></div>
          </div>
          <button type="button" data-auth-action="submit-activation" class="btn btn-primary auth-btn-submit">
            Activer
          </button>
        </div>
        <p class="auth-steps-hint">
          Étape 1 : WhatsApp au support. Étape 2 : collez la clé reçue puis activez.
        </p>
        ${typeof invoFooterTaglineHtml === 'function' ? invoFooterTaglineHtml('auth') : ''}
      </div>
    </div>
  `;
}

/**
 * @param {{ hasPassword?: boolean }} p — si mot de passe session enregistré, champ + validation
 */
function buildLockScreenHTML(p) {
  const hasPassword = !!(p && p.hasPassword);
  const passwordBlock = hasPassword
    ? `
        <div class="auth-lock-password-wrap">
          <label class="auth-field-label">Mot de passe</label>
          <input id="lock-session-password" type="password" autocomplete="current-password"
            class="auth-input">
        </div>
        <div id="lock-error" class="auth-error-box auth-error-box-left"></div>
        <button type="button" data-auth-action="unlock-session" class="btn btn-primary auth-btn-submit">
          Déverrouiller
        </button>
      `
    : `
        <button type="button" data-auth-action="unlock-session" class="btn btn-primary auth-btn-submit">
          Déverrouiller l’application
        </button>
      `;
  const subtitle = hasPassword
    ? 'Saisissez votre mot de passe pour continuer'
    : 'Déverrouiller pour continuer';
  return `
    <div class="auth-login-card auth-login-card-lock">
      <div class="auth-card-header auth-card-header-lock">
        ${authBrandLogoBlock('12px')}
        <div class="auth-card-title-md">Session verrouillée</div>
        <div class="auth-card-subtitle-light auth-card-subtitle-lock">${subtitle}</div>
      </div>
      <div id="auth-card-body" class="auth-card-body">
        ${passwordBlock}
      </div>
    </div>
  `;
}

/** Après validation de la clé licence — mot de passe pour les prochains déverrouillages */
function buildSetSessionPasswordHTML() {
  return `
    <div class="auth-login-card auth-login-card-activation">
      <div class="auth-card-header auth-card-header-setpass">
        ${authBrandLogoBlock('12px')}
        <div class="auth-card-title-md">Mot de passe de session</div>
        <div class="auth-card-subtitle-light auth-card-subtitle-setpass">Choisissez un mot de passe pour déverrouiller l’application après déconnexion.<br>Il reste sur cet appareil uniquement.</div>
      </div>
      <div id="auth-card-body" class="auth-card-body">
        <div class="auth-field-wrap-gap">
          <label class="auth-field-label">Mot de passe</label>
          <input id="session-password" type="password" autocomplete="new-password" minlength="6"
            class="auth-input">
        </div>
        <div class="auth-field-wrap-gap auth-field-wrap-gap-lg">
          <label class="auth-field-label">Confirmer</label>
          <input id="session-password-confirm" type="password" autocomplete="new-password" minlength="6"
            class="auth-input">
        </div>
        <p class="auth-setpass-hint">Minimum 6 caractères. Conservez-le : en cas d’oubli, une nouvelle activation avec votre clé sera nécessaire.</p>
        <div id="set-password-error" class="auth-error-box"></div>
        <button type="button" data-auth-action="set-session-password" class="btn btn-primary auth-btn-submit">
          Enregistrer et ouvrir l’application
        </button>
      </div>
    </div>
  `;
}
