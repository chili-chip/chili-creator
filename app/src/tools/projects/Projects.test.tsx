import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakePlatform } from '../../chili-api/fake-platform';
import { renderCreator } from '../../test/creator';

const game = (title: string) => `${title}\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n`;

describe('Projects', () => {
  it('lists projects and released games with the game count', async () => {
    const platform = createFakePlatform();
    platform.addGame({ title: 'Mossland' });
    platform.addGame({ title: 'Tea time', released: true });
    renderCreator({ platform });
    const projects = await screen.findByRole('list', { name: 'Projects' });
    expect(within(projects).getByText('Mossland')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Released games' })).getByText('Tea time')).toBeInTheDocument();
    expect(screen.getByText('2 of 30 games')).toBeInTheDocument();
  });

  it('starts a new game and opens it', async () => {
    const user = userEvent.setup();
    const { platform } = renderCreator();
    await user.click(await screen.findByRole('button', { name: 'New game' }));
    expect(await screen.findByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');
    expect(platform.games).toHaveLength(1);
  });

  it('opens a project', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    platform.addGame({ title: 'Mossland', data: game('Mossland') });
    renderCreator({ platform });
    await user.click(await screen.findByRole('button', { name: 'Open Mossland' }));
    expect(await screen.findByRole('textbox', { name: 'Game title' })).toHaveValue('Mossland');
  });

  it('asks before deleting, then deletes', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    platform.addGame({ title: 'Mossland' });
    renderCreator({ platform });
    await user.click(await screen.findByRole('button', { name: 'Delete Mossland' }));
    expect(platform.games).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    await waitFor(() => expect(platform.games).toHaveLength(0));
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
  });

  it('explains why a bought game cannot be deleted', async () => {
    const user = userEvent.setup();
    const platform = createFakePlatform();
    const bought = platform.addGame({ title: 'Mossland' });
    platform.markBought(bought.id);
    renderCreator({ platform });
    await user.click(await screen.findByRole('button', { name: 'Delete Mossland' }));
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(await screen.findByText(/cannot be deleted/)).toHaveAttribute('role', 'alert');
  });

  it('explains the limit instead of failing', async () => {
    const platform = createFakePlatform();
    for (let i = 0; i < 30; i++) platform.addGame({ title: `game ${i}` });
    renderCreator({ platform });
    expect(await screen.findByRole('button', { name: 'New game' })).toBeDisabled();
    expect(screen.getByText(/You can keep 30 games/)).toBeInTheDocument();
  });

  it('keeps games on this device when signed out', async () => {
    const user = userEvent.setup();
    renderCreator({ signedIn: false });
    expect(await screen.findByText(/saved in this browser/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(await screen.findByRole('textbox', { name: 'Game title' })).toHaveValue('Untitled game');
  });
});
