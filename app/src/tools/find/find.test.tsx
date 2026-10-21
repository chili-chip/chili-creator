import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderTool } from '../../test/creator';
import find from '.';

const Find = find.component;

describe('Find', () => {
  it('finds things by name or text and goes to them', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Find);
    await user.type(screen.getByRole('searchbox', { name: 'Find in game' }), 'warm');
    await user.click(screen.getByRole('button', { name: /tea dialog/ }));
    expect(creator.editor.getState().dialog).toBe('1');
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    await renderTool(Find);
    await user.type(screen.getByRole('searchbox', { name: 'Find in game' }), 'spaceship');
    expect(screen.getByText('Nothing matches “spaceship”.')).toBeInTheDocument();
  });

  it('shows where the picked drawing is used', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Find);
    act(() => creator.editor.select({ kind: 'tiles', id: 'a' }));
    expect(screen.getByRole('heading', { name: 'Where block is used' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'example room: 52 cells' }));
    expect(creator.editor.getState().room).toBe('0');
  });
});
