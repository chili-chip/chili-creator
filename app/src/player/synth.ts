import type { SoundChannel } from './loop';

export interface Synth {
  apply(channels: SoundChannel[]): void;
  silence(): void;
  dispose(): void;
}

const duties = [1 / 8, 1 / 4, 1 / 2];
const harmonics = 32;

/** A pulse wave of a duty (citsy's pulse: 0 is 1/8, 1 is 1/4, 2 is 1/2) as Fourier terms. */
function pulseWave(context: AudioContext, pulse: number): PeriodicWave {
  const duty = duties[pulse] ?? 0.5;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  for (let n = 1; n < harmonics; n++) {
    real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
    imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
  }
  return context.createPeriodicWave(real, imag);
}

/** Two pulse-wave voices, like the classic player. Create it on a user gesture. */
export function createSquareSynth(): Synth {
  const AudioCtx =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return { apply() {}, silence() {}, dispose() {} };
  const context = new AudioCtx();
  const waves = new Map<number, PeriodicWave>();
  const voices = [0, 1].map(() => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    gain.gain.value = 0;
    osc.connect(gain).connect(context.destination);
    osc.start();
    return { osc, gain, pulse: -1 };
  });
  if (context.state === 'suspended') void context.resume();
  return {
    apply(channels) {
      channels.forEach((channel, i) => {
        const voice = voices[i];
        if (!voice) return;
        if (!channel.on) {
          voice.gain.gain.value = 0;
          return;
        }
        if (channel.pulse !== voice.pulse) {
          voice.pulse = channel.pulse;
          if (!waves.has(channel.pulse)) waves.set(channel.pulse, pulseWave(context, channel.pulse));
          voice.osc.setPeriodicWave(waves.get(channel.pulse)!);
        }
        voice.osc.frequency.value = channel.frequency;
        voice.gain.gain.value = Math.min(0.15, channel.volume * 0.12);
      });
    },
    silence() {
      voices.forEach((voice) => (voice.gain.gain.value = 0));
    },
    dispose() {
      void context.close();
    },
  };
}
