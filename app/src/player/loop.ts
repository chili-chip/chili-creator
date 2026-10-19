import type { CitsyEngine } from './citsy';

/** citsy's button indices. */
export enum Button {
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3,
  Ok = 4,
  Menu = 5,
}

export interface SoundChannel {
  on: boolean;
  frequency: number;
  volume: number;
  pulse: number;
}

export interface PlayLoopHandlers {
  onFrame(pixels: Uint8ClampedArray): void;
  onSound(channels: SoundChannel[]): void;
  onEnd(): void;
}

const firstFrameMs = 16.667;
const maxStepMs = 100;

/** Drives citsy one frame per tick; the caller owns the clock. */
export function createPlayLoop(engine: CitsyEngine, handlers: PlayLoopHandlers) {
  const held = [false, false, false, false, false, false];
  let tapped = false;
  let previous: number | null = null;

  return {
    setButton(button: Button, down: boolean) {
      held[button] = down;
    },
    /** A touch or click: Ok for one frame. */
    tap() {
      tapped = true;
    },
    /** Runs one frame at time `now` (ms); false once the game has ended. */
    tick(now: number): boolean {
      const dt = previous === null ? firstFrameMs : Math.min(maxStepMs, Math.max(0, now - previous));
      previous = now;
      held.forEach((down, index) => engine.setButton(index, down || (index === Button.Ok && tapped)));
      tapped = false;
      const running = engine.frame(dt);
      handlers.onFrame(new Uint8ClampedArray(engine.pixels()));
      const s = engine.sound();
      handlers.onSound([0, 4].map((at) => ({
        on: s[at]! > 0 && s[at + 1]! > 0 && s[at + 2]! > 0,
        frequency: s[at + 1]!,
        volume: s[at + 2]!,
        pulse: s[at + 3]!,
      })));
      if (!running) handlers.onEnd();
      return running;
    },
  };
}

export type PlayLoop = ReturnType<typeof createPlayLoop>;
