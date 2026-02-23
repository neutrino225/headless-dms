import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const runIntegration =
  process.env.RUN_INT_TESTS === '1' || process.env.RUN_INT_TESTS === 'true';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/infra/setup.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    fileParallelism: !runIntegration,
    hookTimeout: runIntegration ? 300_000 : 10_000,
    testTimeout: runIntegration ? 300_000 : 10_000,
    maxWorkers: runIntegration ? 1 : undefined,
    minWorkers: runIntegration ? 1 : undefined,
  },
  resolve: {
    alias: {
      'src': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests'),
      '@domain': resolve(__dirname, 'src/domain'),
      '@application': resolve(__dirname, 'src/application'),
      '@infra': resolve(__dirname, 'src/infra'),
      '@presentation': resolve(__dirname, 'src/presentation'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
