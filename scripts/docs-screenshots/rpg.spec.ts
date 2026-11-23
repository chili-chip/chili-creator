import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { createFakePlatform } from '../../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from '../../e2e/fake-platform';

// Chili RPG screenshots for docs/rpg/. Pepper Village, the example game from
// chili-chip/chili-game-sdk, is open. Run with: npm run docs:screenshots

const out = join(__dirname, '../../docs/assets/screenshots');
const village = readFileSync(join(__dirname, '../../app/src/engines/rpg/fixtures/pepper-village.rpg'), 'utf8');

async function open(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  const platform = createFakePlatform({ token: 'docs' });
  const saved = platform.addGame({ title: 'Pepper Village', data: village, engine: 'rpg' });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['docs'], `/index.html?api=/api&engines=rpg&project=${saved.id}`);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Pepper Village');
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
  await page.waitForTimeout(300);
}

test('chili rpg', async ({ page }) => {
  const creator = await open(page);
  await page.waitForTimeout(500);
  await shot(page, 'rpg-workspace');

  for (const [title, name] of [
    ['Rooms', 'rpg-rooms'],
    ['Art', 'rpg-art'],
    ['Tiles', 'rpg-tiles'],
    ['Game', 'rpg-game'],
    ['Problems', 'rpg-problems'],
  ] as const) {
    await tool(creator, title);
    await shot(group(creator, title), name);
  }

  // Place mode, with the warp to the cave picked.
  await tool(creator, 'Rooms');
  await creator.getByRole('radio', { name: 'Place' }).click();
  const room = creator.getByRole('application', { name: /^Room village/ });
  const box = (await room.boundingBox())!;
  await page.mouse.click(box.x + (18.5 * box.width) / 24, box.y + (12.5 * box.height) / 18);
  await shot(group(creator, 'Rooms'), 'rpg-rooms-place');

  // Play: walk into Elder Ana.
  await tool(creator, 'Play');
  await creator.getByRole('button', { name: 'Play game' }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowUp']) await hold(page, key);
  await page.waitForTimeout(1500);
  await shot(group(creator, 'Play'), 'rpg-play');
  await creator.getByRole('button', { name: 'Stop' }).click();
});
