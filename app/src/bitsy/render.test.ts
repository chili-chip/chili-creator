import { describe, expect, it } from 'vitest';
import { byId, createWorld } from '.';
import { colorsFor, drawingPixels, roomPixels, ROOM_PIXELS } from './render';

const world = () => createWorld({ title: 'Test' });

/** The RGB of pixel (x, y) in an RGBA buffer `width` wide. */
function at(pixels: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

const background = [0, 82, 204, 255];
const tileColor = [128, 159, 255, 255];
const spriteColor = [255, 255, 255, 255];

describe('colorsFor', () => {
  it("uses the room's palette, else the first one", () => {
    const w = world();
    w.palettes.push({ id: '1', colors: [[1, 2, 3]], extra: [] });
    w.rooms[0]!.palette = '1';
    expect(colorsFor(w, '0')).toEqual([[1, 2, 3]]);
    w.rooms[0]!.palette = undefined;
    expect(colorsFor(w, '0')).toEqual(w.palettes[0]!.colors);
    expect(colorsFor(w)).toEqual(w.palettes[0]!.colors);
  });

  it('falls back to black, grey and white without a palette', () => {
    const w = world();
    w.palettes = [];
    expect(colorsFor(w, '0')).toHaveLength(3);
  });
});

describe('drawingPixels', () => {
  it('draws a tile in the tile colour on the background', () => {
    const w = world();
    const pixels = drawingPixels(byId(w.tiles, 'a')!, 0, colorsFor(w), 'tiles');
    expect(pixels).toHaveLength(8 * 8 * 4);
    expect(at(pixels, 8, 0, 0)).toEqual(tileColor);
    expect(at(pixels, 8, 1, 1)).toEqual(background);
  });

  it('draws sprites and items in the sprite colour', () => {
    const w = world();
    const avatar = drawingPixels(byId(w.sprites, 'A')!, 0, colorsFor(w), 'sprites');
    expect(at(avatar, 8, 3, 0)).toEqual(spriteColor);
    expect(at(avatar, 8, 0, 0)).toEqual(background);
  });

  it('follows COL and BGC, and leaves transparent backgrounds clear', () => {
    const w = world();
    const tile = byId(w.tiles, 'a')!;
    tile.color = 2;
    tile.background = 1;
    let pixels = drawingPixels(tile, 0, colorsFor(w), 'tiles');
    expect(at(pixels, 8, 0, 0)).toEqual(spriteColor);
    expect(at(pixels, 8, 1, 1)).toEqual(tileColor);
    tile.background = 'transparent';
    pixels = drawingPixels(tile, 0, colorsFor(w), 'tiles');
    expect(at(pixels, 8, 1, 1)).toEqual([0, 0, 0, 0]);
  });

  it('draws the frame asked for, or the first one', () => {
    const w = world();
    const tile = byId(w.tiles, 'a')!;
    tile.frames.push(Array(64).fill(0));
    expect(at(drawingPixels(tile, 1, colorsFor(w), 'tiles'), 8, 0, 0)).toEqual(background);
    expect(at(drawingPixels(tile, 5, colorsFor(w), 'tiles'), 8, 0, 0)).toEqual(tileColor);
  });

  it('uses black for a colour the palette does not have', () => {
    const w = world();
    const tile = byId(w.tiles, 'a')!;
    tile.color = 7;
    expect(at(drawingPixels(tile, 0, colorsFor(w), 'tiles'), 8, 0, 0)).toEqual([0, 0, 0, 255]);
  });
});

describe('roomPixels', () => {
  it('draws the room: background, tiles, items, then sprites on top', () => {
    const w = world();
    w.rooms[0]!.items.push({ id: '0', x: 1, y: 2 });
    const pixels = roomPixels(w, '0');
    expect(pixels).toHaveLength(ROOM_PIXELS * ROOM_PIXELS * 4);
    // Cell (0,0) is empty.
    expect(at(pixels, ROOM_PIXELS, 0, 0)).toEqual(background);
    // Cell (1,1) is the block tile: its top row is on.
    expect(at(pixels, ROOM_PIXELS, 8, 8)).toEqual(tileColor);
    // The tea item covers the tile at (1,2): its top-left pixel is off, so background.
    expect(at(pixels, ROOM_PIXELS, 8, 16)).toEqual(background);
    expect(at(pixels, ROOM_PIXELS, 8 + 2, 16 + 3)).toEqual(spriteColor);
    // The avatar stands at (4,4); its pixel (3,0) is on.
    expect(at(pixels, ROOM_PIXELS, 32 + 3, 32)).toEqual(spriteColor);
  });

  it('lets the tile show through a transparent sprite background', () => {
    const w = world();
    byId(w.sprites, 'A')!.background = 'transparent';
    byId(w.sprites, 'A')!.position = { room: '0', x: 1, y: 1 };
    const pixels = roomPixels(w, '0');
    expect(at(pixels, ROOM_PIXELS, 8, 8)).toEqual(tileColor);
  });

  it('draws an unknown room as background only', () => {
    const pixels = roomPixels(world(), 'nope');
    expect(at(pixels, ROOM_PIXELS, 64, 64)).toEqual(background);
  });
});
