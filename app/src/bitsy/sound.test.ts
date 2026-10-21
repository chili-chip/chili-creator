import { describe, expect, it } from 'vitest';
import { byId, createWorld, parse, serialize } from '.';
import {
  addBar,
  addBlip,
  addTune,
  blipOf,
  cycleOctave,
  duplicateTune,
  eraseNotes,
  generateBlip,
  keyNameOf,
  moveBar,
  noteAt,
  pitchRow,
  readPitch,
  removeBar,
  removeBlip,
  removeTune,
  setKey,
  setNote,
  staffRows,
  stretchBlip,
  transposeBlip,
  tuneOf,
  updateBlip,
  updateTune,
  writeBlip,
  writePitch,
  writeTune,
  readBlip,
  readTune,
  type Tune,
} from './sound';

const fixtures = import.meta.glob<string>('./fixtures/*.bitsy', { query: '?raw', import: 'default', eager: true });
const fixture = (name: string) => parse(fixtures[`./fixtures/${name}.bitsy`]!).world;
const world = () => createWorld({ title: 'Test' });

/** A seeded random so generated blips are the same every run. */
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('pitches', () => {
  it('reads beats, note, octave and blip', () => {
    expect(readPitch('3d5')).toEqual({ beats: 3, note: 0, octave: 5 });
    expect(readPitch('C#')).toEqual({ beats: 1, note: 1, octave: 4 });
    expect(readPitch('16l2')).toEqual({ beats: 16, note: 5, octave: 2 });
    expect(readPitch('0')).toEqual({ beats: 0, note: 0, octave: 4 });
    expect(readPitch('2G~1')).toEqual({ beats: 2, note: 7, octave: 4, blip: '1' });
  });

  it('writes them back as Bitsy does', () => {
    expect(writePitch({ beats: 1, note: 1, octave: 4 }, null)).toBe('C#');
    expect(writePitch({ beats: 3, note: 0, octave: 5 }, { notes: [0, 2, 4, 5, 7, 9, 11], scale: [0, 1, 2, 4, 5] })).toBe('3d5');
    expect(writePitch({ beats: 0, note: 4, octave: 3 }, null)).toBe('0');
    expect(writePitch({ beats: 2, note: 7, octave: 4, blip: '1' }, null)).toBe('2G~1');
    // A scale degree the key does not use is a rest.
    expect(writePitch({ beats: 1, note: 3, octave: 4 }, { notes: [0, 2, 4, 5, 7, 9, 11], scale: [0, 1, 2, 4, 5] })).toBe('0');
  });
});

describe('tunes', () => {
  it('reads bars, key, tempo, instruments and strum', () => {
    const tune = tuneOf(fixture('editor-default'), '1')!;
    expect(tune.name).toBe('finale fanfare');
    expect(tune.melody).toHaveLength(4);
    expect(tune.melody[0]![0]).toEqual({ beats: 3, note: 0, octave: 4 });
    expect(tune.melody[0]![4]).toEqual({ beats: 3, note: 0, octave: 5 });
    expect(tune.harmony[0]![0]).toEqual({ beats: 16, note: 0, octave: 2 });
    expect(tune.key).toEqual({ notes: [0, 2, 4, 5, 7, 9, 11], scale: [0, 1, 2, 4, 5] });
    expect(tune.tempo).toBe('XFST');
    expect([tune.instrumentA, tune.instrumentB]).toEqual(['P2', 'P8']);
    expect(tune.arpeggio).toBe('INT8');
    expect(keyNameOf(tune)).toBe('major');
  });

  it('writes every tune of the classic games exactly as it was read', () => {
    // A few classic tunes say "TMP F" or "TMP M", which Bitsy plays and saves
    // as medium, and one has an eight-note key, which Bitsy saves with seven.
    const asBitsySaves = (lines: string[]) =>
      lines.map((line) => (/^TMP [FM]$/.test(line) ? 'TMP MED' : line === 'KEY C,C,C,C,C,C,C,C ' ? 'KEY C,C,C,C,C,C,C ' : line));
    for (const name of ['editor-default', 'editor-room', 'editor-tune']) {
      for (const block of fixture(name).tunes) {
        expect(writeTune(readTune(block))).toEqual({ ...block, lines: asBitsySaves(block.lines) });
      }
    }
    for (const block of world().tunes) expect(writeTune(readTune(block))).toEqual(block);
  });

  it('changes one tune and leaves the rest of the file alone', () => {
    const w = world();
    const before = serialize(w);
    updateTune(w, '2', (tune) => {
      tune.tempo = 'SLW';
    });
    const after = serialize(w);
    expect(after).toContain('NAME tuneful town\nTMP SLW\nSQR P4 P2');
    expect(after.replace('TMP SLW', 'TMP FST')).toBe(before);
  });

  it('adds a tune with four empty bars, copies one and removes one from the rooms', () => {
    const w = world();
    const id = addTune(w);
    expect(id).toBe('4');
    const tune = tuneOf(w, id)!;
    expect(tune.melody).toHaveLength(4);
    expect(tune.melody.flat().every((p) => p.beats === 0)).toBe(true);
    expect(keyNameOf(tune)).toBe('major');
    expect(byId(w.tunes, id)!.lines[0]).toBe('0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0');

    const copy = duplicateTune(w, '1')!;
    expect(tuneOf(w, copy)!.melody).toEqual(tuneOf(w, '1')!.melody);
    expect(tuneOf(w, copy)!.name).toBe('finale fanfare copy');

    expect(w.rooms[0]!.tune).toBe('2');
    expect(removeTune(w, '2')).toBe(true);
    expect(w.rooms[0]!.tune).toBeUndefined();
    expect(removeTune(w, '2')).toBe(false);
  });

  it('never hands out tune 0, which means silence', () => {
    const w = world();
    w.tunes = [];
    expect(addTune(w)).toBe('1');
  });
});

