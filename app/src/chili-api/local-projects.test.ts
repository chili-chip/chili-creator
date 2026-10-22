import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createIndexedDbStore, createLocalProjects, createMemoryStore } from './local-projects';

describe('createLocalProjects', () => {
  it('keeps projects on this device, newest first', async () => {
    let now = 0;
    const repo = createLocalProjects(createMemoryStore(), { now: () => new Date(++now * 1000).toISOString() });
    const a = await repo.create({ title: 'A', data: '1' });
    const b = await repo.create({ title: 'B', data: '2' });
    expect(a.id).toMatch(/^local-/);
    expect((await repo.listProjects()).map((p) => p.title)).toEqual(['B', 'A']);
    await repo.update(a.id, { data: '3' });
    expect((await repo.listProjects()).map((p) => p.title)).toEqual(['A', 'B']);
    expect(await repo.get(a.id)).toMatchObject({ data: '3', released: false });
    await repo.remove(b.id);
    expect((await repo.listProjects()).map((p) => p.id)).toEqual([a.id]);
    expect(await repo.listReleased('kacper')).toEqual([]);
  });

  it('duplicates and reports missing projects', async () => {
    const repo = createLocalProjects(createMemoryStore());
    const a = await repo.create({ title: 'A', data: '1' });
    expect(await repo.duplicate(a.id)).toMatchObject({ title: 'A (copy)', data: '1' });
    await expect(repo.get('local-missing')).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('cannot release a game kept on this device', async () => {
    const repo = createLocalProjects(createMemoryStore());
    const a = await repo.create({ title: 'A', data: '1' });
    await expect(repo.release(a.id)).rejects.toMatchObject({ kind: 'unauthorized', message: /Sign in/ });
  });

  it('stores them in IndexedDB', async () => {
    const store = createIndexedDbStore('chili-creator-test');
    const repo = createLocalProjects(store);
    const a = await repo.create({ title: 'Saved', data: 'GAME' });
    const again = createLocalProjects(createIndexedDbStore('chili-creator-test'));
    expect(await again.get(a.id)).toMatchObject({ title: 'Saved', data: 'GAME' });
  });
});
