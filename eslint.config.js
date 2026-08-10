const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        // Browser/Extension globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        chrome: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        AbortController: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      // Disable base rules that conflict with TS versions
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off', // TypeScript handles interface merging
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
  {
    // Test files configuration
    files: ['tests/**/*.js', 'tests/**/*.ts'],
    languageOptions: {
      globals: {
        // Jest globals
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        global: 'writable',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
