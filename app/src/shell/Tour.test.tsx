import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderCreator } from '../test/creator';
import { TOUR_KEY } from './Tour';

describe('Tour', () => {
  it('walks a first-time visitor through the tools, opening each one', async () => {
    const user = userEvent.setup();
    renderCreator({ tour: true });
    const tour = await screen.findByRole('dialog', { name: 'Tour' });
    expect(within(tour).getByText('Step 1 of 6')).toBeInTheDocument();
    expect(within(tour).getByRole('heading', { name: 'Your tools' })).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Next' }));
    expect(within(tour).getByRole('heading', { name: 'Your games' })).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Next' }));
    await user.click(within(tour).getByRole('button', { name: 'Next' }));
    await user.click(within(tour).getByRole('button', { name: 'Next' }));
    expect(within(tour).getByRole('heading', { name: 'Play' })).toBeInTheDocument();
    expect(await screen.findByText('Open a game to play it.')).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Back' }));
    expect(within(tour).getByRole('heading', { name: 'Paint' })).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Next' }));
    await user.click(within(tour).getByRole('button', { name: 'Next' }));
    expect(within(tour).getByText('Step 6 of 6')).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: 'Tour' })).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_KEY)).toBe('done');
  });

  it('can be skipped, and does not come back', async () => {
    const user = userEvent.setup();
    const first = renderCreator({ tour: true });
    await user.click(await screen.findByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog', { name: 'Tour' })).not.toBeInTheDocument();
    first.unmount();
    localStorage.setItem(TOUR_KEY, 'done');
    renderCreator({ tour: true });
    await screen.findByRole('heading', { name: 'Your games' });
    expect(screen.queryByRole('dialog', { name: 'Tour' })).not.toBeInTheDocument();
  });

  it('starts again from the command palette', async () => {
    const user = userEvent.setup();
    localStorage.setItem(TOUR_KEY, 'done');
    renderCreator({ tour: true });
    await user.keyboard('{Control>}k{/Control}');
    await user.click(await screen.findByRole('option', { name: /Take the tour/ }));
    expect(await screen.findByRole('dialog', { name: 'Tour' })).toBeInTheDocument();
  });
});
