/** Anything a registry holds has a unique id. */
export interface Identified {
  id: string;
}

export interface Registry<T extends Identified> {
  /** Adds an item; returns a function that removes it again. */
  register(item: T): () => void;
  get(id: string): T | undefined;
  /** Items in registration order. The same array is returned until something changes. */
  list(): readonly T[];
  /** Calls `listener` after every change; returns a function that stops it. */
  subscribe(listener: () => void): () => void;
}

/**
 * A typed, observable list of contributions (tools, commands, ...).
 * Every extension point in the creator is one of these, so built-in features
 * and future ones plug in the same way.
 */
export function createRegistry<T extends Identified>(kind: string): Registry<T> {
  const items = new Map<string, T>();
  const listeners = new Set<() => void>();
  let snapshot: readonly T[] = [];

  function changed() {
    snapshot = [...items.values()];
    listeners.forEach((listener) => listener());
  }

  return {
    register(item) {
      if (items.has(item.id)) {
        throw new Error(`${kind} "${item.id}" is already registered`);
      }
      items.set(item.id, item);
      changed();
      return () => {
        if (items.get(item.id) === item) {
          items.delete(item.id);
          changed();
        }
      };
    },
    get: (id) => items.get(id),
    list: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
