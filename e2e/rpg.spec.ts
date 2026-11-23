import { expect, test, type Page } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';
import { stroke } from './helpers';

/** Holds a key for a few frames, so the game sees it. */
async function hold(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
}

test('makes a Chili RPG game from Blank, paints a wall and walks into it', async ({ page }) => {
  await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator = await openInFakePlatform(page, ['host-token'], '/index.html?api=/api&engines=rpg&engine=rpg');
  await creator.getByRole('button', { name: 'New game' }).click();
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');

  // The hero starts at 7, 7; put a wall just left of it.
  const tools = creator.getByRole('navigation', { name: 'Tools' });
  await tools.getByRole('button', { name: 'Rooms', exact: true }).click();
  await creator.getByRole('radiogroup', { name: 'Brush' }).getByRole('radio', { name: 'Tile #' }).click();
  await stroke(creator.getByRole('application', { name: /^Room start/ }), 16, [[6, 7]]);

  await tools.getByRole('button', { name: 'Play', exact: true }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  const state = creator.getByLabel('Game state');
  await expect(state).toContainText('start 7, 7');
  await hold(page, 'ArrowLeft');
  await expect(state).toContainText('start 7, 7');
  await hold(page, 'ArrowRight');
  await expect(state).toContainText('start 8, 7');
});
