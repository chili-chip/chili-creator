// The citsy engine (citsy/citsy.js + citsy.wasm, built by chili-chip/citsy
// backends/web) behind a small typed interface.

export interface CitsyEngine {
  /** Loads a game; false when citsy cannot read it (see lastError). */
  load(text: string): boolean;
  unload(): void;
  lastError(): string;
  setButton(index: number, down: boolean): void;
  /** Runs one frame; false once the game has ended. */
  frame(dtMs: number): boolean;
  /** 128×128 RGBA, a view into engine memory that the next frame overwrites. */
  pixels(): Uint8Array;
  /** Two channels of [active, frequency, volume, pulse]. */
  sound(): Float32Array;
}

interface CitsyModule {
  ccall(name: string, returns: string | null, args: string[], values: unknown[]): unknown;
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
}

type CitsyFactory = (options: {
  instantiateWasm: (imports: WebAssembly.Imports, done: (instance: WebAssembly.Instance) => void) => object;
}) => Promise<CitsyModule>;

export interface CitsyOptions {
  /** The text of citsy.js. */
  script: string;
  instantiate: (imports: WebAssembly.Imports) => Promise<WebAssembly.Instance>;
  /** Names citsy.js reads when it thinks it runs in Node (tests pass require and __dirname). */
  globals?: Record<string, unknown>;
}

/** Evaluates citsy.js (a classic script) and starts an engine. */
export async function createCitsy({ script, instantiate, globals = {} }: CitsyOptions): Promise<CitsyEngine> {
  const names = Object.keys(globals);
  const factory = new Function(...names, `${script}\nreturn CitsyModule;`)(
    ...names.map((name) => globals[name]),
  ) as CitsyFactory;

  let failure: unknown = null;
  const module = await factory({
    instantiateWasm(imports, done) {
      instantiate(imports).then(done, (err: unknown) => {
        failure = err;
      });
      return {};
    },
  });
  if (failure) throw failure;

  const call = (name: string, returns: string | null, types: string[] = [], values: unknown[] = []) =>
    module.ccall(name, returns, types, values);

  return {
    load: (text) => call('citsy_load', 'number', ['string'], [text]) === 1,
    unload: () => void call('citsy_unload', null),
    lastError: () => String(call('citsy_last_error', 'string') ?? ''),
    setButton: (index, down) => void call('citsy_set_button', null, ['number', 'number'], [index, down ? 1 : 0]),
    frame: (dt) => call('citsy_frame', 'number', ['number'], [dt]) === 1,
    pixels: () => {
      const at = call('citsy_pixels', 'number') as number;
      return module.HEAPU8.subarray(at, at + 128 * 128 * 4);
    },
    sound: () => {
      const at = (call('citsy_sound', 'number') as number) >> 2;
      return module.HEAPF32.subarray(at, at + 8);
    },
  };
}
