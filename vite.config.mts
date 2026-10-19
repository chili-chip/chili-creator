import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// The new creator lives in app/ and builds to dist/, next to the classic
// editor in editor/. `base: './'` lets the platform serve it under any path.
export default defineConfig({
  root: 'app',
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
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
    include: ['app/src/**/*.test.{ts,tsx}', 'citsy/**/*.test.ts'],
    setupFiles: ['app/src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/src/**/*.{ts,tsx}', 'citsy/chili-project-list.js'],
      exclude: ['app/src/**/*.test.{ts,tsx}', 'app/src/test/**', 'app/src/main.tsx'],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
