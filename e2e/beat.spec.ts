import { expect, test, type Page } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';
import { stroke } from './helpers';

/** Holds a key for a few frames, so the game sees it. */
async function hold(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}

test('makes a Chili Beat game from Blank, adds a rule and wins it', async ({ page }, info) => {
  // The rule trace needs Rules and Play side by side, which a phone can't show.
  test.skip(info.project.name === 'phone');
  await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator = await openInFakePlatform(page, ['host-token'], '/index.html?api=/api&engine=beat');
  await creator.getByRole('button', { name: 'New game' }).click();
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');

  const tools = creator.getByRole('navigation', { name: 'Tools' });
  await tools.getByRole('button', { name: 'Rules', exact: true }).click();
  await creator.getByRole('button', { name: 'Add rule' }).click();
  const card = creator.getByRole('listitem', { name: 'Rule 2' });
  await card.getByRole('combobox', { name: 'Trigger' }).selectOption('bump');
  await card.getByRole('combobox', { name: 'Bumped' }).selectOption('#');
  await card.getByRole('combobox', { name: 'Action' }).selectOption('win');

  await tools.getByRole('button', { name: 'Play', exact: true }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();

  // Walk left into the wall: the win card lights up.
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  await expect(async () => {
    await hold(page, 'ArrowLeft');
    await expect(card).toHaveAttribute('data-lit', 'true', { timeout: 300 });
  }).toPass({ timeout: 15_000 });
});

test('builds a game from Blank with a recipe: paint the flag, walk into it, win', async ({ page }, info) => {
  test.skip(info.project.name === 'phone');
  await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator = await openInFakePlatform(page, ['host-token'], '/index.html?api=/api&engine=beat');
  await creator.getByRole('button', { name: 'New game' }).click();
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');

  const tools = creator.getByRole('navigation', { name: 'Tools' });
  await tools.getByRole('button', { name: 'Rules', exact: true }).click();
  await creator.getByRole('combobox', { name: 'Add a recipe' }).selectOption('goal');
  await expect(creator.getByRole('listitem', { name: 'Rule 2' })).toBeVisible();

  // The hero starts at (7, 7); put the flag just left of it.
  await tools.getByRole('button', { name: 'Screens', exact: true }).click();
  await creator.getByRole('radiogroup', { name: 'Brush' }).getByRole('radio', { name: 'Flag' }).click();
  await stroke(creator.getByRole('application', { name: /^Screen start/ }), 16, [[6, 7]]);

  await tools.getByRole('button', { name: 'Rules', exact: true }).click();
  await tools.getByRole('button', { name: 'Play', exact: true }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  const goal = creator.getByRole('listitem', { name: 'Rule 2' });
  await expect(async () => {
    await hold(page, 'ArrowLeft');
    await expect(goal).toHaveAttribute('data-lit', 'true', { timeout: 300 });
  }).toPass({ timeout: 15_000 });
});

test('the creator starts on the engine choice; picking Chili Beat lists only its games', async ({ page }) => {
  const platform = createFakePlatform({ token: 'host-token' });
  platform.addGame({ title: 'A Bitsy game' });
  platform.addGame({ title: 'A Beat game', data: '{"format": "chili-beat", "version": 1}', engine: 'beat' });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['host-token'], '/index.html?api=/api');
  const choice = creator.getByRole('region', { name: 'Pick an editor' });
  await choice.getByRole('button', { name: /^Chili Beat/ }).click();
  const list = creator.getByRole('list', { name: 'Projects' });
  await expect(list.getByText('A Beat game')).toBeVisible();
  await expect(list.getByText('A Bitsy game')).toHaveCount(0);
  await creator.getByRole('button', { name: 'Change editor' }).click();
  await choice.getByRole('button', { name: /^Bitsy/ }).click();
  await expect(creator.getByRole('list', { name: 'Projects' }).getByText('A Bitsy game')).toBeVisible();
});
