// @vitest-environment node
// The real engine (chili-beat/chili-beat.wasm), so the creator plays games the
// same way the platform and the console do.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadEngine } from './player';

const beeHome = readFileSync(new URL('./fixtures/bee-home.beat', import.meta.url), 'utf8');

describe('the Chili Beat engine', () => {
  it('gives a clear error for a broken game', async () => {
    const player = await loadEngine();
    expect(player.load(beeHome.replace('"become": "u"', '"become": "z"'))).toBe(
      'rules[1].do[0].become: no thing has key "z"',
    );
  });

  it('plays Bee Home to a win', async () => {
    const player = await loadEngine();
    expect(player.load(beeHome)).toBeNull();
    const press = (button: number) => {
      player.step(button);
      player.step(0);
    };
    const waitBeats = (n: number) => {
      for (let i = 0; i < n; i++) {
        const beat = player.debug().beat;
        while (player.debug().beat === beat) player.step(0);
      }
    };
    for (let i = 0; i < 4; i++) press(1);
    press(4);
    for (let i = 0; i < 4; i++) {
      waitBeats(8);
      press(4);
    }
    press(2);
    press(2);
    press(8);
    expect(player.debug()).toMatchObject({ state: 'won', counters: [5], text: 'The hive is happy.' });
  });
});
