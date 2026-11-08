import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vuejsAccessibility = require('eslint-plugin-vuejs-accessibility');
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

// Convert eslint-plugin-vuejs-accessibility recommended rules to 'warn' so static tips are provided without failing CI
const a11yWarnRules = Object.fromEntries(
  Object.keys(vuejsAccessibility.rules || {}).map((ruleName) => [
    `vuejs-accessibility/${ruleName}`,
    'warn',
  ])
);

// Verhindert manuelle -webkit-backdrop-filter oder -webkit-mask Deklarationen in Vue-Styles.
// LightningCSS (rolldown-vite) übernimmt das Autoprefixing für Safari 16 automatisch.
// Manuelle Präfixe führen bei falscher Reihenfolge dazu, dass LightningCSS Standard-Eigenschaften
// verwirft, was Firefox bricht.
const cssPrefixPlugin = {
  rules: {
    'no-manual-webkit-prefix': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow manual -webkit-backdrop-filter and -webkit-mask; use standard properties instead.',
        },
        messages: {
          forbidden:
            'Do not write manual {{prefix}}. Write standard CSS ({{standard}}) instead; LightningCSS autoprefixes it automatically in production.',
        },
      },
      create(context) {
        return {
          Program() {
            const text = context.sourceCode.getText();
            const regex = /-(?:webkit)-(backdrop-filter|mask)\s*:/g;
            let match;

            while ((match = regex.exec(text)) !== null) {
              const loc = context.sourceCode.getLocFromIndex(match.index);
              context.report({
                loc: {
                  start: loc,
                  end: { line: loc.line, column: loc.column + match[0].length },
                },
                messageId: 'forbidden',
                data: {
                  prefix: match[0].trim(),
                  standard: match[1],
                },
              });
            }
          },
        };
      },
    },
  },
};

const readabilityPlugin = {
  rules: {
    'prefer-early-return': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Prefer early returns/guard clauses over wrapping the remainder of a function in a large if block.',
        },
        schema: [
          {
            type: 'object',
            properties: {
              minStatements: {
                type: 'integer',
                minimum: 1,
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          preferEarlyReturn:
            'Prefer an early return/guard clause instead of wrapping {{statementCount}} statements in an "if" block at the end of the function.',
        },
      },
      create(context) {
        const minStatements = context.options[0]?.minStatements ?? 3;

        function checkFunctionBody(node) {
          const body = node.body;

          if (
            !body ||
            body.type !== 'BlockStatement' ||
            !Array.isArray(body.body) ||
            body.body.length === 0
          ) {
            return;
          }

          const lastStatement = body.body[body.body.length - 1];

          if (
            lastStatement.type === 'IfStatement' &&
            !lastStatement.alternate &&
            lastStatement.consequent &&
            lastStatement.consequent.type === 'BlockStatement'
          ) {
            const innerStatements = lastStatement.consequent.body;

            if (innerStatements.length >= minStatements) {
              context.report({
                node: lastStatement,
                messageId: 'preferEarlyReturn',
                data: {
                  statementCount: innerStatements.length,
                },
              });
            }
          }
        }

        return {
          FunctionDeclaration: checkFunctionBody,
          FunctionExpression: checkFunctionBody,
          ArrowFunctionExpression: checkFunctionBody,
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-*/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'scratch/**',
      '**/coverage/**',
      '**/*.sqlite*',
      '**/storybook-static/**',
      '**/tests/scratch/**',
      '.claude',
      '**/venv/**',
      '**/.venv/**',
    ],
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...vuejsAccessibility.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    plugins: {
      'css-prefix': cssPrefixPlugin,
    },
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      'css-prefix/no-manual-webkit-prefix': 'error',
    },
  },
  {
    plugins: {
      readability: readabilityPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'max-depth': ['warn', 4],
      complexity: ['warn', 15],
      'max-params': ['warn', 4],
      'no-nested-ternary': 'warn',
      'readability/prefer-early-return': ['warn', { minStatements: 3 }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'warn',
      'vue/attributes-order': 'off',
      'vue/no-undef-components': [
        'error',
        {
          ignorePatterns: [
            'router-link',
            'router-view',
            'Teleport',
            'Transition',
            'TransitionGroup',
            'KeepAlive',
            'Suspense',
            'component',
            'slot',
          ],
        },
      ],
      ...a11yWarnRules,
      'vuejs-accessibility/label-has-for': [
        'warn',
        {
          controlComponents: [
            'Checkbox',
            'Input',
            'Select',
            'Textarea',
            'PasswordInput',
            'Combobox',
            'ImageUrlInput',
            'FileAttachments',
            'DropZone',
            'TourAssignDropdown',
          ],
        },
      ],
      'vuejs-accessibility/form-control-has-label': [
        'warn',
        {
          labelComponents: ['FormField'],
        },
      ],
      'id-length': [
        'warn',
        {
          min: 2,
          exceptions: ['_', 'i', 'j', 'e', 'x', 'y', 'a', 'b', 'k', 'v', 'w', 'h'],
          properties: 'never',
        },
      ],
      '@typescript-eslint/no-magic-numbers': [
        'warn',
        {
          ignore: [
            -1, 0, 1, 2, 100, 1000, 200, 201, 204, 301, 302, 304, 400, 401, 403, 404, 409, 422, 500,
          ],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.mjs',
      '**/*.spec.mjs',
      'e2e/**/*.ts',
      'scripts/**/*.test.*',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'vue/one-component-per-file': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      complexity: 'off',
      'max-depth': 'off',
      'max-params': 'off',
      'readability/prefer-early-return': 'off',
      'id-length': 'off',
      'no-nested-ternary': 'off',
    },
  },
  eslintConfigPrettier,
  {
    rules: {
      curly: ['error', 'all'],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
      ],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
    },
  }
);

export { readabilityPlugin };
