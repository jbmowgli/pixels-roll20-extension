const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { assetCopyPatterns } = require('./webpack.common.js');

// Fixed ID required so the native messaging host manifest can allowlist this
// extension (Firefox has no equivalent of Chrome's key-derived extension ID).
const FIREFOX_EXTENSION_ID = 'pixels-roll20@jtoddy.github.io';

module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist/firefox'),
    filename: '[name].js',
    clean: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: 'manifest.json',
          transform(content) {
            const manifest = JSON.parse(content.toString());

            // Firefox MV3 uses event pages, not service workers.
            manifest.background = {
              scripts: ['background/background.js'],
            };

            if (!manifest.permissions.includes('nativeMessaging')) {
              manifest.permissions = [
                ...manifest.permissions,
                'nativeMessaging',
              ];
            }

            manifest.browser_specific_settings = {
              gecko: { id: FIREFOX_EXTENSION_ID },
            };

            // Firefox has no Web Bluetooth — swap the Chrome-only
            // GATT-based module for the native-messaging bridge. (roll20.js
            // itself still feature-detects and picks the right one at
            // runtime; this only controls which module's standalone script
            // — and thus its early window.* legacy exports — loads first.)
            manifest.content_scripts.forEach(entry => {
              const index = entry.js.indexOf(
                'content/modules/PixelsBluetooth.js'
              );
              if (index !== -1) {
                entry.js[index] = 'content/modules/PixelsNativeBridge.js';
              }
            });

            return JSON.stringify(manifest, null, 2);
          },
        },
        ...assetCopyPatterns,
      ],
    }),
  ],
};
