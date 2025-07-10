const js = require('@eslint/js');

module.exports = [
  {
    // ES Modules configuration (more specific, should come first)
    files: [
      'src/content/modules/*.js',
      'src/content/roll20.js',
      'src/core/extensionMessaging.js',
      'src/components/modifierBox/dragDrop.js',
      'src/components/modifierBox/dragDropManager.js',
      'src/components/modifierBox/themeManager.js',
      'src/components/modifierBox/rowManager.js',
      'src/components/modifierBox/dragHandler.js',
      'src/components/modifierBox/modifierBox.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
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

        // Extension-specific globals
        postChatMessage: 'readonly',
        sendTextToExtension: 'readonly',
        sendStatusToExtension: 'readonly',
        pixelsModifier: 'writable',
        pixelsModifierName: 'writable',
        connectToPixel: 'writable',
        pixels: 'writable',
        Pixel: 'writable',
        ModifierBox: 'writable',
        ModifierBoxRowManager: 'writable',
        ModifierBoxThemeManager: 'writable',
        ModifierBoxDragHandler: 'writable',
        PixelsBluetooth: 'writable',
        log: 'readonly',
        global: 'writable',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Customize rules for Chrome extension development
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
  {
    // Non-ES module files configuration
    files: ['**/*.js'],
    ignores: [
      'src/components/modifierBox/dragDrop.js', // Will be handled by ES modules config
      'src/components/modifierBox/dragDropManager.js', // Will be handled by ES modules config
      'src/components/modifierBox/themeManager.js', // Will be handled by ES modules config
      'src/components/modifierBox/rowManager.js', // Will be handled by ES modules config
      'src/components/modifierBox/dragHandler.js', // Will be handled by ES modules config
      'src/components/modifierBox/modifierBox.js', // Will be handled by ES modules config
      'src/content/modules/*.js', // Will be handled by ES modules config
      'src/content/roll20.js', // Will be handled by ES modules config
      'src/core/extensionMessaging.js', // Will be handled by ES modules config
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
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

        // Extension-specific globals
        postChatMessage: 'readonly',
        sendTextToExtension: 'readonly',
        sendStatusToExtension: 'readonly',
        pixelsModifier: 'writable',
        pixelsModifierName: 'writable',
        connectToPixel: 'writable',
        pixels: 'writable',
        Pixel: 'writable',
        ModifierBox: 'writable',
        ModifierBoxRowManager: 'writable',
        ModifierBoxThemeManager: 'writable',
        ModifierBoxDragHandler: 'writable',
        PixelsBluetooth: 'writable',
        log: 'readonly',
        global: 'writable',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Customize rules for Chrome extension development
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off', // Allow console in extensions for debugging
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn',
      eqeqeq: ['warn', 'always'],
      curly: ['warn', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-template': 'warn',
      'no-throw-literal': 'warn',
    },
  },
  {
    // Test files configuration
    files: ['tests/**/*.js'],
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
      'no-unused-vars': 'off', // Allow unused vars in tests
    },
  },
];
