import { describe, expect, it, vi } from 'vitest';
import { createRegistry } from './registry';

describe('createRegistry', () => {
  it('lists items in the order they were registered', () => {
    const registry = createRegistry<{ id: string }>('tool');
    registry.register({ id: 'room' });
    registry.register({ id: 'paint' });
    expect(registry.list().map((item) => item.id)).toEqual(['room', 'paint']);
    expect(registry.get('paint')).toEqual({ id: 'paint' });
    expect(registry.get('missing')).toBeUndefined();
  });

  it('refuses a second item with the same id', () => {
    const registry = createRegistry<{ id: string }>('tool');
    registry.register({ id: 'room' });
    expect(() => registry.register({ id: 'room' })).toThrow('tool "room" is already registered');
  });

  it('removes an item with the function register returns', () => {
    const registry = createRegistry<{ id: string }>('tool');
    const unregister = registry.register({ id: 'room' });
    unregister();
    expect(registry.list()).toEqual([]);
  });

  it('tells subscribers about every change until they unsubscribe', () => {
    const registry = createRegistry<{ id: string }>('tool');
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    const unregister = registry.register({ id: 'room' });
    unregister();
    unsubscribe();
    registry.register({ id: 'paint' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('returns the same list between changes, so React can subscribe to it', () => {
    const registry = createRegistry<{ id: string }>('tool');
    registry.register({ id: 'room' });
    expect(registry.list()).toBe(registry.list());
  });
});
