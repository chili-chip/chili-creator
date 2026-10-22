import { byId } from './by-id';
import type { Drawing, Frame, Id, Item, Palette, Rgb, Room, Sprite, Tile, World } from './types';

// Edits on a world, for tools to run inside `projects.updateWorld`. They
// change the world in place and do what the classic editor does.

export type DrawingKind = 'tiles' | 'sprites' | 'items';

/** The player's sprite. It is always there and always in a room. */
export const AVATAR = 'A';

/** "0" in a tilemap means no tile. */
export const EMPTY_TILE = '0';

export const ROOM_SIZE = 16;
export const DRAWING_SIZE = 8;

/** The next id after the highest base-36 id, as the classic editor counts. */
export function nextId(ids: readonly string[], reserved: readonly string[] = []): string {
  let highest = -1;
  for (const id of ids) {
    if (!/^[0-9a-z]+$/i.test(id)) continue;
    highest = Math.max(highest, parseInt(id, 36));
  }
  const taken = new Set([...ids, ...reserved]);
  let next = highest + 1;
  while (taken.has(next.toString(36))) next++;
  return next.toString(36);
}

export function drawingsOf(world: World, kind: 'tiles'): Tile[];
export function drawingsOf(world: World, kind: 'sprites'): Sprite[];
export function drawingsOf(world: World, kind: 'items'): Item[];
export function drawingsOf(world: World, kind: DrawingKind): Drawing[];
export function drawingsOf(world: World, kind: DrawingKind): Drawing[] {
  return world[kind];
}

export function blankFrame(): Frame {
  return Array(DRAWING_SIZE * DRAWING_SIZE).fill(0);
}

/** Adds a blank tile, sprite or item and returns its id. */
export function addDrawing(world: World, kind: DrawingKind): Id {
  const list = drawingsOf(world, kind);
  const id = nextId(
    list.map((drawing) => drawing.id),
    kind === 'tiles' ? [EMPTY_TILE] : [],
  );
  const base = { id, frames: [blankFrame()], extra: [] };
  if (kind === 'sprites') world.sprites.push({ ...base, inventory: [] });
  else if (kind === 'items') world.items.push(base);
  else world.tiles.push(base);
  return id;
}

/** Copies a drawing under a new id; a copied sprite is not placed anywhere. */
export function duplicateDrawing(world: World, kind: DrawingKind, id: Id): Id | null {
  const list = drawingsOf(world, kind);
  const original = byId(list, id);
  if (!original) return null;
  const copy = structuredClone(original) as Drawing & Partial<Sprite>;
  copy.id = nextId(
    list.map((drawing) => drawing.id),
    kind === 'tiles' ? [EMPTY_TILE] : [],
  );
  if (original.name !== undefined) copy.name = `${original.name} copy`;
  delete copy.position;
  list.push(copy);
  return copy.id;
}

/** Removes a drawing and every use of it in rooms. The avatar stays. */
export function removeDrawing(world: World, kind: DrawingKind, id: Id): boolean {
  if (kind === 'sprites' && id === AVATAR) return false;
  const list = drawingsOf(world, kind);
  const index = list.findIndex((drawing) => drawing.id === id);
  if (index < 0) return false;
  list.splice(index, 1);
  if (kind === 'tiles') {
    for (const room of world.rooms) {
      room.tilemap = room.tilemap.map((row) => row.map((cell) => (cell === id ? EMPTY_TILE : cell)));
      room.walls = room.walls.filter((wall) => wall !== id);
    }
  }
  if (kind === 'items') {
    for (const room of world.rooms) room.items = room.items.filter((item) => item.id !== id);
    for (const sprite of world.sprites) sprite.inventory = sprite.inventory.filter((entry) => entry.id !== id);
  }
  return true;
}

function inside(x: number, y: number, size: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
}

export function setPixel(drawing: Drawing, frame: number, x: number, y: number, value: number): void {
  const pixels = drawing.frames[frame];
  if (!pixels || !inside(x, y, DRAWING_SIZE)) return;
  pixels[y * DRAWING_SIZE + x] = value;
}

