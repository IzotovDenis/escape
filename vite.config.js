import { defineConfig } from 'vite';
import { pwaBuild } from './scripts/pwa-build.js';

export default defineConfig({
  base: '/escape/',
  plugins: [pwaBuild()],
  build: { rollupOptions: { input: { home: 'index.html', school: 'school.html', aqua: 'aquapark.html' }, output: { manualChunks: { three: ['three'] } } } },
});
