import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@src': fileURLToPath(new URL('./src', import.meta.url)),
      '@vworlds/vecs': fileURLToPath(
        new URL(
          '../../node_modules/@vworlds/vecs/dist/index.js',
          import.meta.url,
        ),
      ),
      phaser: fileURLToPath(
        new URL(
          '../../node_modules/phaser/dist/phaser.esm.min.js',
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
