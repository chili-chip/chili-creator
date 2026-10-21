import { describe, expect, it } from 'vitest';
import { byId, createWorld, parse, serialize } from '.';
import {
  addDrawing,
  addPalette,
  addRoom,
  contentAt,
  duplicateRoom,
  AVATAR,
  clearFrame,
  drawingsOf,
  duplicateDrawing,
  eraseAt,
  fillPixels,
  flipDrawing,
  nextId,
  paintTile,
  placeSprite,
  removeDrawing,
  setAnimated,
  setPixel,
  spritesAt,
  toggleItem,
} from './edit';

const fixtures = import.meta.glob<string>('./fixtures/*.bitsy', { query: '?raw', import: 'default', eager: true });
const fixture = (name: string) => fixtures[`./fixtures/${name}.bitsy`]!;

const world = () => createWorld({ title: 'Test' });

describe('nextId', () => {
  it('counts on in base 36 after the highest id, as the classic editor does', () => {
    expect(nextId(['0', '1', '9'])).toBe('a');
    expect(nextId(['a', 'z'])).toBe('10');
    expect(nextId(['A', 'a'])).toBe('b');
  });

  it('starts at 0, or after the reserved ids', () => {
    expect(nextId([])).toBe('0');
    expect(nextId([], ['0'])).toBe('1');
  });

  it('ignores ids that are not base 36 numbers', () => {
    expect(nextId(['a', 'my_tile'])).toBe('b');
  });
});

describe('drawings', () => {
  it('adds a blank tile, sprite or item with a fresh id', () => {
    const w = world();
    const tile = addDrawing(w, 'tiles');
    const sprite = addDrawing(w, 'sprites');
    const item = addDrawing(w, 'items');
    expect([tile, sprite, item]).toEqual(['b', 'b', '2']);
    expect(byId(w.tiles, 'b')).toMatchObject({ frames: [Array(64).fill(0)], extra: [] });
    expect(byId(w.sprites, 'b')).toMatchObject({ inventory: [], extra: [] });
    expect(byId(w.sprites, 'b')!.position).toBeUndefined();
  });

  it('never gives a tile the id 0, which means an empty cell', () => {
    const w = world();
    w.tiles = [];
    expect(addDrawing(w, 'tiles')).toBe('1');
  });

  it('writes a new drawing the way the editor does', () => {
    const w = world();
    const id = addDrawing(w, 'tiles');
    setPixel(byId(w.tiles, id)!, 0, 0, 0, 1);
    expect(serialize(w)).toContain(`TIL a\n11111111\n10000001\n10000001\n10011001\n10011001\n10000001\n10000001\n11111111\nNAME block\n\nTIL b\n10000000\n${'00000000\n'.repeat(7)}\nSPR A`);
  });

  it('duplicates a drawing without its place in a room', () => {
    const w = world();
    const id = duplicateDrawing(w, 'sprites', 'a')!;
    const copy = byId(w.sprites, id)!;
    expect(copy.frames).toEqual(byId(w.sprites, 'a')!.frames);
    expect(copy.name).toBe('cat copy');
    expect(copy.position).toBeUndefined();
    expect(copy.dialog).toBe('0');
    expect(duplicateDrawing(w, 'sprites', 'missing')).toBeNull();
  });

  it('removes a tile from every room that uses it', () => {
    const w = world();
    w.rooms[0]!.walls = ['a'];
    expect(removeDrawing(w, 'tiles', 'a')).toBe(true);
    expect(w.tiles).toEqual([]);
    expect(w.rooms[0]!.tilemap.flat().every((cell) => cell === '0')).toBe(true);
    expect(w.rooms[0]!.walls).toEqual([]);
  });

  it('removes an item from rooms and inventories', () => {
    const w = world();
    w.rooms[0]!.items.push({ id: '0', x: 2, y: 2 });
    w.sprites[0]!.inventory.push({ id: '0', count: 1 });
    expect(removeDrawing(w, 'items', '0')).toBe(true);
    expect(w.rooms[0]!.items).toEqual([]);
    expect(w.sprites[0]!.inventory).toEqual([]);
  });

  it('keeps the avatar', () => {
    const w = world();
    expect(removeDrawing(w, 'sprites', AVATAR)).toBe(false);
    expect(removeDrawing(w, 'sprites', 'a')).toBe(true);
    expect(drawingsOf(w, 'sprites').map((s) => s.id)).toEqual([AVATAR]);
  });
});

