import type { GifFrame } from './gif';

// Collects what the player shows for a GIF: a frame only when the picture
// changes, shown until the next change.

export function createRecorder({ now = () => performance.now(), maxMs = 30_000 }: { now?: () => number; maxMs?: number } = {}) {
  let frames: GifFrame[] | null = null;
  let started = 0;
  let last = 0;
  let previous: Uint8ClampedArray | null = null;

  const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  /** Gives the last frame its time, up to `at`. */
  function close(at: number) {
    const lastFrame = frames?.at(-1);
    if (lastFrame) lastFrame.delayMs = Math.min(at, started + maxMs) - last;
  }

  return {
    start() {
      frames = [];
      previous = null;
      started = last = now();
    },
    frame(pixels: Uint8ClampedArray) {
      if (!frames) return;
      const at = now();
      if (at - started >= maxMs) return;
      if (previous && same(previous, pixels)) return;
      close(at);
      last = at;
      previous = new Uint8ClampedArray(pixels);
      frames.push({ pixels: previous, delayMs: 0 });
    },
    recording: () => frames !== null,
    full: () => frames !== null && now() - started >= maxMs,
    /** How long the recording has run, up to its longest. */
    elapsedMs: () => (frames ? Math.min(now() - started, maxMs) : 0),
    maxMs,
    stop(): GifFrame[] {
      const done = frames ?? [];
      close(now());
      frames = null;
      previous = null;
      return done;
    },
  };
}

export type Recorder = ReturnType<typeof createRecorder>;
