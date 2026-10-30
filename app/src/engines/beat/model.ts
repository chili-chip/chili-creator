// The Chili Beat file format, v1 (chili-chip/chili-beat docs/format.md).
// The editor keeps a game as the same JSON shape the file has.
import blank from './fixtures/blank.beat?raw';

export const SWEETIE_16 = [
  '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
  '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
];

export const LIMITS = { things: 64, screens: 64, counters: 4, rules: 128, conditions: 2, actions: 6, blips: 16, tunes: 8 };

/** 8 rows of 8 digits, 0-3. */
export type Picture = string[];

export interface Thing {
  key: string;
  name: string;
  you?: boolean;
  frames: Picture[];
}

export interface Screen {
  id: string;
  map: [number, number];
  tune?: string;
  reset?: boolean;
  /** 16 rows of 16 thing keys, '.' for empty. */
  things: string[];
  ground?: string[];
}

export interface Counter {
  id: string;
  name: string;
  icon: string;
  start?: number;
}

export type Button = 'a' | 'b' | 'arrow' | 'up' | 'down' | 'left' | 'right';
/** A thing key, "you" or "any". */
export type Match = string;
export type Way = 'up' | 'down' | 'left' | 'right' | 'forward' | 'back' | 'same' | 'toward' | 'away' | 'random';
export type Who = 'you' | 'it' | 'bumper' | 'bumped';

export type Trigger =
  | { start: true }
  | { press: Button }
  | { bump: [Match, Match] }
  | { every: number; thing: Match }
  | { counter: string; reaches: number };

export type Condition =
  | { chance: number }
  | { counter: string; atLeast: number }
  | { counter: string; atMost: number }
  | { counter: string; exactly: number };

export type Action =
  | { move: Way; who?: Who }
  | { turn: Way; who?: Who }
  | { become: string; who?: Who }
  | { vanish: true; who?: Who }
  | { make: string; to: Way; who?: Who }
  | { count: string; add: number }
  | { count: string; set: number }
  | { say: string }
  | { sound: string }
  | { go: string }
  | { shake: true }
  | { win: string }
  | { lose: string };

export interface Rule {
  when: Trigger;
  if?: Condition[];
  do: Action[];
}

export interface Blip {
  id: string;
  preset: 'coin' | 'jump' | 'hit' | 'boom' | 'step' | 'power' | 'blip';
  pitch?: number;
  length?: number;
  slide?: number;
}

export interface Tune {
  id: string;
  scale: 'major' | 'minor' | 'pentatonic-major' | 'pentatonic-minor';
  lead: number[];
  beat: number[];
}

export interface Game {
  format: 'chili-beat';
  version: 1;
  title: string;
  author?: string;
  palette: [number, number, number, number];
  tempo: number;
  time: 'beat' | 'turns';
  seed?: number;
  start: string;
  counters?: Counter[];
  things: Thing[];
  screens: Screen[];
  rules: Rule[];
  blips?: Blip[];
  tunes?: Tune[];
}

/**
 * Reads a game. The engine checks everything when it plays; here we only make
 * sure it is a Chili Beat game the editor can show.
 */
export function parseGame(text: string): { doc: Game; issues: { message: string }[] } {
  let game: Partial<Game> | null = null;
  try {
    game = JSON.parse(text) as Partial<Game>;
  } catch {
    // Not JSON.
  }
  if (!game || typeof game !== 'object' || game.format !== 'chili-beat') {
    return { doc: parseGame(blank).doc, issues: [{ message: 'This is not a Chili Beat game.' }] };
  }
  if (game.version !== 1) {
    return { doc: parseGame(blank).doc, issues: [{ message: 'This game needs a newer Chili Beat.' }] };
  }
  return { doc: game as Game, issues: [] };
}

// Same layout as the chili-beat repo's files: a value goes on one line when it
// fits in 96 characters, and lists of lists always go one per line.
function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}

function format(value: unknown, indent: number): string {
  const line = inline(value);
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

/** A new game: a hero in a walled room and the arrow rule. */
export function blankGame(title: string): string {
  const game = parseGame(blank).doc;
  game.title = title;
  delete game.author;
  return serializeGame(game);
}
