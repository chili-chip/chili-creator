import { byId } from './by-id';
import { nextId } from './edit';
import type { Id, RawBlock, World } from './types';

// Tunes and blips, typed. The world keeps their lines as written (RawBlock), so
// a tune nobody touched stays byte for byte; a tool reads one, changes it and
// writes it back the way the Bitsy editor's serializeWorld does.

export const BAR_LENGTH = 16;
export const MAX_BARS = 16;

/** Square wave duty: 1/2, 1/4 or 1/8. */
export type Wave = 'P2' | 'P4' | 'P8';
export type Tempo = 'SLW' | 'MED' | 'FST' | 'XFST';
/** How the harmony strums the chord of its first note. */
export type Arpeggio = 'OFF' | 'UP' | 'DWN' | 'INT5' | 'INT8';

export const waves: readonly Wave[] = ['P2', 'P4', 'P8'];
export const tempos: readonly Tempo[] = ['SLW', 'MED', 'FST', 'XFST'];
export const arpeggios: readonly Arpeggio[] = ['OFF', 'UP', 'DWN', 'INT5', 'INT8'];

/** One note, or a rest when `beats` is 0. */
export interface Pitch {
  beats: number;
  /** Chromatic 0–11 (C to B), or a scale degree 0–6 (do to ti) in a tune with a key. */
  note: number;
  /** 2 to 5; 4 is middle C's octave. */
  octave: number;
  /** A blip played instead of the note. */
  blip?: Id;
}

/** A tune's key: the chromatic note of each scale degree, and the degrees in use. */
export interface TuneKey {
  notes: number[];
  scale: number[];
}

export interface Tune {
  id: Id;
  name?: string;
  melody: Pitch[][];
  harmony: Pitch[][];
  /** null plays every chromatic note. */
  key: TuneKey | null;
  tempo: Tempo;
  instrumentA: Wave;
  instrumentB: Wave;
  arpeggio: Arpeggio;
}

export interface Envelope {
  /** Milliseconds, except sustain: a volume from 0 to 15. */
  attack: number;
  decay: number;
  sustain: number;
  length: number;
  release: number;
}

export interface Blip {
  id: Id;
  name?: string;
  pitches: [Pitch, Pitch, Pitch];
  envelope: Envelope;
  /** Milliseconds between pitch changes, and before the first. */
  beat: { time: number; delay: number };
  instrument: Wave;
  repeat: boolean;
}

const chromaticNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const solfaNames = ['d', 'r', 'm', 'f', 's', 'l', 't'];

export const rest = (): Pitch => ({ beats: 0, note: 0, octave: 4 });
export const emptyBar = (): Pitch[] => Array.from({ length: BAR_LENGTH }, rest);

/** "3d5~1": beats, note (upper case chromatic, lower case solfa), octave, blip. */
export function readPitch(text: string): Pitch {
  const pitch: Pitch = { beats: 1, note: 0, octave: 4 };
  const [body = '', blip] = text.trim().split('~');
  let i = 0;
  let digits = '';
  while (i < body.length && body[i]! >= '0' && body[i]! <= '9') digits += body[i++];
  if (digits) pitch.beats = parseInt(digits, 10);
  const letter = body[i];
  if (letter !== undefined) {
    if (letter === letter.toUpperCase()) {
      const sharp = body[i + 1] === '#';
      const note = chromaticNames.indexOf(letter + (sharp ? '#' : ''));
      if (note >= 0) pitch.note = note;
      i += sharp ? 2 : 1;
    } else {
      const note = solfaNames.indexOf(letter);
      if (note >= 0) pitch.note = note;
      i += 1;
    }
  }
  const octave = Number(body[i]);
  if (octave >= 2 && octave <= 5) pitch.octave = octave;
  if (blip !== undefined && pitch.beats > 0) pitch.blip = blip;
  return pitch;
}

function noteName(note: number, key: TuneKey | null): string | null {
  if (key) return key.scale.includes(note) ? (solfaNames[note] ?? null) : null;
  return chromaticNames[note] ?? null;
}

