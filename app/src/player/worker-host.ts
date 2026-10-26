import type { CitsyEngine } from './citsy';
import { createPlayLoop, type PlayLoop } from './loop';
import type { FromWorker, ToWorker } from './protocol';

export interface WorkerHostOptions {
  post(message: FromWorker, transfer?: Transferable[]): void;
  loadEngine(): Promise<CitsyEngine>;
  /** Calls fn every `ms`; returns a function that stops it. */
  every(ms: number, fn: () => void): () => void;
  now(): number;
}

const frameMs = 1000 / 60;

/** What the player worker does with each message, without the worker globals. */
export function createWorkerHost({ post, loadEngine, every, now }: WorkerHostOptions) {
  let engine: Promise<CitsyEngine> | null = null;
  let loop: PlayLoop | null = null;
  let stopClock: (() => void) | null = null;
  let lastSound = '';

  function halt() {
    stopClock?.();
    stopClock = null;
    loop = null;
  }

  async function play(data: string) {
    halt();
    let citsy: CitsyEngine;
    try {
      engine ??= loadEngine();
      citsy = await engine;
    } catch (err) {
      engine = null;
      post({ type: 'error', message: `The player could not start: ${err instanceof Error ? err.message : err}` });
      return;
    }
    if (!citsy.load(data)) {
      post({ type: 'error', message: citsy.lastError() || 'citsy could not load this game.' });
      return;
    }
    lastSound = '';
    const current = createPlayLoop(citsy, {
      onFrame(pixels) {
        post({ type: 'frame', pixels: pixels.buffer as ArrayBuffer }, [pixels.buffer]);
      },
      onSound(channels) {
        const key = JSON.stringify(channels);
        if (key === lastSound) return;
        lastSound = key;
        post({ type: 'sound', channels });
      },
      onState(state) {
        post({ type: 'state', state });
      },
      onEnd() {
        halt();
        post({ type: 'ended' });
      },
    });
    loop = current;
    post({ type: 'started' });
    stopClock = every(frameMs, () => current.tick(now()));
  }

  return {
    async handle(message: ToWorker): Promise<void> {
      switch (message.type) {
        case 'play':
          return play(message.data);
        case 'button':
          loop?.setButton(message.button, message.down);
          return;
        case 'tap':
          loop?.tap();
          return;
        case 'stop':
          halt();
          if (engine) (await engine.catch(() => null))?.unload();
          return;
      }
    },
  };
}
