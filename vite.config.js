import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// GitHub Pages serves the site under /<repo>/.
// Override with VITE_BASE=/ for custom domains or local previews.
const base = process.env.VITE_BASE ?? '/borg-module-runner/';

// Bake a build stamp into the copied public/sw.js so each deploy gets its own
// cache name and previous caches are evicted on activate. Vite copies the
// public/ tree verbatim, so we rewrite the emitted file after the bundle
// closes (transform/generateBundle hooks don't see public assets).
function swBuildStamp() {
  const stamp = `${Date.now()}`;
  return {
    name: 'sw-build-stamp',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      const swPath = resolve(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const code = readFileSync(swPath, 'utf-8');
      if (!code.includes('__BUILD_VERSION__')) return;
      writeFileSync(swPath, code.replace(/__BUILD_VERSION__/g, stamp));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), swBuildStamp()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // Adventures are eagerly bundled so the PWA's service worker can
    // cache the entire library on first load — bigger initial JS, but
    // every module is fully playable offline thereafter.
    chunkSizeWarningLimit: 1500,
  },
});
