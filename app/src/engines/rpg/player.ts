// The Chili RPG engine (chili-rpg/chili-rpg.js + .wasm, built by
// chili-chip/chili-game-sdk players/rpg/web) and its player wrapper.
// @ts-expect-error plain JavaScript from the chili-game-sdk build
import createChiliRpg from '../../../../chili-rpg/chili-rpg.js';
// @ts-expect-error plain JavaScript from the chili-game-sdk build
import { ChiliRpgPlayer } from '../../../../chili-rpg/player.js';

/** What is happening; see the game SDK's docs/rpg/players.md. */
export interface RpgDebug {
  state: 'playing' | 'won' | 'lost' | 'none';
  title: string;
  room: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  turn: number;
  stats: Record<string, number>;
  hp: number;
  talking: boolean;
  speaker: string;
  text: string;
  choices: string[];
  flags: string[];
  vars: Record<string, number>;
  quests: Record<string, number | 'done'>;
  bag: { item: string; count: number; equipped: boolean }[];
}

/** What the Play tool uses. */
export interface RpgPlayer {
  load(text: string): string | null;
  start(canvas: HTMLCanvasElement, options?: { keys?: EventTarget }): void;
  stop(): void;
  restart(): void;
  step(buttons?: number): void;
  press(button: number, down: boolean): void;
  enableSound(): void;
  debug(): RpgDebug;
  /** The screen as 128 × 128 RGBA pixels. */
  rgba(): Uint8ClampedArray;
  muted: boolean;
  onStep: ((debug: RpgDebug) => void) | null;
}

export const RPG_BUTTONS = { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32, x: 64, y: 128 } as const;

/** Loads the wasm engine. Each call makes a new, separate engine. */
export async function loadEngine(): Promise<RpgPlayer> {
  return (await ChiliRpgPlayer.create(createChiliRpg)) as RpgPlayer;
}
