import { unitLines } from './serialize';
import type {
  Collection,
  Drawing,
  Frame,
  LayoutUnit,
  ParseIssue,
  ParseResult,
  Position,
  RawBlock,
  Room,
  Sprite,
  UnitRef,
  World,
} from './types';

// Reads `.bitsy` text the way the Bitsy editor does (editor/script/engine/world.js),
// with citsy's additions: a top-level `NAME` title and multi-line dialog
// without `"""` (chili-chip/citsy src/parser/parser.cpp).

export function emptyWorld(): World {
  return {
    title: '',
    flags: {},
    palettes: [],
    rooms: [],
    tiles: [],
    sprites: [],
    items: [],
    dialogs: [],
    endings: [],
    variables: [],
    tunes: [],
    blips: [],
    fonts: [],
  };
}

function words(line: string): string[] {
  return line.split(' ');
}

/** Everything after the first space, like Bitsy's getNameArg. */
function rest(line: string): string {
  const at = line.indexOf(' ');
  return at < 0 ? '' : line.slice(at + 1);
}

function coords(arg: string | undefined): [number, number] {
  const [x, y] = (arg ?? '').split(',');
  return [parseInt(x ?? '', 10), parseInt(y ?? '', 10)];
}

const tripleQuote = '"""';

function countTripleQuotes(line: string): number {
  return line.split(tripleQuote).length - 1;
}

interface Cursor {
  lines: string[];
  i: number;
}

/** Lines up to the next blank line. */
function readBody(cursor: Cursor): string[] {
  const body: string[] = [];
  while (cursor.i < cursor.lines.length && cursor.lines[cursor.i] !== '') {
    body.push(cursor.lines[cursor.i]!);
    cursor.i++;
  }
  return body;
}

/** Like readBody, but blank lines inside a `"""` block belong to the script. */
function readScriptBody(cursor: Cursor): string[] {
  const body: string[] = [];
  let open = false;
  while (cursor.i < cursor.lines.length) {
    const line = cursor.lines[cursor.i]!;
    if (!open && line === '') break;
    if (countTripleQuotes(line) % 2 !== 0) open = !open;
    body.push(line);
    cursor.i++;
  }
  return body;
}

function splitName(body: string[]): { script: string; name?: string } {
  const last = body[body.length - 1];
  if (body.length > 1 && last !== undefined && words(last)[0] === 'NAME') {
    return { script: body.slice(0, -1).join('\n'), name: rest(last) };
  }
  return { script: body.join('\n') };
}

/** Reads frames from the start of a drawing body; returns the lines left over. */
function readFrames(body: string[]): { frames: Frame[]; rest: string[]; ok: boolean } {
  const frames: Frame[] = [];
  let i = 0;
  for (;;) {
    const rows = body.slice(i, i + 8);
    if (rows.length < 8 || rows.some((row) => !/^\d{8}/.test(row))) {
      return { frames, rest: body.slice(i), ok: false };
    }
    frames.push(rows.flatMap((row) => row.slice(0, 8).split('').map(Number)));
    i += 8;
    if (body[i]?.startsWith('>')) {
      i++;
      continue;
    }
    return { frames, rest: body.slice(i), ok: true };
  }
}

function readColors(drawing: Drawing, line: string): boolean {
  const [key, arg] = words(line);
  if (key === 'COL') {
    drawing.color = parseInt(arg ?? '', 10);
    return true;
  }
  if (key === 'BGC') {
    drawing.background = arg === '*' ? 'transparent' : parseInt(arg ?? '', 10);
    return true;
  }
  if (key === 'NAME') {
    drawing.name = rest(line);
    return true;
  }
  return false;
}

