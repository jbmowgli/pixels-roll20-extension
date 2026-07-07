const { merge } = require('webpack-merge');
const { config: common } = require('./webpack.common.js');
const chromeConfig = require('./webpack.chrome.js');
const firefoxConfig = require('./webpack.firefox.js');

// `--env browser=chrome|firefox` selects the target; defaults to chrome so
// plain `webpack` invocations keep working. Chrome uses Web Bluetooth
// directly; Firefox (which has no Web Bluetooth) gets a manifest patched
// for a native-messaging background relay — see webpack.firefox.js.
module.exports = (env = {}) => {
  const browserConfig =
    env.browser === 'firefox' ? firefoxConfig : chromeConfig;
  return merge(common, browserConfig);
};
