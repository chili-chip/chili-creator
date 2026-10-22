import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorld, emptyBar, tuneOf, blipOf, type Tune } from '../bitsy';
import type { SoundChannel } from '../player';
import { createSoundPreview } from './preview';

function fakeSynth() {
  const synth = {
    heard: [] as SoundChannel[][],
    apply: vi.fn((channels: SoundChannel[]) => synth.heard.push(channels)),
    silence: vi.fn(),
    dispose: vi.fn(),
  };
  return synth;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('sound preview', () => {
  it('makes the synth on the first play, then plays a tune and tells where it is', () => {
    const synth = fakeSynth();
    const makeSynth = vi.fn(() => synth);
    const world = createWorld({ title: 'Test' });
    const preview = createSoundPreview({ synth: makeSynth });
    expect(makeSynth).not.toHaveBeenCalled();
    const listener = vi.fn();
    preview.subscribe(listener);

    const tune: Tune = { ...tuneOf(world, '2')!, tempo: 'XFST' };
    preview.playTune(tune, world);
    expect(makeSynth).toHaveBeenCalledOnce();
    expect(preview.state()).toEqual({ playing: 'tune', id: '2', bar: 0, beat: 0 });
    vi.advanceTimersByTime(94 * 3 + 20);
    expect(preview.state()).toMatchObject({ bar: 0, beat: 3 });
    expect(listener).toHaveBeenCalled();
    expect(synth.heard.some((channels) => channels.some((c) => c.on))).toBe(true);

    preview.stop();
    expect(synth.silence).toHaveBeenCalled();
    expect(preview.state()).toEqual({ playing: null });
    const calls = synth.apply.mock.calls.length;
    vi.advanceTimersByTime(500);
    expect(synth.apply.mock.calls.length).toBe(calls);
  });

  it('plays a blip once and goes quiet by itself', () => {
    const synth = fakeSynth();
    const preview = createSoundPreview({ synth: () => synth });
    const world = createWorld({ title: 'Test' });
    preview.playBlip(blipOf(world, '1')!);
    expect(preview.state()).toEqual({ playing: 'blip', id: '1' });
    vi.advanceTimersByTime(1000);
    expect(preview.state()).toEqual({ playing: null });
    expect(synth.silence).toHaveBeenCalled();
  });

  it('plays one note of a tune', () => {
    const synth = fakeSynth();
    const preview = createSoundPreview({ synth: () => synth });
    preview.playNote({ beats: 1, note: 9, octave: 4 }, 'P4');
    vi.advanceTimersByTime(20);
    expect(synth.heard.at(-1)![0]).toMatchObject({ on: true, frequency: 440, pulse: 1 });
    vi.advanceTimersByTime(400);
    expect(synth.heard.at(-1)![0]!.on).toBe(false);
  });

  it('plays blip notes from the world it was given', () => {
    const synth = fakeSynth();
    const preview = createSoundPreview({ synth: () => synth });
    const world = createWorld({ title: 'Test' });
    const tune: Tune = { ...tuneOf(world, '2')!, melody: [emptyBar()], harmony: [emptyBar()] };
    tune.melody[0]![0] = { beats: 1, note: 0, octave: 4, blip: '1' };
    preview.playTune(tune, world);
    vi.advanceTimersByTime(40);
    // Blip 1 starts on E5.
    expect(synth.heard.at(-1)![0]).toMatchObject({ on: true });
    expect(Math.round(synth.heard.at(-1)![0]!.frequency)).toBe(659);
  });

  it('closes the synth when disposed', () => {
    const synth = fakeSynth();
    const preview = createSoundPreview({ synth: () => synth });
    preview.playNote({ beats: 1, note: 0, octave: 4 }, 'P2');
    preview.dispose();
    expect(synth.dispose).toHaveBeenCalled();
  });
});
