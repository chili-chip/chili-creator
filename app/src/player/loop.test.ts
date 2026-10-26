import { describe, expect, it, vi } from 'vitest';
import { Button, createPlayLoop } from './loop';
import type { CitsyEngine } from './citsy';

function fakeEngine(overrides: Partial<CitsyEngine> = {}): CitsyEngine & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    load: vi.fn(() => true),
    unload: vi.fn(),
    lastError: () => '',
    setButton: (index, down) => calls.push(`button ${index} ${down ? 1 : 0}`),
    frame: (dt) => {
      calls.push(`frame ${dt}`);
      return true;
    },
    pixels: () => new Uint8Array(128 * 128 * 4).fill(7),
    sound: () => new Float32Array([1, 440, 0.5, 2, 0, 0, 0, 0]),
    stateVersion: () => 0,
    stateJson: () => '{"version":0,"inventory":{},"variables":{}}',
    setVariable: vi.fn(),
    setItem: vi.fn(() => true),
    validate: () => ({ ok: true, errors: [] }),
    ...overrides,
  };
}

describe('createPlayLoop', () => {
  it('steps the engine by the time that passed, capped at 100 ms', () => {
    const engine = fakeEngine();
    const loop = createPlayLoop(engine, { onFrame: () => {}, onSound: () => {}, onEnd: () => {} });
    loop.tick(1000);
    loop.tick(1016);
    loop.tick(1500);
    const frames = engine.calls.filter((call) => call.startsWith('frame'));
    expect(frames).toEqual(['frame 16.667', 'frame 16', 'frame 100']);
  });

  it('sends held buttons before each frame', () => {
    const engine = fakeEngine();
    const loop = createPlayLoop(engine, { onFrame: () => {}, onSound: () => {}, onEnd: () => {} });
    loop.setButton(Button.Right, true);
    loop.tick(0);
    expect(engine.calls.slice(0, 7)).toEqual([
      'button 0 0',
      'button 1 0',
      'button 2 0',
      'button 3 1',
      'button 4 0',
      'button 5 0',
      'frame 16.667',
    ]);
  });

  it('holds a tap on Ok for one frame', () => {
    const engine = fakeEngine();
    const loop = createPlayLoop(engine, { onFrame: () => {}, onSound: () => {}, onEnd: () => {} });
    loop.tap();
    loop.tick(0);
    loop.tick(16);
    const ok = engine.calls.filter((call) => call.startsWith('button 4'));
    expect(ok).toEqual(['button 4 1', 'button 4 0']);
  });

  it('hands out a copy of the picture and the sound', () => {
    const engine = fakeEngine();
    const onFrame = vi.fn();
    const onSound = vi.fn();
    const loop = createPlayLoop(engine, { onFrame, onSound, onEnd: () => {} });
    loop.tick(0);
    const pixels = onFrame.mock.calls[0]![0] as Uint8ClampedArray;
    expect(pixels).toBeInstanceOf(Uint8ClampedArray);
    expect(pixels.length).toBe(65536);
    expect(pixels[0]).toBe(7);
    expect(onSound).toHaveBeenCalledWith([
      { on: true, frequency: 440, volume: 0.5, pulse: 2 },
      { on: false, frequency: 0, volume: 0, pulse: 0 },
    ]);
  });

  it('reports the game state on the first frame and whenever its version moves', () => {
    const versions = [1, 1, 2];
    let n = 0;
    const stateJson = vi.fn(() => `{"version":${versions[n - 1]},"inventory":{"0":${n}},"variables":{"a":"x"}}`);
    const engine = fakeEngine({ stateVersion: () => versions[n++]!, stateJson });
    const onState = vi.fn();
    const loop = createPlayLoop(engine, { onFrame: () => {}, onSound: () => {}, onEnd: () => {}, onState });
    loop.tick(0);
    loop.tick(16);
    loop.tick(32);
    expect(stateJson).toHaveBeenCalledTimes(2);
    expect(onState.mock.calls).toEqual([
      [{ inventory: { 0: 1 }, variables: { a: 'x' } }],
      [{ inventory: { 0: 3 }, variables: { a: 'x' } }],
    ]);
  });

  it('ends when the game ends', () => {
    const engine = fakeEngine({ frame: () => false });
    const onEnd = vi.fn();
    const loop = createPlayLoop(engine, { onFrame: () => {}, onSound: () => {}, onEnd });
    expect(loop.tick(0)).toBe(false);
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
