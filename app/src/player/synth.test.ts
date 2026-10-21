import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSquareSynth } from './synth';

/** Just enough Web Audio to see what the synth asks for. */
function fakeAudio() {
  const oscillators: { frequency: { value: number }; setPeriodicWave: ReturnType<typeof vi.fn>; type: string }[] = [];
  const gains: { gain: { value: number } }[] = [];
  const waves: { real: Float32Array; imag: Float32Array }[] = [];
  class FakeContext {
    state = 'running';
    destination = {};
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        setPeriodicWave: vi.fn(),
        connect: (node: unknown) => node,
        start: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }
    createGain() {
      const gain = { gain: { value: 1 }, connect: (node: unknown) => node };
      gains.push(gain);
      return gain;
    }
    createPeriodicWave(real: Float32Array, imag: Float32Array) {
      const wave = { real, imag };
      waves.push(wave);
      return wave;
    }
    resume = vi.fn();
    close = vi.fn();
  }
  vi.stubGlobal('AudioContext', FakeContext);
  return { oscillators, gains, waves };
}

afterEach(() => vi.unstubAllGlobals());

describe('square synth', () => {
  it('plays each channel at its pitch, volume and pulse width', () => {
    const audio = fakeAudio();
    const synth = createSquareSynth();
    synth.apply([
      { on: true, frequency: 440, volume: 1, pulse: 0 },
      { on: false, frequency: 0, volume: 0, pulse: 2 },
    ]);
    expect(audio.oscillators[0]!.frequency.value).toBe(440);
    expect(audio.gains[0]!.gain.value).toBeGreaterThan(0);
    expect(audio.gains[1]!.gain.value).toBe(0);
    expect(audio.oscillators[0]!.setPeriodicWave).toHaveBeenCalledTimes(1);

    // Same pulse again: no new wave. A narrower pulse has more of the upper harmonics.
    synth.apply([{ on: true, frequency: 220, volume: 1, pulse: 0 }]);
    expect(audio.oscillators[0]!.setPeriodicWave).toHaveBeenCalledTimes(1);
    synth.apply([{ on: true, frequency: 220, volume: 1, pulse: 2 }]);
    expect(audio.oscillators[0]!.setPeriodicWave).toHaveBeenCalledTimes(2);
    const eighth = audio.oscillators[0]!.setPeriodicWave.mock.calls[0]![0] as { imag: Float32Array; real: Float32Array };
    const half = audio.oscillators[0]!.setPeriodicWave.mock.calls[1]![0] as { imag: Float32Array; real: Float32Array };
    // A half pulse is a square wave: no even harmonics.
    expect(Math.abs(half.imag[2]!) + Math.abs(half.real[2]!)).toBeCloseTo(0);
    expect(Math.abs(eighth.imag[2]!) + Math.abs(eighth.real[2]!)).toBeGreaterThan(0.1);

    synth.silence();
    expect(audio.gains[0]!.gain.value).toBe(0);
  });
});