function parseRoom(id: string, body: string[], world: World, positions: Map<string, Position>): Room {
  const commas = world.flags.ROOM_FORMAT !== undefined && world.flags.ROOM_FORMAT !== '0';
  const tilemap = body
    .slice(0, 16)
    .map((row) => (commas ? row.split(',') : row.slice(0, 16).split('')));
  const room: Room = { id, tilemap, walls: [], items: [], exits: [], endings: [], extra: [] };
  for (const line of body.slice(16)) {
    const args = words(line);
    switch (args[0]) {
      case 'NAME':
        room.name = rest(line);
        break;
      case 'WAL':
        room.walls = (args[1] ?? '').split(',');
        break;
      case 'ITM': {
        const [x, y] = coords(args[2]);
        room.items.push({ id: args[1] ?? '', x, y });
        break;
      }
      case 'EXT': {
        const [x, y] = coords(args[1]);
        const [dx, dy] = coords(args[3]);
        const exit: Room['exits'][number] = { x, y, dest: { room: args[2] ?? '', x: dx, y: dy } };
        for (let a = 4; a < args.length; a++) {
          if (args[a] === 'FX') exit.transition = args[++a];
          else if (args[a] === 'DLG') exit.dialog = args[++a];
        }
        room.exits.push(exit);
        break;
      }
      case 'END': {
        const [x, y] = coords(args[2]);
        room.endings.push({ id: args[1] ?? '', x, y });
        break;
      }
      case 'PAL':
        room.palette = args[1];
        break;
      case 'AVA':
        room.avatar = args[1];
        break;
      case 'TUNE':
        room.tune = args[1];
        break;
      default:
        // Old games place sprites from the room: `SPR a 4,4`.
        if (args[0] === 'SPR' && args[2] && !args[1]?.includes(',')) {
          const [x, y] = coords(args[2]);
          positions.set(args[1] ?? '', { room: id, x, y });
        }
        room.extra.push(line);
    }
  }
  return room;
}

function parseDrawingBody(
  header: string,
  body: string[],
  line: number,
  issues: ParseIssue[],
): { frames: Frame[]; rest: string[] } {
  const read = readFrames(body);
  if (!read.ok) issues.push({ line, message: `${header}: drawing needs 8 rows of 8 pixels` });
  return read;
}

function parseRaw(id: string, body: string[]): RawBlock {
  const block: RawBlock = { id, lines: [] };
  for (const line of body) {
    if (words(line)[0] === 'NAME' && block.name === undefined) block.name = rest(line);
    else block.lines.push(line);
  }
  return block;
}

const entityKeywords: Record<string, Collection> = {
  PAL: 'palettes',
  ROOM: 'rooms',
  SET: 'rooms',
  TIL: 'tiles',
  SPR: 'sprites',
  ITM: 'items',
  DLG: 'dialogs',
  END: 'endings',
  VAR: 'variables',
  TUNE: 'tunes',
  BLIP: 'blips',
  FONT: 'fonts',
};

