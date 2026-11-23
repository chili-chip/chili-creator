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

test('makes a one-quest game: find the item, the quest is done, the game is won', async ({ page }) => {
  await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator = await openInFakePlatform(page, ['host-token'], '/index.html?api=/api&engines=rpg&engine=rpg');
  await creator.getByRole('button', { name: 'New game' }).click();
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');
  const tools = creator.getByRole('navigation', { name: 'Tools' });

  await tools.getByRole('button', { name: 'Items', exact: true }).click();
  await creator.getByRole('button', { name: 'Add item' }).click();

  // Stage 1: have the item. When it is done, the game is won.
  await tools.getByRole('button', { name: 'Quests', exact: true }).click();
  await creator.getByRole('button', { name: 'Add quest' }).click();
  await creator.getByRole('combobox', { name: 'Stage 1 goal' }).selectOption('collect');
  const done = creator.getByRole('group', { name: 'When stage 1 is done' });
  await done.getByRole('button', { name: 'Add action' }).click();
  await done.getByRole('combobox', { name: 'When stage 1 is done action 1 type' }).selectOption('end');

  // The hero starts at 7, 7. A trigger at 6, 7 starts the quest; the item lies at 5, 7.
  await tools.getByRole('button', { name: 'Rooms', exact: true }).click();
  await creator.getByRole('radio', { name: 'Place' }).click();
  const room = creator.getByRole('application', { name: /^Room start/ });
  await creator.getByRole('radio', { name: 'Trigger' }).click();
  await stroke(room, 16, [[6, 7]]);
  const trigger = creator.getByRole('group', { name: 'Trigger' });
  await trigger.getByRole('button', { name: 'Add action' }).click();
  await trigger.getByRole('combobox', { name: 'Trigger action 1 type' }).selectOption('quest');
  await creator.getByRole('radio', { name: 'Item Item 1' }).click();
  await stroke(room, 16, [[5, 7]]);
  await expect(creator.getByText('No problems')).toBeVisible();

  await tools.getByRole('button', { name: 'Play', exact: true }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  const state = creator.getByLabel('Game state');
  await hold(page, 'ArrowLeft');
  await expect(state).toContainText('quest-1 stage 1');
  await hold(page, 'ArrowLeft');
  await hold(page, 'KeyZ');
  await hold(page, 'KeyX');
  await expect(state).toContainText('won');
});
