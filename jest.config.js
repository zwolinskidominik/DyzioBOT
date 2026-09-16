/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/unit/**/*.test.ts', '**/tests/integration/**/*.test.ts', '**/tests/e2e/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false, tsconfig: 'tsconfig.tests.json' }],
    // pretty-ms (i jego zależność parse-ms) są publikowane wyłącznie jako ESM, a projekt
    // kompiluje się do CommonJS — bez tego Jest wywala "Cannot use import statement outside
    // a module" i ubija całe suite importujące moderationHelpers.
    '^.+\\.m?js$': ['ts-jest', { diagnostics: false, tsconfig: 'tsconfig.tests.json' }],
  },
  // Domyślnie Jest pomija całe node_modules w transformacji — te dwie paczki musimy przepuścić.
  transformIgnorePatterns: ['/node_modules/(?!(pretty-ms|parse-ms)/)'],
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/index.ts', '!src/scripts/**'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  globalSetup: '<rootDir>/tests/mongo/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/mongo/globalTeardown.ts'
};
