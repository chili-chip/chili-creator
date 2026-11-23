import { defineAgentTool, docOf, editDoc, picture, type AgentTool, type JsonSchema } from '../../agent';
import type { Creator } from '../../creator';
import { encodePng, pngDataUrl } from '../../export/png';
import {
  addPicture,
  addRoom,
  addTile,
  deleteDialogue,
  deleteItem,
  deleteKind,
  deleteQuest,
  deleteRoom,
  deleteTile,
  paintCell,
  place,
  removeAt,
  renameId,
  renameRoom,
  resizeRoom,
  roomById,
} from './edit';
import { LIMITS, serializeGame, type Game, type Tile } from './model';
import { loadEngine, RPG_BUTTONS, type RpgPlayer } from './player';
import { roomRGBA } from './render';

// What AI agents can do in a Chili RPG game: the same edits as the Chili RPG
// editor's tools (edit.ts). The game is JSON, so most tools take parts of it
// as they are in the file (the game SDK's docs/rpg/game-file.md).

const RPG = 'rpg';
const game = (creator: Creator) => docOf<Game>(creator, RPG);
const edit = <R>(creator: Creator, recipe: (g: Game) => R) => editDoc<Game, R>(creator, RPG, recipe);

// --- Schemas -----------------------------------------------------------------

const str = (description?: string): JsonSchema => ({ type: 'string', ...(description ? { description } : {}) });
const coord: JsonSchema = { type: 'integer', minimum: 0, maximum: 63 };
const int = (minimum: number, maximum: number, description?: string): JsonSchema => ({ type: 'integer', minimum, maximum, ...(description ? { description } : {}) });
const EVENT =
  'An event is a list of actions, or {"if": [conditions], "do": [actions], "else": [actions]}. ' +
  'Conditions: {"flag"}, {"not"}, {"var", "op", "value"}, {"has", "count"}, {"quest", "stage", "op"} or {"quest", "done"}, {"stat", "op", "value"}. ' +
  'Actions: {"set"}, {"clear"}, {"add", "value"}, {"give", "count"}, {"take", "count"}, {"heal"}, {"hurt"}, {"xp"}, {"stat", "value"}, ' +
  '{"warp", "x", "y"}, {"say": dialogue}, {"quest", "stage"} or {"quest", "done": true}, {"sound"}, {"save": true}, {"end": "win"|"lose"}, {"remove": true}.';
const fields = (description: string): JsonSchema => ({ type: 'object', description: `${description} A field set to null is removed.` });
const id = (what: string): JsonSchema => str(`The ${what}'s id: 1 to 24 lower case letters, digits, - or _.`);
const buttonNames = Object.keys(RPG_BUTTONS) as (keyof typeof RPG_BUTTONS)[];

// --- Helpers -----------------------------------------------------------------

const ID = /^[a-z0-9_-]{1,24}$/;

function checkId(value: string) {
  if (!ID.test(value)) throw new Error('An id is 1 to 24 lower case letters, digits, - or _.');
}

function roomIn(g: Game, room: string) {
  if (!g.rooms.some((r) => r.id === room)) throw new Error(`No room has id "${room}".`);
  return roomById(g, room);
}

function tileIn(g: Game, key: string): Tile {
  const tile = g.tiles.find((t) => t.key === key);
  if (!tile) throw new Error(`No tile has key "${key}".`);
  return tile;
}

function readPicture(rows: string[]): string[] {
  if (rows.length !== 8 || rows.some((row) => !/^[0-9a-f.]{8}$/.test(row))) throw new Error('A picture is 8 rows of 8 characters, 0 to f or ".".');
  return [...rows];
}

function readRows(g: Game, rows: string[], top: boolean): string[] {
  const width = rows[0]?.length ?? 0;
  if (rows.length < LIMITS.roomMin || rows.length > LIMITS.roomMax || width < LIMITS.roomMin || width > LIMITS.roomMax || rows.some((r) => r.length !== width)) {
    throw new Error(`A room is ${LIMITS.roomMin} to ${LIMITS.roomMax} rows of the same width, ${LIMITS.roomMin} to ${LIMITS.roomMax} tile keys each.`);
  }
  for (const row of rows) for (const key of row) if (!(top && key === ' ')) tileIn(g, key);
  return [...rows];
}

/** Puts `patch` on `target`: null removes a field. */
function merge(target: object, patch: Record<string, unknown>) {
  const t = target as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'id') continue;
    if (value === null) delete t[key];
    else t[key] = structuredClone(value);
  }
}