describe('writing notes', () => {
  const chromatic = (): Tune => {
    const w = world();
    const tune = tuneOf(w, addTune(w))!;
    setKey(tune, 'chromatic');
    return tune;
  };

  it('puts a note on a staff row, high C an octave up', () => {
    const tune = chromatic();
    setNote(tune, 'melody', 0, 2, 7);
    setNote(tune, 'melody', 0, 4, 12, { beats: 3 });
    setNote(tune, 'harmony', 0, 0, 9);
    expect(tune.melody[0]![2]).toEqual({ beats: 1, note: 7, octave: 4 });
    expect(tune.melody[0]![4]).toEqual({ beats: 3, note: 0, octave: 5 });
    expect(tune.harmony[0]![0]).toEqual({ beats: 1, note: 9, octave: 2 });
    expect(pitchRow(tune, 'melody', tune.melody[0]![4]!)).toBe(12);
    expect(noteAt(tune, 'melody', 0, 6)).toBe(4);
    expect(noteAt(tune, 'melody', 0, 7)).toBeNull();
  });

  it('keeps notes to the key: scale degrees, and nothing off the scale', () => {
    const w = world();
    const tune = tuneOf(w, addTune(w))!;
    expect(staffRows(tune)).toEqual([0, 2, 4, 7, 9, 12]);
    setNote(tune, 'melody', 0, 0, 4);
    setNote(tune, 'melody', 0, 1, 5);
    expect(tune.melody[0]![0]).toEqual({ beats: 1, note: 2, octave: 4 });
    expect(tune.melody[0]![1]!.beats).toBe(0);
    expect(writeTune(tune).lines[0]).toBe('m,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0');
  });

  it('erases, shortens and splits notes like Bitsy', () => {
    const tune = chromatic();
    setNote(tune, 'melody', 0, 0, 0, { beats: 8 });
    eraseNotes(tune, 'melody', 0, 3, 4);
    expect(tune.melody[0]![0]!.beats).toBe(3);
    expect(tune.melody[0]![5]).toEqual({ beats: 3, note: 0, octave: 4 });
    // Writing over the start of a note moves what is left of it along.
    setNote(tune, 'melody', 0, 5, 2);
    expect(tune.melody[0]![5]!.note).toBe(2);
    expect(tune.melody[0]![6]).toEqual({ beats: 2, note: 0, octave: 4 });
  });

  it('plays a blip as a note', () => {
    const tune = chromatic();
    setNote(tune, 'melody', 0, 0, 0, { blip: '1' });
    expect(writeTune(tune).lines[0]!.startsWith('C~1,')).toBe(true);
  });

  it('cycles a note through the octaves', () => {
    const tune = chromatic();
    setNote(tune, 'melody', 0, 0, 0);
    cycleOctave(tune, 'melody', 0, 0);
    expect(tune.melody[0]![0]!.octave).toBe(5);
    cycleOctave(tune, 'melody', 0, 0);
    expect(tune.melody[0]![0]!.octave).toBe(2);
  });

  it('converts notes between a key and chromatic', () => {
    const tune = chromatic();
    setNote(tune, 'melody', 0, 0, 4);
    setNote(tune, 'melody', 0, 1, 5);
    setKey(tune, 'major');
    expect(tune.melody[0]![0]!.note).toBe(2);
    // F is not in the major pentatonic scale.
    expect(tune.melody[0]![1]!.beats).toBe(0);
    setKey(tune, 'minor');
    expect(keyNameOf(tune)).toBe('minor');
    setKey(tune, 'chromatic');
    expect(tune.melody[0]![0]!.note).toBe(3);
    expect(tune.key).toBeNull();
    expect(keyNameOf(tune)).toBe('chromatic');
  });

  it('adds, copies, moves and removes bars, keeping 1 to 16', () => {
    const tune = chromatic();
    setNote(tune, 'melody', 0, 0, 7);
    expect(addBar(tune, 0)).toBe(4);
    expect(tune.melody[4]![0]!.note).toBe(7);
    expect(moveBar(tune, 4, 1)).toBe(true);
    expect(tune.melody[1]![0]!.note).toBe(7);
    expect(removeBar(tune, 1)).toBe(true);
    expect(tune.melody).toHaveLength(4);
    while (tune.melody.length < 16) addBar(tune);
    expect(addBar(tune)).toBeNull();
    while (tune.melody.length > 1) removeBar(tune, 0);
    expect(removeBar(tune, 0)).toBe(false);
  });
});

