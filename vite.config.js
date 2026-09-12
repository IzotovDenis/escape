import { defineConfig } from 'vite';

export default defineConfig({
  base: '/escape/',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
