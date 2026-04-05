import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5434/hospital_test';

export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_DATABASE_URL: TEST_DATABASE_URL,
    },
    globalSetup: ['src/__tests__/integration/setup/global-setup.ts'],
    setupFiles: ['src/__tests__/integration/setup/test-db.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/routes/**'],
    },
  },
});
