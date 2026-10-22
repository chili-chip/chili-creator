import { describe, expect, it } from 'vitest';
import { emptyBar, type Blip, type Tune } from '../bitsy/sound';
import { createSoundEngine, frequencyOf } from './engine';

function tune(change: (t: Tune) => void = () => {}): Tune {
  const t: Tune = {
    id: '1',
    melody: [emptyBar(), emptyBar()],
    harmony: [emptyBar(), emptyBar()],
    key: null,
    tempo: 'MED',
    instrumentA: 'P2',
    instrumentB: 'P8',
    arpeggio: 'OFF',
  };
  change(t);
  return t;
}

const blip: Blip = {
  id: '1',
  pitches: [
    { beats: 1, note: 9, octave: 4 },
    { beats: 1, note: 0, octave: 5 },
    { beats: 0, note: 0, octave: 4 },
  ],
  envelope: { attack: 10, decay: 10, sustain: 5, length: 20, release: 10 },
  beat: { time: 20, delay: 0 },
  instrument: 'P4',
  repeat: false,
};

/** Runs the engine in small steps and returns the channels after `ms`. */
function run(engine: ReturnType<typeof createSoundEngine>, ms: number, step = 4) {
  let channels = engine.update(0);
  for (let t = 0; t < ms; t += step) channels = engine.update(step);
  return channels;
}

describe('frequencies', () => {
  it('match Bitsy: A4 is 440 Hz, octaves double', () => {
    expect(frequencyOf({ beats: 1, note: 9, octave: 4 })).toBeCloseTo(440);
    expect(frequencyOf({ beats: 1, note: 9, octave: 5 })).toBeCloseTo(880);
    expect(frequencyOf({ beats: 1, note: 0, octave: 2 })).toBeCloseTo(261.7 / 4);
  });

  it('read scale degrees through the key', () => {
    const key = { notes: [0, 2, 4, 5, 7, 9, 11], scale: [0, 1, 2, 4, 5] };
    expect(frequencyOf({ beats: 1, note: 5, octave: 4 }, key)).toBeCloseTo(440);
  });
});

describe('tunes', () => {
  it('plays each sixteenth at the tempo and holds long notes', () => {
    const engine = createSoundEngine();
    engine.playTune(
      tune((t) => {
        t.melody[0]![0] = { beats: 2, note: 9, octave: 4 };
        t.harmony[0]![1] = { beats: 1, note: 0, octave: 2 };
      }),
    );
    let [a, b] = run(engine, 10);
    expect(a).toMatchObject({ on: true, frequency: 440, pulse: 2 });
    expect(b!.on).toBe(false);
    expect(engine.position()).toEqual({ bar: 0, beat: 0 });
    // Medium is 188 ms a sixteenth: the second beat still holds A, the harmony starts.
    [a, b] = run(engine, 190);
    expect(a).toMatchObject({ on: true, frequency: 440 });
    expect(b).toMatchObject({ on: true, pulse: 0 });
    expect(engine.position()).toEqual({ bar: 0, beat: 1 });
    // The third beat is a rest.
    [a, b] = run(engine, 190);
    expect(a!.on).toBe(false);
    expect(b!.on).toBe(false);
  });

  it('goes on to the next bar and loops round', () => {
    const engine = createSoundEngine();
    engine.playTune(tune((t) => (t.tempo = 'XFST')), { bar: 1 });
    run(engine, 94 * 16 + 10);
    expect(engine.position()).toEqual({ bar: 0, beat: 0 });
  });

  it('can repeat one bar', () => {
    const engine = createSoundEngine();
    engine.playTune(tune((t) => (t.tempo = 'XFST')), { bar: 1, loopBar: true });
    run(engine, 94 * 16 + 10);
    expect(engine.position()).toEqual({ bar: 1, beat: 0 });
  });

  it('strums the chord of the harmony’s first note', () => {
    const engine = createSoundEngine();
    engine.playTune(
      tune((t) => {
        t.key = { notes: [0, 2, 4, 5, 7, 9, 11], scale: [0, 1, 2, 3, 4, 5, 6] };
        t.arpeggio = 'UP';
        t.harmony[0]![0] = { beats: 16, note: 0, octave: 3 };
      }),
    );
    const heard = [Math.round(run(engine, 0)[1]!.frequency)];
    for (let i = 0; i < 3; i++) heard.push(Math.round(run(engine, 188)[1]!.frequency));
    // C E G C, an octave below middle C.
    expect(heard).toEqual([131, 165, 196, 262]);
  });

  it('plays a blip in place of a note', () => {
    const engine = createSoundEngine({ blip: () => blip });
    engine.playTune(tune((t) => (t.melody[0]![0] = { beats: 1, note: 0, octave: 4, blip: '1' })));
    const [a] = run(engine, 12);
    expect(a).toMatchObject({ on: true, frequency: 440, pulse: 1 });
  });

  it('stops', () => {
    const engine = createSoundEngine();
    engine.playTune(tune((t) => (t.melody[0]![0] = { beats: 1, note: 9, octave: 4 })));
    run(engine, 10);
    engine.stop();
    expect(engine.update(4).every((c) => !c.on)).toBe(true);
    expect(engine.position()).toBeNull();
  });
});

describe('blips', () => {
  it('follows the envelope and steps through the pitches', () => {
    const engine = createSoundEngine();
    engine.playBlip(blip);
    let [a] = run(engine, 6, 2);
    expect(a).toMatchObject({ on: true, frequency: 440, pulse: 1 });
    expect(a!.volume).toBeCloseTo((10 * 0.6) / 15, 1);
    [a] = run(engine, 20, 2);
    expect(a!.frequency).toBeCloseTo(523.4);
    expect(engine.playingBlip()).toBe(true);
    [a] = run(engine, 30, 2);
    expect(a!.on).toBe(false);
    expect(engine.playingBlip()).toBe(false);
  });

  it('repeats its pitches when asked', () => {
    const engine = createSoundEngine();
    engine.playBlip({ ...blip, repeat: true, beat: { time: 10, delay: 0 } });
    const [a] = run(engine, 21, 1);
    expect(a!.frequency).toBeCloseTo(440);
  });
});
