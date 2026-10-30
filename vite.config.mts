import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The platform serves dist/ as is, so the licences go into it: ours (with the
// Bitsy notice), the Bitsy credits and citsy's, next to Vite's list of the
// bundled packages' licences.
const licences = (): Plugin => ({
  name: 'licences',
  generateBundle() {
    const files = { 'LICENSE.txt': 'LICENSE', 'CREDITS.md': 'docs/bitsy/CREDITS.md', 'citsy-LICENSE.txt': 'citsy/LICENSE', 'chili-beat-LICENSE.txt': 'chili-beat/LICENSE' };
    for (const [fileName, path] of Object.entries(files)) {
      this.emitFile({ type: 'asset', fileName, source: readFileSync(path, 'utf8') });
    }
  },
});

// The creator lives in app/ and builds to dist/. `base: './'` lets the platform serve it under any path.
export default defineConfig({
  root: 'app',
  base: './',
  plugins: [react(), tailwindcss(), licences()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    license: { fileName: 'THIRD-PARTY-LICENSES.md' },
    // The plan's budget is 300 KB gzipped for first load; Rolldown warns on
    // minified size, which is about 4x that.
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 4301 },
  preview: { port: 4310 },
  test: {
    root: '.',
    environment: 'jsdom',
    globals: true,
    include: ['app/src/**/*.test.{ts,tsx}'],
    setupFiles: ['app/src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/src/**/*.{ts,tsx}'],
      exclude: ['app/src/**/*.test.{ts,tsx}', 'app/src/test/**', 'app/src/main.tsx'],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