describe('pixels', () => {
  it('sets one pixel of one frame', () => {
    const w = world();
    const tile = byId(w.tiles, 'a')!;
    setPixel(tile, 0, 1, 1, 1);
    expect(tile.frames[0]![9]).toBe(1);
    setPixel(tile, 0, 9, 1, 1); // outside: ignored
    setPixel(tile, 3, 1, 1, 1); // no such frame: ignored
    expect(tile.frames).toHaveLength(1);
  });

  it('fills the connected area of the same colour', () => {
    const w = world();
    const tile = byId(w.tiles, 'a')!;
    fillPixels(tile, 0, 1, 1, 1);
    // The block's inside is filled; the 2×2 in the middle was already on.
    expect(tile.frames[0]!.every((pixel) => pixel === 1)).toBe(true);
    fillPixels(tile, 0, 0, 0, 1); // same colour: nothing to do
    expect(tile.frames[0]!.every((pixel) => pixel === 1)).toBe(true);
  });

  it('flips a frame and clears it', () => {
    const w = world();
    const sprite = byId(w.sprites, 'a')!;
    const before = [...sprite.frames[0]!];
    flipDrawing(sprite, 0, 'x');
    expect(sprite.frames[0]!.slice(16, 24)).toEqual(before.slice(16, 24).reverse());
    flipDrawing(sprite, 0, 'x');
    flipDrawing(sprite, 0, 'y');
    expect(sprite.frames[0]!.slice(0, 8)).toEqual(before.slice(56, 64));
    clearFrame(sprite, 0);
    expect(sprite.frames[0]).toEqual(Array(64).fill(0));
  });

  it('turns animation on with a copy of the first frame, and off again', () => {
    const w = world();
    const sprite = byId(w.sprites, 'a')!;
    setAnimated(sprite, true);
    expect(sprite.frames).toHaveLength(2);
    expect(sprite.frames[1]).toEqual(sprite.frames[0]);
    expect(sprite.frames[1]).not.toBe(sprite.frames[0]);
    setAnimated(sprite, false);
    expect(sprite.frames).toHaveLength(1);
  });

  it('round-trips an animated drawing after an edit', () => {
    const { world: w } = parse(fixture('animated'));
    const tile = w.tiles.find((t) => t.frames.length > 1)!;
    setPixel(tile, 1, 0, 0, tile.frames[1]![0] ? 0 : 1);
    const again = parse(serialize(w)).world;
    expect(byId(again.tiles, tile.id)!.frames).toEqual(tile.frames);
  });
});

