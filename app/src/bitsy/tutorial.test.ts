// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import citsyScript from '../../../citsy/citsy.js?raw';
import { createCitsy, type CitsyEngine } from '../player/citsy';
import { Button, createPlayLoop } from '../player/loop';
import { parse, serialize, validate } from '.';

// The game the docs tutorial builds (docs/tutorial/) and offers as a download.
const game = readFileSync(fileURLToPath(new URL('../../../docs/assets/tutorial/chili-garden.bitsy', import.meta.url)), 'utf8');

describe('the docs tutorial game', () => {
  it('parses cleanly and round-trips byte for byte', () => {
    const { world, issues } = parse(game);
    expect(issues).toEqual([]);
    expect(serialize(world)).toBe(game);
  });

  it('has no problems', () => {
    expect(validate(parse(game).world)).toEqual([]);
  });

  it('plays in citsy: the gardener talks when the avatar walks up to him', async () => {
    const citsy = await engine();
    expect(citsy.load(game)).toBe(true);
    let screen: Uint8ClampedArray = new Uint8ClampedArray();
    let time = 0;
    const loop = createPlayLoop(citsy, { onFrame: (pixels) => (screen = pixels), onSound: () => {}, onEnd: () => {} });
    const press = (button?: Button) => {
      if (button !== undefined) loop.setButton(button, true);
      for (let i = 0; i < 10; i++) loop.tick(time++ * 16);
      if (button !== undefined) loop.setButton(button, false);
      for (let i = 0; i < 10; i++) loop.tick(time++ * 16);
    };
    // The textbox is the only black on screen.
    const textbox = () => screen.filter((value, i) => i % 4 === 0 && value + screen[i + 1]! + screen[i + 2]! === 0).length;
    press();
    expect(textbox()).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) press(Button.Ok);
    expect(textbox()).toBe(0);
    for (let i = 0; i < 7; i++) press(Button.Up);
    expect(textbox()).toBeGreaterThan(0);
  });
});

function engine(): Promise<CitsyEngine> {
  const wasm = readFileSync(fileURLToPath(new URL('../../../citsy/citsy.wasm', import.meta.url)));
  return createCitsy({
    script: citsyScript,
    instantiate: (imports) => WebAssembly.instantiate(wasm, imports).then((result) => result.instance),
    globals: { require: createRequire(import.meta.url), __dirname: process.cwd() },
  });
}
