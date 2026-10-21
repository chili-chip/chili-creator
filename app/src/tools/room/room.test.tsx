import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { byId } from '../../bitsy';
import { paintedPixels, placeOnScreen, rgbAt } from '../../test/canvas';
import { renderTool } from '../../test/creator';
import room from '.';

const Room = room.component;

/** The room canvas, 160×160 on screen: each cell is 10 wide. */
function canvas() {
  const surface = screen.getByRole('application', { name: /^Room/ });
  placeOnScreen(surface, 160, 160);
  return surface;
}

function click(surface: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(surface, { clientX: x * 10 + 5, clientY: y * 10 + 5, button: 0, pointerId: 1 });
  fireEvent.pointerUp(surface, { pointerId: 1 });
}

describe('Room', () => {
  it('draws the room', async () => {
    await renderTool(Room);
    const pixels = paintedPixels(canvas().querySelector('canvas')!);
    expect(rgbAt(pixels, 128, 0, 0)).toEqual([0, 82, 204]);
    expect(rgbAt(pixels, 128, 8, 8)).toEqual([128, 159, 255]);
  });

  it('paints the picked tile, and a click on the same tile clears it', async () => {
    const { creator, world } = await renderTool(Room);
    act(() => creator.editor.select({ kind: 'tiles', id: 'a' }));
    const surface = canvas();
    fireEvent.pointerDown(surface, { clientX: 35, clientY: 35, button: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 55, clientY: 35, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(surface, { pointerId: 1 });
    expect(world().rooms[0]!.tilemap[3]!.slice(3, 6)).toEqual(['a', 'a', 'a']);
    click(surface, 4, 3);
    expect(world().rooms[0]!.tilemap[3]![4]).toBe('0');
    // One stroke, one undo.
    act(() => void creator.projects.undo());
    act(() => void creator.projects.undo());
    expect(world().rooms[0]!.tilemap[3]!.slice(3, 6)).toEqual(['0', '0', '0']);
  });

  it('moves the picked sprite where it is clicked', async () => {
    const { creator, world } = await renderTool(Room);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    click(canvas(), 6, 7);
    expect(byId(world().sprites, 'a')!.position).toEqual({ room: '0', x: 6, y: 7 });
  });

  it('puts the picked item down, or picks it up again', async () => {
    const { creator, world } = await renderTool(Room);
    act(() => creator.editor.select({ kind: 'items', id: '0' }));
    click(canvas(), 2, 2);
    expect(world().rooms[0]!.items).toEqual([{ id: '0', x: 2, y: 2 }]);
    click(canvas(), 2, 2);
    expect(world().rooms[0]!.items).toEqual([]);
  });

  it('erases what is in a cell', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Room);
    await user.click(screen.getByRole('radio', { name: 'Erase' }));
    click(canvas(), 8, 12);
    expect(byId(world().sprites, 'a')!.position).toBeUndefined();
    click(canvas(), 1, 1);
    expect(world().rooms[0]!.tilemap[1]![1]).toBe('0');
  });

  it('shows the cell under the pointer', async () => {
    await renderTool(Room);
    fireEvent.pointerMove(canvas(), { clientX: 35, clientY: 45, buttons: 0, pointerId: 1 });
    expect(screen.getByText('x 3, y 4')).toBeInTheDocument();
  });

  it('makes a new room and switches between rooms', async () => {
    const user = userEvent.setup();
    const { world, creator } = await renderTool(Room);
    const picker = screen.getByRole('combobox', { name: 'Room' });
    expect(picker).toHaveDisplayValue('example room');
    await user.click(screen.getByRole('button', { name: 'New room' }));
    expect(world().rooms.map((r) => r.id)).toEqual(['0', '1']);
    expect(picker).toHaveDisplayValue('Room 1');
    expect(creator.editor.getState().room).toBe('1');
    await user.selectOptions(picker, 'example room');
    expect(creator.editor.getState().room).toBe('0');
  });

  it('renames the room', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Room);
    const name = screen.getByRole('textbox', { name: 'Room name' });
    await user.clear(name);
    await user.type(name, 'hall');
    expect(world().rooms[0]!.name).toBe('hall');
  });

  it('says what a click will do', async () => {
    const { creator } = await renderTool(Room);
    expect(screen.getByText(/Click to move avatar/)).toBeInTheDocument();
    act(() => creator.editor.select({ kind: 'tiles', id: 'a' }));
    expect(screen.getByText(/Click to paint block/)).toBeInTheDocument();
    act(() => creator.editor.select({ kind: 'items', id: '1' }));
    expect(screen.getByText(/Click to put down key/)).toBeInTheDocument();
  });
});