/** Adds or changes a character, item, dialogue or quest, and renames it everywhere with `newId`. */
function upsert(g: Game, type: 'kind' | 'item' | 'dialogue' | 'quest', input: { id: string; newId?: string; patch?: Record<string, unknown> }, make: (id: string) => object) {
  checkId(input.id);
  const key = ({ kind: 'kinds', item: 'items', dialogue: 'dialogue', quest: 'quests' } as const)[type];
  const list = (g[key] ??= []) as { id: string }[];
  let found = list.find((x) => x.id === input.id);
  if (!found) {
    const limit = { kind: LIMITS.kinds, item: LIMITS.items, dialogue: LIMITS.dialogue, quest: LIMITS.quests }[type];
    if (list.length >= limit) throw new Error(`A game can have ${limit} of these.`);
    found = { id: input.id, ...make(input.id) };
    list.push(found);
  }
  merge(found, input.patch ?? {});
  if (input.newId && input.newId !== input.id) renameId(g, type, input.id, input.newId);
  return { id: input.newId ?? input.id };
}

function roomPng(g: Game, room: string) {
  const r = roomIn(g, room);
  return encodePng(roomRGBA(g, r), (r.ground[0]?.length ?? 16) * 8, r.ground.length * 8, { scale: 2 });
}

let engine: Promise<RpgPlayer> | null = null;

// --- Tools -------------------------------------------------------------------

