import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/api/src/**/*.db.test.ts'],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
