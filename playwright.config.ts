import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build, served the way the
// platform serves it: static files, same origin as the page around them.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4310',
    trace: 'retain-on-failure',
    // The first-run tour is tested on its own; it stays out of the other tests' way.
    storageState: {
      cookies: [],
      origins: [{ origin: 'http://localhost:4310', localStorage: [{ name: 'chili.creator.tour.v1', value: 'done' }] }],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4310/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