export function parse(text: string): ParseResult {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  const world = emptyWorld();
  const issues: ParseIssue[] = [];
  const units: { ref: UnitRef; gap: number; text: string[] }[] = [];
  const positions = new Map<string, Position>();
  const cursor: Cursor = { lines, i: 0 };
  let gap = 0;

  function add(ref: UnitRef, start: number) {
    units.push({ ref, gap, text: lines.slice(start, cursor.i) });
    gap = 0;
  }

  // Line one is the title, unless the file starts with a comment.
  const first = lines[0] ?? '';
  if (first !== '' && !first.startsWith('#')) {
    if (first === tripleQuote) {
      cursor.i = 1;
      while (cursor.i < lines.length && lines[cursor.i] !== tripleQuote) cursor.i++;
      cursor.i = Math.min(cursor.i + 1, lines.length);
    } else {
      cursor.i = 1;
    }
    world.title = lines.slice(0, cursor.i).join('\n');
    add({ kind: 'title', style: 'first-line' }, 0);
  }

  while (cursor.i < lines.length) {
    const start = cursor.i;
    const line = lines[start]!;
    if (line === '') {
      gap++;
      cursor.i++;
      continue;
    }
    if (line.startsWith('#')) {
      cursor.i++;
      add({ kind: 'raw' }, start);
      continue;
    }
    const args = words(line);
    const keyword = args[0]!;
    const id = args[1] ?? '';

    if (keyword === '!') {
      world.flags[id] = args.slice(2).join(' ');
      cursor.i++;
      add({ kind: 'flag', key: id }, start);
      continue;
    }
    if (keyword === 'DEFAULT_FONT' || keyword === 'TEXT_DIRECTION') {
      if (keyword === 'DEFAULT_FONT') world.defaultFont = id;
      else world.textDirection = id;
      cursor.i++;
      add({ kind: keyword === 'DEFAULT_FONT' ? 'default-font' : 'text-direction' }, start);
      continue;
    }
    if (keyword === 'NAME' && world.title === '') {
      world.title = rest(line);
      cursor.i++;
      add({ kind: 'title', style: 'name' }, start);
      continue;
    }

    const collection = entityKeywords[keyword];
    cursor.i++;
    if (!collection) {
      readBody(cursor);
      add({ kind: 'raw' }, start);
      continue;
    }
    const lineNumber = start + 1;
    const header = `${keyword} ${id}`;
    switch (collection) {
      case 'palettes': {
        const body = readBody(cursor);
        const palette: World['palettes'][number] = { id, colors: [], extra: [] };
        for (const row of body) {
          if (words(row)[0] === 'NAME') palette.name = rest(row);
          else if (/^\d+,\d+,\d+$/.test(row)) {
            palette.colors.push(row.split(',').map(Number) as [number, number, number]);
          } else palette.extra.push(row);
        }
        world.palettes.push(palette);
        break;
      }
      case 'rooms':
        world.rooms.push(parseRoom(id, readBody(cursor), world, positions));
        break;
      case 'tiles': {
        const { frames, rest: props } = parseDrawingBody(header, readBody(cursor), lineNumber, issues);
        const tile: World['tiles'][number] = { id, frames, extra: [] };
        for (const prop of props) {
          const [key, arg] = words(prop);
          if (readColors(tile, prop)) continue;
          if (key === 'WAL' && (arg === 'true' || arg === 'false')) tile.wall = arg === 'true';
          else tile.extra.push(prop);
        }
        world.tiles.push(tile);
        break;
      }
      case 'sprites': {
        const { frames, rest: props } = parseDrawingBody(header, readBody(cursor), lineNumber, issues);
        const sprite: Sprite = { id, frames, inventory: [], extra: [] };
        for (const prop of props) {
          const parts = words(prop);
          if (readColors(sprite, prop)) continue;
          if (parts[0] === 'DLG') sprite.dialog = parts[1];
          else if (parts[0] === 'POS') {
            const [x, y] = coords(parts[2]);
            sprite.position = { room: parts[1] ?? '', x, y };
          } else if (parts[0] === 'ITM') {
            sprite.inventory.push({ id: parts[1] ?? '', count: parseFloat(parts[2] ?? '') });
          } else if (parts[0] === 'BLIP') sprite.blip = parts[1];
          else sprite.extra.push(prop);
        }
        world.sprites.push(sprite);
        break;
      }
      case 'items': {
        const { frames, rest: props } = parseDrawingBody(header, readBody(cursor), lineNumber, issues);
        const item: World['items'][number] = { id, frames, extra: [] };
        for (const prop of props) {
          const parts = words(prop);
          if (readColors(item, prop)) continue;
          if (parts[0] === 'DLG') item.dialog = parts[1];
          else if (parts[0] === 'BLIP') item.blip = parts[1];
          else item.extra.push(prop);
        }
        world.items.push(item);
        break;
      }
      case 'dialogs':
        world.dialogs.push({ id, ...splitName(readScriptBody(cursor)) });
        break;
      case 'endings':
        world.endings.push({ id, ...splitName(readScriptBody(cursor)) });
        break;
      case 'variables': {
        const [value = '', ...extra] = readBody(cursor);
        world.variables.push({ id, value, extra });
        break;
      }
      case 'tunes':
      case 'blips':
      case 'fonts':
        world[collection].push(parseRaw(id, readBody(cursor)));
        break;
    }
    add({ kind: 'entity', collection, id }, start);
  }

  // Sprites placed from a room (old format) start there, as in Bitsy.
  for (const [id, position] of positions) {
    const sprite = world.sprites.find((s) => s.id === id);
    if (sprite && !sprite.position) sprite.position = position;
  }

  // Remember how each unit was written. Canonical lines are worked out after
  // everything is read, because rooms depend on flags and sprites on rooms.
  const layoutUnits: LayoutUnit[] = units.map((unit) => ({
    ...unit,
    canonical: unitLines(world, unit.ref) ?? [],
  }));
  world.layout = { eol, units: layoutUnits, trailing: gap };
  return { world, issues };
}
