import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakePlatform } from '../../chili-api/fake-platform';
import { Button } from '../../player';
import { renderCreator } from '../../test/creator';

const game = (title: string) => `${title}\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n`;

async function withOpenGame() {
  const platform = createFakePlatform();
  const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
  const view = renderCreator({ platform, initialProject: String(saved.id) });
  await screen.findByRole('textbox', { name: 'Game title' });
  return view;
}

describe('Play', () => {
  it('asks for a game when none is open', async () => {
    renderCreator();
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
});
