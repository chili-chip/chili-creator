import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';

// A shop: the coin is one step right of the avatar, the shopkeeper one step left.
const shop = readFileSync(join(__dirname, '../app/src/bitsy/fixtures/state.bitsy'), 'utf8');

/** Holds a key for a few frames, so the game sees it. */
async function hold(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

test('Play shows the inventory and variables change as the game runs', async ({ page }) => {
  const platform = createFakePlatform({ token: 'host-token' });
  const game = platform.addGame({ title: 'Live state', data: shop });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['host-token'], `/index.html?api=/api&project=${game.id}`);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Live state');

  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Play' }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();

  const inventory = creator.getByRole('table', { name: 'Inventory' });
  const variables = creator.getByRole('table', { name: 'Variables' });
  await expect(inventory.getByRole('row', { name: 'coin 0' })).toBeVisible({ timeout: 10_000 });
  await expect(variables.getByRole('row', { name: 'visits 0' })).toBeVisible();

  // Read past the title, then step onto the coin.
  await creator.getByRole('application', { name: 'Game screen' }).focus();
  await expect(async () => {
    await hold(page, ' ');
    await hold(page, 'ArrowRight');
    await expect(inventory.getByRole('row', { name: 'coin 1' })).toBeVisible({ timeout: 300 });
  }).toPass({ timeout: 15_000 });

  // Walk back to the shopkeeper; talking sets a variable.
  await expect(async () => {
    await hold(page, ' ');
    await hold(page, 'ArrowLeft');
    await expect(variables.getByRole('row', { name: 'visits 1' })).toBeVisible({ timeout: 300 });
  }).toPass({ timeout: 15_000 });
});
