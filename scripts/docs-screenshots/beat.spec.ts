import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { createFakePlatform } from '../../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from '../../e2e/fake-platform';

// Chili Beat screenshots for docs/beat/. Bee Home, the example game from
// chili-chip/chili-beat, is open. Run with: npm run docs:screenshots

const out = join(__dirname, '../../docs/assets/screenshots');
const beeHome = readFileSync(join(__dirname, '../../app/src/engines/beat/fixtures/bee-home.beat'), 'utf8');

async function open(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  const platform = createFakePlatform({ token: 'docs' });
  const saved = platform.addGame({ title: 'Bee Home', data: beeHome, engine: 'beat' });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['docs'], `/index.html?api=/api&project=${saved.id}`);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Bee Home');
  return creator;
}

async function tool(creator: FrameLocator, title: string) {
  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: title, exact: true }).click();
}

/** The docked group whose tab in front is `title`. */
function group(creator: FrameLocator, title: string): Locator {
  return creator.locator('.dv-groupview').filter({ has: creator.locator('.dv-active-tab', { hasText: title }) }).first();
}

async function shot(target: Page | Locator, name: string) {
  const page = 'page' in target && typeof target.page === 'function' ? target.page() : (target as Page);
  await page.waitForTimeout(300);
  await target.screenshot({ path: join(out, `${name}.png`), animations: 'disabled', caret: 'hide' });
}

async function hold(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

test('chili beat', async ({ page }) => {
  const creator = await open(page);
  await page.waitForTimeout(500);
  await shot(page, 'beat-workspace');

  await tool(creator, 'Screens');
  await shot(group(creator, 'Screens'), 'beat-screens');
  await tool(creator, 'Things');
  await shot(group(creator, 'Things'), 'beat-things');
  await tool(creator, 'Rules');
  await shot(group(creator, 'Rules'), 'beat-rules');
  await tool(creator, 'Sounds');
  await shot(group(creator, 'Sounds'), 'beat-sounds');
  await tool(creator, 'Game');
  await shot(group(creator, 'Game'), 'beat-game');
  await tool(creator, 'Problems');
  await shot(group(creator, 'Problems'), 'beat-problems');

  // Play: visit a flower and the Rules cards light up.
  await tool(creator, 'Rules');
  await tool(creator, 'Play');
  await creator.getByRole('button', { name: 'Play game' }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  for (let i = 0; i < 4; i++) await hold(page, 'ArrowUp');
  await expect(async () => {
    await hold(page, 'ArrowLeft');
    await expect(creator.getByRole('listitem', { name: 'Rule 2' })).toHaveAttribute('data-lit', 'true', { timeout: 200 });
  }).toPass({ timeout: 10_000 });
  await shot(page, 'beat-play');
  await creator.getByRole('button', { name: 'Stop' }).click();

  // The engine choice the creator starts on.
  await creator.getByRole('button', { name: 'Change editor' }).click();
  await creator.getByRole('region', { name: 'Pick an editor' }).waitFor();
  await shot(page, 'engine-choice');
});
