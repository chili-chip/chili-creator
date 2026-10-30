import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, servePlatform } from './fake-platform';

/** Presses the pointer down on cell (x, y) of a canvas split into `cells` × `cells`, drags through `path`, and lets go. */
export async function stroke(canvas: Locator, cells: number, path: [number, number][]) {
  const box = (await canvas.boundingBox())!;
  const at = ([x, y]: [number, number]) => [box.x + ((x + 0.5) * box.width) / cells, box.y + ((y + 0.5) * box.height) / cells] as const;
  const page = canvas.page();
  await page.mouse.move(...at(path[0]!));
  await page.mouse.down();
  for (const cell of path.slice(1)) await page.mouse.move(...at(cell), { steps: 2 });
  await page.mouse.up();
}

/** How many pixels of the game screen are not black. */
export async function litPixels(canvas: Locator): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! + data[i + 1]! + data[i + 2]! > 0) lit++;
    return lit;
  });
}

/** Presses New game and picks the Bitsy engine. */
export async function newBitsyGame(creator: FrameLocator | Page) {
  await creator.getByRole('button', { name: 'New game' }).click();
  await creator.getByRole('group', { name: 'Pick an engine' }).getByRole('button', { name: /^Bitsy/ }).click();
}

export async function newGame(page: Page) {
  const platform = await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator: FrameLocator = await openInFakePlatform(page, ['host-token']);
  await newBitsyGame(creator);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');
  return { platform, creator };
}
