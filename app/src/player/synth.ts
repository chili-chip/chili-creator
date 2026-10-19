import type { SoundChannel } from './loop';

export interface Synth {
  apply(channels: SoundChannel[]): void;
  silence(): void;
  dispose(): void;
}

/** Two square-wave voices, like the classic player. Create it on a user gesture. */
export function createSquareSynth(): Synth {
  const AudioCtx =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return { apply() {}, silence() {}, dispose() {} };
  const context = new AudioCtx();
  const voices = [0, 1].map(() => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    gain.gain.value = 0;
    osc.connect(gain).connect(context.destination);
    osc.start();
    return { osc, gain };
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
