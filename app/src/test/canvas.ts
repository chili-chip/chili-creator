/** What was last drawn on a canvas in tests (see setup.ts), as RGBA. */
export function paintedPixels(canvas: Element): Uint8ClampedArray | undefined {
  return (canvas as HTMLCanvasElement & { painted?: Uint8ClampedArray }).painted;
}

/** The RGB of pixel (x, y) of an RGBA buffer `width` wide. */
export function rgbAt(pixels: Uint8ClampedArray | undefined, width: number, x: number, y: number): number[] {
  if (!pixels) return [];
  const i = (y * width + x) * 4;
  return [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
}

/** Gives an element a size on screen, which jsdom does not lay out. */
export function placeOnScreen(element: Element, width: number, height: number, left = 0, top = 0): void {
  element.getBoundingClientRect = () =>
    ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON() {} }) as DOMRect;
}
