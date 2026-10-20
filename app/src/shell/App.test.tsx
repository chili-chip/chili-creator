import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakePlatform } from '../chili-api/fake-platform';
import { renderCreator } from '../test/creator';

const game = (title: string) => `${title}\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n`;

describe('App', () => {
  it('shows the creator frame with a launcher for every registered tool', async () => {
    renderCreator();
    expect(screen.getByRole('banner')).toHaveTextContent('Chili Creator');
    const tools = screen.getByRole('navigation', { name: 'Tools' });
    expect(within(tools).getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(within(tools).getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('shows who is signed in', async () => {
    renderCreator();
    expect(await screen.findByText('Kacper')).toBeInTheDocument();
  });

  it('says so when nobody is signed in', async () => {
    renderCreator({ signedIn: false });
    expect(await screen.findByText('Not signed in')).toBeInTheDocument();
  });

  it('offers the classic editor while the new one is in preview', async () => {
    renderCreator();
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Classic editor' })).toHaveAttribute(
      'href',
      expect.stringContaining('../editor/index.html'),
    );
  });

  it('opens the command palette with Ctrl+K and runs a command from it', async () => {
    const user = userEvent.setup();
    renderCreator();
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Commands' });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Reset layout/ }));
    expect(screen.queryByRole('dialog', { name: 'Commands' })).not.toBeInTheDocument();
  });

  it('renames the open game and shows the save state', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { creator } = renderCreator({ platform, initialProject: String(saved.id) });
    const title = await screen.findByRole('textbox', { name: 'Game title' });
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Saved');
    await user.clear(title);
    await user.type(title, 'Moss');
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Saving');
    await act(() => creator.projects.flush());
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Saved');
    expect(platform.games[0]!.title).toBe('Moss');
  });

  it('offers to retry a failed save', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { creator } = renderCreator({ platform, initialProject: String(saved.id) });
    const title = await screen.findByRole('textbox', { name: 'Game title' });
    platform.failNext();
    await user.type(title, '!');
    await act(() => creator.projects.flush().catch(() => {}));
    expect(screen.getByRole('status', { name: 'Save state' })).toHaveTextContent('Not saved');
    await user.click(screen.getByRole('button', { name: 'Retry saving' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(platform.games[0]!.title).toBe('Mossland!');
  });

  it('opens the project from the URL', async () => {
    const platform = createFakePlatform();
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    renderCreator({ platform, initialProject: String(saved.id) });
    expect(await screen.findByRole('textbox', { name: 'Game title' })).toHaveValue('Mossland');
  });
});
