module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/.expo/'],
  collectCoverageFrom: ['utils/**/*.ts', '!utils/**/*.test.ts'],
  coverageThreshold: {
    './utils/debts.ts': { branches: 85, functions: 100, lines: 100, statements: 100 },
    './utils/splits.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
    './utils/proration.ts': { branches: 85, functions: 100, lines: 100, statements: 100 },
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*)',
  ],
};
