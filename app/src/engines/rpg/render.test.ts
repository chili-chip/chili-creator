import { describe, expect, it } from 'vitest';
import { blankGame, parseGame } from './model';
import { pictureRGBA, roomRGBA } from './render';

const game = () => parseGame(blankGame('Test')).doc;
const pixel = (rgba: Uint8ClampedArray, width: number, x: number, y: number) => [...rgba.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];

describe('drawing a Chili RPG game', () => {
  it('draws a picture in Sweetie 16, with clear pixels see-through', () => {
    const rgba = pictureRGBA(game().art!.pictures[2]!);
    expect(pixel(rgba, 8, 3, 0)).toEqual([0xff, 0xcd, 0x75, 255]);
    expect(pixel(rgba, 8, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('draws a room: background, ground, the hero at the start, and what is placed', () => {
    const g = game();
    const room = g.rooms[0]!;
    const rgba = roomRGBA(g, room);
    expect(rgba).toHaveLength(128 * 128 * 4);
    // Floor is clear, so the background shows; walls are drawn.
    expect(pixel(rgba, 128, 8 * 5, 8 * 5)).toEqual([0x1a, 0x1c, 0x2c, 255]);
    expect(pixel(rgba, 128, 0, 0)).toEqual([0x94, 0xb0, 0xc2, 255]);
    // The hero stands at the start, 7, 7.
    expect(pixel(rgba, 128, 7 * 8 + 3, 7 * 8)).toEqual([0xff, 0xcd, 0x75, 255]);
  });

  it('draws a room of any size', () => {
    const g = game();
    const room = { id: 'big', ground: Array(20).fill('#'.repeat(24)) };
    expect(roomRGBA(g, room)).toHaveLength(24 * 8 * 20 * 8 * 4);
  });
});
