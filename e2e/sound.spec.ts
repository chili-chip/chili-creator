import { expect, test } from '@playwright/test';
import { newGame } from './helpers';

test('sound: write a tune for the room, give the cat a new blip, and it is saved', async ({ page }) => {
  const { platform, creator } = await newGame(page);
  const tools = creator.getByRole('navigation', { name: 'Tools' });

  // A new tune: draw a long C, then a G, and play it in the room.
  await tools.getByRole('button', { name: 'Tunes' }).click();
  await creator.getByRole('button', { name: 'New tune' }).click();
  const staff = creator.getByRole('grid', { name: 'Melody, bar 1' });
  const c1 = staff.getByRole('gridcell', { name: 'C at beat 1.1', exact: true });
  const c3 = staff.getByRole('gridcell', { name: 'C at beat 1.3', exact: true });
  await c1.hover();
  await page.mouse.down();
  await c3.hover();
  await page.mouse.up();
  await staff.getByRole('gridcell', { name: 'G at beat 2.1', exact: true }).click();
  await expect(c3).toHaveAttribute('aria-selected', 'true');
  await creator.getByRole('button', { name: 'Play tune' }).click();
  await expect(creator.getByRole('button', { name: 'Stop' })).toBeVisible();
  await creator.getByRole('button', { name: 'Stop' }).click();

  await tools.getByRole('button', { name: 'Room' }).click();
  await creator.getByRole('combobox', { name: 'Music' }).selectOption({ label: 'tune 4' });

  // A new bloop for the cat.
  await tools.getByRole('button', { name: 'Blips' }).click();
  await creator.getByRole('combobox', { name: 'Kind' }).selectOption('bloop');
  await creator.getByRole('button', { name: 'New blip' }).click();
  await creator.getByRole('button', { name: 'cat', exact: true }).click();
  await tools.getByRole('button', { name: 'Paint' }).click();
  await creator.getByRole('combobox', { name: 'Sound' }).selectOption({ label: 'bloop 3' });

  await expect.poll(() => platform.games[0]!.data, { timeout: 10_000 }).toContain('BLIP 3\n');
  const data = platform.games[0]!.data;
  expect(data).toContain('TUNE 4\n3d,0,0,0,s,0,0,0,0,0,0,0,0,0,0,0\n');
  expect(data).toMatch(/ROOM 0[\s\S]*TUNE 4\n/);
  expect(data).toMatch(/SPR a[\s\S]*BLIP 3\n/);
  await expect(creator.getByRole('status', { name: 'Save state' })).toContainText('Saved');
});
