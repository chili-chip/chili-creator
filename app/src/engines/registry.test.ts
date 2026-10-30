import { describe, expect, it } from 'vitest';
import { createEngineRegistry } from './registry';
import { fakeEngine } from './fake';
import type { EngineModule } from './types';

const bitsyLike: EngineModule<{ title: string }> = {
  ...fakeEngine,
  id: 'bitsy',
  title: 'Bitsy',
  format: { ...fakeEngine.format, extension: '.bitsy', detect: () => false },
};

describe('createEngineRegistry', () => {
  it('finds the engine of a game by its text, and falls back to the first one', () => {
    const engines = createEngineRegistry([bitsyLike, fakeEngine]);
    expect(engines.of(fakeEngine.newGame('x')).id).toBe('fake');
    expect(engines.of('Old game\n\n# BITSY VERSION 8\n').id).toBe('bitsy');
    expect(engines.default().id).toBe('bitsy');
  });

  it('prefers the engine saved with a project', () => {
    const engines = createEngineRegistry([bitsyLike, fakeEngine]);
    expect(engines.of('anything', 'fake').id).toBe('fake');
    expect(engines.of('anything', 'unknown').id).toBe('bitsy');
  });

  it('offers only turned-on engines for new games', () => {
    const engines = createEngineRegistry([bitsyLike, fakeEngine], { enabled: ['bitsy'] });
    expect(engines.offered().map((e) => e.id)).toEqual(['bitsy']);
    // Games of an engine that is not offered still open.
    expect(engines.of(fakeEngine.newGame('x')).id).toBe('fake');
    expect(createEngineRegistry([bitsyLike, fakeEngine]).offered().map((e) => e.id)).toEqual(['bitsy', 'fake']);
  });

  it('reads the engines to offer from the page address', () => {
    expect(createEngineRegistry([bitsyLike, fakeEngine], { search: '?engines=fake' }).offered().map((e) => e.id)).toEqual([
      'bitsy',
      'fake',
    ]);
    expect(createEngineRegistry([bitsyLike, fakeEngine], { search: '' , enabled: ['bitsy'] }).offered()).toHaveLength(1);
  });
});