/** Flood-fills the area of the same colour around (x, y), four ways. */
export function fillPixels(drawing: Drawing, frame: number, x: number, y: number, value: number): void {
  const pixels = drawing.frames[frame];
  if (!pixels || !inside(x, y, DRAWING_SIZE)) return;
  const from = pixels[y * DRAWING_SIZE + x];
  if (from === value) return;
  const todo: [number, number][] = [[x, y]];
  while (todo.length) {
    const [cx, cy] = todo.pop()!;
    if (!inside(cx, cy, DRAWING_SIZE) || pixels[cy * DRAWING_SIZE + cx] !== from) continue;
    pixels[cy * DRAWING_SIZE + cx] = value;
    todo.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

export function flipDrawing(drawing: Drawing, frame: number, axis: 'x' | 'y'): void {
  const pixels = drawing.frames[frame];
  if (!pixels) return;
  const rows = Array.from({ length: DRAWING_SIZE }, (_, y) => pixels.slice(y * DRAWING_SIZE, (y + 1) * DRAWING_SIZE));
  const flipped = axis === 'x' ? rows.map((row) => row.reverse()) : rows.reverse();
  drawing.frames[frame] = flipped.flat();
}

export function clearFrame(drawing: Drawing, frame: number): void {
  if (drawing.frames[frame]) drawing.frames[frame] = blankFrame();
}

/** Bitsy drawings animate between two frames; the second starts as a copy. */
export function setAnimated(drawing: Drawing, animated: boolean): void {
  if (animated && drawing.frames.length < 2) drawing.frames.push([...drawing.frames[0]!]);
  if (!animated) drawing.frames = drawing.frames.slice(0, 1);
}

/** Adds an empty room with the first palette and returns its id. */
export function addRoom(world: World): Id {
  const id = nextId(world.rooms.map((room) => room.id));
  const room: Room = {
    id,
    tilemap: Array.from({ length: ROOM_SIZE }, () => Array(ROOM_SIZE).fill(EMPTY_TILE)),
    walls: [],
    items: [],
    exits: [],
    endings: [],
    extra: [],
  };
  if (world.palettes[0]) room.palette = world.palettes[0].id;
  world.rooms.push(room);
  return id;
}

export function paintTile(room: Room, x: number, y: number, tile: Id): void {
  if (!inside(x, y, ROOM_SIZE)) return;
  const row = room.tilemap[y];
  if (row) row[x] = tile;
}

/** Puts a sprite at a cell. A sprite is in one place, so this moves it. */
export function placeSprite(world: World, id: Id, room: Id, x: number, y: number): void {
  const sprite = byId(world.sprites, id);
  if (!sprite || !inside(x, y, ROOM_SIZE)) return;
  sprite.position = { room, x, y };
}

export function spritesAt(world: World, room: Id, x: number, y: number): Sprite[] {
  return world.sprites.filter((s) => s.position?.room === room && s.position.x === x && s.position.y === y);
}

/** Adds an item to a cell, or takes it away when it is already there. */
export function toggleItem(room: Room, id: Id, x: number, y: number): 'added' | 'removed' {
  const index = room.items.findIndex((item) => item.id === id && item.x === x && item.y === y);
  if (index >= 0) {
    room.items.splice(index, 1);
    return 'removed';
  }
  room.items.push({ id, x, y });
  return 'added';
}

/** Takes away the top thing in a cell: a sprite (not the avatar), an item, then the tile. */
export function eraseAt(world: World, roomId: Id, x: number, y: number): boolean {
  const room = byId(world.rooms, roomId);
  if (!room) return false;
  const sprite = spritesAt(world, roomId, x, y).filter((s) => s.id !== AVATAR).at(-1);
  if (sprite) {
    delete sprite.position;
    return true;
  }
  const item = room.items.findLastIndex((i) => i.x === x && i.y === y);
  if (item >= 0) {
    room.items.splice(item, 1);
    return true;
  }
  if (room.tilemap[y]?.[x] !== undefined && room.tilemap[y][x] !== EMPTY_TILE) {
    room.tilemap[y][x] = EMPTY_TILE;
    return true;
  }
  return false;
}

const greys: Rgb[] = [
  [0, 0, 0],
  [128, 128, 128],
  [255, 255, 255],
];

/** Adds a palette, copied from `from` when given, and returns its id. */
export function addPalette(world: World, from?: Id): Id {
  const id = nextId(world.palettes.map((p) => p.id));
  const source = from === undefined ? undefined : byId(world.palettes, from);
  const palette: Palette = { id, colors: structuredClone(source?.colors ?? greys), extra: [] };
  if (source?.name !== undefined) palette.name = `${source.name} copy`;
  world.palettes.push(palette);
  return id;
}

/** Copies a room under a new id, with "copy" after its name. Returns the new id. */
export function duplicateRoom(world: World, roomId: Id): Id {
  const room = byId(world.rooms, roomId);
  if (!room) return '';
  const id = nextId(world.rooms.map((r) => r.id));
  const copy: Room = structuredClone(room);
  copy.id = id;
  if (room.name) copy.name = `${room.name.replace(/\s*copy$/, '')} copy`;
  world.rooms.splice(world.rooms.indexOf(room) + 1, 0, copy);
  return id;
}

/** What is on a cell, as the game draws it: a sprite, else an item, else a tile. */
export function contentAt(world: World, roomId: Id, x: number, y: number): { kind: DrawingKind; id: Id } | null {
  const sprite = world.sprites.find((s) => s.position?.room === roomId && s.position.x === x && s.position.y === y && s.id !== AVATAR)
    ?? world.sprites.find((s) => s.position?.room === roomId && s.position.x === x && s.position.y === y);
  if (sprite) return { kind: 'sprites', id: sprite.id };
  const room = byId(world.rooms, roomId);
  const item = room?.items.find((i) => i.x === x && i.y === y);
  if (item) return { kind: 'items', id: item.id };
  const tile = room?.tilemap[y]?.[x];
  return tile && tile !== EMPTY_TILE ? { kind: 'tiles', id: tile } : null;
}

/** Removes a palette; its rooms take the first palette left. The last palette stays. */
export function removePalette(world: World, id: Id): boolean {
  if (world.palettes.length < 2 || !byId(world.palettes, id)) return false;
  world.palettes = world.palettes.filter((p) => p.id !== id);
  const fallback = world.palettes[0]!.id;
  for (const room of world.rooms) if (room.palette === id) room.palette = fallback;
  return true;
}
