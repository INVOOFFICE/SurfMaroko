import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * Minimal ESLint flat config (ESLint 9+).
 * - App scripts share one browser scope via <script> — no-undef is off to avoid false positives.
 * - innerHTML is restricted except at the two audited sinks (html-safe, sw-register fallback).
 */
export default [
  { ignores: ['node_modules/**', 'js/vendor/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'sw-register.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      /** Fonctions invoquées depuis events.js / HTML : pas de graphe de modules. */
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      /**
       * no-restricted-properties avec object: '*' ne couvre pas ce cas ; selector AST fiable.
       * @see https://eslint.org/docs/latest/rules/no-restricted-syntax
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression > MemberExpression[property.name="innerHTML"]',
          message:
            'Évitez innerHTML direct ; utilisez textContent, createElement, setStaticHtml(), ou sanitizeHTML() (sinks : html-safe.js / sw-register uniquement, avec eslint-disable documenté).',
        },
      ],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: globals.serviceworker,
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression > MemberExpression[property.name="innerHTML"]',
          message:
            'Évitez innerHTML dans le service worker ; utilisez des messages texte ou postMessage.',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['tests/jest/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  eslintConfigPrettier,
];
