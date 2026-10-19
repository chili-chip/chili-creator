// The classic editor's "load game" list (chili-creator#15): drafts and
// released games, every page, newest edit first.
import './chili-project-list.js';

type Game = { id: number; title: string; released: boolean; updated_at: string };
type Page = { results: Game[]; next: string | null } | Game[];
type ProjectList = {
  MAX_PAGES: number;
  gamesPath(username: string, released: boolean, page: number): string;
  loadAll(fetchJson: (path: string) => Promise<Page>, username: string): Promise<Game[]>;
};

const list = (globalThis as unknown as { ChiliProjectList: ProjectList }).ChiliProjectList;

function game(id: number, released: boolean, minute: number): Game {
  const updated = new Date(Date.UTC(2026, 9, 19, 12, minute)).toISOString();
  return { id, title: `Game ${id}`, released, updated_at: updated };
}

/** A fake API: GET /games/ pages its list by 20 like the platform (PAGE_SIZE). */
function fakeApi(drafts: Game[], released: Game[]) {
  const calls: string[] = [];
  const fetchJson = (path: string): Promise<Page> => {
    calls.push(path);
    const url = new URL(path, 'https://platform.example/api');
    const source = url.searchParams.get('released') === 'false' ? drafts : released;
    const page = Number(url.searchParams.get('page') ?? '1');
    const results = source.slice((page - 1) * 20, page * 20);
    const next = page * 20 < source.length ? `https://other.example/api${path}&page=${page + 1}` : null;
    return Promise.resolve({ results, next });
  };
  return { calls, fetchJson };
}

describe('ChiliProjectList', () => {
  it('asks for drafts with released=false and for released games without it', () => {
    expect(list.gamesPath('ana b', false, 1)).toBe('/games/?username=ana%20b&released=false');
    expect(list.gamesPath('ana b', true, 1)).toBe('/games/?username=ana%20b');
    expect(list.gamesPath('ana', true, 2)).toBe('/games/?username=ana&page=2');
  });

  it('lists released games next to drafts (they were missing)', async () => {
    const api = fakeApi([game(1, false, 1)], [game(2, true, 2)]);

    const games = await list.loadAll(api.fetchJson, 'ana');

    expect(games.map((g) => g.id)).toEqual([2, 1]);
    expect(games.find((g) => g.id === 2)?.released).toBe(true);
  });

  it('follows every page past the first 20', async () => {
    const drafts = Array.from({ length: 25 }, (_, i) => game(i + 1, false, i));
    const released = Array.from({ length: 3 }, (_, i) => game(100 + i, true, 30 + i));
    const api = fakeApi(drafts, released);

    const games = await list.loadAll(api.fetchJson, 'ana');

    expect(games).toHaveLength(28);
    expect(api.calls).toContain('/games/?username=ana&released=false&page=2');
  });

  it('builds page paths itself instead of following a next link to another host', async () => {
    const api = fakeApi(
      Array.from({ length: 21 }, (_, i) => game(i + 1, false, i)),
      [],
    );

    await list.loadAll(api.fetchJson, 'ana');

    expect(api.calls.every((path) => path.startsWith('/games/?'))).toBe(true);
  });

  it('sorts newest edit first', async () => {
    const api = fakeApi([game(1, false, 5), game(2, false, 1)], [game(3, true, 3)]);

    const games = await list.loadAll(api.fetchJson, 'ana');

    expect(games.map((g) => g.id)).toEqual([1, 3, 2]);
  });

  it('shows a game released between the two requests once, as released', async () => {
    const api = fakeApi([game(7, false, 1)], [game(7, true, 2)]);

    const games = await list.loadAll(api.fetchJson, 'ana');

    expect(games).toEqual([game(7, true, 2)]);
  });

  it('stops after MAX_PAGES if the API never stops sending next', async () => {
    const calls: string[] = [];
    const endless = (path: string): Promise<Page> => {
      calls.push(path);
      return Promise.resolve({ results: [], next: 'https://platform.example/api/games/?page=x' });
    };

    await list.loadAll(endless, 'ana');

    expect(calls).toHaveLength(2 * list.MAX_PAGES);
  });

  it('accepts an unpaged list', async () => {
    const fetchJson = (path: string): Promise<Page> =>
      Promise.resolve(path.includes('released=false') ? [game(1, false, 1)] : [game(2, true, 2)]);

    const games = await list.loadAll(fetchJson, 'ana');

    expect(games.map((g) => g.id)).toEqual([2, 1]);
  });

  it('fails as a whole when one request fails, so the editor keeps its last list', async () => {
    const fetchJson = (path: string): Promise<Page> =>
      path.includes('released=false')
        ? Promise.resolve({ results: [game(1, false, 1)], next: null })
        : Promise.reject(new Error('could not load projects'));

    await expect(list.loadAll(fetchJson, 'ana')).rejects.toThrow('could not load projects');
  });
});
