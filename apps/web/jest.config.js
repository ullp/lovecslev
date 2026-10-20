/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, tsconfig: { module: 'commonjs', target: 'ES2022', esModuleInterop: true } }],
  },
};
