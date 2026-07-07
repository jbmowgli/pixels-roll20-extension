// Shared webpack config used by both the Chrome and Firefox builds
// (webpack.chrome.js / webpack.firefox.js), merged together in
// webpack.config.js via webpack-merge. Only what differs per browser
// (output path, manifest generation) lives outside this file.

// Copy patterns identical across browsers — everything except manifest.json,
// which each browser-specific config supplies itself (Firefox transforms it,
// Chrome copies it as-is).
const assetCopyPatterns = [
  { from: 'assets/images', to: 'assets/images' },
  {
    from: 'src/components/modifierBox/modifierBox.html',
    to: 'components/modifierBox/modifierBox.html',
  },
  {
    from: 'src/components/popup/popup.html',
    to: 'components/popup/popup.html',
  },
  {
    from: 'src/components/modifierBox/styles',
    to: 'components/modifierBox/styles',
  },
  {
    from: 'src/components/popup/popup.css',
    to: 'components/popup/popup.css',
  },
];

const path = require('path');

const config = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    // Background script
    'background/background': './src/background/background.js',

    // Content scripts
    'content/roll20': './src/content/roll20.js',

    // Utility modules
    'utils/modifierSettings': './src/utils/modifierSettings.js',
    'utils/profileStorage': './src/utils/profileStorage.js',
    'utils/themeDetector': './src/utils/themeDetector.js',
    'utils/cssLoader': './src/utils/cssLoader.js',
    'utils/htmlLoader': './src/utils/htmlLoader.js',

    // Content modules
    'content/modules/Utils': './src/content/modules/Utils.js',
    'content/modules/PopupDetection': './src/content/modules/PopupDetection.js',
    'content/modules/Roll20Integration':
      './src/content/modules/Roll20Integration.js',
    'content/modules/StorageManager': './src/content/modules/StorageManager.js',
    'content/modules/ModifierBoxManager':
      './src/content/modules/ModifierBoxManager.js',
    'content/modules/PixelsBluetooth':
      './src/content/modules/PixelsBluetooth.js',

    // Modifier box components
    'components/modifierBox/modifierBox':
      './src/components/modifierBox/modifierBox.js',
    'components/modifierBox/dragHandler':
      './src/components/modifierBox/dragHandler.js',
    'components/modifierBox/themeManager':
      './src/components/modifierBox/themeManager.js',
    'components/modifierBox/rowManager':
      './src/components/modifierBox/rowManager.js',
    'components/modifierBox/dragDrop':
      './src/components/modifierBox/dragDrop.js',

    // Popup component
    'components/popup/popup': './src/components/popup/popup.js',
  },
  resolve: {
    extensions: ['.js', '.ts'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@core': path.resolve(__dirname, 'src/core'),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    chrome: '88', // Chrome extension minimum version
                  },
                  modules: 'cjs', // Transform to CommonJS for browser compatibility
                  useBuiltIns: 'usage',
                  corejs: 3,
                },
              ],
            ],
            plugins: ['@babel/plugin-transform-runtime'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  optimization: {
    splitChunks: false, // Disable code splitting for content scripts
  },
  // Chrome/Firefox extension specific settings — both target 'web' and
  // neither supports ES module output for content scripts.
  target: 'web',
  experiments: {
    outputModule: false,
  },
};

module.exports = { config, assetCopyPatterns };