export const rpgAgentTools: AgentTool[] = [
  defineAgentTool<{ pictures?: boolean }>({
    name: 'rpg_get_game',
    title: 'Get Chili RPG game',
    description:
      'The open Chili RPG game as it is in its .rpg file: start, hero look, rules, stats, levels, tiles (one-character keys), rooms ' +
      '(rows of tile keys, with actors, items, warps and triggers), kinds (characters), items, slots, dialogue and quests. ' +
      'Pictures (8x8, characters 0-f are Sweetie 16 colours, "." is clear) are left out unless pictures is true; pictureCount says how many there are.',
    inputSchema: { type: 'object', properties: { pictures: { type: 'boolean' } } },
    readOnly: true,
    run: ({ pictures }, { creator }) => {
      const g = game(creator);
      const { art, ...rest } = g;
      return { ...rest, ...(pictures ? { art } : {}), pictureCount: art?.pictures.length ?? 0 };
    },
  }),

  defineAgentTool<{
    author?: string | null;
    background?: string;
    start?: { room: string; x: number; y: number };
    rules?: Record<string, unknown>;
    player?: Record<string, unknown>;
    stats?: Record<string, number>;
    levels?: Record<string, unknown> | null;
    lose?: unknown;
  }>({
    name: 'rpg_set_game',
    title: 'Set Chili RPG game',
    description:
      'Game and hero settings, as in the file: author, background ("#rrggbb"), start {room, x, y}, rules {step_ms, repeat_ms, diagonal, bag, spread, crit}, ' +
      'player look {sprite, frames, sprites}, stats as {id: start value} (hp, max_hp, atk, def), levels {xp: [...], gain: {stat: n}}, ' +
      'and lose, the event when the hero dies. null removes author, levels or lose.',
    inputSchema: {
      type: 'object',
      properties: {
        author: { type: ['string', 'null'] },
        background: str('"#rrggbb", shown where tiles are clear.'),
        start: { type: 'object', properties: { room: str(), x: coord, y: coord }, required: ['room', 'x', 'y'] },
        rules: { type: 'object' },
        player: { type: 'object' },
        stats: { type: 'object', description: 'Start values by stat id.' },
        levels: { type: ['object', 'null'] },
        lose: { type: ['array', 'object', 'null'], description: `When the hero dies. ${EVENT}` },
      },
    },
    run: (input, { creator }) =>
      edit(creator, (g) => {
        if (input.start) {
          const room = roomIn(g, input.start.room);
          if (input.start.x >= (room.ground[0]?.length ?? 0) || input.start.y >= room.ground.length) throw new Error('The start is outside the room.');
          g.start = { ...input.start };
        }
        if (input.background !== undefined && !/^#[0-9a-fA-F]{6}$/.test(input.background)) throw new Error('background is "#rrggbb".');
        for (const [statId, value] of Object.entries(input.stats ?? {})) {
          const stat = g.stats.find((s) => s.id === statId);
          if (!stat) throw new Error(`No stat has id "${statId}". Stats: ${g.stats.map((s) => s.id).join(', ')}.`);
          stat.start = value;
        }
        const { start: _start, stats: _stats, ...rest } = input;
        merge(g, rest as Record<string, unknown>);
        return { ok: true };
      }),
  }),

  defineAgentTool<{ number?: number; rows: string[] }>({
    name: 'rpg_set_picture',
    title: 'Set picture',
    description: 'Draws a picture: 8 rows of 8 characters, 0 to f a Sweetie 16 colour, "." clear. Without number it adds one. Gives back its number, which tiles, characters and items use.',
    inputSchema: { type: 'object', properties: { number: int(0, LIMITS.pictures - 1), rows: { type: 'array', items: { type: 'string' } } }, required: ['rows'] },
    run: ({ number, rows }, { creator }) =>
      edit(creator, (g) => {
        const picture = readPicture(rows);
        if (number === undefined) number = addPicture(g);
        const list = g.art!.pictures;
        if (!list[number]) throw new Error(`There is no picture ${number}. The game has ${list.length}; leave number out to add one.`);
        list[number] = picture;
        return { number };
      }),
  }),

  defineAgentTool<{ key?: string; sprite?: number | number[]; frame_ms?: number | null; solid?: boolean | null; water?: boolean | null; save?: boolean | null; damage?: number | null }>({
    name: 'rpg_set_tile',
    title: 'Set tile',
    description: 'Adds a tile type (no key) or changes one: sprite (a picture number, or up to 4 to animate), frame_ms, solid, water, save, damage. null removes a field. Gives back its key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: str('One character.'),
        sprite: { type: ['integer', 'array'], items: int(0, 255) },
        frame_ms: { type: ['integer', 'null'], minimum: 50, maximum: 5000 },
        solid: { type: ['boolean', 'null'] },
        water: { type: ['boolean', 'null'] },
        save: { type: ['boolean', 'null'] },
        damage: { type: ['integer', 'null'], minimum: 0, maximum: 999 },
      },
    },
    run: ({ key, ...rest }, { creator }) =>
      edit(creator, (g) => {
        const tile = key === undefined ? addTile(g, typeof rest.sprite === 'number' ? rest.sprite : 0) : g.tiles.find((t) => t.key === key) ?? null;
        if (!tile) {
          if (!/^[!-~]$/.test(key!)) throw new Error('A tile key is one printable character, not a space.');
          g.tiles.push({ key: key!, sprite: 0 });
        }
        merge(tile ?? g.tiles.at(-1)!, rest);
        return { key: (tile ?? g.tiles.at(-1)!).key };
      }),
  }),

  defineAgentTool<{ key: string }>({
    name: 'rpg_remove_tile',
    title: 'Remove tile',
    description: 'Removes a tile type. The first other tile takes its place on the ground; on the top layer its cells become empty.',
    inputSchema: { type: 'object', properties: { key: str() }, required: ['key'] },
    run: ({ key }, { creator }) =>
      edit(creator, (g) => {
        tileIn(g, key);
        deleteTile(g, key);
        return { ok: true };
      }),
  }),

  // Rooms

  defineAgentTool<{ id?: string; width?: number; height?: number }>({
    name: 'rpg_add_room',
    title: 'Add room',
    description: 'Adds a room filled with the first tile, 16x16 by default and up to 64x64. Rooms bigger than the screen scroll.',
    inputSchema: { type: 'object', properties: { id: id('room'), width: int(16, 64), height: int(16, 64) } },
    run: (input, { creator }) =>
      edit(creator, (g) => {
        const room = addRoom(g);
        if (input.id) renameRoom(g, room.id, input.id);
        if (input.width || input.height) resizeRoom(g, room.id, input.width ?? 16, input.height ?? 16);
        return { id: room.id };
      }),
  }),

  defineAgentTool<{ id: string; newId?: string; name?: string | null; ground?: string[]; top?: string[] | null; music?: string | null }>({
    name: 'rpg_set_room',
    title: 'Set room',
    description:
      'Changes a room: name, the whole ground (rows of tile keys, all the same width), the top layer drawn over people (same size; a space is empty; null removes it), ' +
      'music (a song id), or its id with newId (warps and quests follow).',
    inputSchema: {
      type: 'object',
      properties: {
        id: str(),
        newId: id('room'),
        name: { type: ['string', 'null'] },
        ground: { type: 'array', items: { type: 'string' } },
        top: { type: ['array', 'null'], items: { type: 'string' } },
        music: { type: ['string', 'null'] },
      },
      required: ['id'],
    },
    run: ({ id: roomId, newId, ground, top, ...rest }, { creator }) =>
      edit(creator, (g) => {
        const room = roomIn(g, roomId);
        if (ground) room.ground = readRows(g, ground, false);
        if (top === null) delete room.top;
        else if (top) {
          if (top.length !== room.ground.length || top.some((r) => r.length !== room.ground[0]!.length)) throw new Error('top must be the same size as ground.');
          room.top = readRows(g, top, true);
        }
        merge(room, rest);
        if (newId && newId !== roomId) renameRoom(g, roomId, newId);
        return { id: newId ?? roomId };
      }),
  }),

  defineAgentTool<{ id: string; width: number; height: number }>({
    name: 'rpg_resize_room',
    title: 'Resize room',
    description: 'Changes a room size, 16 to 64 each way. New cells get the first tile; what ends up outside is dropped, and the start and warps move in.',
    inputSchema: { type: 'object', properties: { id: str(), width: int(16, 64), height: int(16, 64) }, required: ['id', 'width', 'height'] },
    run: ({ id: roomId, width, height }, { creator }) =>
      edit(creator, (g) => {
        roomIn(g, roomId);
        resizeRoom(g, roomId, width, height);
        return { ok: true };
      }),
  }),

  defineAgentTool<{ room: string; layer?: 'ground' | 'top'; x: number; y: number; key: string; width?: number; height?: number }>({
    name: 'rpg_paint',
    title: 'Paint',
    description: 'Paints a tile key on a cell, or a block of width x height cells from x, y. On the top layer, " " is empty.',
    inputSchema: {
      type: 'object',
      properties: { room: str(), layer: { type: 'string', enum: ['ground', 'top'] }, x: coord, y: coord, key: str(), width: int(1, 64), height: int(1, 64) },
      required: ['room', 'x', 'y', 'key'],
    },
    run: ({ room: roomId, layer = 'ground', x, y, key, width = 1, height = 1 }, { creator }) =>
      edit(creator, (g) => {
        const room = roomIn(g, roomId);
        if (!(layer === 'top' && key === ' ')) tileIn(g, key);
        const w = room.ground[0]!.length;
        if (x + width > w || y + height > room.ground.length) throw new Error(`The room is ${w}x${room.ground.length}.`);
        for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) paintCell(g, roomId, layer, x + dx, y + dy, key);
        return { ok: true };
      }),
  }),

  defineAgentTool<{
    room: string;
    x: number;
    y: number;
    character?: string;
    item?: string;
    count?: number;
    warp?: { to: string; x: number; y: number };
    trigger?: Record<string, unknown>;
    start?: boolean;
  }>({
    name: 'rpg_place',
    title: 'Place',
    description:
      'Places one thing on a cell: a character (kind id), an item (item id, count), a warp {to: room, x, y}, a trigger {if, do, else, once} ' +
      'that runs when the hero steps there, or the start. A character or item replaces the one on the cell.',
    inputSchema: {
      type: 'object',
      properties: {
        room: str(),
        x: coord,
        y: coord,
        character: str(),
        item: str(),
        count: int(1, 99),
        warp: { type: 'object', properties: { to: str(), x: coord, y: coord }, required: ['to', 'x', 'y'] },
        trigger: { type: 'object', description: `{"if": [...], "do": [...], "else": [...], "once": true}. ${EVENT}` },
        start: { type: 'boolean' },
      },
      required: ['room', 'x', 'y'],
    },
    run: ({ room: roomId, x, y, character, item, count, warp, trigger, start }, { creator }) =>
      edit(creator, (g) => {
        const room = roomIn(g, roomId);
        if (x >= room.ground[0]!.length || y >= room.ground.length) throw new Error('That cell is outside the room.');
        if ([character, item, warp, trigger, start].filter((v) => v !== undefined && v !== false).length !== 1) {
          throw new Error('Give one of character, item, warp, trigger or start.');
        }
        if (character !== undefined) {
          if (!g.kinds?.some((k) => k.id === character)) throw new Error(`No character has id "${character}".`);
          place(g, roomId, { kind: character }, x, y);
        } else if (item !== undefined) {
          if (!g.items?.some((i) => i.id === item)) throw new Error(`No item has id "${item}".`);
          place(g, roomId, { item }, x, y);
          if (count && count > 1) room.items!.at(-1)!.count = count;
        } else if (warp) {
          roomIn(g, warp.to);
          place(g, roomId, { warp: true }, x, y);
          Object.assign(room.warps!.at(-1)!, { to: warp.to, tx: warp.x, ty: warp.y });
        } else if (trigger) {
          place(g, roomId, { trigger: true }, x, y);
          const t = room.triggers!.at(-1)!;
          delete t.do;
          merge(t, trigger);
        } else {
          place(g, roomId, { start: true }, x, y);
        }
        return { ok: true };
      }),
  }),

  defineAgentTool<{ room: string; x: number; y: number }>({
    name: 'rpg_clear_cell',
    title: 'Clear cell',
    description: 'Removes the characters, items, warps and triggers on a cell. The tiles and the start stay.',
    inputSchema: { type: 'object', properties: { room: str(), x: coord, y: coord }, required: ['room', 'x', 'y'] },
    run: ({ room, x, y }, { creator }) =>
      edit(creator, (g) => {
        roomIn(g, room);
        removeAt(g, room, x, y);
        return { ok: true };
      }),
  }),

  defineAgentTool<{ id: string }>({
    name: 'rpg_remove_room',
    title: 'Remove room',
    description: 'Removes a room and the warps into it. Not the start room.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id: roomId }, { creator }) =>
      edit(creator, (g) => {
        roomIn(g, roomId);
        deleteRoom(g, roomId);
        return { ok: true };
      }),
  }),

  defineAgentTool<{ room: string }>({
    name: 'rpg_room_picture',
    title: 'Room picture',
    description: 'A PNG of a whole room as the game starts it, 16 pixels a tile. Warps and triggers are not drawn. Look at it to check your work.',
    inputSchema: { type: 'object', properties: { room: str() }, required: ['room'] },
    readOnly: true,
    run: ({ room }, { creator }) => picture(roomPng(game(creator), room), { room }),
  }),

  defineAgentTool<{ room?: string }>({
    name: 'rpg_set_cover',
    title: 'Set cover',
    description: 'Makes the first 16x16 tiles of a room the game cover on the platform. The start room when none is given.',
    inputSchema: { type: 'object', properties: { room: str() } },
    run: async ({ room }, { creator }) => {
      const g = game(creator);
      const r = roomIn(g, room ?? g.start.room);
      const full = roomRGBA(g, r);
      const w = r.ground[0]!.length * 8;
      const cover = new Uint8ClampedArray(128 * 128 * 4);
      for (let y = 0; y < 128; y++) cover.set(full.subarray(y * w * 4, (y * w + 128) * 4), y * 128 * 4);
      await creator.projects.setCover(pngDataUrl(encodePng(cover, 128, 128, { scale: 2 })));
      return { ok: true, room: r.id };
    },
  }),

  // Characters, items, dialogue, quests

  defineAgentTool<{ id: string; newId?: string; character?: Record<string, unknown> }>({
    name: 'rpg_set_character',
    title: 'Set character',
    description:
      'Adds or changes a kind of character, with its fields as in the file: name, sprite, frames, friendly, brain (still, wander, chase, guard, patrol, coward), ' +
      'sight, home, flee, speed, stats {hp, atk, def}, xp, drops [{item, chance, count}], talk (dialogue id), bump and death (events). newId renames it everywhere.',
    inputSchema: { type: 'object', properties: { id: id('character'), newId: id('character'), character: fields(EVENT) }, required: ['id'] },
    run: ({ id: kindId, newId, character }, { creator }) =>
      edit(creator, (g) => upsert(g, 'kind', { id: kindId, newId, patch: character }, () => ({ name: kindId, sprite: 0 }))),
  }),

  defineAgentTool<{ id: string; newId?: string; item?: Record<string, unknown> }>({
    name: 'rpg_set_item',
    title: 'Set item',
    description:
      'Adds or changes an item, with its fields as in the file: name, text, icon (picture number), kind (use, equip, key, quest), stack, ' +
      'slot and bonus {stat: n} for equip, and use (an event) for use. newId renames it everywhere.',
    inputSchema: { type: 'object', properties: { id: id('item'), newId: id('item'), item: fields(EVENT) }, required: ['id'] },
    run: ({ id: itemId, newId, item }, { creator }) => edit(creator, (g) => upsert(g, 'item', { id: itemId, newId, patch: item }, () => ({ name: itemId }))),
  }),

  defineAgentTool<{ slots: string[] }>({
    name: 'rpg_set_slots',
    title: 'Set equipment slots',
    description: 'The equipment slots, for example ["weapon", "armour", "charm"]. Up to 8.',
    inputSchema: { type: 'object', properties: { slots: { type: 'array', maxItems: LIMITS.slots, items: str() } }, required: ['slots'] },
    run: ({ slots }, { creator }) =>
      edit(creator, (g) => {
        slots.forEach(checkId);
        if (slots.length) g.slots = [...slots];
        else delete g.slots;
        return { ok: true };
      }),
  }),

  defineAgentTool<{ id: string; newId?: string; dialogue?: Record<string, unknown> }>({
    name: 'rpg_set_dialogue',
    title: 'Set dialogue',
    description:
      'Adds or changes a dialogue: who (a character id or any name), face, and lines [{text, id, who, if, do, else, choices: [{text, goto, if, do, else}]}]. ' +
      'A line with if is skipped when it fails. A choice goes to the line with that id, or ends the talk. newId renames it everywhere.',
    inputSchema: { type: 'object', properties: { id: id('dialogue'), newId: id('dialogue'), dialogue: fields(EVENT) }, required: ['id'] },
    run: ({ id: dialogueId, newId, dialogue }, { creator }) =>
      edit(creator, (g) => upsert(g, 'dialogue', { id: dialogueId, newId, patch: dialogue }, () => ({ lines: [{ text: '...' }] }))),
  }),

  defineAgentTool<{ id: string; newId?: string; quest?: Record<string, unknown> }>({
    name: 'rpg_set_quest',
    title: 'Set quest',
    description:
      'Adds or changes a quest: title and up to 8 stages [{log, goal, done}]. A goal is {talk: kind}, {collect: item, count}, {defeat: kind, count}, ' +
      '{reach: room, x, y} or {flag}. done is an event. Start a quest with the action {"quest": id, "stage": 1}. newId renames it everywhere.',
    inputSchema: { type: 'object', properties: { id: id('quest'), newId: id('quest'), quest: fields(EVENT) }, required: ['id'] },
    run: ({ id: questId, newId, quest }, { creator }) =>
      edit(creator, (g) => upsert(g, 'quest', { id: questId, newId, patch: quest }, () => ({ stages: [{ log: '' }] }))),
  }),

  ...(
    [
      ['character', 'Remove character', 'Removes a kind of character and its people in every room.', (g: Game, x: string) => deleteKind(g, x), (g: Game) => g.kinds],
      ['item', 'Remove item', 'Removes an item, the ones lying in rooms, and drops of it.', (g: Game, x: string) => deleteItem(g, x), (g: Game) => g.items],
      ['dialogue', 'Remove dialogue', 'Removes a dialogue.', (g: Game, x: string) => deleteDialogue(g, x), (g: Game) => g.dialogue],
      ['quest', 'Remove quest', 'Removes a quest.', (g: Game, x: string) => deleteQuest(g, x), (g: Game) => g.quests],
    ] as const
  ).map(([what, title, description, remove, list]) =>
    defineAgentTool<{ id: string }>({
      name: `rpg_remove_${what}`,
      title,
      description: `${description} Problems lists what still names it.`,
      inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
      run: ({ id: target }, { creator }) =>
        edit(creator, (g) => {
          if (!list(g)?.some((x) => x.id === target)) throw new Error(`No ${what} has id "${target}".`);
          remove(g, target);
          return { ok: true };
        }),
    }),
  ),

  // Play

  defineAgentTool<{ buttons?: string[]; stepsAfter?: number }>({
    name: 'rpg_play',
    title: 'Play',
    description:
      'Plays the open game from the start in the real Chili RPG engine, the one the console uses. It checks the whole game first and says what is wrong. ' +
      'Then it presses buttons one after another (a talks and picks up, b waits a turn, x opens the bag, y the quests), runs stepsAfter steps ' +
      '(1/60 s each, 30 by default) after each, and sends back the screen as a PNG with the state: playing, won or lost, room, x, y, hp, level, ' +
      'the text and choices showing, flags, variables, quests and the bag.',
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
        player.step(RPG_BUTTONS[name as keyof typeof RPG_BUTTONS]);
        for (let i = 0; i < stepsAfter; i++) player.step(0);
      }
      return picture(encodePng(player.rgba(), 128, 128, { scale: 2 }), player.debug());
    },
  }),
];
