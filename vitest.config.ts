import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testEnvironment: 'node',
    include: ['__test__/**/*.test.ts'],
    exclude: ['node_modules', 'lib', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/node_modules/**']
    },
    threshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
