const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    // Background script
    'background/background': './src/background/background.js',

    // Content scripts
    'content/roll20': './src/content/roll20.js',

    // Modifier box components
    'components/modifierBox/modifierBox':
      './src/components/modifierBox/modifierBox.js',
    'components/modifierBox/dragHandler':
      './src/components/modifierBox/dragHandler.js',
    'components/modifierBox/themeManager':
      './src/components/modifierBox/themeManager.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
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
            presets: ['@babel/preset-env'],
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
        // Copy manifest and assets
        { from: 'manifest.json' },
        { from: 'assets', to: 'assets' },

        // Copy HTML files
        {
          from: 'src/components/modifierBox/modifierBox.html',
          to: 'components/modifierBox/modifierBox.html',
        },

        // Copy CSS files
        {
          from: 'src/components/modifierBox/styles',
          to: 'components/modifierBox/styles',
        },
      ],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
        },
      },
    },
  },
  // Chrome extension specific settings
  target: 'web',
  experiments: {
    outputModule: false, // Chrome extensions don't support ES modules yet
  },
};
