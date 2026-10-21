import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderTool } from '../../test/creator';
import library from '.';

const Library = library.component;

describe('Library', () => {
  it("lists the game's sprites, with the avatar picked", async () => {
    await renderTool(Library);
    const list = screen.getByRole('list', { name: 'Sprites' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['avatar', 'cat']);
    expect(within(list).getByRole('button', { name: 'avatar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows tiles and items on their own tabs', async () => {
    const user = userEvent.setup();
    await renderTool(Library);
    await user.click(screen.getByRole('radio', { name: 'Tiles' }));
    expect(within(screen.getByRole('list', { name: 'Tiles' })).getByRole('button', { name: 'block' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Items' }));
    const items = within(screen.getByRole('list', { name: 'Items' })).getAllByRole('button');
    expect(items.map((b) => b.getAttribute('aria-label'))).toEqual(['tea', 'key']);
  });

  it('picks a drawing for Paint and the Room', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Library);
    await user.click(screen.getByRole('button', { name: 'cat' }));
    expect(creator.editor.getState().drawing).toEqual({ kind: 'sprites', id: 'a' });
    expect(screen.getByRole('button', { name: 'cat' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('makes a new drawing of the kind shown, picks it and saves it', async () => {
    const user = userEvent.setup();
    const { creator, world, platform } = await renderTool(Library);
    await user.click(screen.getByRole('radio', { name: 'Tiles' }));
    await user.click(screen.getByRole('button', { name: 'New tile' }));
    expect(world().tiles.map((t) => t.id)).toEqual(['a', 'b']);
    expect(creator.editor.getState().drawing).toEqual({ kind: 'tiles', id: 'b' });
    expect(screen.getByRole('button', { name: 'tile b' })).toHaveAttribute('aria-pressed', 'true');
    await act(() => creator.projects.flush());
    expect(platform.games[0]!.data).toContain('\nTIL b\n');
  });

  it('duplicates the picked drawing', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Library);
    await user.click(screen.getByRole('button', { name: 'cat' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate cat' }));
    expect(world().sprites.map((s) => s.name)).toEqual([undefined, 'cat', 'cat copy']);
    expect(screen.getByRole('button', { name: 'cat copy' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('deletes the picked drawing after asking', async () => {
    const user = userEvent.setup();
    const { world, creator } = await renderTool(Library);
    await user.click(screen.getByRole('button', { name: 'cat' }));
    await user.click(screen.getByRole('button', { name: 'Delete cat' }));
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(world().sprites).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Delete cat' }));
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(world().sprites.map((s) => s.id)).toEqual(['A']);
    expect(creator.editor.getState().drawing).toEqual({ kind: 'sprites', id: 'A' });
  });

  it('cannot delete the avatar', async () => {
    await renderTool(Library);
    expect(screen.getByRole('button', { name: 'Delete avatar' })).toBeDisabled();
  });

  it('finds drawings by name or id', async () => {
    const user = userEvent.setup();
    await renderTool(Library);
    await user.type(screen.getByRole('searchbox', { name: 'Find' }), 'ca');
    const list = screen.getByRole('list', { name: 'Sprites' });
    expect(within(list).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['cat']);
    await user.clear(screen.getByRole('searchbox', { name: 'Find' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find' }), 'zzz');
    expect(screen.getByText('Nothing matches “zzz”.')).toBeInTheDocument();
  });

  it('asks for a game when none is open', async () => {
    const { creator } = await renderTool(Library);
    await act(() => creator.projects.close());
    expect(screen.getByText('Open a game to see its tiles, sprites and items.')).toBeInTheDocument();
  });
});
