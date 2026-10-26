import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createFakePlatform } from '../../chili-api/fake-platform';
import { Button } from '../../player';
import { blankGame, renderCreator } from '../../test/creator';

const saved = vi.hoisted(() => ({ files: [] as { name: string; content: Uint8Array; type: string }[] }));
vi.mock('../../export/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../export/files')>()),
  download: (name: string, content: Uint8Array, type: string) => saved.files.push({ name, content, type }),
}));

const game = (title: string) => `${title}\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n`;

async function withOpenGame(data = game('Mossland')) {
  const platform = createFakePlatform();
  const saved = platform.addGame({ title: 'Mossland', data });
  const view = renderCreator({ platform, initialProject: String(saved.id) });
  await screen.findByRole('textbox', { name: 'Game title' });
  showPlay();
  return { ...view, platform };
}

/** Play opens as a tab behind Paint; the launcher brings it to the front. */
function showPlay() {
  act(() => within(screen.getByRole('navigation', { name: 'Tools' })).getByRole('button', { name: 'Play' }).click());
}

describe('Play', () => {
  it('asks for a game when none is open', async () => {
    renderCreator();
    showPlay();
    expect(await screen.findByText('Open a game to play it.')).toBeInTheDocument();
  });

  it('plays the open game and stops it', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    expect(player.played).toEqual([game('Mossland')]);
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(player.stop).toHaveBeenCalled();
  });

  it('plays the latest edits when restarted', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    const title = screen.getByRole('textbox', { name: 'Game title' });
    await user.clear(title);
    await user.type(title, 'Moss');
    await user.click(screen.getByRole('button', { name: 'Restart' }));
    expect(player.played.at(-1)).toBe(game('Moss'));
  });

  it('sends keys to the game while the screen has focus', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    const screenEl = screen.getByRole('application', { name: 'Game screen' });
    fireEvent.keyDown(screenEl, { key: 'ArrowLeft' });
    fireEvent.keyUp(screenEl, { key: 'ArrowLeft' });
    expect(player.pressed).toEqual([
      [Button.Left, true],
      [Button.Left, false],
    ]);
  });

  it('has touch buttons', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Up' }));
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Up' }));
    expect(player.pressed).toEqual([
      [Button.Up, true],
      [Button.Up, false],
    ]);
  });

  it('shows why a game did not start', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    act(() => player.set({ status: 'error', message: 'bad room' }));
    // Dockview has its own live region, so find the message by its text.
    expect(await screen.findByText('bad room')).toHaveAttribute('role', 'alert');
  });

  it('records a GIF of what is played', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    expect(screen.queryByRole('button', { name: 'Record GIF' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    await user.click(screen.getByRole('button', { name: 'Record GIF' }));
    act(() => player.paint(new Uint8ClampedArray(128 * 128 * 4).fill(200)));
    act(() => player.paint(new Uint8ClampedArray(128 * 128 * 4).fill(50)));
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(saved.files).toHaveLength(1);
    expect(saved.files[0]!.name).toBe('Mossland.gif');
    expect(saved.files[0]!.type).toBe('image/gif');
    expect(String.fromCharCode(...saved.files[0]!.content.slice(0, 6))).toBe('GIF89a');
  });

  it('shows how long a recording has run', async () => {
    const user = userEvent.setup();
    await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    await user.click(screen.getByRole('button', { name: 'Record GIF' }));
    expect(screen.getByRole('progressbar', { name: 'Recording' })).toHaveAttribute('max', '30');
  });

  it('saves a picture of the screen', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    expect(screen.queryByRole('button', { name: 'Save picture' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    act(() => player.paint(new Uint8ClampedArray(128 * 128 * 4).fill(200)));
    await user.click(screen.getByRole('button', { name: 'Save picture' }));
    const file = saved.files.at(-1)!;
    expect(file.name).toBe('Mossland.png');
    expect(file.type).toBe('image/png');
    expect([...file.content.slice(1, 4)]).toEqual([80, 78, 71]);
  });

  it('uses the screen as the game\'s cover', async () => {
    const user = userEvent.setup();
    const { player, platform } = await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    act(() => player.paint(new Uint8ClampedArray(128 * 128 * 4).fill(200)));
    await user.click(screen.getByRole('button', { name: 'Use as cover' }));
    expect(await screen.findByText('Cover set.')).toBeInTheDocument();
    expect(platform.games[0]!.cover).toMatch(/cover\.png$/);
  });

  it('shows the inventory and variables while the game runs', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame(blankGame);
    expect(screen.queryByRole('table', { name: 'Inventory' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    act(() => player.setGameState({ inventory: {}, variables: { a: 42 } }));
    const inventory = screen.getByRole('table', { name: 'Inventory' });
    expect(within(inventory).getByRole('row', { name: 'tea 0' })).toBeInTheDocument();
    expect(within(inventory).getByRole('row', { name: 'key 0' })).toBeInTheDocument();
    const variables = screen.getByRole('table', { name: 'Variables' });
    expect(within(variables).getByRole('row', { name: 'a 42' })).toBeInTheDocument();
  });

  it('updates the counts and values as they change', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame(blankGame);
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    act(() => player.setGameState({ inventory: {}, variables: { a: 42 } }));
    act(() => player.setGameState({ inventory: { 1: 1 }, variables: { a: 'opened', b: true } }));
    const inventory = screen.getByRole('table', { name: 'Inventory' });
    expect(within(inventory).getByRole('row', { name: 'key 1' })).toBeInTheDocument();
    const variables = screen.getByRole('table', { name: 'Variables' });
    expect(within(variables).getByRole('row', { name: 'a "opened"' })).toBeInTheDocument();
    expect(within(variables).getByRole('row', { name: 'b true' })).toBeInTheDocument();
  });

  it('says when a game has no items or variables', async () => {
    const user = userEvent.setup();
    const { player } = await withOpenGame();
    await user.click(screen.getByRole('button', { name: 'Play game' }));
    act(() => player.setGameState({ inventory: {}, variables: {} }));
    expect(screen.getByText('No items in this game.')).toBeInTheDocument();
    expect(screen.getByText('No variables in this game.')).toBeInTheDocument();
  });
});
