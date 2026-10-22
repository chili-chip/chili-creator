import { describe, expect, it } from 'vitest';
import { createRecorder } from './recorder';

const frame = (value: number) => new Uint8ClampedArray(128 * 128 * 4).fill(value);

describe('recorder', () => {
  it('keeps the frames that change, each shown until the next one', () => {
    let now = 0;
    const recorder = createRecorder({ now: () => now });
    recorder.frame(frame(1));
    expect(recorder.recording()).toBe(false);
    recorder.start();
    recorder.frame(frame(1));
    now = 16;
    recorder.frame(frame(1));
    now = 120;
    recorder.frame(frame(2));
    now = 300;
    const frames = recorder.stop();
    expect(frames.map((f) => f.delayMs)).toEqual([120, 180]);
    expect(frames[0]!.pixels[0]).toBe(1);
    expect(frames[1]!.pixels[0]).toBe(2);
    expect(recorder.recording()).toBe(false);
  });

  it('copies frames, so the player can reuse its buffer', () => {
    let now = 0;
    const recorder = createRecorder({ now: () => now });
    const shared = frame(1);
    recorder.start();
    recorder.frame(shared);
    shared.fill(9);
    now = 50;
    expect(recorder.stop()[0]!.pixels[0]).toBe(1);
  });

  it('stops by itself at the longest recording', () => {
    let now = 0;
    const recorder = createRecorder({ now: () => now, maxMs: 1000 });
    recorder.start();
    recorder.frame(frame(1));
    now = 1500;
    recorder.frame(frame(2));
    expect(recorder.full()).toBe(true);
    const frames = recorder.stop();
    expect(frames).toHaveLength(1);
    expect(frames[0]!.delayMs).toBe(1000);
  });

  it('says how far a recording has got', () => {
    let now = 0;
    const recorder = createRecorder({ now: () => now, maxMs: 1000 });
    expect(recorder.elapsedMs()).toBe(0);
    recorder.start();
    now = 400;
    expect(recorder.elapsedMs()).toBe(400);
    expect(recorder.maxMs).toBe(1000);
    now = 2000;
    expect(recorder.elapsedMs()).toBe(1000);
  });
});