/** Like Bitsy: a rest is "0", a one-beat middle-octave C is "C". */
export function writePitch(pitch: Pitch, key: TuneKey | null): string {
  const name = noteName(pitch.note, key);
  const beats = name === null ? 0 : pitch.beats;
  if (beats <= 0) return '0';
  let text = beats === 1 ? '' : String(beats);
  text += name;
  if (pitch.octave !== 4) text += pitch.octave;
  if (pitch.blip !== undefined) text += `~${pitch.blip}`;
  return text;
}

const keyword = (line: string) => line.split(' ')[0] ?? '';
const args = (line: string) => line.split(' ').slice(1).filter(Boolean);

function readBar(line: string | undefined): Pitch[] {
  const notes = (line ?? '').split(',');
  return Array.from({ length: BAR_LENGTH }, (_, i) => (i < notes.length && notes[i] !== '' ? readPitch(notes[i]!) : rest()));
}

export function readTune(block: RawBlock): Tune {
  const tune: Tune = {
    id: block.id,
    melody: [],
    harmony: [],
    key: null,
    tempo: 'MED',
    instrumentA: 'P2',
    instrumentB: 'P2',
    arpeggio: 'OFF',
    ...(block.name === undefined ? {} : { name: block.name }),
  };
  const lines = block.lines;
  let i = 0;
  while (tune.melody.length < MAX_BARS && i < lines.length && !/^[A-Z]+ /.test(lines[i]!)) {
    tune.melody.push(readBar(lines[i]));
    tune.harmony.push(readBar(lines[i + 1]));
    i += 2;
    if (lines[i] === '>') i++;
    else break;
  }
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const [first, second] = args(line);
    switch (keyword(line)) {
      case 'KEY':
        tune.key = {
          notes: Array.from({ length: 7 }, (_, n) => {
            const note = first?.split(',')[n];
            return note ? readPitch(note).note : -1;
          }),
          scale: (second ?? '')
            .split(',')
            .filter(Boolean)
            .map((n) => readPitch(n).note),
        };
        break;
      case 'TMP':
        if (tempos.includes(first as Tempo)) tune.tempo = first as Tempo;
        break;
      case 'SQR':
        if (waves.includes(first as Wave)) tune.instrumentA = first as Wave;
        if (waves.includes(second as Wave)) tune.instrumentB = second as Wave;
        break;
      case 'ARP':
        if (arpeggios.includes(first as Arpeggio)) tune.arpeggio = first as Arpeggio;
        break;
    }
  }
  if (tune.melody.length === 0) {
    tune.melody.push(emptyBar());
    tune.harmony.push(emptyBar());
  }
  return tune;
}

export function writeTune(tune: Tune): RawBlock {
  const lines: string[] = [];
  tune.melody.forEach((bar, i) => {
    if (i > 0) lines.push('>');
    lines.push(bar.map((p) => writePitch(p, tune.key)).join(','));
    lines.push((tune.harmony[i] ?? emptyBar()).map((p) => writePitch(p, tune.key)).join(','));
  });
  if (tune.key) {
    lines.push(`KEY ${tune.key.notes.map((n) => chromaticNames[n] ?? 'C').join(',')} ${tune.key.scale.map((n) => solfaNames[n]).join(',')}`);
  }
  lines.push(`TMP ${tune.tempo}`, `SQR ${tune.instrumentA} ${tune.instrumentB}`);
  if (tune.key && tune.arpeggio !== 'OFF') lines.push(`ARP ${tune.arpeggio}`);
  return { id: tune.id, lines, ...(tune.name === undefined ? {} : { name: tune.name }) };
}

