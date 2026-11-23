import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { createFakePlatform } from '../../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from '../../e2e/fake-platform';

// Chili RPG screenshots for docs/editors/rpg/. Pepper Village, the example game from
// chili-chip/chili-game-sdk, is open. Run with: npm run docs:screenshots

const out = join(__dirname, '../../docs/assets/screenshots');
const fixture = (name: string) => readFileSync(join(__dirname, `../../app/src/engines/rpg/fixtures/${name}.rpg`), 'utf8');

async function open(page: Page, title = 'Pepper Village', data = fixture('pepper-village')) {
  await page.setViewportSize({ width: 1280, height: 800 });
  const platform = createFakePlatform({ token: 'docs' });
  const saved = platform.addGame({ title, data, engine: 'rpg' });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['docs'], `/index.html?api=/api&engines=rpg&project=${saved.id}`);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue(title);
  return creator;
}

/** Plays the game in Play and presses `keys`, then shoots the game screen. */
async function play(page: Page, creator: FrameLocator, keys: string[], name: string) {
  // A tall window shows the whole screen.
  await page.setViewportSize({ width: 1280, height: 1300 });
  await tool(creator, 'Play');
  await creator.getByRole('button', { name: 'Play game' }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  for (const key of keys) await hold(page, key);
  await page.waitForTimeout(1500);
  await shot(creator.locator('canvas[aria-label^="Game screen"]'), name);
  await creator.getByRole('button', { name: 'Stop' }).click();
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
    ['Hero', 'rpg-hero'],
    ['Characters', 'rpg-characters'],
    ['Items', 'rpg-items'],
    ['Dialogue', 'rpg-dialogue'],
    ['Quests', 'rpg-quests'],
    ['Game', 'rpg-game'],
    ['Problems', 'rpg-problems'],
  ] as const) {
    await tool(creator, title);
    await shot(group(creator, title), name);
  }

  // An event form: the cave door opens with the key.
  await tool(creator, 'Characters');
  await creator.getByRole('list', { name: 'Characters' }).getByRole('button', { name: 'Door', exact: true }).click();
  const event = creator.getByRole('group', { name: 'When you walk into it' });
  await event.scrollIntoViewIfNeeded();
  await shot(event, 'rpg-event');

  // Place mode, with the warp to the cave picked.
  await tool(creator, 'Rooms');
  await creator.getByRole('radio', { name: 'Place' }).click();
  const room = creator.getByRole('application', { name: /^Room village/ });
  const box = (await room.boundingBox())!;
  await page.mouse.click(box.x + (18.5 * box.width) / 24, box.y + (12.5 * box.height) / 18);
  await shot(group(creator, 'Rooms'), 'rpg-rooms-place');

  // Play: walk into Elder Ana.
  await play(page, creator, ['ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowUp'], 'rpg-play');
});

test('chili rpg tutorial', async ({ page }) => {
  // Lost Ring, the game docs/editors/rpg/tutorial.md builds: walk into Gran.
  const creator = await open(page, 'Lost Ring', fixture('lost-ring'));
  await play(page, creator, ['ArrowUp', 'ArrowUp', 'ArrowUp'], 'rpg-tutorial');
});
