import { useSyncExternalStore } from 'react';
import type { Identified, Registry } from '../plugin-api';

/** The registry's items, re-rendering when something registers or leaves. */
export function useRegistry<T extends Identified>(registry: Registry<T>): readonly T[] {
  return useSyncExternalStore(registry.subscribe, registry.list, registry.list);
}