export function readBlip(block: RawBlock): Blip {
  const [pitchLine = '', ...rest] = block.lines;
  const notes = pitchLine.split(',');
  const pitch = (n: number): Pitch => {
    const text = notes[n];
    return text === undefined || text === '' ? { beats: 0, note: 0, octave: 4 } : readPitch(text);
  };
  const blip: Blip = {
    id: block.id,
    pitches: [pitch(0), pitch(1), pitch(2)],
    envelope: { attack: 0, decay: 0, sustain: 0, length: 0, release: 0 },
    beat: { time: 0, delay: 0 },
    instrument: 'P2',
    repeat: false,
    ...(block.name === undefined ? {} : { name: block.name }),
  };
  const int = (text: string | undefined) => {
    const n = parseInt(text ?? '', 10);
    return Number.isNaN(n) ? 0 : n;
  };
  for (const line of rest) {
    const values = args(line);
    switch (keyword(line)) {
      case 'ENV': {
        const [attack, decay, sustain, length, release] = values.map(int);
        blip.envelope = { attack: attack ?? 0, decay: decay ?? 0, sustain: sustain ?? 0, length: length ?? 0, release: release ?? 0 };
        break;
      }
      case 'BEAT':
        blip.beat = { time: int(values[0]), delay: int(values[1]) };
        break;
      case 'SQR':
        if (waves.includes(values[0] as Wave)) blip.instrument = values[0] as Wave;
        break;
      case 'RPT':
        blip.repeat = values[0] === '1';
        break;
    }
  }
  return blip;
}

export function writeBlip(blip: Blip): RawBlock {
  const pitch = (p: Pitch) => (p.beats > 0 ? (chromaticNames[p.note] ?? 'C') + (p.octave === 4 ? '' : p.octave) : String(p.beats));
  const { attack, decay, sustain, length, release } = blip.envelope;
  const lines = [
    blip.pitches.map(pitch).join(','),
    `ENV ${attack} ${decay} ${sustain} ${length} ${release}`,
    `BEAT ${blip.beat.time} ${blip.beat.delay}`,
    `SQR ${blip.instrument}`,
  ];
  if (blip.repeat) lines.push('RPT 1');
  return { id: blip.id, lines, ...(blip.name === undefined ? {} : { name: blip.name }) };
}

// --- In the world -----------------------------------------------------------

export function tuneOf(world: World, id: Id): Tune | undefined {
  const block = byId(world.tunes, id);
  return block && readTune(block);
}

export function blipOf(world: World, id: Id): Blip | undefined {
  const block = byId(world.blips, id);
  return block && readBlip(block);
}

export const tuneName = (tune: { id: Id; name?: string }) => tune.name || `Tune ${tune.id}`;
export const blipName = (blip: { id: Id; name?: string }) => blip.name || `Blip ${blip.id}`;

/** Changes a tune and writes it back in place. */
export function updateTune(world: World, id: Id, change: (tune: Tune) => void): boolean {
  const index = world.tunes.findIndex((t) => t.id === id);
  if (index < 0) return false;
  const tune = readTune(world.tunes[index]!);
  change(tune);
  world.tunes[index] = writeTune(tune);
  return true;
}

export function updateBlip(world: World, id: Id, change: (blip: Blip) => void): boolean {
  const index = world.blips.findIndex((b) => b.id === id);
  if (index < 0) return false;
  const blip = readBlip(world.blips[index]!);
  change(blip);
  world.blips[index] = writeBlip(blip);
  return true;
}

// "0" means "no tune" in a room, so it is never handed out.
const soundId = (blocks: readonly RawBlock[]) => nextId(blocks.map((b) => b.id), ['0']);

/** A new tune: four empty bars in a cheerful key. */
export function addTune(world: World): Id {
  const id = soundId(world.tunes);
  const tune: Tune = {
    id,
    name: `tune ${id}`,
    melody: [emptyBar(), emptyBar(), emptyBar(), emptyBar()],
    harmony: [emptyBar(), emptyBar(), emptyBar(), emptyBar()],
    key: copyKey(keys.major),
    tempo: 'MED',
    instrumentA: 'P2',
    instrumentB: 'P4',
    arpeggio: 'OFF',
  };
  world.tunes.push(writeTune(tune));
  return id;
}