describe('blips', () => {
  it('reads pitches, envelope, beat, wave and repeat', () => {
    const blip = blipOf(world(), '1')!;
    expect(blip.name).toBe('meow');
    expect(blip.pitches).toEqual([
      { beats: 1, note: 4, octave: 5 },
      { beats: 1, note: 11, octave: 5 },
      { beats: 1, note: 11, octave: 5 },
    ]);
    expect(blip.envelope).toEqual({ attack: 40, decay: 99, sustain: 4, length: 185, release: 138 });
    expect(blip.beat).toEqual({ time: 61, delay: 115 });
    expect(blip.instrument).toBe('P2');
    expect(blip.repeat).toBe(false);
  });

  it('writes every blip of the classic games exactly as it was read', () => {
    for (const name of ['editor-default', 'editor-blip']) {
      for (const block of fixture(name).blips) expect(writeBlip(readBlip(block))).toEqual(block);
    }
  });

  it('makes new blips of a kind and remakes them', () => {
    const w = world();
    const id = addBlip(w, 'bloop', seeded());
    const blip = blipOf(w, id)!;
    expect(id).toBe('3');
    expect(blip.name).toBe('bloop 3');
    expect(blip.pitches[0]!.octave).toBe(2);
    expect(blip.pitches[1]!.beats).toBe(0);
    for (const kind of ['pick up', 'greeting', 'bleep', 'magic', 'meow', 'random'] as const) {
      generateBlip(blip, kind, seeded(7));
      for (const p of blip.pitches) expect(p.octave).toBeGreaterThanOrEqual(2);
      for (const p of blip.pitches) expect(p.octave).toBeLessThanOrEqual(5);
      expect(blip.envelope.sustain).toBeLessThanOrEqual(15);
    }
  });

  it('shifts pitch and stretches time', () => {
    const w = world();
    updateBlip(w, '1', (blip) => {
      transposeBlip(blip, 1);
      stretchBlip(blip, 2);
    });
    const blip = blipOf(w, '1')!;
    expect(blip.pitches[0]).toEqual({ beats: 1, note: 5, octave: 5 });
    expect(blip.pitches[1]).toEqual({ beats: 1, note: 11, octave: 5 });
    expect(blip.envelope.length).toBe(370);
  });

  it('removes a blip from the sprites, items and tunes that used it', () => {
    const w = world();
    updateTune(w, '1', (tune) => {
      tune.melody[0]![0]!.blip = '1';
    });
    expect(byId(w.sprites, 'a')!.blip).toBe('1');
    expect(removeBlip(w, '1')).toBe(true);
    expect(byId(w.sprites, 'a')!.blip).toBeUndefined();
    expect(tuneOf(w, '1')!.melody[0]![0]!.beats).toBe(0);
    expect(removeBlip(w, '1')).toBe(false);
  });
});
