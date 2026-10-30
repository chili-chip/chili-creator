// The Chili Beat engine (chili-beat/chili-beat.js + .wasm, built by
// chili-chip/chili-beat) and its player wrapper.
// @ts-expect-error plain JavaScript from the chili-beat build
import createChiliBeat from '../../../../chili-beat/chili-beat.js';
// @ts-expect-error plain JavaScript from the chili-beat build
import { ChiliBeatPlayer } from '../../../../chili-beat/player.js';

export interface BeatDebug {
  state: 'playing' | 'won' | 'lost';
  screen: string;
  beat: number;
  counters: number[];
  /** Rules that ran during the last step, by index. */
  fired: number[];
  sounds: number[];
  text: string;
}

/** What the Play tool uses; see chili-beat docs/web.md. */
export interface BeatPlayer {
  load(text: string): string | null;
  start(canvas: HTMLCanvasElement, options?: { keys?: EventTarget }): void;
  stop(): void;
  restart(): void;
  step(buttons?: number): void;
  press(button: number, down: boolean): void;
  debug(): BeatDebug;
  muted: boolean;
  onStep: ((debug: BeatDebug) => void) | null;
}

export const BEAT_BUTTONS = { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32 } as const;

/** Loads the wasm engine. Each call makes a new, separate engine. */
export async function loadEngine(): Promise<BeatPlayer> {
  return (await ChiliBeatPlayer.create(createChiliBeat)) as BeatPlayer;
}