describe('rooms', () => {
  it('adds an empty room using the first palette', () => {
    const w = world();
    const id = addRoom(w);
    const room = byId(w.rooms, id)!;
    expect(id).toBe('1');
    expect(room.tilemap).toHaveLength(16);
    expect(room.tilemap.every((row) => row.length === 16 && row.every((cell) => cell === '0'))).toBe(true);
    expect(room.palette).toBe('0');
    expect(serialize(w)).toContain(`ROOM 1\n${'0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0\n'.repeat(16)}PAL 0\n`);
  });

  it('writes a room without commas in the old format', () => {
    const w = world();
    w.flags.ROOM_FORMAT = '0';
    addRoom(w);
    expect(serialize(w)).toContain(`ROOM 1\n${'0000000000000000\n'.repeat(16)}`);
  });

  it('paints and clears a tile in a cell', () => {
    const w = world();
    const room = w.rooms[0]!;
    paintTile(room, 3, 4, 'a');
    expect(room.tilemap[4]![3]).toBe('a');
    paintTile(room, 3, 4, '0');
    expect(room.tilemap[4]![3]).toBe('0');
    paintTile(room, 16, 4, 'a'); // outside: ignored
    expect(room.tilemap[4]).toHaveLength(16);
  });

  it('moves a sprite to a cell, since each sprite is in one place', () => {
    const w = world();
    w.rooms.push({ ...structuredClone(w.rooms[0]!), id: '1' });
    placeSprite(w, 'a', '1', 2, 3);
    expect(byId(w.sprites, 'a')!.position).toEqual({ room: '1', x: 2, y: 3 });
    expect(spritesAt(w, '1', 2, 3).map((s) => s.id)).toEqual(['a']);
    expect(spritesAt(w, '0', 8, 12)).toEqual([]);
  });

  it('adds an item to a cell, or takes it away when it is there', () => {
    const room = world().rooms[0]!;
    expect(toggleItem(room, '0', 5, 5)).toBe('added');
    expect(room.items).toEqual([{ id: '0', x: 5, y: 5 }]);
    expect(toggleItem(room, '0', 5, 5)).toBe('removed');
    expect(room.items).toEqual([]);
  });

  it('erases the top thing in a cell: a sprite, then an item, then the tile', () => {
    const w = world();
    const room = w.rooms[0]!;
    toggleItem(room, '0', 1, 1);
    placeSprite(w, 'a', '0', 1, 1);
    expect(eraseAt(w, '0', 1, 1)).toBe(true);
    expect(byId(w.sprites, 'a')!.position).toBeUndefined();
    expect(eraseAt(w, '0', 1, 1)).toBe(true);
    expect(room.items).toEqual([]);
    expect(eraseAt(w, '0', 1, 1)).toBe(true);
    expect(room.tilemap[1]![1]).toBe('0');
    expect(eraseAt(w, '0', 1, 1)).toBe(false);
  });

  it('does not erase the avatar', () => {
    const w = world();
    paintTile(w.rooms[0]!, 4, 4, 'a');
    expect(eraseAt(w, '0', 4, 4)).toBe(true);
    expect(byId(w.sprites, AVATAR)!.position).toEqual({ room: '0', x: 4, y: 4 });
    expect(w.rooms[0]!.tilemap[4]![4]).toBe('0');
  });
});

describe('palettes', () => {
  it('copies a palette under a new id', () => {
    const w = world();
    const id = addPalette(w, '0');
    expect(id).toBe('1');
    expect(byId(w.palettes, id)).toEqual({ id: '1', name: 'blueprint copy', colors: w.palettes[0]!.colors, extra: [] });
    expect(byId(w.palettes, id)!.colors).not.toBe(w.palettes[0]!.colors);
  });

  it('makes a black, grey and white palette when there is none to copy', () => {
    const w = world();
    w.palettes = [];
    expect(addPalette(w)).toBe('0');
    expect(w.palettes[0]!.colors).toEqual([
      [0, 0, 0],
      [128, 128, 128],
      [255, 255, 255],
    ]);
  });
});

describe('rooms', () => {
  it('duplicates a room: tiles, items, exits, endings, palette, music and avatar', () => {
    const w = createWorld({ title: 'Test' });
    const room = w.rooms[0]!;
    room.name = 'hall';
    room.tune = '1';
    room.avatar = 'a';
    room.exits.push({ x: 1, y: 1, dest: { room: '0', x: 2, y: 2 } });
    const id = duplicateRoom(w, '0');
    const copy = byId(w.rooms, id)!;
    expect(copy).toMatchObject({ name: 'hall copy', tune: '1', avatar: 'a', palette: room.palette });
    expect(copy.tilemap).toEqual(room.tilemap);
    expect(copy.tilemap).not.toBe(room.tilemap);
    expect(copy.exits).toEqual(room.exits);
    copy.exits[0]!.x = 5;
    expect(room.exits[0]!.x).toBe(1);
    expect(copy.items).toEqual(room.items);
  });

  it('says what is on a cell: a sprite before an item before a tile', () => {
    const w = createWorld({ title: 'Test' });
    const cat = byId(w.sprites, 'a')!.position!;
    expect(contentAt(w, '0', cat.x, cat.y)).toEqual({ kind: 'sprites', id: 'a' });
    const item = w.rooms[0]!.items[0];
    if (item) expect(contentAt(w, '0', item.x, item.y)).toEqual({ kind: 'items', id: item.id });
    w.rooms[0]!.tilemap[0]![0] = w.tiles[0]!.id;
    expect(contentAt(w, '0', 0, 0)).toEqual({ kind: 'tiles', id: w.tiles[0]!.id });
    w.rooms[0]!.tilemap[5]![5] = '0';
    expect(contentAt(w, '0', 5, 5)).toBeNull();
  });
});
