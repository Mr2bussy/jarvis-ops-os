import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

// Pragmatic config for a large existing codebase: real correctness bugs are errors,
// stylistic / legacy noise is a warning (so the gate is meaningful from day one and
// warnings can be driven down over time). Type-aware rules are intentionally off for
// speed/breadth; enable a scoped type-checked pass later for no-floating-promises.
export default tseslint.config(
  {
    ignores: [
      'dist/**', 'dist-electron/**', 'dist_new/**', 'release/**',
      'node_modules/**', 'coverage/**', '**/*.config.{js,mjs,ts}',
      'stryker-tmp/**', '.stryker-tmp/**', 'reports/**',
      'playwright-report/**', 'test-results/**', '_archive/**',
      // Plain Node scripts (ESM/CJS) — not TS-eslint targets
      'scripts/**/*.{mjs,cjs,js}',
      '.dependency-cruiser.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // TypeScript already resolves globals/ambient types; ESLint's no-undef cannot
      // and would false-positive on browser/Node globals (official tseslint guidance).
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Allow the `cond && fn()` and `cond ? a() : b()` statement idioms used across the UI.
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      // HUD comment separators contain box-drawing whitespace — permit it in comments/strings.
      'no-irregular-whitespace': ['error', { skipComments: true, skipStrings: true, skipTemplates: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
      'prefer-const': 'warn',
      // Legacy HUD/@ts-nocheck surfaces: allow until typed (false = not banned).
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    // All files (incl. any .mjs build scripts): TS-first project, so undefined-symbol
    // resolution is the compiler's/runtime's job. `preserve-caught-error` is a new,
    // opinionated style rule — surface as a warning rather than a hard gate.
    rules: {
      'no-undef': 'off',
      'preserve-caught-error': 'warn',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    // D5 — bare KPI / fake money literals in screens must not compile past eslint.
    // Complements honesty-report.mjs --fail (wired in verify). Matches honesty fail rules:
    // fabricated-money ($1,234+) and bare agent-count literals — not every `$` price tick.
    files: ['src/screens/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/\\$\\s?\\d{1,3}(,\\d{3})+(\\.\\d+)?/]',
          message:
            'D5: fabricated money literal ($1,234+) — use Sourced/<Value>, or DEMO/catalog label (honesty-report).',
        },
        {
          selector: 'TemplateElement[value.cooked=/\\$\\s?\\d{1,3}(,\\d{3})+/]',
          message:
            'D5: fabricated money in template — use Sourced/<Value> or DEMO-labeled catalog.',
        },
        {
          selector: 'JSXText[value=/\\b(1[0-9]{2,3}|[2-9][0-9]{2,3})\\s+agents?\\b/i]',
          message:
            'D5: bare agent-count literal — use vault-measured Sourced value via <Value>.',
        },
        {
          selector: 'Literal[value=/\\b(1[0-9]{2,3}|[2-9][0-9]{2,3})\\s+agents?\\b/i]',
          message:
            'D5: bare agent-count string literal — use vault-measured Sourced value via <Value>.',
        },
      ],
    },
  },
  prettier,
);
