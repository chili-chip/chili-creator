import { defineAgentTool, docOf, editDoc, picture, titleOf, type AgentTool, type JsonSchema } from '../../agent';
import type { Creator } from '../../creator';
import {
  AVATAR,
  addBlip,
  addDialog,
  addDrawing,
  addEnding,
  addExit,
  addPalette,
  addRoom,
  addTune,
  blipKinds,
  blipOf,
  byId,
  clearFrame,
  dialogText,
  drawingsOf,
  duplicateDrawing,
  duplicateRoom,
  duplicateTune,
  eraseAt,
  eraseMarkerAt,
  exitAt,
  fillPixels,
  flipDrawing,
  generateBlip,
  giveDialog,
  keyNameOf,
  keys,
  mutateBlip,
  paceBlip,
  paintTile,
  placeSprite,
  readFontFile,
  referencesTo,
  removeBlip,
  removeDialog,
  removeDrawing,
  removeEndingAt,
  removeExit,
  removePalette,
  removeRoom,
  removeTune,
  removeVariable,
  renameVariable,
  returnExitOf,
  roomPixels,
  search,
  setCustomFont,
  setDialogText,
  setExitDest,
  setExitDialog,
  setKey,
  setPixel,
  setStartingItem,
  setTwoWay,
  stretchBlip,
  transposeBlip,
  tuneOf,
  updateBlip,
  updateTune,
  type Drawing,
  type DrawingKind,
  type Exit,
  type Frame,
  type Id,
  type KeyName,
  type Pitch,
  type Rgb,
  type Room,
  type Target,
  type World,
} from '../../bitsy';
import { fileName } from '../../export/files';
import { exportHtml, loadHtmlParts } from '../../export/html';
import { encodePng, pngDataUrl } from '../../export/png';
import { Button } from '../../player';

// What AI agents can do in a Bitsy game. Each tool is a thin layer over the
// same edits the Bitsy editor's tools make (bitsy/edit.ts, story.ts, sound.ts).

const BITSY = 'bitsy';
const world = (creator: Creator) => docOf<World>(creator, BITSY);
const edit = <R>(creator: Creator, recipe: (w: World) => R) => editDoc<World, R>(creator, BITSY, recipe);

// --- Schemas -----------------------------------------------------------------

const none: JsonSchema = { type: 'object', properties: {} };
const str = (description?: string): JsonSchema => ({ type: 'string', ...(description ? { description } : {}) });
const cell: JsonSchema = { type: 'integer', minimum: 0, maximum: 15 };
const pixel: JsonSchema = { type: 'integer', minimum: 0, maximum: 7 };
const kind: JsonSchema = { type: 'string', enum: ['tiles', 'sprites', 'items'], description: 'tiles, sprites or items.' };
const nullableId = (description: string): JsonSchema => ({ type: ['string', 'null'], description });
const at = (description = 'The room id.'): Record<string, JsonSchema> => ({ room: str(description), x: cell, y: cell });
const frames: JsonSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 2,
  items: { type: 'array', items: { type: 'string' } },
  description: 'One frame, or two to animate. A frame is 8 strings of 8 digits, top row first: 1 is drawn, 0 is background.',
};
const colors: JsonSchema = {
  type: 'array',
  minItems: 3,
  items: { type: 'string' },
  description: 'Background, tiles, sprites and items, as #rrggbb.',
};
const bar: JsonSchema = {
  type: 'array',
  minItems: 16,
  maxItems: 16,
  items: {
    type: 'object',
    properties: {
      beats: { type: 'integer', minimum: 0, maximum: 16, description: 'How long it sounds; 0 is a rest.' },
      note: { type: 'integer', minimum: 0, maximum: 11, description: 'Chromatic 0-11 (C to B), or the scale degree 0-6 when the tune has a key.' },
      octave: { type: 'integer', minimum: 2, maximum: 5 },
      blip: str('A blip played instead of the note.'),
    },
    required: ['beats', 'note', 'octave'],
  },
};
const bars: JsonSchema = { type: 'array', items: bar, description: 'Bars of 16 steps each.' };

// --- Helpers -----------------------------------------------------------------

const singular: Record<DrawingKind, string> = { tiles: 'tile', sprites: 'sprite', items: 'item' };

function drawingIn(w: World, k: DrawingKind, id: Id): Drawing {
  const found = byId(drawingsOf(w, k), id);
  if (!found) throw new Error(`No ${singular[k]} has id "${id}".`);
  return found;
}

function roomIn(w: World, id: Id): Room {
  const found = byId(w.rooms, id);
  if (!found) throw new Error(`No room has id "${id}".`);
  return found;
}

const hex = (rgb: Rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;

function rgbOf(text: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text);
  if (!match) throw new Error(`Colours are #rrggbb, like #ff8800. Got "${text}".`);
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)];
}

function readFrames(rows: string[][]): Frame[] {
  return rows.map((frame) => {
    if (frame.length !== 8 || frame.some((row) => !/^[01]{8}$/.test(row))) throw new Error('A frame is 8 rows of 8 digits (0 or 1).');
    return frame.flatMap((row) => [...row].map(Number));
  });
}

const writeFrame = (frame: Frame) => Array.from({ length: 8 }, (_, y) => frame.slice(y * 8, y * 8 + 8).join(''));

const optionalId = (target: { dialog?: Id; blip?: Id }, field: 'dialog' | 'blip', value: string | null | undefined) => {
  if (value === undefined) return;
  if (value === null) delete target[field];
  else target[field] = value;
};

