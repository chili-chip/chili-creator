import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { builtInTools } from '../tools';
import { renderCreator } from '../test/creator';

describe('Help', () => {
  it('opens from the footer with the creator docs and what each tool is for', async () => {
    const user = userEvent.setup();
    renderCreator();
    await screen.findByRole('heading', { name: 'Your games' });
    await user.click(screen.getByRole('button', { name: 'Help' }));
    const help = screen.getByRole('dialog', { name: 'Help' });
    expect(within(help).getByRole('link', { name: /Creator docs/ })).toHaveAttribute('href', 'https://creator.chilichip.eu/');
    for (const tool of builtInTools) {
      expect(tool.help, tool.id).toBeTruthy();
      expect(within(help).getByText(tool.help!)).toBeInTheDocument();
      expect(within(help).getByRole('link', { name: `Learn more about ${tool.title}` })).toHaveAttribute(
        'href',
        tool.id === 'projects'
          ? 'https://creator.chilichip.eu/get-started/projects/'
          : `https://creator.chilichip.eu/editors/bitsy/tools/${tool.id}/`,
      );
    }
    await user.click(within(help).getByRole('button', { name: 'Open Dialog' }));
    expect(screen.queryByRole('dialog', { name: 'Help' })).not.toBeInTheDocument();
    expect(await screen.findByText('Open a game to write what its sprites and items say.')).toBeInTheDocument();
  });

  it('opens from the command palette, starts the tour, and closes with Escape', async () => {
    const user = userEvent.setup();
    renderCreator({ tour: true });
    await user.click(await screen.findByRole('button', { name: 'Skip tour' }));
    await user.keyboard('{Control>}k{/Control}');
    await user.click(await screen.findByRole('option', { name: 'Help: What each tool does' }));
    const help = screen.getByRole('dialog', { name: 'Help' });
    await user.keyboard('{Escape}');
    expect(help).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(screen.getByRole('dialog', { name: 'Tour' })).toBeInTheDocument();
  });
});
