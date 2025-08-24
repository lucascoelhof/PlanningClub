export default {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }]
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/main.js', // Entry point, doesn't need testing
    '!src/services/analytics.js', // External service
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.js',
    '<rootDir>/tests/unit/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globals: {
    // Mock global objects that would be available in browser
    window: {},
    document: {},
    localStorage: {},
    CryptoJS: {},
    Peer: {}
  }
};