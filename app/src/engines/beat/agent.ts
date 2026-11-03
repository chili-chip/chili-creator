import { defineAgentTool, docOf, editDoc, picture, type AgentTool, type JsonSchema } from '../../agent';
import type { Creator } from '../../creator';
import { encodePng, pngDataUrl } from '../../export/png';
import { addCounter, addScreen, addThing, deleteScreen, deleteThing, moveRule, paintCell, renameThingKey, screenById } from './edit';
import { LIMITS, serializeGame, type Blip, type Counter, type Game, type Rule, type Thing, type Tune } from './model';
import { BEAT_BUTTONS, loadEngine, type BeatPlayer } from './player';
import { boardRGBA } from './render';
import { addBlip, addTune, renameBlip, renameTune } from './sound';

// What AI agents can do in a Chili Beat game: the same edits as the Chili
// Beat editor's tools (edit.ts, sound.ts). The game is JSON, so most tools
// take parts of it as they are in the file (chili-beat docs/format.md).

const BEAT = 'beat';
const game = (creator: Creator) => docOf<Game>(creator, BEAT);
const edit = <R>(creator: Creator, recipe: (g: Game) => R) => editDoc<Game, R>(creator, BEAT, recipe);

// --- Schemas -----------------------------------------------------------------

const none: JsonSchema = { type: 'object', properties: {} };
const str = (description?: string): JsonSchema => ({ type: 'string', ...(description ? { description } : {}) });
const cell: JsonSchema = { type: 'integer', minimum: 0, maximum: 15 };
const colour: JsonSchema = { type: 'integer', minimum: 0, maximum: 15 };
const frames: JsonSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 2,
  items: { type: 'array', items: { type: 'string' } },
  description: 'One frame, or two to animate on the beat. A frame is 8 strings of 8 digits 0-3: the game’s 4 colours.',
};
const rows: JsonSchema = {
  type: 'array',
  items: { type: 'string' },
  description: '16 strings of 16 thing keys, top row first; "." is empty.',
};
const steps = (maximum: number, description: string): JsonSchema => ({
  type: 'array',
  minItems: 16,
  maxItems: 16,
  items: { type: 'integer', minimum: 0, maximum },
  description,
});
const lead = steps(15, 'Melody, 16 steps: 0 is a rest, 1 the root note, each step up the next note of the scale.');
const beatSteps = steps(10, 'Bass and drums, 16 steps: 0 is a rest, 1-7 bass notes, 8 kick, 9 snare, 10 hi-hat.');
const rule: JsonSchema = {
  type: 'object',
  description:
    'A card: {"when": trigger, "if": [conditions], "do": [actions]}. ' +
    'Triggers: {"start": true}, {"press": "a"|"b"|"arrow"|"up"|"down"|"left"|"right"}, {"bump": [match, match]}, ' +
    '{"every": beats, "thing": match}, {"counter": id, "reaches": n}. A match is a thing key, "you" or "any". ' +
    'Conditions (up to 2): {"chance": percent}, {"counter": id, "atLeast"|"atMost"|"exactly": n}. ' +
    'Actions (1 to 6): {"move"|"turn": way, "who"?}, {"become": key, "who"?}, {"vanish": true, "who"?}, {"make": key, "to": way, "who"?}, ' +
    '{"count": id, "add"|"set": n}, {"say": text}, {"sound": id}, {"go": screen id}, {"shake": true}, {"win": text}, {"lose": text}. ' +
    'way: up, down, left, right, forward, back, same, toward, away, random. who: you, it, bumper, bumped.',
};
const preset: JsonSchema = { type: 'string', enum: ['coin', 'jump', 'hit', 'boom', 'step', 'power', 'blip'] };
const scale: JsonSchema = { type: 'string', enum: ['major', 'minor', 'pentatonic-major', 'pentatonic-minor'] };
const soundFields: Record<string, JsonSchema> = {
  preset,
  pitch: { type: 'integer', minimum: 0, maximum: 7, description: 'Higher is higher.' },
  length: { type: 'integer', minimum: 0, maximum: 7, description: 'Higher is longer.' },
  slide: { type: 'integer', minimum: 0, maximum: 7, description: 'How much the pitch bends.' },
};
const buttonNames = Object.keys(BEAT_BUTTONS) as (keyof typeof BEAT_BUTTONS)[];

// --- Helpers -----------------------------------------------------------------