export function duplicateTune(world: World, id: Id): Id | null {
  const tune = tuneOf(world, id);
  if (!tune) return null;
  const copy = soundId(world.tunes);
  world.tunes.push(writeTune({ ...tune, id: copy, name: `${tuneName(tune)} copy` }));
  return copy;
}

/** Removes a tune; rooms that played it go quiet. */
export function removeTune(world: World, id: Id): boolean {
  const index = world.tunes.findIndex((t) => t.id === id);
  if (index < 0) return false;
  world.tunes.splice(index, 1);
  for (const room of world.rooms) if (room.tune === id) delete room.tune;
  return true;
}

export function addBlip(world: World, kind: BlipKind = 'pick up', random: () => number = Math.random): Id {
  const id = soundId(world.blips);
  const blip: Blip = {
    id,
    name: `${kind} ${id}`,
    pitches: [rest(), rest(), rest()],
    envelope: { attack: 0, decay: 0, sustain: 0, length: 0, release: 0 },
    beat: { time: 0, delay: 0 },
    instrument: 'P2',
    repeat: false,
  };
  generateBlip(blip, kind, random);
  world.blips.push(writeBlip(blip));
  return id;
}

export function duplicateBlip(world: World, id: Id): Id | null {
  const blip = blipOf(world, id);
  if (!blip) return null;
  const copy = soundId(world.blips);
  world.blips.push(writeBlip({ ...blip, id: copy, name: `${blipName(blip)} copy` }));
  return copy;
}

/** Removes a blip from the world, the sprites and items that made it, and tune notes. */
export function removeBlip(world: World, id: Id): boolean {
  const index = world.blips.findIndex((b) => b.id === id);
  if (index < 0) return false;
  world.blips.splice(index, 1);
  for (const drawing of [...world.sprites, ...world.items]) if (drawing.blip === id) delete drawing.blip;
  for (const block of [...world.tunes]) {
    const tune = readTune(block);
    const uses = [...tune.melody, ...tune.harmony].some((bar) => bar.some((p) => p.blip === id));
    if (!uses) continue;
    updateTune(world, block.id, (t) => {
      for (const bar of [...t.melody, ...t.harmony]) {
        for (const p of bar) {
          if (p.blip === id) p.beats = 0;
        }
      }
    });
  }
  return true;
}

// --- Keys -------------------------------------------------------------------

const majorNotes = [0, 2, 4, 5, 7, 9, 11];
const minorNotes = [0, 2, 3, 5, 7, 8, 10];
const pentatonic = [0, 1, 2, 4, 5];
const diatonic = [0, 1, 2, 3, 4, 5, 6];

export type KeyName = 'major' | 'minor' | 'full major' | 'full minor';
export const keys: Record<KeyName, TuneKey> = {
  major: { notes: majorNotes, scale: pentatonic },
  minor: { notes: minorNotes, scale: pentatonic },
  'full major': { notes: majorNotes, scale: diatonic },
  'full minor': { notes: minorNotes, scale: diatonic },
};

const copyKey = (key: TuneKey): TuneKey => ({ notes: [...key.notes], scale: [...key.scale] });
const sameKey = (a: TuneKey, b: TuneKey) =>
  a.notes.join() === b.notes.join() && a.scale.join() === b.scale.join();

/** Which preset a tune's key is; 'chromatic' when it has none, 'custom' for any other. */
export function keyNameOf(tune: Tune): KeyName | 'chromatic' | 'custom' {
  if (!tune.key) return 'chromatic';
  for (const [name, key] of Object.entries(keys)) if (sameKey(tune.key, key)) return name as KeyName;
  return 'custom';
}

/** The chromatic notes a key plays, low to high. */
export function keyScaleNotes(key: TuneKey): number[] {
  return [...key.scale].sort((a, b) => a - b).map((degree) => key.notes[degree]!);
}

/**
 * Changes a tune's key. Going to or from chromatic converts the notes; notes
 * a key has no place for become rests.
 */
