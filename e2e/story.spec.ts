import { expect, test } from '@playwright/test';
import { litPixels, newGame, stroke } from './helpers';

test('a story: dialog with a variable, an exit to a new room, an ending, and it is saved and plays', async ({ page }) => {
  const { platform, creator } = await newGame(page);
  const tools = creator.getByRole('navigation', { name: 'Tools' });
  const room = creator.getByRole('application', { name: 'Room example room' });
  await expect(room).toBeVisible();

  // The cat counts how often it was talked to.
  await creator.getByRole('button', { name: 'cat', exact: true }).click();
  await tools.getByRole('button', { name: 'Dialog' }).click();
  const text = creator.getByRole('textbox', { name: 'Dialog text' });
  await expect(text).toHaveValue("I'm a cat");
  await text.fill('{a = a + 1}meow number {say a}');

  // A second room, and an exit into it.
  await creator.getByRole('button', { name: 'New room' }).click();
  await creator.getByRole('combobox', { name: 'Room' }).selectOption({ label: 'example room' });
  await creator.getByRole('radio', { name: 'Exit' }).click();
  await stroke(room, 16, [[13, 8]]);

  // An ending with its own text.
  await creator.getByRole('radio', { name: 'Ending' }).click();
  await stroke(room, 16, [[2, 2]]);
  await tools.getByRole('button', { name: 'Exits & endings' }).click();
  await creator.getByRole('textbox', { name: 'Ending text' }).fill('You found the way out');

  // Another variable.
  await tools.getByRole('button', { name: 'Variables' }).click();
  await creator.getByRole('button', { name: 'New variable' }).click();

  await expect(creator.getByRole('button', { name: 'Problems: none' })).toBeVisible();
  await expect.poll(() => platform.games[0]!.data, { timeout: 10_000 }).toContain('DLG 3\nYou found the way out');
  const data = platform.games[0]!.data;
  expect(data).toContain('DLG 0\n{a = a + 1}meow number {say a}');
  expect(data).toContain('EXT 13,8 1 13,8');
  expect(data).toContain('END 3 2,2');
  expect(data).toContain('VAR b\n0');
  await expect(creator.getByRole('status', { name: 'Save state' })).toContainText('Saved');

  await tools.getByRole('button', { name: 'Play' }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();
  const screen = creator.getByRole('application', { name: 'Game screen' });
  await expect.poll(() => litPixels(screen.locator('canvas')), { timeout: 10_000 }).toBeGreaterThan(1000);
});

test('a broken reference shows up as a problem that leads to it', async ({ page }) => {
  const { creator } = await newGame(page);
  const tools = creator.getByRole('navigation', { name: 'Tools' });
  await creator.getByRole('button', { name: 'cat', exact: true }).click();
  await tools.getByRole('button', { name: 'Dialog' }).click();
  await creator.getByRole('textbox', { name: 'Dialog text' }).fill('{exit "attic" 1 1}');

  await creator.getByRole('button', { name: 'Problems: 1 error, 1 warning' }).click();
  const problem = creator.getByRole('button', { name: 'cat dialog exits to room "attic", which does not exist.' });
  await expect(problem).toBeVisible();

  // Going to it shows the dialog.
  await tools.getByRole('button', { name: 'Library' }).click();
  await creator.getByRole('button', { name: 'avatar', exact: true }).click();
  await tools.getByRole('button', { name: 'Problems' }).click();
  await problem.click();
  await expect(creator.getByRole('textbox', { name: 'Dialog text' })).toHaveValue('{exit "attic" 1 1}');
});
