// The Chili RPG file format, v1 (chili-chip/chili-game-sdk docs/rpg/game-file.md
// and format/schema.json). The editor keeps a game as the same JSON shape the
// file has, and the engine checks everything when it plays.
import blank from './fixtures/blank.rpg?raw';

/** The art palette. Character 0 to f in a picture is colour 0 to 15. */
export const SWEETIE_16 = [
  '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
  '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
];

/** The game SDK's limits (format/schema.json). */
export const LIMITS = {
  pictures: 256,
  tiles: 90,
  rooms: 32,
  roomMin: 16,
  roomMax: 64,
  actors: 32,
  roomItems: 32,
  warps: 32,
  triggers: 32,
  kinds: 64,
  items: 128,
  slots: 8,
  dialogue: 255,
  lines: 64,
  choices: 4,
  quests: 32,
  stages: 8,
  stats: 8,
  bag: 32,
};

/** 8 rows of 8 characters: '0' to 'f' is a Sweetie 16 colour, '.' is clear. */
export type Picture = string[];

export interface Look {
  sprite?: number;
  sprites?: { down?: number; up?: number; left?: number; right?: number };
  frames?: number;
  flip?: boolean;
}

export type Op = '=' | '!=' | '<' | '<=' | '>' | '>=';

export type Condition =
  | { flag: string }
  | { not: string }
  | { var: string; op?: Op; value?: number }
  | { has: string; count?: number }
  | { quest: string; stage?: number; done?: boolean; op?: Op }
  | { stat: string; op?: Op; value?: number };

export const SOUNDS = ['step', 'bump', 'hit', 'hurt', 'miss', 'pickup', 'door', 'level', 'save', 'quest', 'win', 'lose'] as const;

export type Action =
  | { set: string }
  | { clear: string }
  | { add: string; value: number }
  | { give: string; count?: number }
  | { take: string; count?: number }
  | { heal: number }
  | { hurt: number }
  | { xp: number }
  | { stat: string; value: number }
  | { warp: string; x: number; y: number }
  | { say: string }
  | { quest: string; stage?: number; done?: true }
  | { sound: (typeof SOUNDS)[number] }
  | { music: string }
  | { save: true }
  | { end: 'win' | 'lose' }
  | { remove: true }
  | { call: string };

/** A list of actions, or conditions with what to do when they pass and when they don't. */
export type GameEvent = Action[] | { if?: Condition[]; do?: Action[]; else?: Action[] };

export interface Tile {
  key: string;
  sprite: number | number[];
  frame_ms?: number;
  solid?: boolean;
  water?: boolean;
  save?: boolean;
  damage?: number;
}

export interface Actor {
  kind: string;
  x: number;
  y: number;
  talk?: string;
  bump?: GameEvent;
  patrol?: [number, number][];
}

export interface Room {
  id: string;
  name?: string;
  /** One string per row, one tile key per cell. */
  ground: string[];
  /** Drawn over actors; ' ' or '.' with no tile shows what is under it. */
  top?: string[];
  music?: string;
  actors?: Actor[];
  items?: { item: string; x: number; y: number; count?: number }[];
  warps?: { x: number; y: number; to: string; tx: number; ty: number }[];
  triggers?: { x: number; y: number; once?: boolean; if?: Condition[]; do?: Action[]; else?: Action[] }[];
}

export interface Kind extends Look {
  id: string;
  name?: string;
  brain?: string;
  sight?: number;
  home?: number;
  flee?: number;
  speed?: number;
  friendly?: boolean;
  stats?: Record<string, number>;
  xp?: number;
  drops?: { item: string; chance?: number; count?: number }[];
  talk?: string;
  bump?: GameEvent;
  death?: GameEvent;
}

export interface Item {
  id: string;
  name?: string;
  text?: string;
  icon?: number;
  kind?: 'use' | 'equip' | 'key' | 'quest';
  stack?: number;
  price?: number;
  slot?: string;
  bonus?: Record<string, number>;
  use?: GameEvent;
}

