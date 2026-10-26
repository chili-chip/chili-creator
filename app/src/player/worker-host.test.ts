import { describe, expect, it, vi } from 'vitest';
import type { CitsyEngine } from './citsy';
import { Button } from './loop';
import type { FromWorker } from './protocol';
import { createWorkerHost } from './worker-host';

function setup(overrides: Partial<CitsyEngine> = {}) {
  let running = true;
  const engine: CitsyEngine = {
    load: vi.fn(() => true),
    unload: vi.fn(),
    lastError: () => 'bad room',
    setButton: vi.fn(),
    frame: vi.fn(() => running),
    pixels: () => new Uint8Array(65536),
    sound: () => new Float32Array(8),
    stateVersion: () => 1,
    stateJson: () => '{"version":1,"inventory":{"0":2},"variables":{"n":1}}',
    setVariable: vi.fn(),
    setItem: vi.fn(() => true),
    validate: () => ({ ok: true, errors: [] }),
    ...overrides,
  };
  const sent: FromWorker[] = [];
  let timer: (() => void) | null = null;
  let clock = 0;
  const host = createWorkerHost({
    post: (message) => sent.push(message),
    loadEngine: vi.fn(async () => engine),
    every: (_ms, fn) => {
      timer = fn;
      return () => (timer = null);
    },
    now: () => clock,
  });
  return {
    engine,
    sent,
    host,
    step() {
      clock += 16;
      timer?.();
    },
    hasTimer: () => timer !== null,
    end: () => (running = false),
  };
}

describe('createWorkerHost', () => {
  it('loads the game, then sends a frame on every step', async () => {
    const t = setup();
    await t.host.handle({ type: 'play', data: 'GAME' });
    expect(t.engine.load).toHaveBeenCalledWith('GAME');
    expect(t.sent).toEqual([{ type: 'started' }]);
    t.step();
    t.step();
    const frames = t.sent.filter((m) => m.type === 'frame');
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ type: 'frame' });
    expect((frames[0] as Extract<FromWorker, { type: 'frame' }>).pixels.byteLength).toBe(65536);
  });

  it('sends sound only when it changes', async () => {
    const sounds = [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 440, 0.5, 1, 0, 0, 0, 0],
      [1, 440, 0.5, 1, 0, 0, 0, 0],
    ];
    let n = 0;
    const t = setup({ sound: () => new Float32Array(sounds[Math.min(n++, 2)]!) });
    await t.host.handle({ type: 'play', data: 'GAME' });
    t.step();
    t.step();
    t.step();
    const sound = t.sent.filter((m) => m.type === 'sound');
    expect(sound).toHaveLength(2);
  });

  it('sends the game state when it changes', async () => {
    const t = setup();
    await t.host.handle({ type: 'play', data: 'GAME' });
    t.step();
    t.step();
    const states = t.sent.filter((m) => m.type === 'state');
    expect(states).toEqual([{ type: 'state', state: { inventory: { 0: 2 }, variables: { n: 1 } } }]);
  });

  it('sends the state again for a new game', async () => {
    const t = setup();
    await t.host.handle({ type: 'play', data: 'GAME' });
    t.step();
    await t.host.handle({ type: 'play', data: 'GAME' });
    t.step();
    expect(t.sent.filter((m) => m.type === 'state')).toHaveLength(2);
  });

  it('passes buttons to the game', async () => {
    const t = setup();
    await t.host.handle({ type: 'play', data: 'GAME' });
    await t.host.handle({ type: 'button', button: Button.Left, down: true });
    t.step();
    expect(t.engine.setButton).toHaveBeenCalledWith(Button.Left, true);
  });

  it('reports a game citsy cannot load', async () => {
    const t = setup({ load: () => false });
    await t.host.handle({ type: 'play', data: 'BROKEN' });
    expect(t.sent).toEqual([{ type: 'error', message: 'bad room' }]);
    expect(t.hasTimer()).toBe(false);
  });

  it('stops the clock when the game ends', async () => {
    const t = setup();
    await t.host.handle({ type: 'play', data: 'GAME' });
    t.end();
    t.step();
    expect(t.sent.at(-1)).toEqual({ type: 'ended' });
    expect(t.hasTimer()).toBe(false);
  });

  it('stops and unloads on stop', async () => {
    const t = setup();
    await t.host.handle({ type: 'play', data: 'GAME' });
    await t.host.handle({ type: 'stop' });
    expect(t.hasTimer()).toBe(false);
    expect(t.engine.unload).toHaveBeenCalled();
  });

  it('reports an engine that fails to start', async () => {
    const sent: FromWorker[] = [];
    const host = createWorkerHost({
      post: (message) => sent.push(message),
      loadEngine: async () => {
        throw new Error('no wasm');
      },
      every: () => () => {},
      now: () => 0,
    });
    await host.handle({ type: 'play', data: 'GAME' });
    expect(sent).toEqual([{ type: 'error', message: 'The player could not start: no wasm' }]);
  });
});
