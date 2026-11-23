// @vitest-environment node
// The real engine (chili-rpg/chili-rpg.wasm, built by chili-chip/chili-game-sdk),
// so the creator plays games the same way the platform and the console do.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blankGame } from './model';
import { loadEngine, RPG_BUTTONS } from './player';

const village = readFileSync(new URL('./fixtures/pepper-village.rpg', import.meta.url), 'utf8');
const lostRing = readFileSync(new URL('./fixtures/lost-ring.rpg', import.meta.url), 'utf8');

describe('the Chili RPG engine', () => {
  it('gives a clear error for a broken game', async () => {
    const player = await loadEngine();
    expect(player.load(village.replace('"kind": "elder"', '"kind": "nobody"'))).toBe('rooms[0].actors[0].kind: no kind "nobody"');
  });

  it('plays a blank game: the hero walks', async () => {
    const player = await loadEngine();
    expect(player.load(blankGame('Test'))).toBeNull();
    expect(player.debug()).toMatchObject({ state: 'playing', title: 'Test', room: 'start', x: 7, y: 7, hp: 10 });
    for (let i = 0; i < 6; i++) player.step(RPG_BUTTONS.right);
    for (let i = 0; i < 30; i++) player.step(0);
    expect(player.debug().x).toBe(8);
  });

  it('talks to Elder Ana in Pepper Village', async () => {
    const player = await loadEngine();
    expect(player.load(village)).toBeNull();
    const walk = (button: number) => {
      for (let i = 0; i < 6; i++) player.step(button);
      for (let i = 0; i < 20; i++) player.step(0);
    };
    // The hero starts at 6, 5 and Ana stands at 4, 3. Walking into her talks.
    walk(RPG_BUTTONS.up);
    walk(RPG_BUTTONS.left);
    walk(RPG_BUTTONS.left);
    expect(player.debug()).toMatchObject({ x: 4, y: 4 });
    walk(RPG_BUTTONS.up);
    for (let i = 0; i < 120; i++) player.step(0);
    expect(player.debug()).toMatchObject({ talking: true, speaker: 'Elder Ana' });
    expect(player.rgba()).toHaveLength(128 * 128 * 4);
  });

  it('plays the Lost Ring tutorial game to the end', async () => {
    const player = await loadEngine();
    expect(player.load(lostRing)).toBeNull();
    const press = (button: number, times = 1) => {
      for (let t = 0; t < times; t++) {
        for (let i = 0; i < 6; i++) player.step(button);
        for (let i = 0; i < 20; i++) player.step(0);
      }
    };
    const talkThrough = () => {
      for (let i = 0; i < 60 && player.debug().talking; i++) press(RPG_BUTTONS.a);
      expect(player.debug().talking).toBe(false);
    };
    // Gran stands at 7, 4 and the hero starts at 7, 7.
    press(RPG_BUTTONS.up, 3);
    expect(player.debug()).toMatchObject({ talking: true, speaker: 'Gran' });
    talkThrough();
    expect(player.debug().quests).toEqual({ ring: 1 });
    // The ring lies at 13, 13.
    press(RPG_BUTTONS.right, 6);
    press(RPG_BUTTONS.down, 8);
    expect(player.debug()).toMatchObject({ x: 13, y: 13 });
    press(RPG_BUTTONS.a);
    press(RPG_BUTTONS.b);
    expect(player.debug()).toMatchObject({ bag: [{ item: 'ring', count: 1 }], quests: { ring: 2 } });
    press(RPG_BUTTONS.left, 6);
    press(RPG_BUTTONS.up, 9);
    expect(player.debug()).toMatchObject({ talking: true, text: expect.stringContaining('My ring') });
    talkThrough();
    press(RPG_BUTTONS.b);
    expect(player.debug()).toMatchObject({ state: 'won', bag: [] });
  });
});
