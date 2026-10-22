import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderTool } from '../../test/creator';
import colors, { hexToRgb, rgbToHex } from '.';

const Colors = colors.component;

describe('hex colours', () => {
  it('converts both ways', () => {
    expect(rgbToHex([0, 82, 204])).toBe('#0052cc');
    expect(hexToRgb('#0052cc')).toEqual([0, 82, 204]);
    expect(hexToRgb('nope')).toBeNull();
  });
});

describe('Colors', () => {
  it("shows the room's palette", async () => {
    await renderTool(Colors);
    expect(screen.getByRole('combobox', { name: 'Palette' })).toHaveDisplayValue('blueprint');
    expect(screen.getByLabelText('Background')).toHaveValue('#0052cc');
    expect(screen.getByLabelText('Tiles')).toHaveValue('#809fff');
    expect(screen.getByLabelText('Sprites and items')).toHaveValue('#ffffff');
  });

  it('changes a colour as one undo step, however long the picker is dragged', async () => {
    const { world, creator } = await renderTool(Colors);
    const background = screen.getByLabelText('Background');
    fireEvent.input(background, { target: { value: '#101010' } });
    fireEvent.input(background, { target: { value: '#202020' } });
    expect(world().palettes[0]!.colors[0]).toEqual([32, 32, 32]);
    act(() => void creator.projects.undo());
    expect(world().palettes[0]!.colors[0]).toEqual([0, 82, 204]);
  });

  it('renames the palette', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Colors);
    const name = screen.getByRole('textbox', { name: 'Palette name' });
    await user.clear(name);
    await user.type(name, 'night');
    expect(world().palettes[0]!.name).toBe('night');
  });

  it("makes a new palette from this one and gives it to the room", async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Colors);
    await user.click(screen.getByRole('button', { name: 'New palette' }));
    expect(world().palettes.map((p) => p.id)).toEqual(['0', '1']);
    expect(world().rooms[0]!.palette).toBe('1');
    expect(screen.getByRole('combobox', { name: 'Palette' })).toHaveDisplayValue('blueprint copy');
  });

  it('gives the room another palette', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Colors);
    await user.click(screen.getByRole('button', { name: 'New palette' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Palette' }), 'blueprint');
    expect(world().rooms[0]!.palette).toBe('0');
  });

  it('takes a typed hex colour', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Colors);
    const hex = screen.getByRole('textbox', { name: 'Background hex' });
    await user.clear(hex);
    await user.type(hex, '#ff0000');
    expect(world().palettes[0]!.colors[0]).toEqual([255, 0, 0]);
    await user.clear(hex);
    await user.type(hex, 'nope');
    expect(world().palettes[0]!.colors[0]).toEqual([255, 0, 0]);
  });

  it('deletes a palette after asking, but not the last one', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Colors);
    expect(screen.getByRole('button', { name: 'Delete palette' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'New palette' }));
    await user.click(screen.getByRole('button', { name: 'Delete palette' }));
    await user.click(screen.getByRole('button', { name: 'Delete for good' }));
    expect(world().palettes).toHaveLength(1);
    expect(world().rooms[0]!.palette).toBe(world().palettes[0]!.id);
  });
});