function readFrames(list: string[][]): string[][] {
  for (const frame of list) {
    if (frame.length !== 8 || frame.some((row) => !/^[0-3]{8}$/.test(row))) throw new Error('A frame is 8 rows of 8 digits (0 to 3).');
  }
  return list.map((frame) => [...frame]);
}

function readRows(g: Game, list: string[]): string[] {
  if (list.length !== 16 || list.some((row) => [...row].length !== 16)) throw new Error('A screen is 16 rows of 16 thing keys, "." for empty.');
  const keys = new Set(g.things.map((t) => t.key));
  for (const row of list) for (const key of row) if (key !== '.' && !keys.has(key)) throw new Error(`No thing has key "${key}".`);
  return [...list];
}

function thingIn(g: Game, key: string): Thing {
  const found = g.things.find((t) => t.key === key);
  if (!found) throw new Error(`No thing has key "${key}".`);
  return found;
}

function counterIn(g: Game, id: string): Counter {
  const found = g.counters?.find((c) => c.id === id);
  if (!found) throw new Error(`No counter has id "${id}".`);
  return found;
}

function blipIn(g: Game, id: string): Blip {
  const found = g.blips?.find((b) => b.id === id);
  if (!found) throw new Error(`No sound has id "${id}".`);
  return found;
}

function tuneIn(g: Game, id: string): Tune {
  const found = g.tunes?.find((t) => t.id === id);
  if (!found) throw new Error(`No tune has id "${id}".`);
  return found;
}

function screenIn(g: Game, id: string) {
  if (!g.screens.some((s) => s.id === id)) throw new Error(`No screen has id "${id}".`);
  return screenById(g, id);
}

/** Rule numbers count from 1, as the Rules tool and Problems show them. */
function ruleIndex(g: Game, number: number): number {
  if (number < 1 || number > g.rules.length) throw new Error(`There is no rule ${number}. The game has ${g.rules.length} rules.`);
  return number - 1;
}

const triggers = ['start', 'press', 'bump', 'every', 'counter'];
const actions = ['move', 'turn', 'become', 'vanish', 'make', 'count', 'say', 'sound', 'go', 'shake', 'win', 'lose'];

/** A quick check of a card's shape; the engine checks the values when it plays (beat_play). */
function readRule(value: Record<string, unknown>): Rule {
  const when = value.when as Record<string, unknown> | undefined;
  if (!when || typeof when !== 'object' || !triggers.some((t) => t in when)) throw new Error(`rule.when must be one of: ${triggers.join(', ')}.`);
  if (!Array.isArray(value.do) || value.do.length > LIMITS.actions) throw new Error(`rule.do must be a list of up to ${LIMITS.actions} actions.`);
  value.do.forEach((action: unknown, i) => {
    if (!action || typeof action !== 'object' || !actions.some((a) => a in action)) {
      throw new Error(`rule.do[${i}] must be one of: ${actions.join(', ')}.`);
    }
  });
  if (value.if !== undefined && (!Array.isArray(value.if) || value.if.length > LIMITS.conditions)) {
    throw new Error(`rule.if must be a list of up to ${LIMITS.conditions} conditions.`);
  }
  for (const key of Object.keys(value)) if (!['when', 'if', 'do'].includes(key)) throw new Error(`rule.${key} is not a known field. Known fields: when, if, do.`);
  return structuredClone(value) as unknown as Rule;
}

function screenPng(g: Game, id: string) {
  return encodePng(boardRGBA(g, screenIn(g, id)), 128, 128, { scale: 2 });
}

let engine: Promise<BeatPlayer> | null = null;

// --- Tools -------------------------------------------------------------------

