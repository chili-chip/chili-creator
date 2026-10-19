// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createWorld, parse, serialize } from '../bitsy';
import citsyScript from '../../../citsy/citsy.js?raw';
import { Button, createPlayLoop } from './loop';
import { createCitsy, type CitsyEngine } from './citsy';

// The real engine (citsy/citsy.wasm), so the creator and the platform play
// games the same way.
const wasm = readFileSync(fileURLToPath(new URL('../../../citsy/citsy.wasm', import.meta.url)));
const nodeGlobals = { require: createRequire(import.meta.url), __dirname: process.cwd() };

function engine(): Promise<CitsyEngine> {
  return createCitsy({
    script: citsyScript,
    instantiate: (imports) => WebAssembly.instantiate(wasm, imports).then((result) => result.instance),
    globals: nodeGlobals,
  });
}

const fixtures = import.meta.glob<string>('../bitsy/fixtures/*.bitsy', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function run(citsy: CitsyEngine, frames: number, held?: Button): Uint8ClampedArray {
  let last: Uint8ClampedArray = new Uint8ClampedArray();
  const loop = createPlayLoop(citsy, { onFrame: (p) => (last = p), onSound: () => {}, onEnd: () => {} });
  if (held !== undefined) loop.setButton(held, true);
  for (let i = 0; i < frames; i++) loop.tick(i * 16);
  return last;
}

function differs(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++;
  return count;
}

describe('citsy engine', () => {
  it.each(Object.keys(fixtures))('loads and draws %s', async (name) => {
    const citsy = await engine();
    expect(citsy.load(fixtures[name]!)).toBe(true);
    const pixels = run(citsy, 5);
    expect(pixels.length).toBe(128 * 128 * 4);
    expect(pixels.some((value, i) => i % 4 !== 3 && value !== 0)).toBe(true);
  });

  it('plays what the world model writes after an edit', async () => {
    const world = createWorld({ title: 'Edited' });
    world.rooms[0]!.tilemap[3]![3] = 'a';
    const citsy = await engine();
    expect(citsy.load(serialize(parse(serialize(world)).world))).toBe(true);
    expect(run(citsy, 3).length).toBe(65536);
  });

  it('moves the avatar when a button is held', async () => {
    const citsy = await engine();
    citsy.load(fixtures['../bitsy/fixtures/editor-default.bitsy']!);
    run(citsy, 30);
    // Dismiss the title card.
    for (let i = 0; i < 4; i++) run(citsy, 30, Button.Ok);
    const before = run(citsy, 30);
    const after = run(citsy, 20, Button.Right);
    expect(differs(before, after)).toBeGreaterThan(0);
  });
});
