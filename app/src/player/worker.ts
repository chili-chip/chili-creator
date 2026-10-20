// The player worker: runs citsy off the main thread and sends frames back.
import citsyScript from '../../../citsy/citsy.js?raw';
import wasmUrl from '../../../citsy/citsy.wasm?url';
import { createCitsy } from './citsy';
import type { FromWorker, ToWorker } from './protocol';
import { createWorkerHost } from './worker-host';

// The app's tsconfig uses the DOM lib; these are the worker globals used here.
const scope = self as unknown as {
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
};

const host = createWorkerHost({
  post: (message: FromWorker, transfer: Transferable[] = []) => scope.postMessage(message, transfer),
  loadEngine: () =>
    createCitsy({
      script: citsyScript,
      instantiate: async (imports) => {
        const response = await fetch(new URL(wasmUrl, import.meta.url));
        if (!response.ok) throw new Error(`citsy.wasm: ${response.status}`);
        // Streaming needs the application/wasm type; some servers send another.
        if (response.headers.get('Content-Type')?.startsWith('application/wasm')) {
          return (await WebAssembly.instantiateStreaming(response, imports)).instance;
        }
        return (await WebAssembly.instantiate(await response.arrayBuffer(), imports)).instance;
      },
    }),
  every: (ms, fn) => {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
  now: () => performance.now(),
});

scope.onmessage = (event: MessageEvent<ToWorker>) => void host.handle(event.data);
