import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/app/domain'),
      '@application': resolve(__dirname, 'src/app/application'),
      '@infra': resolve(__dirname, 'src/app/infra'),
      '@presentation': resolve(__dirname, 'src/presentation'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
