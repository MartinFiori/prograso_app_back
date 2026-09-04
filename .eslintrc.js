module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: 'eslint:recommended',
  ignorePatterns: ['node_modules/', '.agents/'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
  },
}
