import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';

// The game is 128×128, so the Play screen must stay square whatever shape the
// panel has, and fit in it without scrolling (#40).

async function openPlay(page: Page): Promise<FrameLocator> {
  const platform = createFakePlatform({ token: 'host-token' });
  const game = platform.addGame({ title: 'Square', data: 'Square\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n' });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['host-token'], `/index.html?api=/api&project=${game.id}`);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Square');
  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Play' }).click();
  await expect(creator.getByRole('application', { name: 'Game screen' })).toBeVisible();
  return creator;
}

async function expectSquareAndFitting(creator: FrameLocator) {
  const screen = creator.getByRole('application', { name: 'Game screen' });
  await expect(async () => {
    const box = (await screen.boundingBox())!;
    expect(box.width).toBeGreaterThan(40);
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    // The panel around the screen does not scroll just to show it.
    const panel = await screen.evaluate((element) => {
      const scroller = element.closest('[data-play-panel]') as HTMLElement;
      const own = element.getBoundingClientRect();
      const outer = scroller.getBoundingClientRect();
      return {
        scrolls: scroller.scrollHeight > scroller.clientHeight + 1,
        inside: own.top >= outer.top - 1 && own.bottom <= outer.bottom + 1 && own.left >= outer.left - 1 && own.right <= outer.right + 1,
      };
    });
    expect(panel.scrolls).toBe(false);
    expect(panel.inside).toBe(true);
    // The canvas cannot stretch the picture even if its box were not square.
    expect(await screen.locator('canvas').evaluate((c) => getComputedStyle(c).objectFit)).toBe('contain');
  }).toPass({ timeout: 5_000 });
}

test('the game screen stays square in a wide, short window', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has a fixed viewport');
  await page.setViewportSize({ width: 1400, height: 520 });
  const creator = await openPlay(page);
  await expectSquareAndFitting(creator);
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
  await expectSquareAndFitting(creator);
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
