// Renders the plan mockups in this folder to docs/assets/plans/.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1124, height: 600 }, deviceScaleFactor: 2 });
await page.goto(`file://${here('beat-editor.html')}`);
await page.locator('.app').screenshot({ path: here('../../docs/assets/plans/beat-editor-mockup.png') });
await browser.close();
