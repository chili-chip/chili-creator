import { readFileSync } from 'node:fs';
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';

// The game is 128×128, so the Play screen must stay square whatever shape the
// panel has, and fit in it without scrolling (#40).

const EMPTY_GAME = 'Square\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n';

async function openPlay(page: Page, data = EMPTY_GAME): Promise<FrameLocator> {
  const platform = createFakePlatform({ token: 'host-token' });
  const game = platform.addGame({ title: 'Square', data });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['host-token'], `/index.html?api=/api&project=${game.id}`);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toBeVisible();
  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Play' }).click();
  await expect(creator.getByRole('application', { name: 'Game screen' })).toBeVisible();
  return creator;
}

// In a panel too short for the toolbar and a 128 px screen, the panel scrolls
// instead of shrinking the game below its own size (`short: true`).
async function expectSquareAndFitting(creator: FrameLocator, { short = false } = {}) {
  const screen = creator.getByRole('application', { name: 'Game screen' });
  await expect(async () => {
    const box = (await screen.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(128);
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    if (short) {
      await screen.scrollIntoViewIfNeeded();
    }
    // When there is room, the panel around the screen does not scroll just to show it.
    const panel = await screen.evaluate((element) => {
      const scroller = element.closest('[data-play-panel]') as HTMLElement;
      const own = element.getBoundingClientRect();
      const outer = scroller.getBoundingClientRect();
      return {
        scrolls: scroller.scrollHeight > scroller.clientHeight + 1,
        inside: own.top >= outer.top - 1 && own.bottom <= outer.bottom + 1 && own.left >= outer.left - 1 && own.right <= outer.right + 1,
      };
    });
    if (!short) expect(panel.scrolls).toBe(false);
    expect(panel.inside).toBe(true);
    // The canvas cannot stretch the picture even if its box were not square.
    expect(await screen.locator('canvas').evaluate((c) => getComputedStyle(c).objectFit)).toBe('contain');
  }).toPass({ timeout: 5_000 });
}

test('the game screen stays square in a wide, short window', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has a fixed viewport');
  await page.setViewportSize({ width: 1400, height: 520 });
  const creator = await openPlay(page);
  await expectSquareAndFitting(creator, { short: true });
});

test('a short panel keeps the game at least its real size and scrolls the rest', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has a fixed viewport');
  // Mossland has an inventory, so the live state table sits under the screen.
  await page.setViewportSize({ width: 1400, height: 520 });
  const creator = await openPlay(page, readFileSync('app/src/bitsy/fixtures/mossland.bitsy', 'utf8'));
  await creator.getByRole('button', { name: 'Play game' }).click();
  const screen = creator.getByRole('application', { name: 'Game screen' });
  await expect(async () => {
    const box = (await screen.boundingBox())!;
    // 128 px is the game's own size: smaller than that is unreadable.
    expect(box.width).toBeGreaterThanOrEqual(128);
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
  }).toPass({ timeout: 5_000 });
  // The inventory is still there, below the screen.
  await expect(creator.getByText('Inventory')).toBeAttached();
});

test('the game screen stays square in a tall, narrow window', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has a fixed viewport');
  await page.setViewportSize({ width: 700, height: 1100 });
  const creator = await openPlay(page);
  await expectSquareAndFitting(creator);
});

test('the game screen stays square when the window changes shape', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has a fixed viewport');
  await page.setViewportSize({ width: 1280, height: 800 });
  const creator = await openPlay(page);
  await expectSquareAndFitting(creator);
  await page.setViewportSize({ width: 1400, height: 480 });
  await expectSquareAndFitting(creator, { short: true });
  await page.setViewportSize({ width: 640, height: 1000 });
  await expectSquareAndFitting(creator);
});

test('on a phone the screen is square and the touch controls stay visible', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only');
  const creator = await openPlay(page);
  const screen = creator.getByRole('application', { name: 'Game screen' });
  const box = (await screen.boundingBox())!;
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
  await expect(creator.getByRole('button', { name: 'Up' })).toBeInViewport();
});