function drawingInfo(k: DrawingKind, d: Drawing & { wall?: boolean; dialog?: Id; blip?: Id; position?: unknown }) {
  return {
    id: d.id,
    name: d.name,
    frames: d.frames.length,
    ...(k === 'tiles' ? { wall: !!d.wall } : {}),
    dialog: d.dialog,
    blip: d.blip,
    position: d.position,
  };
}

function exitInfo(w: World, room: Room, exit: Exit, index: number) {
  return {
    x: exit.x,
    y: exit.y,
    to: exit.dest,
    transition: exit.transition,
    dialog: exit.dialog,
    twoWay: returnExitOf(w, room.id, index) !== undefined,
  };
}

function roomPng(w: World, id: Id, scale = 2) {
  return encodePng(roomPixels(w, id), 128, 128, { scale });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(test: () => boolean, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(10)) if (test()) return true;
  return test();
}

const buttons: Record<string, Button> = {
  up: Button.Up,
  down: Button.Down,
  left: Button.Left,
  right: Button.Right,
  ok: Button.Ok,
  menu: Button.Menu,
};

// --- Tools -------------------------------------------------------------------

export const bitsyAgentTools: AgentTool[] = [
  defineAgentTool({
    name: 'bitsy_get_world',
    title: 'Get Bitsy game',
    description:
      'A map of the open Bitsy game: settings, where the avatar starts, palettes, rooms, tiles, sprites, items, dialogs, ' +
      'variables, tunes and blips, with their ids. Rooms are 16x16 cells; drawings are 8x8 pixels. Sprite "A" is the avatar.',
    inputSchema: none,
    readOnly: true,
    run: (_input, { creator }) => {
      const w = world(creator);
      return {
        title: w.title,
        font: w.defaultFont ?? 'ascii_small',
        textDirection: w.textDirection === 'RTL' ? 'RTL' : 'LTR',
        textSize: w.flags.TXT_MODE === '1' ? 'chunky' : 'default',
        start: byId(w.sprites, AVATAR)?.position ?? null,
        palettes: w.palettes.map((p) => ({ id: p.id, name: p.name, colors: p.colors.map(hex) })),
        rooms: w.rooms.map((r) => ({ id: r.id, name: r.name, palette: r.palette, tune: r.tune })),
        tiles: w.tiles.map((d) => drawingInfo('tiles', d)),
        sprites: w.sprites.map((d) => drawingInfo('sprites', d)),
        items: w.items.map((d) => drawingInfo('items', d)),
        dialogs: [...w.dialogs, ...w.endings].map((d) => ({ id: d.id, name: d.name, text: dialogText(w, d.id) })),
        variables: w.variables.map((v) => ({ name: v.id, value: v.value })),
        startingItems: byId(w.sprites, AVATAR)?.inventory ?? [],
        tunes: w.tunes.map((t) => ({ id: t.id, name: t.name })),
        blips: w.blips.map((b) => ({ id: b.id, name: b.name })),
      };
    },
  }),

  defineAgentTool<{ font?: string; textDirection?: 'LTR' | 'RTL'; textSize?: 'default' | 'chunky'; customFont?: string }>({
    name: 'bitsy_set_game',
    title: 'Set Bitsy game settings',
    description: 'Font, text direction and text size of the open Bitsy game, or a custom font from .bitsyfont text. Use set_title for the title.',
    inputSchema: {
      type: 'object',
      properties: {
        font: { type: 'string', description: 'ascii_small, unicode_european_small, unicode_european_large, unicode_asian or arabic.' },
        textDirection: { type: 'string', enum: ['LTR', 'RTL'] },
        textSize: { type: 'string', enum: ['default', 'chunky'] },
        customFont: str('The text of a .bitsyfont file; it becomes the font.'),
      },
    },
    run: ({ font, textDirection, textSize, customFont }, { creator }) => {
      const custom = customFont === undefined ? null : readFontFile(customFont);
      if (customFont !== undefined && !custom) throw new Error('customFont is not a .bitsyfont file.');
      edit(creator, (w) => {
        if (font === 'ascii_small') delete w.defaultFont;
        else if (font !== undefined) w.defaultFont = font;
        if (textDirection) w.textDirection = textDirection;
        if (textSize) w.flags.TXT_MODE = textSize === 'chunky' ? '1' : '0';
        if (custom) setCustomFont(w, custom);
      });
      return { ok: true };
    },
  }),

  // Colors

  defineAgentTool<{ name?: string; colors?: string[]; copyOf?: string }>({
    name: 'bitsy_add_palette',
    title: 'Add palette',
    description: 'Adds a palette: three colours a room uses. Copies another palette when copyOf is given.',
    inputSchema: { type: 'object', properties: { name: str(), colors, copyOf: str('A palette id.') } },
    run: ({ name, colors: list, copyOf }, { creator }) => {
      const rgb = list?.map(rgbOf);
      const id = edit(creator, (w) => {
        if (copyOf !== undefined && !byId(w.palettes, copyOf)) throw new Error(`No palette has id "${copyOf}".`);
        const added = addPalette(w, copyOf);
        const palette = byId(w.palettes, added)!;
        if (name !== undefined) palette.name = name;
        if (rgb) palette.colors = rgb;
        return added;
      });
      return { id };
    },
  }),

  defineAgentTool<{ id: string; name?: string; colors?: string[] }>({
    name: 'bitsy_set_palette',
    title: 'Set palette',
    description: 'Renames a palette or changes its colours.',
    inputSchema: { type: 'object', properties: { id: str(), name: str(), colors }, required: ['id'] },
    run: ({ id, name, colors: list }, { creator }) => {
      const rgb = list?.map(rgbOf);
      edit(creator, (w) => {
        const palette = byId(w.palettes, id);
        if (!palette) throw new Error(`No palette has id "${id}".`);
        if (name !== undefined) palette.name = name;
        if (rgb) palette.colors = rgb;
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'bitsy_remove_palette',
    title: 'Remove palette',
    description: 'Removes a palette. Its rooms take the first palette left.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (w) => {
        if (!byId(w.palettes, id)) throw new Error(`No palette has id "${id}".`);
        if (!removePalette(w, id)) throw new Error('A game keeps at least one palette.');
      });
      return { ok: true };
    },
  }),

  // Library and Paint

  defineAgentTool<{ kind: DrawingKind; name?: string; copyOf?: string; frames?: string[][]; wall?: boolean }>({
    name: 'bitsy_add_drawing',
    title: 'Add drawing',
    description:
      'Adds a tile, sprite or item, blank or copied from another of the same kind, and returns its id. ' +
      'Tiles are the room’s floor and walls; sprites are characters; items can be picked up.',
    inputSchema: {
      type: 'object',
      properties: { kind, name: str(), copyOf: str('A drawing id of the same kind.'), frames, wall: { type: 'boolean', description: 'Tiles only: the avatar cannot walk through it.' } },
      required: ['kind'],
    },
    run: ({ kind: k, name, copyOf, frames: rows, wall }, { creator }) => {
      const pixels = rows && readFrames(rows);
      const id = edit(creator, (w) => {
        if (copyOf !== undefined) drawingIn(w, k, copyOf);
        const added = copyOf === undefined ? addDrawing(w, k) : duplicateDrawing(w, k, copyOf)!;
        const drawing = drawingIn(w, k, added) as Drawing & { wall?: boolean };
        if (name !== undefined) drawing.name = name;
        if (pixels) drawing.frames = pixels;
        if (wall !== undefined && k === 'tiles') drawing.wall = wall;
        return added;
      });
      return { id };
    },
  }),

  defineAgentTool<{ kind: DrawingKind; id: string }>({
    name: 'bitsy_get_drawing',
    title: 'Get drawing',
    description: 'A drawing’s pixels (8 strings of 8 digits per frame) and settings.',
    inputSchema: { type: 'object', properties: { kind, id: str() }, required: ['kind', 'id'] },
    readOnly: true,
    run: ({ kind: k, id }, { creator }) => {
      const d = drawingIn(world(creator), k, id) as Drawing & { wall?: boolean; dialog?: Id; blip?: Id };
      return { ...drawingInfo(k, d), frames: d.frames.map(writeFrame) };
    },
  }),

  defineAgentTool<{ kind: DrawingKind; id: string; name?: string; frames?: string[][]; wall?: boolean; dialog?: string | null; blip?: string | null }>({
    name: 'bitsy_set_drawing',
    title: 'Set drawing',
    description:
      'Changes a drawing: its name, pixels (two frames animate it), whether a tile is a wall, ' +
      'and the dialog id and blip id of a sprite or item (null takes them off).',
    inputSchema: {
      type: 'object',
      properties: {
        kind,
        id: str(),
        name: str(),
        frames,
        wall: { type: 'boolean' },
        dialog: nullableId('A dialog id.'),
        blip: nullableId('A blip id, played when the avatar meets it.'),
      },
      required: ['kind', 'id'],
    },
    run: ({ kind: k, id, name, frames: rows, wall, dialog, blip }, { creator }) => {
      const pixels = rows && readFrames(rows);
      edit(creator, (w) => {
        const d = drawingIn(w, k, id) as Drawing & { wall?: boolean; dialog?: Id; blip?: Id };
        if (name !== undefined) d.name = name;
        if (pixels) d.frames = pixels;
        if (wall !== undefined) {
          if (k !== 'tiles') throw new Error('Only tiles can be walls.');
          d.wall = wall;
        }
        if ((dialog !== undefined || blip !== undefined) && k === 'tiles') throw new Error('Only sprites and items have dialog and blips.');
        if (dialog && !byId(w.dialogs, dialog)) throw new Error(`No dialog has id "${dialog}".`);
        if (blip && !byId(w.blips, blip)) throw new Error(`No blip has id "${blip}".`);
        optionalId(d, 'dialog', dialog);
        optionalId(d, 'blip', blip);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ kind: DrawingKind; id: string; frame?: number; action: string; x?: number; y?: number; value?: number }>({
    name: 'bitsy_paint',
    title: 'Paint',
    description: 'Paint tools on one frame of a drawing: set a pixel, flood fill, flip, or clear. value 1 draws, 0 erases.',
    inputSchema: {
      type: 'object',
      properties: {
        kind,
        id: str(),
        frame: { type: 'integer', minimum: 0, maximum: 1 },
        action: { type: 'string', enum: ['pixel', 'fill', 'flip_x', 'flip_y', 'clear'] },
        x: pixel,
        y: pixel,
        value: { type: 'integer', minimum: 0, maximum: 1 },
      },
      required: ['kind', 'id', 'action'],
    },
    run: ({ kind: k, id, frame = 0, action, x, y, value = 1 }, { creator }) => {
      edit(creator, (w) => {
        const d = drawingIn(w, k, id);
        if (!d.frames[frame]) throw new Error(`The drawing has no frame ${frame}.`);
        if ((action === 'pixel' || action === 'fill') && (x === undefined || y === undefined)) throw new Error(`${action} needs x and y.`);
        if (action === 'pixel') setPixel(d, frame, x!, y!, value);
        if (action === 'fill') fillPixels(d, frame, x!, y!, value);
        if (action === 'flip_x') flipDrawing(d, frame, 'x');
        if (action === 'flip_y') flipDrawing(d, frame, 'y');
        if (action === 'clear') clearFrame(d, frame);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ kind: DrawingKind; id: string }>({
    name: 'bitsy_remove_drawing',
    title: 'Remove drawing',
    description: 'Removes a tile, sprite or item and every use of it in rooms.',
    inputSchema: { type: 'object', properties: { kind, id: str() }, required: ['kind', 'id'] },
    run: ({ kind: k, id }, { creator }) => {
      if (k === 'sprites' && id === AVATAR) throw new Error('The avatar (sprite A) cannot be removed.');
      edit(creator, (w) => {
        drawingIn(w, k, id);
        removeDrawing(w, k, id);
      });
      return { ok: true };
    },
  }),

  // Room

  defineAgentTool<{ name?: string; palette?: string; copyOf?: string }>({
    name: 'bitsy_add_room',
    title: 'Add room',
    description: 'Adds an empty room, or a copy of one, and returns its id.',
    inputSchema: { type: 'object', properties: { name: str(), palette: str('A palette id.'), copyOf: str('A room id.') } },
    run: ({ name, palette, copyOf }, { creator }) => {
      const id = edit(creator, (w) => {
        if (copyOf !== undefined) roomIn(w, copyOf);
        if (palette !== undefined && !byId(w.palettes, palette)) throw new Error(`No palette has id "${palette}".`);
        const added = copyOf === undefined ? addRoom(w) : duplicateRoom(w, copyOf);
        const room = roomIn(w, added);
        if (name !== undefined) room.name = name;
        if (palette !== undefined) room.palette = palette;
        return added;
      });
      return { id };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'bitsy_get_room',
    title: 'Get room',
    description:
      'A room: its tiles (16 rows of 16 comma-separated tile ids, "0" is empty), items, sprites, exits and endings. ' +
      'x is the column (0-15, left to right), y the row (0-15, top to bottom).',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    readOnly: true,
    run: ({ id }, { creator }) => {
      const w = world(creator);
      const room = roomIn(w, id);
      return {
        id: room.id,
        name: room.name,
        palette: room.palette,
        tune: room.tune,
        tiles: room.tilemap.map((row) => row.join(',')),
        items: room.items,
        sprites: w.sprites.filter((s) => s.position?.room === id).map((s) => ({ id: s.id, x: s.position!.x, y: s.position!.y })),
        exits: room.exits.map((exit, index) => exitInfo(w, room, exit, index)),
        endings: room.endings.map((e) => ({ ...e, text: dialogText(w, e.id) })),
      };
    },
  }),

  defineAgentTool<{ id: string; name?: string; palette?: string; tune?: string | null; tiles?: string[] }>({
    name: 'bitsy_set_room',
    title: 'Set room',
    description: 'Changes a room: name, palette, tune (null for none), or all its tiles at once as 16 rows of 16 comma-separated tile ids.',
    inputSchema: {
      type: 'object',
      properties: {
        id: str(),
        name: str(),
        palette: str('A palette id.'),
        tune: nullableId('A tune id.'),
        tiles: { type: 'array', minItems: 16, maxItems: 16, items: { type: 'string' } },
      },
      required: ['id'],
    },
    run: ({ id, name, palette, tune, tiles }, { creator }) => {
      edit(creator, (w) => {
        const room = roomIn(w, id);
        if (name !== undefined) room.name = name;
        if (palette !== undefined) {
          if (!byId(w.palettes, palette)) throw new Error(`No palette has id "${palette}".`);
          room.palette = palette;
        }
        if (tune === null) delete room.tune;
        else if (tune !== undefined) {
          if (!byId(w.tunes, tune)) throw new Error(`No tune has id "${tune}".`);
          room.tune = tune;
        }
        if (tiles) {
          room.tilemap = tiles.map((row, y) => {
            const cells = row.split(',').map((c) => c.trim());
            if (cells.length !== 16) throw new Error(`Row ${y} has ${cells.length} cells; a row has 16.`);
            for (const c of cells) if (c !== '0' && !byId(w.tiles, c)) throw new Error(`No tile has id "${c}" (row ${y}).`);
            return cells;
          });
        }
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'bitsy_remove_room',
    title: 'Remove room',
    description: 'Removes a room, the exits into it and the sprites in it. The avatar’s room and the last room stay.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (w) => {
        roomIn(w, id);
        if (!removeRoom(w, id)) throw new Error(`Room "${id}" cannot be removed: the avatar starts there, or it is the last room.`);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ room: string; x: number; y: number; kind: DrawingKind; id: string }>({
    name: 'bitsy_place',
    title: 'Place in room',
    description:
      'Puts a tile, item or sprite on a cell. A sprite is in one place, so placing it moves it; place sprite "A" to move where the avatar starts.',
    inputSchema: { type: 'object', properties: { ...at(), kind, id: str() }, required: ['room', 'x', 'y', 'kind', 'id'] },
    run: ({ room: roomId, x, y, kind: k, id }, { creator }) => {
      edit(creator, (w) => {
        const room = roomIn(w, roomId);
        drawingIn(w, k, id);
        if (k === 'tiles') paintTile(room, x, y, id);
        if (k === 'sprites') placeSprite(w, id, roomId, x, y);
        if (k === 'items' && !room.items.some((i) => i.id === id && i.x === x && i.y === y)) room.items.push({ id, x, y });
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ room: string; x: number; y: number; marker?: boolean }>({
    name: 'bitsy_erase',
    title: 'Erase in room',
    description: 'Takes the top thing off a cell: a sprite (not the avatar), else an item, else the tile. With marker, takes the exit or ending off instead.',
    inputSchema: { type: 'object', properties: { ...at(), marker: { type: 'boolean' } }, required: ['room', 'x', 'y'] },
    run: ({ room, x, y, marker }, { creator }) => {
      const erased = edit(creator, (w) => {
        roomIn(w, room);
        return marker ? eraseMarkerAt(w, room, x, y) : eraseAt(w, room, x, y);
      });
      return { erased };
    },
  }),

  defineAgentTool<{ room: string }>({
    name: 'bitsy_room_picture',
    title: 'Room picture',
    description: 'A PNG of a room as the editor draws it, 256x256 (each cell is 16x16 pixels). Look at it to check your work.',
    inputSchema: { type: 'object', properties: { room: str() }, required: ['room'] },
    readOnly: true,
    run: ({ room }, { creator }) => {
      const w = world(creator);
      roomIn(w, room);
      return picture(roomPng(w, room), { room });
    },
  }),

  defineAgentTool<{ room?: string }>({
    name: 'bitsy_set_cover',
    title: 'Set cover',
    description: 'Makes a room’s picture the game’s cover on the platform. The avatar’s room when no room is given.',
    inputSchema: { type: 'object', properties: { room: str() } },
    run: async ({ room }, { creator }) => {
      const w = world(creator);
      const id = room ?? byId(w.sprites, AVATAR)?.position?.room ?? w.rooms[0]!.id;
      roomIn(w, id);
      await creator.projects.setCover(pngDataUrl(roomPng(w, id)));
      return { ok: true, room: id };
    },
  }),

  // Exits & endings

  defineAgentTool<{ room: string; x: number; y: number; to: { room: string; x: number; y: number }; twoWay?: boolean; transition?: string; dialog?: 'narration' | 'lock' }>({
    name: 'bitsy_add_exit',
    title: 'Add exit',
    description:
      'Puts an exit on a cell that takes the avatar to a cell in another room. twoWay (default true) adds the way back. ' +
      'dialog "lock" makes it need an item called key; "narration" shows text on the way.',
    inputSchema: {
      type: 'object',
      properties: {
        ...at(),
        to: { type: 'object', properties: at('The room it leads to.'), required: ['room', 'x', 'y'] },
        twoWay: { type: 'boolean' },
        transition: { type: 'string', enum: ['fade_w', 'fade_b', 'wave', 'tunnel', 'slide_u', 'slide_d', 'slide_l', 'slide_r'] },
        dialog: { type: 'string', enum: ['narration', 'lock'] },
      },
      required: ['room', 'x', 'y', 'to'],
    },
    run: ({ room, x, y, to, twoWay = true, transition, dialog }, { creator }) => {
      edit(creator, (w) => {
        roomIn(w, room);
        roomIn(w, to.room);
        const index = addExit(w, room, x, y, { twoWay: false });
        setExitDest(w, room, index, { ...to });
        const exit = roomIn(w, room).exits[index]!;
        if (transition) exit.transition = transition;
        if (twoWay) setTwoWay(w, room, index, true);
        if (dialog) setExitDialog(w, room, index, dialog);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ room: string; x: number; y: number; to?: { room: string; x: number; y: number }; twoWay?: boolean; transition?: string | null; dialog?: 'narration' | 'lock' | null }>({
    name: 'bitsy_set_exit',
    title: 'Set exit',
    description: 'Changes the exit on a cell: where it leads, one-way or two-way, transition (null for none), and lock or narration (null for none).',
    inputSchema: {
      type: 'object',
      properties: {
        ...at(),
        to: { type: 'object', properties: at('The room it leads to.'), required: ['room', 'x', 'y'] },
        twoWay: { type: 'boolean' },
        transition: { type: ['string', 'null'], enum: ['fade_w', 'fade_b', 'wave', 'tunnel', 'slide_u', 'slide_d', 'slide_l', 'slide_r'] },
        dialog: { type: ['string', 'null'], enum: ['narration', 'lock'] },
      },
      required: ['room', 'x', 'y'],
    },
    run: ({ room, x, y, to, twoWay, transition, dialog }, { creator }) => {
      edit(creator, (w) => {
        const index = exitAt(roomIn(w, room), x, y);
        if (index < 0) throw new Error(`There is no exit at ${x},${y} in room "${room}".`);
        if (to) {
          roomIn(w, to.room);
          setExitDest(w, room, index, { ...to });
        }
        if (twoWay !== undefined) setTwoWay(w, room, index, twoWay);
        const exit = roomIn(w, room).exits[index]!;
        if (transition === null) delete exit.transition;
        else if (transition !== undefined) exit.transition = transition;
        if (dialog !== undefined) setExitDialog(w, room, index, dialog);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ room: string; x: number; y: number }>({
    name: 'bitsy_remove_exit',
    title: 'Remove exit',
    description: 'Takes the exit on a cell away, with its way back.',
    inputSchema: { type: 'object', properties: at(), required: ['room', 'x', 'y'] },
    run: ({ room, x, y }, { creator }) => {
      edit(creator, (w) => {
        roomIn(w, room);
        if (!removeExit(w, room, x, y)) throw new Error(`There is no exit at ${x},${y} in room "${room}".`);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ room: string; x: number; y: number; text?: string }>({
    name: 'bitsy_add_ending',
    title: 'Add ending',
    description: 'Puts an ending on a cell: when the avatar steps on it, the text shows and the game ends. Returns the ending’s dialog id.',
    inputSchema: { type: 'object', properties: { ...at(), text: str() }, required: ['room', 'x', 'y'] },
    run: ({ room, x, y, text }, { creator }) => {
      const id = edit(creator, (w) => {
        roomIn(w, room);
        return addEnding(w, room, x, y, text);
      });
      return { id };
    },
  }),

  defineAgentTool<{ room: string; x: number; y: number }>({
    name: 'bitsy_remove_ending',
    title: 'Remove ending',
    description: 'Takes the ending on a cell away.',
    inputSchema: { type: 'object', properties: at(), required: ['room', 'x', 'y'] },
    run: ({ room, x, y }, { creator }) => {
      edit(creator, (w) => {
        roomIn(w, room);
        if (!removeEndingAt(w, room, x, y)) throw new Error(`There is no ending at ${x},${y} in room "${room}".`);
      });
      return { ok: true };
    },
  }),

  // Dialog

  defineAgentTool<{ id?: string; kind?: DrawingKind; drawing?: string }>({
    name: 'bitsy_get_dialog',
    title: 'Get dialog',
    description: 'The text of a dialog or ending, by its id, or of a sprite or item.',
    inputSchema: { type: 'object', properties: { id: str(), kind, drawing: str('A sprite or item id.') } },
    readOnly: true,
    run: ({ id, kind: k, drawing }, { creator }) => {
      const w = world(creator);
      let dialogId = id;
      if (k && drawing !== undefined) dialogId = (drawingIn(w, k, drawing) as { dialog?: Id }).dialog;
      if (dialogId === undefined) return { id: null, text: '' };
      const text = dialogText(w, dialogId);
      if (text === undefined) throw new Error(`No dialog has id "${dialogId}".`);
      return { id: dialogId, text };
    },
  }),

  defineAgentTool<{ text: string; id?: string; kind?: DrawingKind; drawing?: string; name?: string }>({
    name: 'bitsy_set_dialog',
    title: 'Set dialog',
    description:
      'Writes dialog in Bitsy’s script: plain text, or {sequence}, {cycle}, {shuffle}, conditions like {- {item "1"} >= 1 ? ...} ' +
      'and actions like {a = a + 1}, {end}, {exit "room" x y}. Give a sprite or item (kind and drawing), a dialog or ending id, ' +
      'or neither to make a new dialog. Returns the dialog id.',
    inputSchema: {
      type: 'object',
      properties: { text: str(), id: str('A dialog or ending id.'), kind, drawing: str('A sprite or item id.'), name: str() },
      required: ['text'],
    },
    run: ({ text, id, kind: k, drawing, name }, { creator }) => {
      const dialogId = edit(creator, (w) => {
        let target = id;
        if (k !== undefined || drawing !== undefined) {
          if (k === 'tiles') throw new Error('Only sprites and items have dialog.');
          if (k === undefined || drawing === undefined) throw new Error('Give both kind and drawing.');
          drawingIn(w, k, drawing);
          target = giveDialog(w, k, drawing)!;
        }
        if (target === undefined) return addDialog(w, text, name);
        if (dialogText(w, target) === undefined) throw new Error(`No dialog has id "${target}".`);
        setDialogText(w, target, text);
        const entry = byId(w.dialogs, target) ?? byId(w.endings, target)!;
        if (name !== undefined) entry.name = name;
        return target;
      });
      return { id: dialogId };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'bitsy_remove_dialog',
    title: 'Remove dialog',
    description: 'Removes a dialog; sprites, items and exits that used it lose it.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (w) => {
        if (!removeDialog(w, id)) throw new Error(`No dialog has id "${id}".`);
      });
      return { ok: true };
    },
  }),

  // Variables

  defineAgentTool<{ name: string; value: string | number | boolean }>({
    name: 'bitsy_set_variable',
    title: 'Set variable',
    description: 'Adds a variable or sets its starting value. Dialog reads and changes it, like {say a} or {a = a + 1}.',
    inputSchema: {
      type: 'object',
      properties: { name: str('Letters, digits and _, not starting with a digit.'), value: { type: ['string', 'number', 'boolean'] } },
      required: ['name', 'value'],
    },
    run: ({ name, value }, { creator }) => {
      edit(creator, (w) => {
        const variable = byId(w.variables, name);
        if (variable) variable.value = String(value);
        else if (!/^[A-Za-z_]\w*$/.test(name)) throw new Error(`"${name}" is not a variable name.`);
        else w.variables.push({ id: name, value: String(value), extra: [] });
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ from: string; to: string }>({
    name: 'bitsy_rename_variable',
    title: 'Rename variable',
    description: 'Renames a variable everywhere, dialog included.',
    inputSchema: { type: 'object', properties: { from: str(), to: str() }, required: ['from', 'to'] },
    run: ({ from, to }, { creator }) => {
      edit(creator, (w) => {
        if (!byId(w.variables, from)) throw new Error(`No variable is called "${from}".`);
        if (!renameVariable(w, from, to)) throw new Error(`"${to}" cannot be a variable name, or it is taken.`);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ name: string }>({
    name: 'bitsy_remove_variable',
    title: 'Remove variable',
    description: 'Removes a variable.',
    inputSchema: { type: 'object', properties: { name: str() }, required: ['name'] },
    run: ({ name }, { creator }) => {
      edit(creator, (w) => {
        if (!removeVariable(w, name)) throw new Error(`No variable is called "${name}".`);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ item: string; count: number }>({
    name: 'bitsy_set_starting_item',
    title: 'Set starting item',
    description: 'How many of an item the avatar has at the start; 0 takes it out.',
    inputSchema: { type: 'object', properties: { item: str('An item id.'), count: { type: 'integer', minimum: 0, maximum: 999 } }, required: ['item', 'count'] },
    run: ({ item, count }, { creator }) => {
      edit(creator, (w) => {
        drawingIn(w, 'items', item);
        setStartingItem(w, item, count);
      });
      return { ok: true };
    },
  }),

  // Tunes

  defineAgentTool<{ id: string }>({
    name: 'bitsy_get_tune',
    title: 'Get tune',
    description: 'A tune: its key, tempo, instruments, and melody and harmony bars of 16 steps.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    readOnly: true,
    run: ({ id }, { creator }) => {
      const tune = tuneOf(world(creator), id);
      if (!tune) throw new Error(`No tune has id "${id}".`);
      return { ...tune, key: keyNameOf(tune) };
    },
  }),

  defineAgentTool<{ copyOf?: string }>({
    name: 'bitsy_add_tune',
    title: 'Add tune',
    description: 'Adds a tune of four empty bars in a major key, or a copy of one, and returns its id. Rooms play tunes (bitsy_set_room).',
    inputSchema: { type: 'object', properties: { copyOf: str('A tune id.') } },
    run: ({ copyOf }, { creator }) => {
      const id = edit(creator, (w) => {
        if (copyOf === undefined) return addTune(w);
        const copy = duplicateTune(w, copyOf);
        if (copy === null) throw new Error(`No tune has id "${copyOf}".`);
        return copy;
      });
      return { id };
    },
  }),

  defineAgentTool<{
    id: string;
    name?: string;
    key?: KeyName | 'chromatic';
    tempo?: 'SLW' | 'MED' | 'FST' | 'XFST';
    instrumentA?: 'P2' | 'P4' | 'P8';
    instrumentB?: 'P2' | 'P4' | 'P8';
    arpeggio?: 'OFF' | 'UP' | 'DWN' | 'INT5' | 'INT8';
    melody?: Pitch[][];
    harmony?: Pitch[][];
  }>({
    name: 'bitsy_set_tune',
    title: 'Set tune',
    description:
      'Changes a tune. key sets the scale (notes are then scale degrees 0-6). Instruments are pulse waves: P2, P4, P8. ' +
      'melody and harmony replace all bars; both need the same number of bars (1 to 16).',
    inputSchema: {
      type: 'object',
      properties: {
        id: str(),
        name: str(),
        key: { type: 'string', enum: [...Object.keys(keys), 'chromatic'] },
        tempo: { type: 'string', enum: ['SLW', 'MED', 'FST', 'XFST'] },
        instrumentA: { type: 'string', enum: ['P2', 'P4', 'P8'], description: 'The melody’s instrument.' },
        instrumentB: { type: 'string', enum: ['P2', 'P4', 'P8'], description: 'The harmony’s instrument.' },
        arpeggio: { type: 'string', enum: ['OFF', 'UP', 'DWN', 'INT5', 'INT8'] },
        melody: bars,
        harmony: bars,
      },
      required: ['id'],
    },
    run: ({ id, name, key, tempo, instrumentA, instrumentB, arpeggio, melody, harmony }, { creator }) => {
      edit(creator, (w) => {
        const found = updateTune(w, id, (tune) => {
          if (name !== undefined) tune.name = name;
          if (key !== undefined) setKey(tune, key);
          if (tempo) tune.tempo = tempo;
          if (instrumentA) tune.instrumentA = instrumentA;
          if (instrumentB) tune.instrumentB = instrumentB;
          if (arpeggio) tune.arpeggio = arpeggio;
          const nextMelody = melody ?? tune.melody;
          const nextHarmony = harmony ?? tune.harmony;
          if (nextMelody.length !== nextHarmony.length || nextMelody.length < 1 || nextMelody.length > 16) {
            throw new Error('melody and harmony need the same number of bars (1 to 16).');
          }
          tune.melody = nextMelody;
          tune.harmony = nextHarmony;
        });
        if (!found) throw new Error(`No tune has id "${id}".`);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'bitsy_remove_tune',
    title: 'Remove tune',
    description: 'Removes a tune; rooms that played it go quiet.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (w) => {
        if (!removeTune(w, id)) throw new Error(`No tune has id "${id}".`);
      });
      return { ok: true };
    },
  }),

  // Blips

  defineAgentTool<{ kind?: (typeof blipKinds)[number] }>({
    name: 'bitsy_add_blip',
    title: 'Add blip',
    description: 'Makes a short sound of a kind and returns its id. Give it to a sprite or item with bitsy_set_drawing.',
    inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: [...blipKinds] } } },
    run: ({ kind: k }, { creator }) => ({ id: edit(creator, (w) => addBlip(w, k)) }),
  }),

  defineAgentTool<{ id: string }>({
    name: 'bitsy_get_blip',
    title: 'Get blip',
    description: 'A blip’s three pitches, envelope, timing, instrument and repeat.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    readOnly: true,
    run: ({ id }, { creator }) => {
      const blip = blipOf(world(creator), id);
      if (!blip) throw new Error(`No blip has id "${id}".`);
      return blip;
    },
  }),

  defineAgentTool<{
    id: string;
    name?: string;
    regenerate?: (typeof blipKinds)[number];
    mutate?: boolean;
    transpose?: number;
    stretch?: number;
    pace?: number;
    instrument?: 'P2' | 'P4' | 'P8';
    repeat?: boolean;
  }>({
    name: 'bitsy_change_blip',
    title: 'Change blip',
    description:
      'Changes a blip like the Blips tool: make it again as a kind, mutate it a little, transpose by semitones, ' +
      'stretch (longer above 1), pace (slower above 1), instrument and repeat.',
    inputSchema: {
      type: 'object',
      properties: {
        id: str(),
        name: str(),
        regenerate: { type: 'string', enum: [...blipKinds] },
        mutate: { type: 'boolean' },
        transpose: { type: 'integer', minimum: -24, maximum: 24 },
        stretch: { type: 'number', minimum: 0.25, maximum: 4 },
        pace: { type: 'number', minimum: 0.25, maximum: 4 },
        instrument: { type: 'string', enum: ['P2', 'P4', 'P8'] },
        repeat: { type: 'boolean' },
      },
      required: ['id'],
    },
    run: ({ id, name, regenerate, mutate, transpose, stretch, pace, instrument, repeat }, { creator }) => {
      edit(creator, (w) => {
        const found = updateBlip(w, id, (blip) => {
          if (regenerate) generateBlip(blip, regenerate);
          if (mutate) mutateBlip(blip);
          if (transpose) transposeBlip(blip, transpose);
          if (stretch) stretchBlip(blip, stretch);
          if (pace) paceBlip(blip, pace);
          if (instrument) blip.instrument = instrument;
          if (repeat !== undefined) blip.repeat = repeat;
          if (name !== undefined) blip.name = name;
        });
        if (!found) throw new Error(`No blip has id "${id}".`);
      });
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'bitsy_remove_blip',
    title: 'Remove blip',
    description: 'Removes a blip; sprites and items that played it go quiet.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
    run: ({ id }, { creator }) => {
      edit(creator, (w) => {
        if (!removeBlip(w, id)) throw new Error(`No blip has id "${id}".`);
      });
      return { ok: true };
    },
  }),

  // Find

  defineAgentTool<{ query: string; category?: 'all' | 'drawings' | 'rooms' | 'dialog' | 'colors' | 'sound' }>({
    name: 'bitsy_find',
    title: 'Find',
    description: 'Finds drawings, rooms, dialog, palettes and sounds by name, id or a line of dialog.',
    inputSchema: {
      type: 'object',
      properties: { query: str(), category: { type: 'string', enum: ['all', 'drawings', 'rooms', 'dialog', 'colors', 'sound'] } },
      required: ['query'],
    },
    readOnly: true,
    run: ({ query, category }, { creator }) => ({ results: search(world(creator), query, category) }),
  }),

  defineAgentTool<{ kind: string; id: string }>({
    name: 'bitsy_where_used',
    title: 'Where used',
    description: 'Where something is used: a drawing (tiles, sprites, items), room, dialog, variable, palette, tune or blip.',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['tiles', 'sprites', 'items', 'room', 'dialog', 'variable', 'palette', 'tune', 'blip'] }, id: str() },
      required: ['kind', 'id'],
    },
    readOnly: true,
    run: ({ kind: k, id }, { creator }) => {
      const target: Target =
        k === 'tiles' || k === 'sprites' || k === 'items'
          ? { type: 'drawing', kind: k, id }
          : k === 'room'
            ? { type: 'room', room: id }
            : ({ type: k, id } as Target);
      return { uses: referencesTo(world(creator), target) };
    },
  }),

  // Play and Download

  defineAgentTool<{ buttons?: string[]; waitMs?: number }>({
    name: 'bitsy_play',
    title: 'Play',
    description:
      'Plays the open game from the start in citsy, the engine the console uses, presses buttons one after another, ' +
      'and sends back the screen as a PNG with the inventory and variables. ok also moves dialog on. Use it to test the game.',
    inputSchema: {
      type: 'object',
      properties: {
        buttons: { type: 'array', maxItems: 64, items: { type: 'string', enum: Object.keys(buttons) } },
        waitMs: { type: 'integer', minimum: 0, maximum: 3000, description: 'How long to wait after each press. 400 by default.' },
      },
    },
    run: async ({ buttons: presses = [], waitMs = 400 }, { creator }) => {
      world(creator);
      let frame: Uint8ClampedArray | null = null;
      const player = creator.createPlayer((pixels) => {
        frame = pixels;
      });
      try {
        player.play(creator.projects.data());
        const started = await until(() => frame !== null || player.state().status === 'error', 5000);
        const failed = player.state();
        if (failed.status === 'error') throw new Error(`The game stopped: ${failed.message}`);
        if (!started) throw new Error('The game did not start.');
        for (const name of presses) {
          player.press(buttons[name]!, true);
          await sleep(Math.min(100, waitMs));
          player.press(buttons[name]!, false);
          await sleep(waitMs);
        }
        const state = player.gameState();
        const data = { status: player.state().status, inventory: state?.inventory ?? {}, variables: state?.variables ?? {} };
        return picture(encodePng(frame!, 128, 128, { scale: 2 }), data);
      } finally {
        player.dispose();
      }
    },
  }),

  defineAgentTool<{ pageColor?: string; size?: number }>({
    name: 'bitsy_download_web_page',
    title: 'Download web page',
    description: 'Gives the person a web page that plays the game anywhere, offline. It fills the window unless a size in pixels is given.',
    inputSchema: {
      type: 'object',
      properties: { pageColor: str('The colour around the game, #rrggbb.'), size: { type: 'integer', minimum: 128, maximum: 4096 } },
    },
    run: async ({ pageColor = '#000000', size }, { creator, download }) => {
      const w = world(creator);
      const title = titleOf(creator.engines.get(BITSY)!, w);
      const html = exportHtml({ data: creator.projects.data(), title, pageColor, size: size ?? 'fill', ...(await loadHtmlParts()) });
      const name = fileName(title, 'html');
      download(name, html, 'text/html');
      return { ok: true, fileName: name };
    },
  }),
];
