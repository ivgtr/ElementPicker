import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    sourcemap: process.env.NODE_ENV === 'development',
    emptyOutDir: true,
  },
});
