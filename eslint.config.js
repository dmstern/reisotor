import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vuejsAccessibility from 'eslint-plugin-vuejs-accessibility';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

// Convert eslint-plugin-vuejs-accessibility recommended rules to 'warn' so static tips are provided without failing CI
const a11yWarnRules = Object.fromEntries(
  Object.keys(vuejsAccessibility.rules || {}).map((ruleName) => [
    `vuejs-accessibility/${ruleName}`,
    'warn',
  ])
);

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-*/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/coverage/**',
      '**/*.sqlite*',
    ],
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...vuejsAccessibility.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'warn',
      'vue/attributes-order': 'off',
      ...a11yWarnRules,
    },
  },
  eslintConfigPrettier
);
