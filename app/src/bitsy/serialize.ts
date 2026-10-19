import type {
  Collection,
  Dialog,
  Drawing,
  Ending,
  Item,
  LayoutUnit,
  Palette,
  RawBlock,
  Room,
  Sprite,
  Tile,
  UnitRef,
  Variable,
  World,
} from './types';

// Canonical output follows the Bitsy editor's serializeWorld
// (editor/script/engine/bitsy.js), so a changed entity looks like the
// editor wrote it.

/** The order Bitsy writes things in, used to place new entities. */
export const unitOrder = [
  'title',
  'raw',
  'flag',
  'default-font',
  'text-direction',
  'palettes',
  'rooms',
  'tiles',
  'sprites',
  'items',
  'dialogs',
  'endings',
  'variables',
  'tunes',
  'blips',
  'fonts',
] as const;

export type UnitKind = (typeof unitOrder)[number];

export function unitKind(ref: UnitRef): UnitKind {
  return ref.kind === 'entity' ? ref.collection : ref.kind;
}

const headers: Record<Collection, string> = {
  palettes: 'PAL',
  rooms: 'ROOM',
  tiles: 'TIL',
  sprites: 'SPR',
  items: 'ITM',
  dialogs: 'DLG',
  endings: 'END',
  variables: 'VAR',
  tunes: 'TUNE',
  blips: 'BLIP',
  fonts: 'FONT',
};

function drawingLines(drawing: Drawing): string[] {
  const lines: string[] = [];
  drawing.frames.forEach((frame, index) => {
    if (index > 0) lines.push('>');
    for (let y = 0; y < 8; y++) {
      lines.push(frame.slice(y * 8, y * 8 + 8).join(''));
    }
  });
  return lines;
}

function colorLines(drawing: Drawing, defaultColor: number): string[] {
  const lines: string[] = [];
  if (drawing.color !== undefined && drawing.color !== defaultColor) lines.push(`COL ${drawing.color}`);
  if (drawing.background === 'transparent') lines.push('BGC *');
  else if (drawing.background !== undefined && drawing.background !== 0) lines.push(`BGC ${drawing.background}`);
  return lines;
}

function name(value: string | undefined): string[] {
  return value === undefined ? [] : [`NAME ${value}`];
}

function palette(p: Palette): string[] {
  return [`PAL ${p.id}`, ...p.colors.map((c) => c.join(',')), ...name(p.name), ...p.extra];
}

function room(r: Room, world: World): string[] {
  const commas = world.flags.ROOM_FORMAT !== '0' && world.flags.ROOM_FORMAT !== undefined;
  const lines = [`ROOM ${r.id}`, ...r.tilemap.map((row) => row.join(commas ? ',' : ''))];
  lines.push(...name(r.name));
  if (r.walls.length > 0) lines.push(`WAL ${r.walls.join(',')}`);
  for (const item of r.items) lines.push(`ITM ${item.id} ${item.x},${item.y}`);
  for (const exit of r.exits) {
    let line = `EXT ${exit.x},${exit.y} ${exit.dest.room} ${exit.dest.x},${exit.dest.y}`;
    if (exit.transition !== undefined) line += ` FX ${exit.transition}`;
    if (exit.dialog !== undefined) line += ` DLG ${exit.dialog}`;
    lines.push(line);
  }
  for (const ending of r.endings) lines.push(`END ${ending.id} ${ending.x},${ending.y}`);
  if (r.palette !== undefined) lines.push(`PAL ${r.palette}`);
  if (r.avatar !== undefined) lines.push(`AVA ${r.avatar}`);
  if (r.tune !== undefined) lines.push(`TUNE ${r.tune}`);
  return [...lines, ...r.extra];
}

function tile(t: Tile): string[] {
  const lines = [`TIL ${t.id}`, ...drawingLines(t), ...name(t.name)];
  if (t.wall !== undefined) lines.push(`WAL ${t.wall}`);
  return [...lines, ...colorLines(t, 1), ...t.extra];
}

function sprite(s: Sprite): string[] {
  const lines = [`SPR ${s.id}`, ...drawingLines(s), ...name(s.name)];
  if (s.dialog !== undefined) lines.push(`DLG ${s.dialog}`);
  if (s.position) lines.push(`POS ${s.position.room} ${s.position.x},${s.position.y}`);
  for (const entry of s.inventory) lines.push(`ITM ${entry.id} ${entry.count}`);
  lines.push(...colorLines(s, 2));
  if (s.blip !== undefined) lines.push(`BLIP ${s.blip}`);
  return [...lines, ...s.extra];
}

function item(i: Item): string[] {
  const lines = [`ITM ${i.id}`, ...drawingLines(i), ...name(i.name)];
  if (i.dialog !== undefined) lines.push(`DLG ${i.dialog}`);
  lines.push(...colorLines(i, 2));
  if (i.blip !== undefined) lines.push(`BLIP ${i.blip}`);
  return [...lines, ...i.extra];
}

function script(header: string, d: Dialog | Ending): string[] {
  return [header, ...d.script.split('\n'), ...name(d.name)];
}

function variable(v: Variable): string[] {
  return [`VAR ${v.id}`, v.value, ...v.extra];
}

/** NAME goes before the first keyword line (KEY, TMP, ENV…), as Bitsy writes it. */
function raw(header: string, block: RawBlock): string[] {
  const lines = [...block.lines];
  if (block.name !== undefined) {
    const at = lines.findIndex((line) => /^[A-Z_]+( |$)/.test(line));
    lines.splice(at < 0 ? lines.length : at, 0, `NAME ${block.name}`);
  }
  return [header, ...lines];
}

