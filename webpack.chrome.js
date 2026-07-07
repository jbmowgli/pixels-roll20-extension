const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { assetCopyPatterns } = require('./webpack.common.js');

module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist/chrome'),
    filename: '[name].js',
    clean: true,
    // No library wrapper for content scripts - just execute in global scope
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        ...assetCopyPatterns,
      ],
    }),
  ],
};
