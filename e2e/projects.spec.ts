import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type FrameLocator, type Locator } from '@playwright/test';
import { createFakePlatform } from '../app/src/chili-api/fake-platform';
import { openInFakePlatform, received, servePlatform } from './fake-platform';
import { newBitsyGame } from './helpers';

const defaultGame = readFileSync(join(__dirname, '../app/src/bitsy/fixtures/editor-default.bitsy'), 'utf8');

/** How many pixels of the game screen are not black. */
async function litPixels(canvas: Locator): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! + data[i + 1]! + data[i + 2]! > 0) lit++;
    return lit;
  });
}

/** Play opens as a tab behind Paint; the launcher brings it to the front. */
export async function showPlay(creator: FrameLocator | import('@playwright/test').Page) {
  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Play' }).click();
}

async function playPanel(creator: FrameLocator | import('@playwright/test').Page) {
  const panel = creator.getByRole('application', { name: 'Game screen' });
  await expect(panel).toBeVisible();
  return panel;
}

test('inside the platform, a saved game opens from the URL, plays in citsy and autosaves', async ({ page }) => {
  const platform = createFakePlatform({ token: 'host-token' });
  const game = platform.addGame({ title: 'Old title', data: defaultGame });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['host-token'], `/index.html?api=/api&project=${game.id}`);

  const title = creator.getByRole('textbox', { name: 'Game title' });
  await expect(title).toHaveValue("Write your game's title here");
  expect(await received(page)).toContainEqual({ type: 'chili-project', id: String(game.id), v: 2 });

  await showPlay(creator);
  await creator.getByRole('button', { name: 'Play game' }).click();
  const screen = await playPanel(creator);
  await expect.poll(() => litPixels(screen.locator('canvas')), { timeout: 10_000 }).toBeGreaterThan(1000);
  await expect(creator.getByRole('alert').filter({ hasText: /\w/ })).toHaveCount(0);

  await title.fill('Tea time');
  await expect.poll(() => platform.games[0]!.title).toBe('Tea time');
  expect(platform.games[0]!.data).toBe(defaultGame.replace("Write your game's title here", 'Tea time'));
  await expect(creator.getByRole('status', { name: 'Save state' })).toContainText('Saved');
  const states = (await received<{ type: string; state?: string }>(page)).filter((m) => m.type === 'chili-save-state');
  expect(states.at(-1)).toMatchObject({ state: 'saved', unsaved: false });
});

test('a new game starts on the platform and is listed', async ({ page }) => {
  const platform = await servePlatform(page, createFakePlatform({ token: 'host-token' }));
  const creator = await openInFakePlatform(page, ['host-token']);
  await expect(creator.getByText('0 of 30 games')).toBeVisible();
  await newBitsyGame(creator);
  await expect(creator.getByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');
  // The new game's room comes to the front; the dashboard lists it.
  await expect(creator.getByRole('application', { name: 'Room example room' })).toBeVisible();
  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Projects' }).click();
  await expect(creator.getByRole('list', { name: 'Projects' }).getByText('Untitled game')).toBeVisible();
  expect(platform.games).toHaveLength(1);
  expect(await received(page)).toContainEqual({ type: 'chili-project', id: String(platform.games[0]!.id), v: 2 });
});

test('a project is released from the creator, and its game page opens on the platform', async ({ page }) => {
  const platform = createFakePlatform({ token: 'host-token' });
  const game = platform.addGame({ title: 'Mossland', data: defaultGame });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['host-token']);
  await creator.getByRole('button', { name: 'Release Mossland' }).click();
  await creator.getByRole('button', { name: 'Release it' }).click();
  await expect(creator.getByRole('list', { name: 'Released games' }).getByText('Mossland')).toBeVisible();
  expect(platform.games[0]!.released).toBe(true);
  expect(await received(page)).toContainEqual({ type: 'chili-released', id: String(game.id), slug: 'mossland', v: 2 });

  await creator.getByRole('button', { name: 'Game page for Mossland' }).click();
  await expect.poll(() => received(page)).toContainEqual({ type: 'chili-navigate', to: `/games/${game.id}`, v: 2 });
});

test('edits to a released game wait for Publish update before buyers get them (#38)', async ({ page }) => {
  const platform = createFakePlatform({ token: 'host-token' });
  const game = platform.addGame({ title: 'Mossland', data: defaultGame, released: true });
  await servePlatform(page, platform);
  const creator = await openInFakePlatform(page, ['host-token'], `/index.html?api=/api&project=${game.id}`);

  await creator.getByRole('textbox', { name: 'Game title' }).fill('Mossland 2');
  await expect.poll(() => platform.games[0]!.title).toBe('Mossland 2');
  expect(platform.releaseOf(game.id)).toMatchObject({ number: 1, title: 'Mossland' });

  await creator.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Projects' }).click();
  const released = creator.getByRole('list', { name: 'Released games' });
  await expect(released.getByRole('listitem')).toHaveCount(1);
  await expect(creator.getByRole('list', { name: 'Projects' }).getByRole('listitem')).toHaveCount(0);
  await expect(released).toContainText('Release 1 · unpublished changes');
  await creator.getByRole('button', { name: 'Publish update for Mossland 2' }).click();
  await creator.getByRole('button', { name: 'Publish it' }).click();
  await expect(released).toContainText('Release 2');
  await expect(released).not.toContainText('unpublished changes');
  expect(platform.releaseOf(game.id)).toMatchObject({ number: 2, title: 'Mossland 2' });
  expect(await received(page)).toContainEqual({ type: 'chili-released', id: String(game.id), slug: 'mossland', v: 2 });
});

test('signed out, a new game is kept in this browser', async ({ page }) => {
  await page.goto('/index.html?engine=bitsy');
  await expect(page.getByText(/saved in this browser only/)).toBeVisible();
  await newBitsyGame(page);
  const title = page.getByRole('textbox', { name: 'Game title' });
  await expect(title).toHaveValue('Untitled game');
  await title.fill('Kept here');
  await expect(page.getByRole('status', { name: 'Save state' })).toContainText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Open Kept here' }).click();
  await expect(page.getByRole('textbox', { name: 'Game title' })).toHaveValue('Kept here');
  await showPlay(page);
  await page.getByRole('button', { name: 'Play game' }).click();
  const screen = await playPanel(page);
  await expect.poll(() => litPixels(screen.locator('canvas')), { timeout: 10_000 }).toBeGreaterThan(1000);
});
