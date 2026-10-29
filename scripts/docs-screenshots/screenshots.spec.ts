import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { createFakePlatform } from '../../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from '../../e2e/fake-platform';

// Screenshots for the docs (docs/assets/screenshots/), taken from the
// production build with the docs tutorial game open in a stand-in for the
// platform. Run after a UI change: npm run docs:screenshots

const out = join(__dirname, '../../docs/assets/screenshots');
const game = readFileSync(join(__dirname, '../../docs/assets/tutorial/chili-garden.bitsy'), 'utf8');

async function open(page: Page, width: number, height: number, data = game) {
  await page.setViewportSize({ width, height });
  const platform = createFakePlatform({ token: 'docs' });
  const saved = platform.addGame({ title: 'Chili Garden', data });
  platform.addGame({ title: 'Tea time', data: game.replace('Chili Garden', 'Tea time') });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['docs'], `/index.html?api=/api&project=${saved.id}`);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Chili Garden');
  return creator;
}

/** Brings a tool to the front from the tool bar. */
async function tool(creator: FrameLocator, title: string) {
  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: title, exact: true }).click();
}

/** The docked group whose tab in front is `title`. */
function group(creator: FrameLocator, title: string): Locator {
  return creator.locator('.dv-groupview').filter({ has: creator.locator('.dv-active-tab', { hasText: title }) }).first();
}

/** Drags a dockview sash by its middle to (x, y). */
async function drag(page: Page, sash: Locator, x: number | null, y: number | null) {
  const box = (await sash.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(x ?? from.x, y ?? from.y, { steps: 5 });
  await page.mouse.up();
}

/** Saves a screenshot of the page or one panel; `height` cuts a panel's empty bottom off. */
/** Holds a key long enough for the game to see it. */
async function hold(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(150);
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
}

async function shot(target: Page | Locator, name: string, height?: number) {
  const page = 'page' in target && typeof target.page === 'function' ? target.page() : (target as Page);
  await page.waitForTimeout(250);
  const options = { path: join(out, `${name}.png`), animations: 'disabled', caret: 'hide' } as const;
  if (height === undefined || target === page) {
    await target.screenshot(options);
    return;
  }
  const box = (await (target as Locator).boundingBox())!;
  await page.screenshot({ ...options, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(height, box.height) } });
}

test('desktop', async ({ page }) => {
  const creator = await open(page, 1280, 800);
  await page.waitForTimeout(500);
  await shot(page, 'workspace');

  await creator.getByRole('button', { name: 'Commands' }).click();
  await shot(page, 'command-palette');
  await page.keyboard.press('Escape');

  await creator.getByRole('button', { name: 'Help', exact: true }).click();
  await shot(page, 'help');
  await page.keyboard.press('Escape');

  await creator.getByRole('combobox', { name: 'Layout' }).selectOption({ label: 'Drawing' });
  await shot(page, 'layout-drawing');
  await creator.getByRole('combobox', { name: 'Layout' }).selectOption({ label: 'Everything' });

  // Bigger panels for one tool at a time: the right column wide, its top group tall.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(300);
  const sashes = creator.locator('.dv-sash');
  await drag(page, sashes.nth(0), 620, null);
  await drag(page, sashes.nth(1), null, 940);

  await tool(creator, 'Projects');
  await shot(group(creator, 'Projects'), 'tool-projects', 360);
  await creator.getByRole('button', { name: 'Release Chili Garden' }).click();
  await shot(group(creator, 'Projects'), 'release-confirm', 470);
  await creator.getByRole('button', { name: 'Not yet' }).click();

  await tool(creator, 'Room');
  await shot(group(creator, 'Room'), 'tool-room');
  await creator.getByRole('radio', { name: 'Exit' }).click();
  await shot(group(creator, 'Room'), 'room-exit-tool');
  await creator.getByRole('radio', { name: 'Place' }).click();

  await tool(creator, 'Library');
  await creator.getByRole('radio', { name: 'Sprites' }).click();
  await creator.getByRole('button', { name: 'gardener', exact: true }).click();
  await tool(creator, 'Paint');
  await shot(group(creator, 'Paint'), 'tool-paint', 470);

  await tool(creator, 'Dialog');
  await shot(group(creator, 'Dialog'), 'tool-dialog', 400);
  await creator.getByRole('radio', { name: 'Blocks' }).click();
  await shot(group(creator, 'Dialog'), 'dialog-blocks');
  await creator.getByRole('radio', { name: 'Text' }).click();

  await tool(creator, 'Exits & endings');
  await creator.getByRole('button', { name: /Exit at 8,0/ }).click();
  await shot(group(creator, 'Exits & endings'), 'tool-exits');

  for (const [title, name, height] of [
    ['Variables', 'tool-variables', 270],
    ['Tunes', 'tool-tunes', undefined],
    ['Blips', 'tool-blips', 560],
    ['Game', 'tool-game', 450],
    ['Download', 'tool-download', 430],
  ] as const) {
    await tool(creator, title);
    await shot(group(creator, title), name, height);
  }

  await tool(creator, 'Play');
  await creator.getByRole('button', { name: 'Play game' }).click();
  const screen = creator.getByRole('application', { name: 'Game screen' });
  await page.waitForTimeout(1500);
  await screen.focus();
  // Past the title, then up to the gardener and talk.
  await hold(page, 'Space');
  for (let i = 0; i < 7; i++) await hold(page, 'ArrowUp');
  await page.waitForTimeout(1500);
  await shot(group(creator, 'Play'), 'tool-play');
  await shot(screen.locator('canvas'), 'game-gardener');

  // The library sits under the tall group: give it the room instead.
  await drag(page, sashes.nth(1), null, 160);
  await tool(creator, 'Library');
  await creator.getByRole('radio', { name: 'Items' }).click();
  await shot(group(creator, 'Library'), 'tool-library');
  await tool(creator, 'Colors');
  await shot(group(creator, 'Colors'), 'tool-colors');
  await tool(creator, 'Find');
  await creator.getByLabel('Find in game').fill('chili');
  await shot(group(creator, 'Find'), 'tool-find');
});

test('problems', async ({ page }) => {
  // The ending loses its text and the gardener gives an item that is gone.
  const broken = game.replace(/\nDLG 4\n[^\n]*\nNAME ending\n/, '\n').replace('ITM 0 6,13', 'ITM 7 6,13');
  const creator = await open(page, 1280, 800, broken);
  await tool(creator, 'Problems');
  await shot(group(creator, 'Problems'), 'tool-problems', 220);
});

test.describe('first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('tour', async ({ page }) => {
    await open(page, 1280, 800);
    await page.waitForTimeout(500);
    await shot(page, 'tour');
  });
});

test.describe('phone', () => {
  test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('room and play', async ({ page }) => {
    const creator = await open(page, 412, 860);
    await tool(creator, 'Room');
    await shot(page, 'phone-room');
    await tool(creator, 'Play');
    await creator.getByRole('button', { name: 'Play game' }).click();
    await page.waitForTimeout(2000);
    await shot(page, 'phone-play');
  });
});
