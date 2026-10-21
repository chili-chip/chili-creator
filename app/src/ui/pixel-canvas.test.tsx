import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { paintedPixels, placeOnScreen } from '../test/canvas';
import { PixelCanvas, PixelImage } from './pixel-canvas';

function setup() {
  const onPaint = vi.fn();
  const onStrokeEnd = vi.fn();
  const onHover = vi.fn();
  const pixels = new Uint8ClampedArray(4 * 4 * 4).fill(200);
  render(
    <PixelCanvas
      label="Room"
      pixels={pixels}
      width={4}
      height={4}
      columns={2}
      rows={2}
      onPaint={onPaint}
      onStrokeEnd={onStrokeEnd}
      onHover={onHover}
    />,
  );
  const canvas = screen.getByRole('application', { name: 'Room' });
  // 2×2 cells on 100×100 screen pixels: each cell is 50 wide.
  placeOnScreen(canvas, 100, 100, 10, 20);
  return { canvas, onPaint, onStrokeEnd, onHover, pixels };
}

describe('PixelCanvas', () => {
  it('draws the pixels it is given', () => {
    const { canvas, pixels } = setup();
    expect(paintedPixels(canvas.querySelector('canvas')!)).toEqual(pixels);
  });

  it('paints the cell under the pointer', () => {
    const { canvas, onPaint, onStrokeEnd } = setup();
    fireEvent.pointerDown(canvas, { clientX: 10 + 75, clientY: 20 + 10, button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(onPaint).toHaveBeenCalledExactlyOnceWith(1, 0, true);
    expect(onStrokeEnd).toHaveBeenCalledOnce();
  });

  it('paints each new cell a drag goes through, once', () => {
    const { canvas, onPaint } = setup();
    fireEvent.pointerDown(canvas, { clientX: 15, clientY: 25, button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 30, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 70, clientY: 30, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 70, clientY: 90, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(onPaint.mock.calls).toEqual([
      [0, 0, true],
      [1, 0, false],
      [1, 1, false],
    ]);
  });

  it('paints the cells between two moves far apart, so fast strokes have no gaps', () => {
    const onPaint = vi.fn();
    render(
      <PixelCanvas label="Big" pixels={new Uint8ClampedArray(4)} width={1} height={1} columns={8} rows={8} onPaint={onPaint} />,
    );
    const canvas = screen.getByRole('application', { name: 'Big' });
    placeOnScreen(canvas, 80, 80);
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 35, clientY: 25, buttons: 1, pointerId: 1 });
    expect(onPaint.mock.calls.map(([x, y]) => `${x},${y}`)).toEqual(['0,0', '1,1', '2,1', '3,2']);
  });

  it('ignores the right button and moves without a press, but reports the hovered cell', () => {
    const { canvas, onPaint, onHover } = setup();
    fireEvent.pointerDown(canvas, { clientX: 15, clientY: 25, button: 2, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 70, clientY: 90, buttons: 0, pointerId: 1 });
    expect(onPaint).not.toHaveBeenCalled();
    expect(onHover).toHaveBeenLastCalledWith({ x: 1, y: 1 });
    fireEvent.pointerLeave(canvas, { pointerId: 1 });
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('keeps cells inside the canvas when the pointer is dragged out', () => {
    const { canvas, onPaint } = setup();
    fireEvent.pointerDown(canvas, { clientX: 15, clientY: 25, button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 500, clientY: -50, buttons: 1, pointerId: 1 });
    expect(onPaint).toHaveBeenLastCalledWith(1, 0, false);
  });

  it('can be used with the keyboard: arrows move, Space or Enter paints', async () => {
    const user = userEvent.setup();
    const { canvas, onPaint, onStrokeEnd } = setup();
    await user.click(document.body);
    await user.tab();
    expect(canvas).toHaveFocus();
    expect(screen.getByText('Column 1, row 1')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowDown}{ArrowRight}');
    expect(screen.getByText('Column 2, row 2')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(onPaint).toHaveBeenCalledExactlyOnceWith(1, 1, true);
    expect(onStrokeEnd).toHaveBeenCalledOnce();
    await user.keyboard('{ArrowLeft}{Enter}');
    expect(onPaint).toHaveBeenLastCalledWith(0, 1, true);
  });
});

describe('PixelImage', () => {
  it('draws pixels on a small canvas', () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4).fill(9);
    const { container } = render(<PixelImage pixels={pixels} width={8} height={8} />);
    expect(paintedPixels(container.querySelector('canvas')!)).toEqual(pixels);
  });
});