export function setKey(tune: Tune, name: KeyName | 'chromatic'): void {
  const bars = [...tune.melody, ...tune.harmony];
  if (name === 'chromatic') {
    const key = tune.key;
    if (!key) return;
    for (const bar of bars) for (const p of bar) if (p.beats > 0) p.note = key.notes[p.note] ?? 0;
    tune.key = null;
    tune.arpeggio = 'OFF';
    return;
  }
  const next = copyKey(keys[name]);
  if (!tune.key) {
    for (const bar of bars) {
      for (const p of bar) {
        if (p.beats <= 0) continue;
        const degree = next.notes.indexOf(p.note);
        if (degree >= 0 && next.scale.includes(degree)) p.note = degree;
        else p.beats = 0;
      }
    }
  }
  tune.key = next;
}

// --- Writing notes ------------------------------------------------------------

export type Part = 'melody' | 'harmony';

/** Rows on the staff: 0–11 chromatic from C, 12 the C above. */
export const HIGH_C = 12;

/** The staff rows a tune can use: all 13, or those in its key. */
export function staffRows(tune: Tune): number[] {
  const rows = Array.from({ length: 13 }, (_, n) => n);
  if (!tune.key) return rows;
  const notes = keyScaleNotes(tune.key);
  return rows.filter((row) => notes.includes(row % 12));
}

const baseOctave = (part: Part) => (part === 'melody' ? 4 : 2);

/** Where a note sits on the staff, or null for a rest or a note outside the key. */
export function pitchRow(tune: Tune, part: Part, pitch: Pitch): number | null {
  if (pitch.beats <= 0) return null;
  let chromatic = pitch.note;
  if (tune.key) {
    if (!tune.key.scale.includes(pitch.note)) return null;
    chromatic = tune.key.notes[pitch.note] ?? 0;
  }
  return chromatic === 0 && pitch.octave > baseOctave(part) ? HIGH_C : chromatic;
}

const barOf = (tune: Tune, part: Part, bar: number) => tune[part][bar];

/** Clears beats `start`..`end`, shortening or splitting notes that cross them, like Bitsy. */
export function eraseNotes(tune: Tune, part: Part, barIndex: number, start: number, end: number): void {
  const bar = barOf(tune, part, barIndex);
  if (!bar) return;
  for (let i = 0; i < BAR_LENGTH; i++) {
    const note = bar[i]!;
    if (note.beats <= 0) continue;
    const noteEnd = i + note.beats - 1;
    const tail = () => {
      bar[end + 1] = { ...note, beats: noteEnd - end };
    };
    if (i >= start && noteEnd <= end) note.beats = 0;
    else if (i < start && noteEnd > end) {
      tail();
      note.beats = start - i;
    } else if (i >= start && i <= end) {
      tail();
      note.beats = 0;
    } else if (noteEnd >= start && noteEnd <= end) note.beats = start - i;
  }
}

/** Puts a note on a staff row at a beat, for `beats` beats; a blip plays instead when given. */
export function setNote(
  tune: Tune,
  part: Part,
  barIndex: number,
  beat: number,
  row: number,
  { beats = 1, blip }: { beats?: number; blip?: Id } = {},
): void {
  const bar = barOf(tune, part, barIndex);
  if (!bar || beat < 0 || beat >= BAR_LENGTH) return;
  const length = Math.max(1, Math.min(beats, BAR_LENGTH - beat));
  eraseNotes(tune, part, barIndex, beat, beat + length - 1);
  const chromatic = row % 12;
  let note = chromatic;
  if (tune.key) {
    note = tune.key.notes.indexOf(chromatic);
    if (note < 0 || !tune.key.scale.includes(note)) return;
  }
  bar[beat] = {
    beats: length,
    note,
    octave: baseOctave(part) + (row >= HIGH_C ? 1 : 0),
    ...(blip === undefined ? {} : { blip }),
  };
}

/** The note sounding at a beat (its start index), if any. */
export function noteAt(tune: Tune, part: Part, barIndex: number, beat: number): number | null {
  const bar = barOf(tune, part, barIndex);
  if (!bar) return null;
  for (let i = 0; i <= beat; i++) {
    const p = bar[i]!;
    if (p.beats > 0 && beat < i + p.beats) return i;
  }
  return null;
}

