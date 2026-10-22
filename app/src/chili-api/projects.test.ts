import { beforeEach, describe, expect, it } from 'vitest';
import { createFakePlatform, type FakePlatform } from './fake-platform';
import { createPlatformProjects, MAX_DATA_BYTES } from './projects';
import { createTransport } from './transport';

let platform: FakePlatform;

function repository() {
  const transport = createTransport({
    baseUrl: 'https://api.test/api',
    tokens: { getToken: async () => 'good-token' },
    fetch: platform.fetch,
  });
  return createPlatformProjects(transport);
}

beforeEach(() => {
  platform = createFakePlatform();
});

describe('createPlatformProjects', () => {
  it('releases a project', async () => {
    const game = platform.addGame({ title: 'Mossland' });
    const released = await repository().release(String(game.id));
    expect(released).toMatchObject({ id: String(game.id), released: true, slug: 'mossland' });
    expect(platform.requests.at(-1)).toMatchObject({ method: 'POST', path: `/games/${game.id}/release/` });
  });

  it('lists every project, following the pages', async () => {
    for (let i = 1; i <= 45; i++) platform.addGame({ title: `game ${i}` });
    platform.addGame({ title: 'out', released: true });
    platform.addGame({ title: 'theirs', owner: 'someone' });
    const projects = await repository().listProjects();
    expect(projects).toHaveLength(45);
    expect(projects[0]).toMatchObject({ id: '45', title: 'game 45', released: false });
    expect(platform.requests.map((r) => r.path)).toEqual([
      '/games/?released=false',
      '/games/?released=false&page=2',
      '/games/?released=false&page=3',
    ]);
  });

  it('lists released games by username', async () => {
    platform.addGame({ title: 'draft' });
    platform.addGame({ title: 'out', released: true, listing_slug: 'out' });
    const released = await repository().listReleased('kacper');
    expect(released.map((p) => [p.title, p.released, p.listingSlug])).toEqual([['out', true, 'out']]);
    expect(platform.requests[0]!.path).toBe('/games/?username=kacper&released=true');
  });

  it('opens a project with its data', async () => {
    const game = platform.addGame({ title: 'mossland', data: 'GAME DATA' });
    const project = await repository().get(String(game.id));
    expect(project).toMatchObject({ id: String(game.id), title: 'mossland', data: 'GAME DATA', slug: 'mossland' });
    expect(project.updatedAt).toBe(game.updated_at);
  });

  it('creates, updates and removes', async () => {
    const repo = repository();
    const created = await repo.create({ title: 'New', data: 'A' });
    expect(created).toMatchObject({ title: 'New', data: 'A' });
    const updated = await repo.update(created.id, { title: 'Renamed', data: 'B' });
    expect(updated).toMatchObject({ title: 'Renamed', slug: 'renamed', data: 'B' });
    expect(platform.requests.at(-1)).toMatchObject({ method: 'PATCH', body: { title: 'Renamed', data: 'B' } });
    await repo.remove(created.id);
    expect(platform.games).toEqual([]);
  });

  it('duplicates a project as a copy', async () => {
    const game = platform.addGame({ title: 'mossland', data: 'GAME' });
    const copy = await repository().duplicate(String(game.id));
    expect(copy).toMatchObject({ title: 'mossland (copy)', data: 'GAME' });
    expect(platform.games).toHaveLength(2);
  });

  it('explains the 30 game limit', async () => {
    for (let i = 0; i < 30; i++) platform.addGame({ released: i % 2 === 0 });
    await expect(repository().create({ title: 'one more', data: 'A' })).rejects.toMatchObject({
      kind: 'project-limit',
    });
  });

  it('refuses data over 1.5 MB before sending it', async () => {
    const game = platform.addGame();
    const big = 'x'.repeat(MAX_DATA_BYTES + 1);
    await expect(repository().update(String(game.id), { data: big })).rejects.toMatchObject({ kind: 'too-large' });
    expect(platform.requests).toEqual([]);
  });

  it('counts bytes, not characters', async () => {
    const game = platform.addGame();
    const big = 'ż'.repeat(MAX_DATA_BYTES / 2 + 1);
    await expect(repository().update(String(game.id), { data: big })).rejects.toMatchObject({ kind: 'too-large' });
  });

  it('passes on 409 when a bought game is deleted', async () => {
    const game = platform.addGame();
    platform.markBought(game.id);
    await expect(repository().remove(String(game.id))).rejects.toMatchObject({
      kind: 'conflict',
      message: expect.stringContaining('cannot be deleted'),
    });
  });

  it('passes on email verification', async () => {
    platform.setEmailVerified(false);
    await expect(repository().create({ title: 'x', data: 'y' })).rejects.toMatchObject({
      kind: 'email-not-verified',
    });
  });
});