export function entityLines(world: World, collection: Collection, id: string): string[] | null {
  const header = `${headers[collection]} ${id}`;
  switch (collection) {
    case 'palettes': {
      const found = world.palettes.find((e) => e.id === id);
      return found ? palette(found) : null;
    }
    case 'rooms': {
      const found = world.rooms.find((e) => e.id === id);
      return found ? room(found, world) : null;
    }
    case 'tiles': {
      const found = world.tiles.find((e) => e.id === id);
      return found ? tile(found) : null;
    }
    case 'sprites': {
      const found = world.sprites.find((e) => e.id === id);
      return found ? sprite(found) : null;
    }
    case 'items': {
      const found = world.items.find((e) => e.id === id);
      return found ? item(found) : null;
    }
    case 'dialogs': {
      const found = world.dialogs.find((e) => e.id === id);
      return found ? script(header, found) : null;
    }
    case 'endings': {
      const found = world.endings.find((e) => e.id === id);
      return found ? script(header, found) : null;
    }
    case 'variables': {
      const found = world.variables.find((e) => e.id === id);
      return found ? variable(found) : null;
    }
    case 'tunes':
    case 'blips':
    case 'fonts': {
      const found = world[collection].find((e) => e.id === id);
      return found ? raw(header, found) : null;
    }
  }
}

/** What the serializer writes for a unit today, or null when it is gone. */
export function unitLines(world: World, ref: UnitRef): string[] | null {
  switch (ref.kind) {
    case 'title':
      return ref.style === 'name' ? [`NAME ${world.title}`] : world.title.split('\n');
    case 'flag':
      return world.flags[ref.key] === undefined ? null : [`! ${ref.key} ${world.flags[ref.key]}`];
    case 'default-font':
      return world.defaultFont === undefined ? null : [`DEFAULT_FONT ${world.defaultFont}`];
    case 'text-direction':
      return world.textDirection === undefined ? null : [`TEXT_DIRECTION ${world.textDirection}`];
    case 'entity':
      return entityLines(world, ref.collection, ref.id);
    case 'raw':
      return null;
  }
}

const collections: Collection[] = [
  'palettes',
  'rooms',
  'tiles',
  'sprites',
  'items',
  'dialogs',
  'endings',
  'variables',
  'tunes',
  'blips',
  'fonts',
];

/** Every unit the world has today, in Bitsy's order. */
export function currentRefs(world: World): UnitRef[] {
  const refs: UnitRef[] = [{ kind: 'title', style: 'first-line' }];
  for (const key of Object.keys(world.flags)) refs.push({ kind: 'flag', key });
  if (world.defaultFont !== undefined) refs.push({ kind: 'default-font' });
  if (world.textDirection !== undefined) refs.push({ kind: 'text-direction' });
  for (const collection of collections) {
    for (const entity of world[collection]) refs.push({ kind: 'entity', collection, id: entity.id });
  }
  return refs;
}

function refKey(ref: UnitRef): string {
  switch (ref.kind) {
    case 'flag':
      return `flag:${ref.key}`;
    case 'entity':
      return `${ref.collection}:${ref.id}`;
    default:
      return ref.kind;
  }
}

interface Piece {
  kind: UnitKind;
  gap: number;
  lines: string[];
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** Where a new unit goes: after the last piece of its kind, else of an earlier kind. */
function insertAt(pieces: Piece[], kind: UnitKind): number {
  const rank = unitOrder.indexOf(kind);
  for (let r = rank; r >= 0; r--) {
    for (let i = pieces.length - 1; i >= 0; i--) {
      if (pieces[i]!.kind === unitOrder[r]) return i + 1;
    }
  }
  return 0;
}

export function serialize(world: World): string {
  const layout = world.layout;
  const units: LayoutUnit[] = layout?.units ?? [];
  const pieces: Piece[] = [];
  const written = new Set<string>();

  for (const unit of units) {
    if (unit.ref.kind === 'raw') {
      pieces.push({ kind: 'raw', gap: unit.gap, lines: unit.text });
      continue;
    }
    const lines = unitLines(world, unit.ref);
    if (lines === null) continue;
    written.add(refKey(unit.ref));
    pieces.push({
      kind: unitKind(unit.ref),
      gap: unit.gap,
      lines: sameLines(lines, unit.canonical) ? unit.text : lines,
    });
  }

  for (const ref of currentRefs(world)) {
    const key = refKey(ref);
    if (written.has(key)) continue;
    // A file without a title line stays without one until a title is set.
    if (ref.kind === 'title' && world.title === '') continue;
    const lines = unitLines(world, ref)!;
    const kind = unitKind(ref);
    const at = insertAt(pieces, kind);
    // Flags sit together; everything else is a block after a blank line.
    const gap = at === 0 ? 0 : kind === 'flag' && pieces[at - 1]?.kind === 'flag' ? 0 : 1;
    pieces.splice(at, 0, { kind, gap, lines });
    if (at === 0 && pieces[1] && pieces[1].gap === 0) pieces[1].gap = 1;
    written.add(key);
  }

  const out: string[] = [];
  for (const piece of pieces) {
    for (let i = 0; i < piece.gap; i++) out.push('');
    out.push(...piece.lines);
  }
  for (let i = 0; i < (layout?.trailing ?? 1); i++) out.push('');
  return out.join(layout?.eol ?? '\n');
}