export interface Line {
  id?: string;
  who?: string;
  face?: number;
  text: string;
  if?: Condition[];
  do?: Action[];
  else?: Action[];
  choices?: { text: string; if?: Condition[]; do?: Action[]; else?: Action[]; goto?: string }[];
}

export interface Dialogue {
  id: string;
  who?: string;
  face?: number;
  lines: Line[];
}

export interface Goal {
  talk?: string;
  collect?: string;
  defeat?: string;
  reach?: string;
  flag?: string;
  count?: number;
  x?: number;
  y?: number;
}

export interface Quest {
  id: string;
  title?: string;
  stages: { log?: string; goal?: Goal; done?: GameEvent }[];
}

export interface Song {
  id: string;
  step_ms?: number;
  lead?: string;
  bass?: string;
  drums?: string;
}

export interface Game {
  $schema?: string;
  format: 'chili-rpg';
  version: 1;
  title: string;
  author?: string;
  sprites?: string;
  art?: { palette?: 'sweetie16'; pictures: Picture[] };
  background?: string;
  start: { room: string; x: number; y: number };
  player: Look;
  rules?: { step_ms?: number; repeat_ms?: number; diagonal?: boolean; bag?: number; spread?: number; crit?: number };
  stats: { id: string; label?: string; start?: number }[];
  levels?: { xp?: number[]; gain?: Record<string, number> };
  tiles: Tile[];
  rooms: Room[];
  kinds?: Kind[];
  slots?: string[];
  items?: Item[];
  dialogue?: Dialogue[];
  quests?: Quest[];
  songs?: Song[];
  lose?: GameEvent;
}

/**
 * Reads a game. The engine checks everything when it plays; here we only make
 * sure it is a Chili RPG game the editor can show.
 */
export function parseGame(text: string): { doc: Game; issues: { message: string }[] } {
  let game: Partial<Game> | null = null;
  try {
    game = JSON.parse(text) as Partial<Game>;
  } catch {
    // Not JSON.
  }
  if (!game || typeof game !== 'object' || game.format !== 'chili-rpg') {
    return { doc: parseGame(blank).doc, issues: [{ message: 'This is not a Chili RPG game.' }] };
  }
  if (game.version !== 1) {
    return { doc: parseGame(blank).doc, issues: [{ message: 'This game needs a newer Chili RPG.' }] };
  }
  const missing = (['start', 'player', 'stats', 'tiles', 'rooms'] as const).find((key) => !game[key]);
  if (missing || !Array.isArray(game.rooms) || !game.rooms.length) {
    return { doc: parseGame(blank).doc, issues: [{ message: `This Chili RPG game has no ${missing ?? 'rooms'}.` }] };
  }
  return { doc: game as Game, issues: [] };
}

function isPicture(value: unknown): boolean {
  return Array.isArray(value) && value.length === 8 && value.every((row) => typeof row === 'string' && row.length === 8);
}

// The game SDK's layout: a value goes on one line when it fits in 96
// characters, lists of lists go one per line, and a picture is always one line.
function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value && typeof value === 'object') {
    const fields = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`);
    return fields.length ? `{ ${fields.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

function format(value: unknown, indent: number): string {
  const line = inline(value);
  if (isPicture(value)) return line;
  const listOfLists = Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
  if (line.length + indent <= 96 && !listOfLists) return line;
  const pad = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => pad + format(v, indent + 2)).join(',\n')}\n${' '.repeat(indent)}]`;
  }
  if (value && typeof value === 'object') {
    const fields = Object.entries(value).map(([k, v]) => `${pad}${JSON.stringify(k)}: ${format(v, indent + 2)}`);
    return `{\n${fields.join(',\n')}\n${' '.repeat(indent)}}`;
  }
  return line;
}

export function serializeGame(game: Game): string {
  return `${format(game, 0)}\n`;
}

/** A new game: the hero in one walled room. */
export function blankGame(title: string): string {
  const game = parseGame(blank).doc;
  game.title = title;
  return serializeGame(game);
}
