import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site under /<repo>/.
// Override with VITE_BASE=/ for custom domains or local previews.
const base = process.env.VITE_BASE ?? '/borg-module-runner/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // Adventures are eagerly bundled so the PWA's service worker can
    // cache the entire library on first load — bigger initial JS, but
    // every module is fully playable offline thereafter.
    chunkSizeWarningLimit: 1500,
  },
});
