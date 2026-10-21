import { readFileSync } from 'node:fs';
import { expect, test, type Download } from '@playwright/test';
import { litPixels, newGame } from './helpers';

const read = async (download: Download) => readFileSync((await download.path())!);

test('export: the game downloads as .bitsy, as a web page that plays it, and as a GIF', async ({ page }) => {
  const { platform, creator } = await newGame(page);
  const tools = creator.getByRole('navigation', { name: 'Tools' });
  await creator.getByRole('textbox', { name: 'Game title' }).fill('Tea time');
  await expect.poll(() => platform.games[0]!.title).toBe('Tea time');

  await tools.getByRole('button', { name: 'Download' }).click();
  const [bitsy] = await Promise.all([page.waitForEvent('download'), creator.getByRole('button', { name: 'Download .bitsy' }).click()]);
  expect(bitsy.suggestedFilename()).toBe('Tea time.bitsy');
  expect((await read(bitsy)).toString('utf8')).toBe(platform.games[0]!.data);

  await creator.getByRole('combobox', { name: 'Size' }).selectOption('512');
  const [web] = await Promise.all([page.waitForEvent('download'), creator.getByRole('button', { name: 'Download web page' }).click()]);
  expect(web.suggestedFilename()).toBe('Tea time.html');
  const html = (await read(web)).toString('utf8');

  // The page plays the game on its own, with nothing else loaded.
  const game = await page.context().newPage();
  await game.setContent(html);
  await expect(game).toHaveTitle('Tea time');
  await expect.poll(() => litPixels(game.locator('#game')), { timeout: 10_000 }).toBeGreaterThan(500);
  await game.close();

  // Record a GIF while playing.
  await tools.getByRole('button', { name: 'Play' }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();
  await expect.poll(() => litPixels(creator.getByRole('application', { name: 'Game screen' }).locator('canvas')), { timeout: 10_000 }).toBeGreaterThan(500);
  await creator.getByRole('button', { name: 'Record GIF' }).click();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const [gif] = await Promise.all([page.waitForEvent('download'), creator.getByRole('button', { name: 'Stop recording' }).click()]);
  expect(gif.suggestedFilename()).toBe('Tea time.gif');
  expect((await read(gif)).subarray(0, 6).toString('latin1')).toBe('GIF89a');

  // The web page imports back as a new game.
  await tools.getByRole('button', { name: 'Projects' }).click();
  await creator.getByLabel('Import a game').setInputFiles({ name: 'Tea time.html', mimeType: 'text/html', buffer: Buffer.from(html) });
  await expect.poll(() => platform.games.length).toBe(2);
  expect(platform.games[1]!.title).toBe('Tea time');
  expect(platform.games[1]!.data).toBe(platform.games[0]!.data);
});
