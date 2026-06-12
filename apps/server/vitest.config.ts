import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@vworlds/vecs': resolve(
        import.meta.dirname,
        '../../node_modules/@vworlds/vecs/dist/index.js',
      ),
    },
  },
  test: {
    setupFiles: ['./tests/setup.ts'],
  },
});
