import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Takes the screenshots in docs/assets/screenshots/ (npm run docs:screenshots).
// Same production build and server as the end-to-end tests.
export default defineConfig({
  ...base,
  testDir: 'scripts/docs-screenshots',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  projects: [{ name: 'docs' }],
  timeout: 120_000,
});
