const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    // Background script
    'background/background': './src/background/background.ts',

    // Content scripts
    'content/roll20': './src/content/roll20.ts',

    // Utility modules
    'utils/modifierSettings': './src/utils/modifierSettings.ts',
    'utils/profileStorage': './src/utils/profileStorage.ts',
    'utils/themeDetector': './src/utils/themeDetector.ts',
    'utils/cssLoader': './src/utils/cssLoader.ts',
    'utils/htmlLoader': './src/utils/htmlLoader.ts',

    // Content modules
    'content/modules/Utils': './src/content/modules/Utils.ts',
    'content/modules/PopupDetection': './src/content/modules/PopupDetection.ts',
    'content/modules/Roll20Integration':
      './src/content/modules/Roll20Integration.ts',
    'content/modules/RollBatcher': './src/content/modules/RollBatcher.ts',
    'content/modules/PixelsCommand': './src/content/modules/PixelsCommand.ts',
    'content/modules/FormulaEvaluator':
      './src/content/modules/FormulaEvaluator.ts',
    'content/modules/StorageManager': './src/content/modules/StorageManager.ts',
    'content/modules/ModifierBoxManager':
      './src/content/modules/ModifierBoxManager.ts',

    // Modifier box components
    'components/modifierBox/modifierBox':
      './src/components/modifierBox/modifierBox.ts',
    'components/modifierBox/dragHandler':
      './src/components/modifierBox/dragHandler.ts',
    'components/modifierBox/themeManager':
      './src/components/modifierBox/themeManager.ts',
    'components/modifierBox/rowManager':
      './src/components/modifierBox/rowManager.ts',
    'components/modifierBox/dragDrop':
      './src/components/modifierBox/dragDrop.ts',

    // Popup component
    'components/popup/popup': './src/components/popup/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
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
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'ESNext',
              moduleResolution: 'bundler',
            },
          },
        },
      },
      {
        test: /\.js$/,
        exclude: [/node_modules/, /pixels-ble\/dist/],
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    chrome: '88',
                  },
                  modules: 'cjs',
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
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        // Copy manifest and runtime assets
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'assets/images', to: 'assets/images' },

        // Copy HTML files
        {
          from: 'src/components/modifierBox/modifierBox.html',
          to: 'components/modifierBox/modifierBox.html',
        },
        {
          from: 'src/components/popup/popup.html',
          to: 'components/popup/popup.html',
        },

        // Copy CSS files
        {
          from: 'src/components/modifierBox/styles',
          to: 'components/modifierBox/styles',
        },
        {
          from: 'src/components/popup/popup.css',
          to: 'components/popup/popup.css',
        },
      ],
    }),
  ],
  optimization: {
    splitChunks: false,
  },
  target: 'web',
  experiments: {
    outputModule: false,
  },
};
