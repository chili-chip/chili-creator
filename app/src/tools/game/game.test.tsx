import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { serialize } from '../../bitsy';
import { renderTool } from '../../test/creator';
import game from '.';

const Game = game.component;

describe('Game', () => {
  it('renames the game', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Game);
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Moss');
    expect(world().title).toBe('Moss');
  });

  it('picks the font and text direction', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Game);
    const font = screen.getByRole('combobox', { name: 'Font' });
    expect(font).toHaveDisplayValue('ASCII small');
    await user.selectOptions(font, 'Arabic');
    await user.click(screen.getByRole('radio', { name: 'Right to left' }));
    expect(world().defaultFont).toBe('arabic');
    expect(world().textDirection).toBe('RTL');
    expect(serialize(world())).toContain('DEFAULT_FONT arabic');
    await user.selectOptions(font, 'ASCII small');
    await user.click(screen.getByRole('radio', { name: 'Left to right' }));
    expect(world().defaultFont).toBeUndefined();
    expect(world().textDirection).toBe('LTR');
  });

  it('says where the game starts', async () => {
    await renderTool(Game);
    expect(screen.getByText('Starts in example room at 4,4')).toBeInTheDocument();
  });
});
