import { BAR_LENGTH, type Blip, type Id, type Pitch, type Tune, type TuneKey, type Wave } from '../bitsy';
import type { SoundChannel } from '../player';

// Bitsy's two square-wave channels, worked out in steps like citsy's
// SoundPlayer (src/sound/sound.cpp): the tools use it to preview tunes and
// blips. Channel 1 has the melody and blips, channel 2 the harmony.
//
// Unlike citsy today, a long note sounds for all its beats and the strum
// starts on the first bar, as in Bitsy.

const chromaticHz = [261.7, 277.2, 293.7, 311.2, 329.7, 349.3, 370.0, 392.0, 415.3, 440.0, 466.2, 493.9];
const maxVolume = 15;
const noteVolume = 5;
const blipPeak = 10;

const tempoMs = { SLW: 250, MED: 188, FST: 125, XFST: 94 } as const;
const pulses: Record<Wave, number> = { P8: 0, P4: 1, P2: 2 };

const strums = { OFF: [], UP: [0, 2, 4, 7], DWN: [7, 4, 2, 0], INT5: [0, 4], INT8: [0, 7] } as const;

/** Whether a tune's note sounds: not a rest, and in its key. */
function playable(pitch: Pitch, key: TuneKey | null): boolean {
  if (pitch.beats <= 0) return false;
  if (!key) return true;
  const degree = pitch.note % 7;
  return key.scale.includes(degree) && (key.notes[degree] ?? -1) >= 0;
}

export function frequencyOf(pitch: Pitch, key: TuneKey | null = null): number {
  let note = pitch.note;
  let octave = pitch.octave;
  if (key) {
    const mapped = key.notes[note % 7] ?? -1;
    if (pitch.note >= 7) octave += 1;
    note = mapped < 0 ? note : mapped;
  }
  note = Math.max(0, Math.min(11, note));
  octave = Math.max(2, Math.min(octave, 5));
  return chromaticHz[note]! * 2 ** (octave - 4);
}

interface Voice {
  frequency: number;
  volume: number;
  pulse: number;
  /** Milliseconds left. */
  left: number;
}

const silent = (): SoundChannel => ({ on: false, frequency: 0, volume: 0, pulse: 2 });

export interface SoundEngineOptions {
  /** Looks up blips that tune notes play. */
  blip?: (id: Id) => Blip | undefined;
}

