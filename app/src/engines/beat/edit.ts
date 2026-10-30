// Edits on a game, for tools to run inside `projects.updateDoc<Game>`.
import { LIMITS, type Action, type Counter, type Game, type Rule, type Screen, type Thing, type Trigger } from './model';

const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*+-/:;<=>?@[]^_{|}~#,';
const EMPTY_ROW = '.'.repeat(16);

export function nextKey(game: Game): string {
  const used = new Set(game.things.map((t) => t.key));
  const key = [...KEYS].find((k) => !used.has(k));
  if (!key) throw new Error('A game can have 64 things.');
  return key;
}

export function addThing(game: Game): Thing {
  if (game.things.length >= LIMITS.things) throw new Error('A game can have 64 things.');
  const number = game.things.filter((t) => t.name.startsWith('Thing ')).length + 1;
  const thing: Thing = { key: nextKey(game), name: `Thing ${number}`, frames: [Array(8).fill('00000000')] };
  game.things.push(thing);
  return thing;
}

function thing(game: Game, key: string): Thing {
  const found = game.things.find((t) => t.key === key);
  if (!found) throw new Error(`No thing has key ${key}`);
  return found;
}

export function setPixel(game: Game, key: string, frame: number, x: number, y: number, colour: number) {
  const rows = thing(game, key).frames[frame]!;
  rows[y] = rows[y]!.slice(0, x) + String(colour) + rows[y]!.slice(x + 1);
}

export function screenById(game: Game, id: string): Screen {
  const screen = game.screens.find((s) => s.id === id);
  if (!screen) throw new Error(`No screen has id ${id}`);
  return screen;
}

export function screenAt(game: Game, x: number, y: number): Screen | undefined {
  return game.screens.find((s) => s.map[0] === x && s.map[1] === y);
}

export function paintCell(game: Game, screenId: string, layer: 'things' | 'ground', x: number, y: number, key: string) {
  const screen = screenById(game, screenId);
  const rows = layer === 'things' ? screen.things : (screen.ground ??= Array(16).fill(EMPTY_ROW));
  rows[y] = rows[y]!.slice(0, x) + key + rows[y]!.slice(x + 1);
  if (layer === 'ground' && rows.every((row) => row === EMPTY_ROW)) delete screen.ground;
}

function freeId(taken: string[], base: string): string {
  for (let n = 1; ; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`;
}

export function addScreen(game: Game, x: number, y: number): Screen {
  if (game.screens.length >= LIMITS.screens) throw new Error('A game can have 64 screens.');
  if (screenAt(game, x, y)) throw new Error('There is a screen here already.');
  const screen: Screen = {
    id: freeId(game.screens.map((s) => s.id), 'screen'),
    map: [x, y],
    things: Array(16).fill(EMPTY_ROW),
  };
  game.screens.push(screen);
  return screen;
}

export function deleteScreen(game: Game, id: string) {
  if (game.screens.length === 1) throw new Error('A game needs one screen.');
  game.screens = game.screens.filter((s) => s.id !== id);
  if (game.start === id) game.start = game.screens[0]!.id;
}

/** Calls `visit` on every place a rule names a thing, so it can be changed. */
function forEachKeyInRules(rule: Rule, visit: (key: string) => string) {
  const when = rule.when as Record<string, unknown>;
  if ('bump' in when) when.bump = (when.bump as string[]).map(visit);
  if ('every' in when) when.thing = visit(when.thing as string);
  for (const action of rule.do as Record<string, unknown>[]) {
    if ('become' in action) action.become = visit(action.become as string);
    if ('make' in action) action.make = visit(action.make as string);
  }
}

export function renameThingKey(game: Game, from: string, to: string) {
  if (game.things.some((t) => t.key === to)) throw new Error(`Key ${to} is in use.`);
  thing(game, from).key = to;
  const swap = (row: string) => row.split('').map((c) => (c === from ? to : c)).join('');
  for (const screen of game.screens) {
    screen.things = screen.things.map(swap);
    if (screen.ground) screen.ground = screen.ground.map(swap);
  }
  for (const counter of game.counters ?? []) if (counter.icon === from) counter.icon = to;
  game.rules.forEach((rule) => forEachKeyInRules(rule, (k) => (k === from ? to : k)));
}

/** Removes a thing from the game and its screens. Rules that name it are left for Problems to point at. */
export function deleteThing(game: Game, key: string) {
  if (game.things.length === 1) throw new Error('A game needs one thing.');
  game.things = game.things.filter((t) => t.key !== key);
  const clear = (row: string) => row.split('').map((c) => (c === key ? '.' : c)).join('');
  for (const screen of game.screens) {
    screen.things = screen.things.map(clear);
    if (screen.ground) screen.ground = screen.ground.map(clear);
  }
}

export function addRule(game: Game, rule: Rule = { when: { press: 'a' }, do: [{ say: 'Hello!' }] }) {
  if (game.rules.length >= LIMITS.rules) throw new Error('A game can have 128 rules.');
  game.rules.push(rule);
}

export function moveRule(game: Game, index: number, by: number) {
  const to = index + by;
  if (to < 0 || to >= game.rules.length) return;
  const [rule] = game.rules.splice(index, 1);
  game.rules.splice(to, 0, rule!);
}

export function addCounter(game: Game): Counter {
  game.counters ??= [];
  if (game.counters.length >= LIMITS.counters) throw new Error('A game can have 4 counters.');
  const counter: Counter = {
    id: freeId(game.counters.map((c) => c.id), 'counter'),
    name: `Counter ${game.counters.length + 1}`,
    icon: game.things[0]!.key,
    start: 0,
  };
  game.counters.push(counter);
  return counter;
}

/** Default triggers and actions offered when a card changes kind. */
export function defaultTrigger(kind: string, game: Game): Trigger {
  const you = 'you';
  const first = game.things[0]!.key;
  switch (kind) {
    case 'start': return { start: true };
    case 'bump': return { bump: [you, first] };
    case 'every': return { every: 1, thing: first };
    case 'counter': return { counter: game.counters?.[0]?.id ?? '', reaches: 1 };
    default: return { press: 'arrow' };
  }
}

export function defaultAction(kind: string, game: Game): Action {
  const first = game.things[0]!.key;
  switch (kind) {
    case 'turn': return { turn: 'same' };
    case 'become': return { become: first };
    case 'vanish': return { vanish: true };
    case 'make': return { make: first, to: 'forward' };
    case 'count': return { count: game.counters?.[0]?.id ?? '', add: 1 };
    case 'say': return { say: 'Hello!' };
    case 'sound': return { sound: game.blips?.[0]?.id ?? '' };
    case 'go': return { go: game.screens[0]!.id };
    case 'shake': return { shake: true };
    case 'win': return { win: 'You win!' };
    case 'lose': return { lose: 'You lose.' };
    default: return { move: 'same' };
  }
}
