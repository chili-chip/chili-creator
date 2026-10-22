import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { byId } from '../../bitsy';
import { paintedPixels, placeOnScreen, rgbAt } from '../../test/canvas';
import { renderTool } from '../../test/creator';
import paint from '.';

const Paint = paint.component;

/** The drawing canvas, 80×80 on screen: each pixel is 10 wide. */
function canvas() {
  const surface = screen.getByRole('application', { name: /^Drawing/ });
  placeOnScreen(surface, 80, 80);
  return surface;
}

function press(surface: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(surface, { clientX: x * 10 + 5, clientY: y * 10 + 5, button: 0, pointerId: 1 });
}
function drag(surface: HTMLElement, x: number, y: number) {
  fireEvent.pointerMove(surface, { clientX: x * 10 + 5, clientY: y * 10 + 5, buttons: 1, pointerId: 1 });
}
function release(surface: HTMLElement) {
  fireEvent.pointerUp(surface, { pointerId: 1 });
}

describe('Paint', () => {
  it('shows the picked drawing in the room’s colours', async () => {
    await renderTool(Paint);
    const pixels = paintedPixels(canvas().querySelector('canvas')!);
    expect(rgbAt(pixels, 8, 3, 0)).toEqual([255, 255, 255]);
    expect(rgbAt(pixels, 8, 0, 0)).toEqual([0, 82, 204]);
  });

  it('draws with the pencil: the first pixel decides on or off, for the whole stroke', async () => {
    const { world } = await renderTool(Paint);
    const surface = canvas();
    press(surface, 0, 0);
    drag(surface, 1, 0);
    drag(surface, 2, 0);
    drag(surface, 3, 0); // already on: stays on
    release(surface);
    expect(byId(world().sprites, 'A')!.frames[0]!.slice(0, 8)).toEqual([1, 1, 1, 1, 1, 0, 0, 0]);
    // A fast drag skips cells; the line between them is painted too.
    press(surface, 0, 0);
    drag(surface, 3, 0);
    release(surface);
    expect(byId(world().sprites, 'A')!.frames[0]!.slice(0, 8)).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
  });

  it('undoes a whole stroke in one step', async () => {
    const { world, creator } = await renderTool(Paint);
    const before = byId(world().sprites, 'A')!.frames[0];
    const surface = canvas();
    press(surface, 0, 7);
    drag(surface, 1, 7);
    drag(surface, 2, 7);
    release(surface);
    act(() => void creator.projects.undo());
    expect(byId(world().sprites, 'A')!.frames[0]).toEqual(before);
  });

  it('fills an area with the bucket', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Paint);
    await user.click(screen.getByRole('radio', { name: 'Fill' }));
    const surface = canvas();
    press(surface, 0, 0);
    release(surface);
    const frame = byId(world().sprites, 'A')!.frames[0]!;
    // The empty area left of the avatar's head is filled, down to its arm.
    expect([frame[0], frame[2 * 8], frame[4 * 8]]).toEqual([1, 1, 1]);
    // The head walls it off from the right side, which stays empty.
    expect(frame[7]).toBe(0);
  });

  it('flips and clears the drawing', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Paint);
    const before = [...byId(world().sprites, 'A')!.frames[0]!];
    await user.click(screen.getByRole('button', { name: 'Flip upside down' }));
    expect(byId(world().sprites, 'A')!.frames[0]!.slice(0, 8)).toEqual(before.slice(56));
    await user.click(screen.getByRole('button', { name: 'Flip left to right' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(byId(world().sprites, 'A')!.frames[0]).toEqual(Array(64).fill(0));
  });

  it('renames the drawing', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Paint);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'hero');
    expect(byId(world().sprites, 'A')!.name).toBe('hero');
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    expect(byId(world().sprites, 'A')!.name).toBeUndefined();
  });

  it('animates with a second frame, painted on its own', async () => {
    const user = userEvent.setup();
    const { world } = await renderTool(Paint);
    await user.click(screen.getByRole('checkbox', { name: 'Animated' }));
    expect(byId(world().sprites, 'A')!.frames).toHaveLength(2);
    await user.click(screen.getByRole('radio', { name: 'Frame 2' }));
    const surface = canvas();
    press(surface, 0, 0);
    release(surface);
    const frames = byId(world().sprites, 'A')!.frames;
    expect(frames[1]![0]).toBe(1);
    expect(frames[0]![0]).toBe(0);
    await user.click(screen.getByRole('checkbox', { name: 'Animated' }));
    expect(byId(world().sprites, 'A')!.frames).toHaveLength(1);
    expect(screen.queryByRole('radio', { name: 'Frame 2' })).not.toBeInTheDocument();
  });

  it('makes a tile a wall', async () => {
    const user = userEvent.setup();
    const { world, creator } = await renderTool(Paint);
    act(() => creator.editor.select({ kind: 'tiles', id: 'a' }));
    expect(screen.getByText('Tile')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Wall' }));
    expect(byId(world().tiles, 'a')!.wall).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'Wall' }));
    expect(byId(world().tiles, 'a')!.wall).toBeUndefined();
  });

  it('only tiles can be walls', async () => {
    await renderTool(Paint);
    expect(screen.queryByRole('checkbox', { name: 'Wall' })).not.toBeInTheDocument();
  });

  it('asks for a drawing when none is picked', async () => {
    const { creator } = await renderTool(Paint);
    act(() => creator.editor.set({ drawing: null }));
    expect(screen.getByText('Pick a tile, sprite or item in the Library to paint it.')).toBeInTheDocument();
  });

  it('picks the blip a sprite or item makes, and plays it', async () => {
    const user = userEvent.setup();
    const { world, creator, sound } = await renderTool(Paint);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    const blip = screen.getByRole('combobox', { name: 'Sound' });
    expect(blip).toHaveDisplayValue('meow');
    await user.selectOptions(blip, 'pick up key');
    expect(byId(world().sprites, 'a')!.blip).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Play sound' }));
    expect(sound.playBlip).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
    await user.selectOptions(blip, 'None');
    expect(byId(world().sprites, 'a')!.blip).toBeUndefined();
    // Tiles make no sound.
    act(() => creator.editor.select({ kind: 'tiles', id: 'a' }));
    expect(screen.queryByRole('combobox', { name: 'Sound' })).toBeNull();
  });

  it('plays an animated drawing beside the frames, and hides the grid', async () => {
    const user = userEvent.setup();
    const { creator } = await renderTool(Paint);
    act(() => creator.editor.select({ kind: 'sprites', id: 'a' }));
    expect(screen.queryByRole('img', { name: 'Animation preview' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Animated' }));
    expect(screen.getByRole('img', { name: 'Animation preview' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Grid' }));
    expect(creator.editor.getState().showGrid).toBe(false);
  });
});
