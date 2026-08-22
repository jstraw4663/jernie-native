module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|phosphor-react-native|@react-native-firebase)',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // functions/ is an independent workspace (own package.json, own ts-jest-based
  // jest.config.js, deployed separately) — run its tests via `npm test --prefix
  // functions`, not swept up here under the RN/jest-expo preset.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/functions/', '<rootDir>/.worktrees/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
