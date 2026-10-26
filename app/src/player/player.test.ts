import { describe, expect, it, vi } from 'vitest';
import { Button } from './loop';
import { createPlayer, type PlayerState } from './player';
import type { FromWorker, ToWorker } from './protocol';

class FakeWorker {
  sent: ToWorker[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: ToWorker) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(message: FromWorker) {
    this.onmessage?.({ data: message } as MessageEvent<FromWorker>);
  }
}

function setup() {
  const worker = new FakeWorker();
  const paint = vi.fn();
  const synth = { apply: vi.fn(), silence: vi.fn(), dispose: vi.fn() };
  const states: PlayerState[] = [];
  const player = createPlayer({
    createWorker: () => worker as unknown as Worker,
    paint,
    createSynth: () => synth,
  });
  player.subscribe((state) => states.push(state));
  return { worker, paint, synth, player, states };
}

describe('createPlayer', () => {
  it('starts idle and plays a game in the worker', () => {
    const t = setup();
    expect(t.player.state()).toEqual({ status: 'idle' });
    t.player.play('GAME');
    expect(t.worker.sent).toEqual([{ type: 'play', data: 'GAME' }]);
    expect(t.player.state()).toEqual({ status: 'loading' });
    t.worker.emit({ type: 'started' });
    expect(t.player.state()).toEqual({ status: 'playing' });
  });

  it('paints frames and plays sound', () => {
    const t = setup();
    t.player.play('GAME');
    const pixels = new Uint8ClampedArray(65536).buffer;
    t.worker.emit({ type: 'frame', pixels });
    expect(t.paint).toHaveBeenCalledWith(new Uint8ClampedArray(pixels));
    const channels = [
      { on: true, frequency: 440, volume: 0.5, pulse: 1 },
      { on: false, frequency: 0, volume: 0, pulse: 0 },
    ];
    t.worker.emit({ type: 'sound', channels });
    expect(t.synth.apply).toHaveBeenCalledWith(channels);
  });

  it('forwards buttons and taps while playing', () => {
    const t = setup();
    t.player.press(Button.Up, true);
    expect(t.worker.sent).toEqual([]);
    t.player.play('GAME');
    t.player.press(Button.Up, true);
    t.player.tap();
    expect(t.worker.sent.slice(1)).toEqual([
      { type: 'button', button: Button.Up, down: true },
      { type: 'tap' },
    ]);
  });

  it('shows errors from the engine and the worker', () => {
    const t = setup();
    t.player.play('GAME');
    t.worker.emit({ type: 'error', message: 'bad room' });
    expect(t.player.state()).toEqual({ status: 'error', message: 'bad room' });
    t.worker.onerror?.({ message: 'boom' } as ErrorEvent);
    expect(t.player.state()).toEqual({ status: 'error', message: 'The player stopped: boom' });
  });

  it('goes quiet when the game ends or stops', () => {
    const t = setup();
    t.player.play('GAME');
    t.worker.emit({ type: 'ended' });
    expect(t.player.state()).toEqual({ status: 'ended' });
    expect(t.synth.silence).toHaveBeenCalledTimes(1);
    t.player.play('GAME');
    t.player.stop();
    expect(t.worker.sent.at(-1)).toEqual({ type: 'stop' });
    expect(t.player.state()).toEqual({ status: 'idle' });
    expect(t.synth.silence).toHaveBeenCalledTimes(2);
  });

  it('ends the worker and the sound on dispose', () => {
    const t = setup();
    t.player.play('GAME');
    t.player.dispose();
    expect(t.worker.terminated).toBe(true);
    expect(t.synth.dispose).toHaveBeenCalled();
  });

  it('keeps the latest game state and tells its subscribers', () => {
    const t = setup();
    const seen: unknown[] = [];
    t.player.subscribeGameState((state) => seen.push(state));
    expect(t.player.gameState()).toBeNull();
    t.player.play('GAME');
    const state = { inventory: { 0: 1 }, variables: { n: 2 } };
    t.worker.emit({ type: 'state', state });
    expect(t.player.gameState()).toEqual(state);
    t.player.play('GAME');
    expect(t.player.gameState()).toBeNull();
    expect(seen).toEqual([state, null]);
  });

  it('tells subscribers about each change', () => {
    const t = setup();
    t.player.play('GAME');
    t.worker.emit({ type: 'started' });
    expect(t.states.map((s) => s.status)).toEqual(['loading', 'playing']);
  });
});
