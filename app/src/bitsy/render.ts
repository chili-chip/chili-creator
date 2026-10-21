import { byId } from './by-id';
import { DRAWING_SIZE, ROOM_SIZE, type DrawingKind } from './edit';
import type { Drawing, Id, Rgb, Room, World } from './types';

// The editor's view of a world, drawn in TypeScript as RGBA pixels. citsy is
// only used to play, so editing stays instant.

export const ROOM_PIXELS = ROOM_SIZE * DRAWING_SIZE;

const fallback: Rgb[] = [
  [0, 0, 0],
  [128, 128, 128],
  [255, 255, 255],
];

/** The colours a room is drawn in: its palette, else the first one. */
export function colorsFor(world: World, roomId?: Id): Rgb[] {
  const room = roomId === undefined ? undefined : byId(world.rooms, roomId);
  const palette = (room?.palette !== undefined && byId(world.palettes, room.palette)) || world.palettes[0];
  return palette?.colors ?? fallback;
}

/** Tiles draw in colour 1 and sprites and items in colour 2, unless COL says otherwise. */
export function defaultColor(kind: DrawingKind): number {
  return kind === 'tiles' ? 1 : 2;
}

function blit(
  out: Uint8ClampedArray,
  width: number,
  drawing: Drawing,
  frame: number,
  colors: Rgb[],
  kind: DrawingKind,
  left: number,
  top: number,
) {
  const pixels = drawing.frames[frame] ?? drawing.frames[0];
  if (!pixels) return;
  const on = colors[drawing.color ?? defaultColor(kind)] ?? fallback[0]!;
  const off = drawing.background === 'transparent' ? null : (colors[drawing.background ?? 0] ?? fallback[0]!);
  for (let y = 0; y < DRAWING_SIZE; y++) {
    for (let x = 0; x < DRAWING_SIZE; x++) {
      const color = pixels[y * DRAWING_SIZE + x] ? on : off;
      if (!color) continue;
      const i = ((top + y) * width + left + x) * 4;
      out[i] = color[0];
      out[i + 1] = color[1];
      out[i + 2] = color[2];
      out[i + 3] = 255;
    }
  }
}

/** One frame of a drawing, 8×8 RGBA. */
export function drawingPixels(drawing: Drawing, frame: number, colors: Rgb[], kind: DrawingKind): Uint8ClampedArray {
  const out = new Uint8ClampedArray(DRAWING_SIZE * DRAWING_SIZE * 4);
  blit(out, DRAWING_SIZE, drawing, frame, colors, kind, 0, 0);
  return out;
}

/** A room as the editor shows it, 128×128 RGBA: tiles, then items, then sprites. */
export function roomPixels(world: World, roomId: Id, frame = 0): Uint8ClampedArray {
  const out = new Uint8ClampedArray(ROOM_PIXELS * ROOM_PIXELS * 4);
  const colors = colorsFor(world, roomId);
  const [r, g, b] = colors[0] ?? fallback[0]!;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  }
  const room = byId(world.rooms, roomId);
  if (!room) return out;
  const draw = (drawing: Drawing | undefined, kind: DrawingKind, x: number, y: number) => {
    if (drawing) blit(out, ROOM_PIXELS, drawing, frame, colors, kind, x * DRAWING_SIZE, y * DRAWING_SIZE);
  };
  room.tilemap.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell !== '0' && x < ROOM_SIZE && y < ROOM_SIZE) draw(byId(world.tiles, cell), 'tiles', x, y);
    }),
  );
  for (const item of room.items) draw(byId(world.items, item.id), 'items', item.x, item.y);
  const sprites = world.sprites.filter((s) => s.position?.room === roomId);
  // The avatar goes on top, as in the game.
  sprites.sort((a, b) => Number(a.id === 'A') - Number(b.id === 'A'));
  for (const sprite of sprites) draw(sprite, 'sprites', sprite.position!.x, sprite.position!.y);
  return out;
}

export const EXIT_COLOR: Rgb = [255, 196, 0];
export const ENDING_COLOR: Rgb = [255, 72, 96];

/** Outlines a room's exits and endings on its pixels; the picked cell gets a thicker line. */
export function markRoom(out: Uint8ClampedArray, room: Room, selected?: { x: number; y: number } | null): void {
  const outline = (cellX: number, cellY: number, color: Rgb) => {
    const thickness = selected && selected.x === cellX && selected.y === cellY ? 2 : 1;
    for (let y = 0; y < DRAWING_SIZE; y++) {
      for (let x = 0; x < DRAWING_SIZE; x++) {
        const edge = Math.min(x, y, DRAWING_SIZE - 1 - x, DRAWING_SIZE - 1 - y);
        if (edge >= thickness) continue;
        const i = ((cellY * DRAWING_SIZE + y) * ROOM_PIXELS + cellX * DRAWING_SIZE + x) * 4;
        out[i] = color[0];
        out[i + 1] = color[1];
        out[i + 2] = color[2];
        out[i + 3] = 255;
      }
    }
  };
  for (const exit of room.exits) outline(exit.x, exit.y, EXIT_COLOR);
  for (const ending of room.endings) outline(ending.x, ending.y, ENDING_COLOR);
}

export const WALL_COLOR: Rgb = [255, 96, 64];

/** Hatches the cells a player cannot walk through: wall tiles and the room's own walls. */
export function markWalls(out: Uint8ClampedArray, world: World, roomId: Id): void {
  const room = byId(world.rooms, roomId);
  if (!room) return;
  room.tilemap.forEach((row, cellY) =>
    row.forEach((cell, cellX) => {
      if (cell === '0' || cellX >= ROOM_SIZE || cellY >= ROOM_SIZE) return;
      if (!byId(world.tiles, cell)?.wall && !room.walls.includes(cell)) return;
      for (let y = 0; y < DRAWING_SIZE; y++) {
        for (let x = 0; x < DRAWING_SIZE; x++) {
          if ((x + y) % 4 !== 0) continue;
          const i = ((cellY * DRAWING_SIZE + y) * ROOM_PIXELS + cellX * DRAWING_SIZE + x) * 4;
          out[i] = WALL_COLOR[0];
          out[i + 1] = WALL_COLOR[1];
          out[i + 2] = WALL_COLOR[2];
          out[i + 3] = 255;
        }
      }
    }),
  );
}
