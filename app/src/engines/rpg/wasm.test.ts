// @vitest-environment node
// The real engine (chili-rpg/chili-rpg.wasm, built by chili-chip/chili-game-sdk),
// so the creator plays games the same way the platform and the console do.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blankGame } from './model';
import { loadEngine, RPG_BUTTONS } from './player';

const village = readFileSync(new URL('./fixtures/pepper-village.rpg', import.meta.url), 'utf8');

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
});