export function createSoundEngine({ blip: findBlip = () => undefined }: SoundEngineOptions = {}) {
  let tune: Tune | null = null;
  let loopBar = false;
  let bar = 0;
  let beat = -1;
  let timer = 0;
  let strum: Pitch[] = [];
  const voices: (Voice | null)[] = [null, null];

  let blip: Blip | null = null;
  let blipFrequencies: number[] = [];
  let blipTimer = 0;
  let blipLength = 0;
  /** A blip on its own stops the tune until it is done, as in a game. */
  let blipPausesTune = false;

  function startBlip(next: Blip, pausesTune: boolean) {
    blip = next;
    blipTimer = 0;
    const { attack, decay, length, release } = next.envelope;
    blipLength = attack + decay + length + release;
    blipFrequencies = next.pitches.filter((p) => p.beats > 0).map((p) => frequencyOf(p));
    blipPausesTune = pausesTune;
    voices[0] = null;
  }

  function blipVoice(dt: number): Voice | null {
    if (!blip) return null;
    blipTimer += Math.min(dt, 32);
    const e = blip.envelope;
    const t = blipTimer;
    let volume = 0;
    if (t < e.attack) volume = e.attack > 0 ? blipPeak * (t / e.attack) : blipPeak;
    else if (t < e.attack + e.decay) volume = blipPeak + (e.sustain - blipPeak) * (e.decay > 0 ? (t - e.attack) / e.decay : 1);
    else if (t < e.attack + e.decay + e.length) volume = e.sustain;
    else if (t < blipLength) volume = e.sustain * (1 - (e.release > 0 ? (t - e.attack - e.decay - e.length) / e.release : 1));
    if (t >= blipLength) {
      blip = null;
      blipPausesTune = false;
      return null;
    }
    let index = 0;
    if (blip.beat.time > 0 && blipFrequencies.length > 0) {
      const steps = Math.floor(Math.max(0, t - blip.beat.delay) / blip.beat.time);
      index = blip.repeat ? steps % blipFrequencies.length : Math.min(steps, blipFrequencies.length - 1);
    }
    const frequency = blipFrequencies[index];
    if (frequency === undefined) return null;
    return { frequency, volume: Math.max(0, Math.min(1, volume / maxVolume)), pulse: pulses[blip.instrument], left: 1 };
  }

  function note(pitch: Pitch, wave: Wave, beatMs: number): Voice {
    return { frequency: frequencyOf(pitch, tune!.key), volume: noteVolume / maxVolume, pulse: pulses[wave], left: pitch.beats * beatMs };
  }

  function makeStrum() {
    strum = [];
    if (!tune || tune.arpeggio === 'OFF' || !tune.key) return;
    const root = tune.harmony[bar]?.[0];
    if (!root || root.beats <= 0) return;
    strum = strums[tune.arpeggio].map((step) => ({ ...root, note: root.note + step, beats: 1 }));
  }

  function nextBeat(beatMs: number) {
    if (!tune) return;
    beat += 1;
    if (beat >= BAR_LENGTH) {
      beat = 0;
      if (!loopBar) bar = (bar + 1) % tune.melody.length;
    }
    if (beat === 0) makeStrum();

    const melody = tune.melody[bar]?.[beat];
    if (melody && melody.beats > 0) {
      const effect = melody.blip === undefined ? undefined : findBlip(melody.blip);
      if (effect) startBlip(effect, false);
      else if (!blip && playable(melody, tune.key)) voices[0] = note(melody, tune.instrumentA, beatMs);
    }

    if (tune.arpeggio === 'OFF' || !tune.key) {
      const harmony = tune.harmony[bar]?.[beat];
      if (harmony && playable(harmony, tune.key)) voices[1] = note(harmony, tune.instrumentB, beatMs);
    } else if (strum.length > 0) {
      const step = strum[beat % strum.length]!;
      if (playable(step, tune.key)) voices[1] = note(step, tune.instrumentB, beatMs);
    }
  }

  return {
    /** Plays a tune from a bar, round and round; `loopBar` keeps to that bar. */
    playTune(next: Tune, options: { bar?: number; loopBar?: boolean } = {}) {
      tune = next;
      loopBar = options.loopBar ?? false;
      bar = Math.max(0, Math.min(options.bar ?? 0, next.melody.length - 1));
      beat = -1;
      timer = tempoMs[next.tempo];
      voices[0] = voices[1] = null;
      strum = [];
    },
    playBlip(next: Blip) {
      startBlip(next, true);
    },
    stop() {
      tune = null;
      blip = null;
      blipPausesTune = false;
      voices[0] = voices[1] = null;
    },
    /** Moves time on by `dt` ms and returns both channels. */
    update(dt: number): SoundChannel[] {
      for (const voice of voices) if (voice) voice.left -= dt;
      voices.forEach((voice, i) => {
        if (voice && voice.left <= 0) voices[i] = null;
      });
      const effect = blipVoice(dt);
      if (tune && !blipPausesTune) {
        const beatMs = tempoMs[tune.tempo];
        timer += dt;
        while (timer >= beatMs) {
          timer -= beatMs;
          nextBeat(beatMs);
        }
      }
      const out = [effect ?? voices[0], voices[1]];
      return out.map((voice) =>
        voice && voice.volume > 0 ? { on: true, frequency: voice.frequency, volume: voice.volume, pulse: voice.pulse } : silent(),
      );
    },
    /** Where the tune is, or null when none plays. */
    position(): { bar: number; beat: number } | null {
      return tune ? { bar, beat: Math.max(0, beat) } : null;
    },
    playingBlip(): boolean {
      return blip !== null;
    },
  };
}

export type SoundEngine = ReturnType<typeof createSoundEngine>;
