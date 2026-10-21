import { expect, test, type FrameLocator, type Locator } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';

/** Presses the pointer down on cell (x, y) of a canvas split into `cells` × `cells`, drags through `path`, and lets go. */
async function stroke(canvas: Locator, cells: number, path: [number, number][]) {
  const box = (await canvas.boundingBox())!;
  const at = ([x, y]: [number, number]) => [box.x + ((x + 0.5) * box.width) / cells, box.y + ((y + 0.5) * box.height) / cells] as const;
  const page = canvas.page();
  await page.mouse.move(...at(path[0]!));
  await page.mouse.down();
  for (const cell of path.slice(1)) await page.mouse.move(...at(cell), { steps: 2 });
  await page.mouse.up();
}

/** How many pixels of the game screen are not black. */
async function litPixels(canvas: Locator): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! + data[i + 1]! + data[i + 2]! > 0) lit++;
    return lit;
  });
}

async function newGame(page: import('@playwright/test').Page) {
  const platform = await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator: FrameLocator = await openInFakePlatform(page, ['host-token']);
  await creator.getByRole('button', { name: 'New game' }).click();
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');
  return { platform, creator };
}

test('a new game: paint a sprite, place it in the room, play it, and it is saved', async ({ page }) => {
  const { platform, creator } = await newGame(page);

  // The room is in front once the game is open.
  const room = creator.getByRole('application', { name: 'Room example room' });
  await expect(room).toBeVisible();

  // Make a sprite and paint a line across it.
  await creator.getByRole('button', { name: 'New sprite' }).click();
  const drawing = creator.getByRole('application', { name: 'Drawing sprite b' });
  await expect(drawing).toBeVisible();
  await stroke(drawing, 8, [
    [1, 4],
    [6, 4],
  ]);

  // Put it in the room.
  await stroke(room, 16, [[10, 10]]);
  await expect(creator.getByText('Click to move sprite b')).toBeVisible();

  await expect.poll(() => platform.games[0]!.data, { timeout: 10_000 }).toContain('POS 0 10,10');
  const data = platform.games[0]!.data;
  expect(data).toMatch(/SPR b\n(?:0{8}\n){4}01111110\n(?:0{8}\n){3}POS 0 10,10\n/);
  await expect(creator.getByRole('status', { name: 'Save state' })).toContainText('Saved');

  // It plays in citsy.
  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Play' }).click();
  await creator.getByRole('button', { name: 'Play game' }).click();
  const screen = creator.getByRole('application', { name: 'Game screen' });
  await expect.poll(() => litPixels(screen.locator('canvas')), { timeout: 10_000 }).toBeGreaterThan(1000);
});

test('undo and redo take back a whole stroke and bring it back', async ({ page }) => {
  const { platform, creator } = await newGame(page);
  const room = creator.getByRole('application', { name: 'Room example room' });
  await expect(room).toBeVisible();
  await creator.getByRole('radio', { name: 'Tiles' }).click();
  await creator.getByRole('button', { name: 'block' }).click();
  await stroke(room, 16, [
    [3, 3],
    [6, 3],
  ]);
  await expect.poll(() => platform.games[0]!.data).toContain('0,a,0,a,a,a,a,0,0,0,0,0,0,0,a,0');

  await creator.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => platform.games[0]!.data).toContain('0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0\n0,a,0,0,0,0,0,0,0,0,0,0,0,0,a,0\n0,a,0,0,0,0,0,0');

  await room.focus();
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => platform.games[0]!.data).toContain('0,a,0,a,a,a,a,0,0,0,0,0,0,0,a,0');
});