/** Moves a note up an octave, from 5 back round to 2. */
export function cycleOctave(tune: Tune, part: Part, barIndex: number, beat: number): void {
  const pitch = barOf(tune, part, barIndex)?.[beat];
  if (!pitch || pitch.beats <= 0) return;
  pitch.octave = pitch.octave >= 5 ? 2 : pitch.octave + 1;
}

// --- Bars -------------------------------------------------------------------

export function addBar(tune: Tune, copyOf?: number): number | null {
  if (tune.melody.length >= MAX_BARS) return null;
  const copy = (bar: Pitch[] | undefined) => (bar ? bar.map((p) => ({ ...p })) : emptyBar());
  tune.melody.push(copyOf === undefined ? emptyBar() : copy(tune.melody[copyOf]));
  tune.harmony.push(copyOf === undefined ? emptyBar() : copy(tune.harmony[copyOf]));
  return tune.melody.length - 1;
}

export function removeBar(tune: Tune, index: number): boolean {
  if (tune.melody.length <= 1 || index < 0 || index >= tune.melody.length) return false;
  tune.melody.splice(index, 1);
  tune.harmony.splice(index, 1);
  return true;
}

export function moveBar(tune: Tune, from: number, to: number): boolean {
  if (to < 0 || to >= tune.melody.length || from < 0 || from >= tune.melody.length) return false;
  for (const part of [tune.melody, tune.harmony]) {
    const [bar] = part.splice(from, 1);
    part.splice(to, 0, bar!);
  }
  return true;
}

// --- Blip generators (the classic editor's blip-o-matic) ----------------------

export const blipKinds = ['pick up', 'greeting', 'bloop', 'bleep', 'magic', 'meow', 'random'] as const;
export type BlipKind = (typeof blipKinds)[number];

export const blipKindHints: Record<BlipKind, string> = {
  'pick up': 'sounds an item might make when you pick it up',
  greeting: 'sounds a sprite could say hello with',
  bloop: 'lower pitched, rounder sounds',
  bleep: 'higher pitched, tinnier sounds',
  magic: 'weird sounds',
  meow: "I'm a cat",
  random: 'who knows?',
};

/** Fills a blip with a fresh sound of a kind, as the classic editor does. */
export function generateBlip(blip: Blip, kind: BlipKind, random: () => number = Math.random): void {
  // Bitsy's octave indices 0–3 are octaves 2–5; randInt's top is exclusive.
  const int = (min: number, max: number) => min + Math.floor((max - min) * random());
  const note = (octave: number): Pitch => ({ beats: 1, note: int(0, 12), octave });
  const anyOctave = () => int(0, 4) + 2;
  const wave = (from = 0, to = 3): Wave => (['P8', 'P4', 'P2'] as const)[int(from, to)]!;
  const envelope = (a: [number, number], d: [number, number], l: [number, number], r: [number, number], s: [number, number] = [2, 10]) => ({
    attack: int(...a),
    decay: int(...d),
    sustain: int(...s),
    length: int(...l),
    release: int(...r),
  });
  switch (kind) {
    case 'pick up': {
      const octave = int(1, 4) + 2;
      blip.pitches = [note(octave), note(octave), note(octave)];
      blip.envelope = envelope([64, 128], [64, 128], [64, 192], [64, 160]);
      blip.beat = { time: int(32, 96), delay: 0 };
      blip.instrument = wave();
      blip.repeat = false;
      break;
    }
    case 'greeting': {
      const octave = int(0, 4) + 2;
      blip.pitches = [note(octave), note(octave), rest()];
      blip.envelope = envelope([64, 128], [64, 128], [64, 192], [64, 160]);
      blip.beat = { time: int(32, 96), delay: 0 };
      blip.instrument = wave();
      blip.repeat = false;
      break;
    }
    case 'bloop':
      blip.pitches = [note(2), rest(), rest()];
      blip.envelope = envelope([0, 64], [0, 64], [32, 128], [0, 64]);
      blip.beat = { time: 0, delay: 0 };
      blip.instrument = 'P2';
      blip.repeat = false;
      break;
    case 'bleep': {
      const octave = int(2, 3) + 2;
      blip.pitches = [note(octave), rest(), rest()];
      blip.envelope = envelope([0, 64], [0, 64], [32, 128], [0, 64]);
      blip.beat = { time: 0, delay: 0 };
      blip.instrument = wave(0, 2);
      blip.repeat = false;
      break;
    }
    case 'magic':
      blip.pitches = [note(anyOctave()), note(anyOctave()), note(anyOctave())];
      blip.envelope = envelope([64, 256], [64, 256], [64, 256], [64, 256]);
      blip.beat = { time: int(32, 160), delay: int(32, 192) };
      blip.instrument = wave();
      blip.repeat = random() > 0.33;
      break;
    case 'meow': {
      const octave = int(2, 4) + 2;
      blip.pitches = [note(octave), note(octave), random() > 0.75 ? note(octave) : rest()];
      blip.envelope = envelope([32, 96], [64, 128], [64, 192], [64, 160]);
      blip.beat = { time: int(32, 64), delay: int(32, 128) };
      blip.instrument = wave();
      blip.repeat = random() > 0.75;
      break;
    }
    case 'random':
      blip.pitches = [note(anyOctave()), note(anyOctave()), note(anyOctave())];
      blip.envelope = envelope([0, 480], [0, 480], [0, 480], [0, 480], [0, 15]);
      blip.beat = { time: int(0, 480), delay: int(0, 480) };
      blip.instrument = wave();
      blip.repeat = random() > 0.5;
      break;
  }
}

