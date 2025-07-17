module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          chrome: '88', // Chrome extension minimum version
        },
        modules: 'auto', // Let webpack handle module transformation
      },
    ],
  ],
  plugins: ['@babel/plugin-transform-runtime'],
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current',
            },
            modules: 'cjs', // Ensure CommonJS for tests
          },
        ],
      ],
    },
    production: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              chrome: '88', // Chrome extension minimum version
            },
            modules: false, // Preserve ES modules for webpack tree-shaking
          },
        ],
      ],
    },
  },
};
