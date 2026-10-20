import type { Button, SoundChannel } from './loop';

/** Messages from the page to the player worker. */
export type ToWorker =
  | { type: 'play'; data: string }
  | { type: 'button'; button: Button; down: boolean }
  | { type: 'tap' }
  | { type: 'stop' };

/** Messages from the player worker to the page. */
export type FromWorker =
  | { type: 'started' }
  /** 128×128 RGBA, transferred. */
  | { type: 'frame'; pixels: ArrayBuffer }
  | { type: 'sound'; channels: SoundChannel[] }
  | { type: 'ended' }
  | { type: 'error'; message: string };