/** Nudges a blip's pitches and timing a little, like the classic editor's "mutate". */
export function mutateBlip(blip: Blip, random: () => number = Math.random): void {
  const int = (min: number, max: number) => min + Math.floor((max - min) * random());
  const ms = (n: number) => Math.max(32, Math.min(480, n));
  for (const p of blip.pitches) {
    const absolute = Math.max(0, Math.min(4 * 12 - 1, (p.octave - 2) * 12 + p.note + int(-2, 2)));
    p.octave = Math.floor(absolute / 12) + 2;
    p.note = absolute % 12;
  }
  blip.envelope = { ...blip.envelope, length: ms(blip.envelope.length + int(-64, 64)) };
  blip.beat = { time: ms(blip.beat.time + int(-64, 64)), delay: ms(blip.beat.delay + int(-64, 64)) };
}

/** Shifts every pitch of a blip by semitones, staying within octaves 2–5. */
export function transposeBlip(blip: Blip, semitones: number): void {
  for (const p of blip.pitches) {
    if (p.beats <= 0) continue;
    const absolute = Math.max(0, Math.min(4 * 12 - 1, (p.octave - 2) * 12 + p.note + semitones));
    p.octave = Math.floor(absolute / 12) + 2;
    p.note = absolute % 12;
  }
}

const clampMs = (n: number) => Math.max(0, Math.min(960, Math.round(n)));

/** Makes a blip last longer (factor > 1) or shorter. */
export function stretchBlip(blip: Blip, factor: number): void {
  const e = blip.envelope;
  blip.envelope = { ...e, attack: clampMs(e.attack * factor), decay: clampMs(e.decay * factor), length: clampMs(e.length * factor), release: clampMs(e.release * factor) };
}

/** Changes the time between pitches (factor > 1 is slower). */
export function paceBlip(blip: Blip, factor: number): void {
  blip.beat = { time: clampMs(blip.beat.time * factor), delay: clampMs(blip.beat.delay * factor) };
}

/** "C#5". */
export function pitchName(pitch: Pitch, key: TuneKey | null = null): string {
  const chromatic = key ? (key.notes[pitch.note] ?? 0) : pitch.note;
  return `${chromaticNames[chromatic] ?? 'C'}${pitch.octave}`;
}

export { chromaticNames };
