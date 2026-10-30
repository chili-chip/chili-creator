import { describe, expect, it } from 'vitest';
import { blankGame, parseGame } from './model';
import { boardRGBA, pictureRGBA } from './render';

describe('drawing a Chili Beat game for the editor', () => {
  const game = parseGame(blankGame('Test')).doc; // palette 0, 6, 13, 12

  it('draws a picture in the game palette, with colour 0 see-through when asked', () => {
    const wall = game.things[1]!.frames[0]!;
    const rgba = pictureRGBA(game, wall);
    expect([...rgba.slice(0, 4)]).toEqual([0x94, 0xb0, 0xc2, 255]); // "2" is palette[2] = 13
    const hero = pictureRGBA(game, game.things[0]!.frames[0]!, true);
    expect(rgba.length).toBe(8 * 8 * 4);
    expect(hero[3]).toBe(0);
  });

  it('draws a screen: background, ground, then things', () => {
    const rgba = boardRGBA(game, game.screens[0]!);
    expect(rgba.length).toBe(128 * 128 * 4);
    expect([...rgba.slice(0, 4)]).toEqual([0x94, 0xb0, 0xc2, 255]); // wall at (0, 0)
    const at = (x: number, y: number) => [...rgba.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
    expect(at(20, 20)).toEqual([0x1a, 0x1c, 0x2c, 255]); // empty cell: colour 0
    expect(at(56 + 2, 56)).toEqual([0xf4, 0xf4, 0xf4, 255]); // hero top row "00333300": colour 3 = 12
  });
});
