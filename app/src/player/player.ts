import type { GameState } from './citsy';
import type { Button } from './loop';
import type { FromWorker, ToWorker } from './protocol';
import { createSquareSynth, type Synth } from './synth';

export type PlayerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'playing' }
  | { status: 'ended' }
  | { status: 'error'; message: string };

export interface PlayerOptions {
  createWorker?: () => Worker;
  /** Draws one 128×128 RGBA frame. */
  paint: (pixels: Uint8ClampedArray) => void;
  createSynth?: () => Synth;
}

function defaultWorker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'citsy-player' });
}

/** Plays games in a worker running citsy; the page only paints and plays sound. */
export function createPlayer({ createWorker = defaultWorker, paint, createSynth = createSquareSynth }: PlayerOptions) {
  let worker: Worker | null = null;
  let synth: Synth | null = null;
  let current: PlayerState = { status: 'idle' };
  const listeners = new Set<(state: PlayerState) => void>();
  let game: GameState | null = null;
  const gameListeners = new Set<(state: GameState | null) => void>();

  function setGame(state: GameState | null) {
    if (state === game) return;
    game = state;
    gameListeners.forEach((listener) => listener(state));
  }

  function set(state: PlayerState) {
    current = state;
    if (state.status !== 'playing' && state.status !== 'loading') synth?.silence();
    listeners.forEach((listener) => listener(state));
  }

  function send(message: ToWorker) {
    worker?.postMessage(message);
  }

  function ensureWorker(): Worker {
    if (worker) return worker;
    const created = createWorker();
    created.onmessage = (event: MessageEvent<FromWorker>) => {
      const message = event.data;
      switch (message.type) {
        case 'started':
          set({ status: 'playing' });
          break;
        case 'frame':
          paint(new Uint8ClampedArray(message.pixels));
          break;
        case 'sound':
          synth?.apply(message.channels);
          break;
        case 'state':
          setGame(message.state);
          break;
        case 'ended':
          set({ status: 'ended' });
          break;
        case 'error':
          set({ status: 'error', message: message.message });
          break;
      }
    };
    created.onerror = (event: ErrorEvent) => {
      set({ status: 'error', message: `The player stopped: ${event.message || 'unknown error'}` });
    };
    worker = created;
    return created;
  }

  const active = () => current.status === 'playing' || current.status === 'loading';

  return {
    state: () => current,
    subscribe(listener: (state: PlayerState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Starts (or restarts) a game from its `.bitsy` text. Call it from a user gesture so sound can start. */
    /** The running game's inventory and variables; null until its first frame. */
    gameState: () => game,
    subscribeGameState(listener: (state: GameState | null) => void): () => void {
      gameListeners.add(listener);
      return () => gameListeners.delete(listener);
    },
    play(data: string) {
      synth ??= createSynth();
      ensureWorker();
      setGame(null);
      set({ status: 'loading' });
      send({ type: 'play', data });
    },
    stop() {
      if (!worker) return;
      send({ type: 'stop' });
      set({ status: 'idle' });
    },
    press(button: Button, down: boolean) {
      if (active()) send({ type: 'button', button, down });
    },
    tap() {
      if (active()) send({ type: 'tap' });
    },
    dispose() {
      worker?.terminate();
      worker = null;
      synth?.dispose();
      synth = null;
      listeners.clear();
      gameListeners.clear();
    },
  };
}

export type Player = ReturnType<typeof createPlayer>;
