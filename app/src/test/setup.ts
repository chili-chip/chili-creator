import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  globalThis.localStorage?.clear();
});

// jsdom has no layout; Dockview only needs these to exist.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no canvas. This 2D context keeps the last picture drawn, so tests
// can read it back with `paintedPixels`.
const contexts = new WeakMap<HTMLCanvasElement, unknown>();
// Node-environment tests (the real engine) have no DOM at all.
if (typeof HTMLCanvasElement !== 'undefined') HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
  if (kind !== '2d') return null;
  if (!contexts.has(this)) {
    const canvas = this;
    contexts.set(this, {
      canvas,
      imageSmoothingEnabled: false,
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      putImageData(image: { data: Uint8ClampedArray }) {
        (canvas as HTMLCanvasElement & { painted?: Uint8ClampedArray }).painted = new Uint8ClampedArray(image.data);
      },
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        width,
        height,
        data: (canvas as HTMLCanvasElement & { painted?: Uint8ClampedArray }).painted ?? new Uint8ClampedArray(width * height * 4),
      }),
      clearRect() {},
    });
  }
  return contexts.get(this) as never;
} as typeof HTMLCanvasElement.prototype.getContext;
