import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createCreator } from '../creator';

function setup(me: () => Promise<{ username: string; displayName: string }>) {
  const creator = createCreator({ apiBase: '/api', parent: null, origin: 'http://localhost' });
  creator.profile.me = vi.fn(me);
  render(<App creator={creator} />);
  return creator;
}

describe('App', () => {
  it('shows the creator frame with a launcher for every registered tool', async () => {
    setup(async () => ({ username: 'kacper', displayName: 'Kacper' }));
    expect(screen.getByRole('banner')).toHaveTextContent('Chili Creator');
    expect(screen.getByRole('navigation', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('shows who is signed in', async () => {
    setup(async () => ({ username: 'kacper', displayName: 'Kacper' }));
    expect(await screen.findByText('Kacper')).toBeInTheDocument();
  });

  it('says so when nobody is signed in', async () => {
    setup(async () => {
      throw Object.assign(new Error('Sign in'), { kind: 'unauthorized' });
    });
    expect(await screen.findByText('Not signed in')).toBeInTheDocument();
  });

  it('offers the classic editor while the new one is in preview', async () => {
    setup(async () => ({ username: 'kacper', displayName: 'Kacper' }));
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Classic editor' })).toHaveAttribute(
      'href',
      expect.stringContaining('../editor/index.html'),
    );
  });

  it('opens the command palette with Ctrl+K and runs a command from it', async () => {
    const user = userEvent.setup();
    setup(async () => ({ username: 'kacper', displayName: 'Kacper' }));
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Commands' });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Reset layout/ }));
    expect(screen.queryByRole('dialog', { name: 'Commands' })).not.toBeInTheDocument();
  });
});
