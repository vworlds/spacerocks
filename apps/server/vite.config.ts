import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@vworlds/vecs': fileURLToPath(
        new URL(
          '../../node_modules/@vworlds/vecs/dist/index.js',
          import.meta.url,
        ),
      ),
    },
  },
});
