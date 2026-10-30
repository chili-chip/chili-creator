import type { EngineModule } from './types';

export interface EngineRegistryOptions {
  /** Engines offered for new games. All of them by default. */
  enabled?: string[];
  /** The page address's query: `?engines=<id>` turns on an engine that is still in progress. */
  search?: string;
}

/** The engines the creator knows. The first one is the default and opens games with no engine. */
export function createEngineRegistry(engines: EngineModule[], { enabled, search = '' }: EngineRegistryOptions = {}) {
  const extra = new URLSearchParams(search).get('engines')?.split(',') ?? [];
  const on = enabled ? new Set([...enabled, ...extra]) : null;
  const byId = (id: string | undefined) => engines.find((e) => e.id === id);

  return {
    list: () => engines,
    get: byId,
    default: () => engines[0]!,
    /** The engine for a game: the one saved with it, else the one that recognises the text. */
    of(text: string, saved?: string): EngineModule {
      return byId(saved) ?? engines.find((e) => e.format.detect(text)) ?? engines[0]!;
    },
    /** Engines to pick from when making a new game. */
    offered: () => engines.filter((e) => !on || on.has(e.id)),
  };
}

export type EngineRegistry = ReturnType<typeof createEngineRegistry>;
