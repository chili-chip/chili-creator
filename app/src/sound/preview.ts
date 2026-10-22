import { byId, readBlip, rest, type Blip, type Id, type Pitch, type Tune, type TuneKey, type Wave, type World } from '../bitsy';
import { createSquareSynth, type Synth } from '../player/synth';
import { createSoundEngine, type SoundEngine } from './engine';

// Plays tunes, blips and single notes in the tools, through the same square
// synth as the game player. The synth is made on the first play, which comes
// from a click, so browsers let it make sound.

export type PreviewState =
  | { playing: null }
  | { playing: 'tune'; id: Id; bar: number; beat: number }
  | { playing: 'blip'; id: Id }
  | { playing: 'note' };

export interface SoundPreviewOptions {
  synth?: () => Synth;
  /** Milliseconds between steps. */
  step?: number;
}

export function createSoundPreview({ synth: makeSynth = createSquareSynth, step = 16 }: SoundPreviewOptions = {}) {
  let synth: Synth | null = null;
  let engine: SoundEngine | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let current: PreviewState = { playing: null };
  const listeners = new Set<(state: PreviewState) => void>();

  function set(next: PreviewState) {
    const same = JSON.stringify(next) === JSON.stringify(current);
    current = next;
    if (!same) listeners.forEach((listener) => listener(next));
  }

  function halt() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    engine = null;
    synth?.silence();
  }

  function tick() {
    if (!engine || !synth) return;
    synth.apply(engine.update(step));
    if (current.playing === 'tune') {
      const position = engine.position();
      if (position) set({ ...current, ...position });
    } else if (!engine.playingBlip()) {
      halt();
      set({ playing: null });
    }
  }

  function start(prepare: (engine: SoundEngine) => void, state: PreviewState, world?: World) {
    halt();
    synth ??= makeSynth();
    engine = createSoundEngine({ blip: (id) => (world ? blipIn(world, id) : undefined) });
    prepare(engine);
    current = state;
    synth.apply(engine.update(0));
    if (state.playing === 'tune') {
      const position = engine.position();
      if (position) current = { ...state, ...position };
    }
    listeners.forEach((listener) => listener(current));
    timer = setInterval(tick, step);
  }

  return {
    /** Plays a tune round and round from a bar; `world` has the blips its notes use. */
    playTune(tune: Tune, world?: World, options: { bar?: number; loopBar?: boolean } = {}) {
      start((e) => e.playTune(tune, options), { playing: 'tune', id: tune.id, bar: 0, beat: 0 }, world);
    },
    playBlip(blip: Blip) {
      start((e) => e.playBlip(blip), { playing: 'blip', id: blip.id });
    },
    /** One note, for hearing what was just written. */
    playNote(pitch: Pitch, wave: Wave, key: TuneKey | null = null) {
      const note: Pitch = { ...pitch, beats: 1 };
      if (key) {
        note.note = key.notes[pitch.note % 7] ?? 0;
        if (pitch.note >= 7) note.octave += 1;
      }
      const blip: Blip = {
        id: '',
        pitches: [note, rest(), rest()],
        envelope: { attack: 0, decay: 0, sustain: 5, length: 188, release: 0 },
        beat: { time: 0, delay: 0 },
        instrument: wave,
        repeat: false,
      };
      start((e) => e.playBlip(blip), { playing: 'note' });
    },
    stop() {
      halt();
      set({ playing: null });
    },
    state: () => current,
    subscribe(listener: (state: PreviewState) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispose() {
      halt();
      synth?.dispose();
      synth = null;
    },
  };
}

function blipIn(world: World, id: Id): Blip | undefined {
  const block = byId(world.blips, id);
  return block && readBlip(block);
}

export type SoundPreview = ReturnType<typeof createSoundPreview>;