export const beatAgentTools: AgentTool[] = [
  defineAgentTool({
    name: 'beat_get_game',
    title: 'Get Chili Beat game',
    description:
      'The open Chili Beat game as it is in its .beat file: 4 colours (indexes into the Sweetie 16 palette), tempo, beat or turns, ' +
      'the start screen, counters, things (8x8 pictures in colours 0-3, key is one character), screens (16x16 cells of thing keys on a ' +
      'world map), rules (cards, numbered from 1), sounds and tunes. Thing "you" is the player.',
    inputSchema: none,
    readOnly: true,
    run: (_input, { creator }) => {
      const g = game(creator);
      return { ...g, rules: g.rules.map((r, i) => ({ number: i + 1, ...r })) };
    },
  }),

  defineAgentTool<{ author?: string; palette?: number[]; tempo?: number; time?: 'beat' | 'turns'; start?: string; seed?: number }>({
    name: 'beat_set_game',
    title: 'Set Chili Beat game',
    description:
      'Game settings: author, the 4 colours (Sweetie 16 indexes 0-15; colour 0 is the background), tempo in beats a second (2-8), ' +
      'time ("beat": the world moves on the beat; "turns": only when the player presses), the start screen and the random seed. ' +
      'Use set_title for the title.',
    inputSchema: {
      type: 'object',
      properties: {
        author: str(),
        palette: { type: 'array', minItems: 4, maxItems: 4, items: colour },
        tempo: { type: 'integer', minimum: 2, maximum: 8 },
        time: { type: 'string', enum: ['beat', 'turns'] },
        start: str('A screen id.'),
        seed: { type: 'integer', minimum: 0, maximum: 4294967295 },
      },
    },
    run: ({ author, palette, tempo, time, start, seed }, { creator }) => {
      edit(creator, (g) => {
        if (start !== undefined) g.start = screenIn(g, start).id;
        if (author !== undefined) g.author = author;
        if (palette) g.palette = palette as Game['palette'];
        if (tempo !== undefined) g.tempo = tempo;
        if (time) g.time = time;
        if (seed !== undefined) g.seed = seed;
      });
      return { ok: true };
    },
  }),

  // Counters

  defineAgentTool<{ name?: string; icon?: string; start?: number }>({
    name: 'beat_add_counter',
    title: 'Add counter',
    description: 'Adds a counter (up to 4), drawn over the board with a thing as its icon. Rules count, check and react to it. Returns its id.',
    inputSchema: { type: 'object', properties: { name: str(), icon: str('A thing key.'), start: { type: 'integer', minimum: 0, maximum: 999 } } },
    run: ({ name, icon, start }, { creator }) => {
      const id = edit(creator, (g) => {
        if (icon !== undefined) thingIn(g, icon);
        const counter = addCounter(g);
        if (name !== undefined) counter.name = name;
        if (icon !== undefined) counter.icon = icon;
        if (start !== undefined) counter.start = start;
        return counter.id;
      });
      return { id };
    },
  }),

  defineAgentTool<{ id: string; name?: string; icon?: string; start?: number }>({
    name: 'beat_set_counter',
    title: 'Set counter',
    description: 'Changes a counter’s name, icon (a thing key) or starting value.',
    inputSchema: {
      type: 'object',
      properties: { id: str(), name: str(), icon: str('A thing key.'), start: { type: 'integer', minimum: 0, maximum: 999 } },
      required: ['id'],
    },
    run: ({ id, name, icon, start }, { creator }) => {
      edit(creator, (g) => {
        const counter = counterIn(g, id);
        if (icon !== undefined) counter.icon = thingIn(g, icon).key;
        if (name !== undefined) counter.name = name;
        if (start !== undefined) counter.start = start;
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'beat_remove_counter',
    title: 'Remove counter',
    description: 'Removes a counter. Rules that use it show up in list_problems.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (g) => {
        counterIn(g, id);
        g.counters = g.counters!.filter((c) => c.id !== id);
      });
      return { ok: true };
    },
  }),

  // Things

  defineAgentTool<{ name?: string; you?: boolean; frames?: string[][] }>({
    name: 'beat_add_thing',
    title: 'Add thing',
    description: 'Adds a thing (up to 64): a hero, wall, coin, enemy… Returns its key, the character screens use for it.',
    inputSchema: { type: 'object', properties: { name: str(), you: { type: 'boolean', description: 'The player controls it.' }, frames } },
    run: ({ name, you, frames: list }, { creator }) => {
      const pictures = list && readFrames(list);
      const key = edit(creator, (g) => {
        const thing = addThing(g);
        if (name !== undefined) thing.name = name;
        if (you) thing.you = true;
        if (pictures) thing.frames = pictures;
        return thing.key;
      });
      return { key };
    },
  }),

  defineAgentTool<{ key: string; newKey?: string; name?: string; you?: boolean; frames?: string[][] }>({
    name: 'beat_set_thing',
    title: 'Set thing',
    description: 'Changes a thing: its name, picture, whether it is "you", or its key (screens, counters and rules follow).',
    inputSchema: {
      type: 'object',
      properties: { key: str(), newKey: str('One character, not "."'), name: str(), you: { type: 'boolean' }, frames },
      required: ['key'],
    },
    run: ({ key, newKey, name, you, frames: list }, { creator }) => {
      const pictures = list && readFrames(list);
      if (newKey !== undefined && ([...newKey].length !== 1 || newKey === '.' || newKey === ' ')) throw new Error('A key is one character, not "." or a space.');
      edit(creator, (g) => {
        const thing = thingIn(g, key);
        if (name !== undefined) thing.name = name;
        if (you === true) thing.you = true;
        if (you === false) delete thing.you;
        if (pictures) thing.frames = pictures;
        if (newKey !== undefined && newKey !== key) renameThingKey(g, key, newKey);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ key: string }>({
    name: 'beat_remove_thing',
    title: 'Remove thing',
    description: 'Removes a thing and clears it off every screen. Rules that name it show up in list_problems.',
    inputSchema: { type: 'object', properties: { key: str() }, required: ['key'] },
    run: ({ key }, { creator }) => {
      edit(creator, (g) => {
        thingIn(g, key);
        deleteThing(g, key);
      });
      return { ok: true };
    },
  }),

  // Screens

  defineAgentTool<{ x: number; y: number }>({
    name: 'beat_add_screen',
    title: 'Add screen',
    description: 'Adds an empty screen at a place on the 8x8 world map. Walking off an edge leads to the screen next to it. Returns its id.',
    inputSchema: {
      type: 'object',
      properties: { x: { type: 'integer', minimum: 0, maximum: 7 }, y: { type: 'integer', minimum: 0, maximum: 7 } },
      required: ['x', 'y'],
    },
    run: ({ x, y }, { creator }) => ({ id: edit(creator, (g) => addScreen(g, x, y).id) }),
  }),

  defineAgentTool<{ id: string; newId?: string; things?: string[]; ground?: string[] | null; tune?: string | null; reset?: boolean; map?: number[] }>({
    name: 'beat_set_screen',
    title: 'Set screen',
    description:
      'Changes a screen: all its things at once, its ground layer (drawn under things; null clears it), its tune (null for none), ' +
      'reset (it starts fresh each visit), its place on the world map, or its id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: str(),
        newId: str(),
        things: rows,
        ground: { ...rows, type: ['array', 'null'] },
        tune: { type: ['string', 'null'] },
        reset: { type: 'boolean' },
        map: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 0, maximum: 7 } },
      },
      required: ['id'],
    },
    run: ({ id, newId, things, ground, tune, reset, map }, { creator }) => {
      edit(creator, (g) => {
        const screen = screenIn(g, id);
        if (things) screen.things = readRows(g, things);
        if (ground === null) delete screen.ground;
        else if (ground) screen.ground = readRows(g, ground);
        if (tune === null) delete screen.tune;
        else if (tune !== undefined) screen.tune = tuneIn(g, tune).id;
        if (reset === true) screen.reset = true;
        if (reset === false) delete screen.reset;
        if (map) {
          const taken = g.screens.find((s) => s !== screen && s.map[0] === map[0] && s.map[1] === map[1]);
          if (taken) throw new Error(`Screen "${taken.id}" is at ${map[0]},${map[1]} already.`);
          screen.map = [map[0]!, map[1]!];
        }
        if (newId !== undefined && newId !== id) {
          if (g.screens.some((s) => s.id === newId)) throw new Error(`A screen is already called ${newId}.`);
          screen.id = newId;
          if (g.start === id) g.start = newId;
          for (const r of g.rules) for (const a of r.do) if ('go' in a && a.go === id) a.go = newId;
        }
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ screen: string; layer?: 'things' | 'ground'; x: number; y: number; key: string }>({
    name: 'beat_paint',
    title: 'Paint cell',
    description: 'Puts a thing on one cell of a screen, on the things layer (default) or the ground layer. key "." empties the cell.',
    inputSchema: {
      type: 'object',
      properties: { screen: str(), layer: { type: 'string', enum: ['things', 'ground'] }, x: cell, y: cell, key: str() },
      required: ['screen', 'x', 'y', 'key'],
    },
    run: ({ screen, layer = 'things', x, y, key }, { creator }) => {
      edit(creator, (g) => {
        screenIn(g, screen);
        if (key !== '.') thingIn(g, key);
        paintCell(g, screen, layer, x, y, key);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'beat_remove_screen',
    title: 'Remove screen',
    description: 'Removes a screen. A game keeps at least one.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (g) => {
        screenIn(g, id);
        deleteScreen(g, id);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ screen: string }>({
    name: 'beat_screen_picture',
    title: 'Screen picture',
    description: 'A PNG of a screen as the game starts it, 256x256. Look at it to check your work.',
    inputSchema: { type: 'object', properties: { screen: str() }, required: ['screen'] },
    readOnly: true,
    run: ({ screen }, { creator }) => picture(screenPng(game(creator), screen), { screen }),
  }),

  defineAgentTool<{ screen?: string }>({
    name: 'beat_set_cover',
    title: 'Set cover',
    description: 'Makes a screen’s picture the game’s cover on the platform. The start screen when none is given.',
    inputSchema: { type: 'object', properties: { screen: str() } },
    run: async ({ screen }, { creator }) => {
      const g = game(creator);
      const id = screen ?? g.start;
      await creator.projects.setCover(pngDataUrl(screenPng(g, id)));
      return { ok: true, screen: id };
    },
  }),

  // Rules

  defineAgentTool<{ rule: Record<string, unknown>; at?: number }>({
    name: 'beat_add_rule',
    title: 'Add rule',
    description: 'Adds a rule card, at the end or at a number. Cards run in order. Returns its number.',
    inputSchema: { type: 'object', properties: { rule, at: { type: 'integer', minimum: 1 } }, required: ['rule'] },
    run: ({ rule: value, at }, { creator }) => {
      const card = readRule(value);
      const number = edit(creator, (g) => {
        if (g.rules.length >= LIMITS.rules) throw new Error('A game can have 128 rules.');
        const index = at === undefined ? g.rules.length : Math.min(at - 1, g.rules.length);
        g.rules.splice(index, 0, card);
        return index + 1;
      });
      return { ok: true, number };
    },
  }),

  defineAgentTool<{ number: number; rule: Record<string, unknown> }>({
    name: 'beat_set_rule',
    title: 'Set rule',
    description: 'Replaces a rule card by its number.',
    inputSchema: { type: 'object', properties: { number: { type: 'integer', minimum: 1 }, rule }, required: ['number', 'rule'] },
    run: ({ number, rule: value }, { creator }) => {
      const card = readRule(value);
      edit(creator, (g) => {
        g.rules[ruleIndex(g, number)] = card;
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ number: number; to: number }>({
    name: 'beat_move_rule',
    title: 'Move rule',
    description: 'Moves a rule card to another number. Cards run in order.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'integer', minimum: 1 }, to: { type: 'integer', minimum: 1 } },
      required: ['number', 'to'],
    },
    run: ({ number, to }, { creator }) => {
      edit(creator, (g) => {
        const from = ruleIndex(g, number);
        moveRule(g, from, ruleIndex(g, to) - from);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ number: number }>({
    name: 'beat_remove_rule',
    title: 'Remove rule',
    description: 'Removes a rule card by its number.',
    inputSchema: { type: 'object', properties: { number: { type: 'integer', minimum: 1 } }, required: ['number'] },
    run: ({ number }, { creator }) => {
      edit(creator, (g) => {
        g.rules.splice(ruleIndex(g, number), 1);
      });
      return { ok: true };
    },
  }),

  // Sounds

  defineAgentTool<{ id?: string; preset?: Blip['preset']; pitch?: number; length?: number; slide?: number }>({
    name: 'beat_add_sound',
    title: 'Add sound',
    description: 'Adds a sound effect (up to 16) that rules play with {"sound": id}. Returns its id.',
    inputSchema: { type: 'object', properties: { id: str(), ...soundFields } },
    run: ({ id, preset: kind, pitch, length, slide }, { creator }) => {
      const made = edit(creator, (g) => {
        const blip = addBlip(g);
        if (kind) blip.preset = kind;
        if (pitch !== undefined) blip.pitch = pitch;
        if (length !== undefined) blip.length = length;
        if (slide !== undefined) blip.slide = slide;
        if (id !== undefined) renameBlip(g, blip.id, id);
        return blip.id;
      });
      return { id: made };
    },
  }),

  defineAgentTool<{ id: string; newId?: string; preset?: Blip['preset']; pitch?: number; length?: number; slide?: number }>({
    name: 'beat_set_sound',
    title: 'Set sound',
    description: 'Changes a sound effect, or renames it (rules follow).',
    inputSchema: { type: 'object', properties: { id: str(), newId: str(), ...soundFields }, required: ['id'] },
    run: ({ id, newId, preset: kind, pitch, length, slide }, { creator }) => {
      edit(creator, (g) => {
        const blip = blipIn(g, id);
        if (kind) blip.preset = kind;
        if (pitch !== undefined) blip.pitch = pitch;
        if (length !== undefined) blip.length = length;
        if (slide !== undefined) blip.slide = slide;
        if (newId !== undefined && newId !== id) renameBlip(g, id, newId);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'beat_remove_sound',
    title: 'Remove sound',
    description: 'Removes a sound effect. Rules that play it show up in list_problems.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (g) => {
        blipIn(g, id);
        g.blips = g.blips!.filter((b) => b.id !== id);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ scale?: Tune['scale']; lead?: number[]; beat?: number[] }>({
    name: 'beat_add_tune',
    title: 'Add tune',
    description: 'Adds a 16-step tune (up to 8) that plays on the beat of the screens that use it. Returns its id.',
    inputSchema: { type: 'object', properties: { scale, lead, beat: beatSteps } },
    run: ({ scale: key, lead: melody, beat }, { creator }) => {
      const id = edit(creator, (g) => {
        const tune = addTune(g);
        if (key) tune.scale = key;
        if (melody) tune.lead = [...melody];
        if (beat) tune.beat = [...beat];
        return tune.id;
      });
      return { id };
    },
  }),

  defineAgentTool<{ id: string; newId?: string; scale?: Tune['scale']; lead?: number[]; beat?: number[] }>({
    name: 'beat_set_tune',
    title: 'Set tune',
    description:
      'Changes a tune: its scale, the lead (melody) and the beat (bass and drums), or renames it (screens follow).',
    inputSchema: { type: 'object', properties: { id: str(), newId: str(), scale, lead, beat: beatSteps }, required: ['id'] },
    run: ({ id, newId, scale: key, lead: melody, beat }, { creator }) => {
      edit(creator, (g) => {
        const tune = tuneIn(g, id);
        if (key) tune.scale = key;
        if (melody) tune.lead = [...melody];
        if (beat) tune.beat = [...beat];
        if (newId !== undefined && newId !== id) renameTune(g, id, newId);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'beat_remove_tune',
    title: 'Remove tune',
    description: 'Removes a tune; screens that played it go quiet.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (g) => {
        tuneIn(g, id);
        g.tunes = g.tunes!.filter((t) => t.id !== id);
        for (const screen of g.screens) if (screen.tune === id) delete screen.tune;
      });
      return { ok: true };
    },
  }),

  // Play

  defineAgentTool<{ buttons?: string[]; stepsAfter?: number }>({
    name: 'beat_play',
    title: 'Play',
    description:
      'Plays the open game from the start in the real Chili Beat engine, the one the console uses. It checks the whole game first ' +
      'and says what is wrong. Then it presses buttons one after another, runs stepsAfter steps (1/60 s each, 30 by default) ' +
      'after each, and sends back the screen as a PNG with the state: playing, won or lost, the screen, counters, ' +
      'the rules that ran last and the text showing.',
    inputSchema: {
      type: 'object',
      properties: {
        buttons: { type: 'array', maxItems: 64, items: { type: 'string', enum: buttonNames } },
        stepsAfter: { type: 'integer', minimum: 0, maximum: 600 },
      },
    },
    run: async ({ buttons = [], stepsAfter = 30 }, { creator }) => {
      const text = serializeGame(game(creator));
      engine ??= loadEngine();
      const player = await engine;
      const error = player.load(text);
      if (error) throw new Error(`The engine cannot play this game: ${error}`);
      player.step(0);
      for (const name of buttons) {
        player.step(BEAT_BUTTONS[name as keyof typeof BEAT_BUTTONS]);
        for (let i = 0; i < stepsAfter; i++) player.step(0);
      }
      const debug = player.debug();
      const data = {
        state: debug.state,
        screen: debug.screen,
        beat: debug.beat,
        counters: debug.counters,
        firedRules: debug.fired.map((i) => i + 1),
        text: debug.text,
      };
      return picture(encodePng(player.rgba(), 128, 128, { scale: 2 }), data);
    },
  }),
];
