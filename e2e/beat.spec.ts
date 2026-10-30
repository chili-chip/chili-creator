import { expect, test, type Page } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';

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
  const creator = await openInFakePlatform(page, ['host-token'], '/index.html?api=/api&engines=beat');
  await creator.getByRole('button', { name: 'New game' }).click();
  await creator.getByRole('group', { name: 'Pick an engine' }).getByRole('button', { name: /Chili Beat/ }).click();
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');

  const tools = creator.getByRole('navigation', { name: 'Tools' });
  await tools.getByRole('button', { name: 'Rules', exact: true }).click();
  await creator.getByRole('button', { name: 'Add rule' }).click();
  const card = creator.getByRole('listitem', { name: 'Rule 2' });
  await card.getByRole('combobox', { name: 'Trigger' }).selectOption('bump');
  await card.getByRole('combobox', { name: 'Bumped' }).selectOption('#');
  await card.getByRole('combobox', { name: 'Action' }).selectOption('win');

  await tools.getByRole('button', { name: 'Play', exact: true }).click();
  await creator.getByRole('button', { name: 'Play', exact: true }).click();
  await creator.getByRole('button', { name: 'Stop' }).waitFor();

  // Walk left into the wall: the win card lights up.
  await creator.locator('canvas[aria-label^="Game screen"]').focus();
  await expect(async () => {
    await hold(page, 'ArrowLeft');
    await expect(card).toHaveAttribute('data-lit', 'true', { timeout: 300 });
  }).toPass({ timeout: 15_000 });
});
