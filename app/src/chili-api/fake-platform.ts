// An in-memory stand-in for the Chili platform games API, used by unit tests
// (as the transport's fetch) and by the end-to-end tests (behind page.route).
// It copies the real behaviour from chili-platform src/games/: 20 per page
// with absolute `next` links, newest first, 30 games per account (released
// ones count), 1.5 MB of data, owner-only writes, email verification,
// 409 when a bought game is deleted, and numbered releases: after a release,
// edits stay in the owner's working copy until the next release (#38).

export interface FakeGame {
  /** Set by platforms with engines (chili-platform#170). */
  engine?: string;
  id: number;
  title: string;
  slug: string;
  owner: string;
  cover: string;
  data: string;
  released: boolean;
  /** The release players get; null before the first one. */
  release_number: number | null;
  released_at: string | null;
  /** Owner only: title or data changed since the current release. */
  has_unreleased_changes: boolean;
  listing_slug: string;
  in_library: boolean;
  created_at: string;
  updated_at: string;
}

export interface FakePlatformOptions {
  username?: string;
  /** The access token the API accepts. */
  token?: string;
  /** Origin the API is served from; `next` links use it. */
  origin?: string;
  emailVerified?: boolean;
}

export const MAX_PROJECTS = 30;
export const MAX_DATA_BYTES = 1_500_000;
const PAGE_SIZE = 20;

export interface FakeRelease {
  number: number;
  title: string;
  data: string;
  created_at: string;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-') || 'game'
  );
}

function json(status: number, body?: unknown): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function createFakePlatform({
  username = 'kacper',
  token = 'good-token',
  origin = 'https://api.test',
  emailVerified = true,
}: FakePlatformOptions = {}) {
  const games: FakeGame[] = [];
  const bought = new Set<number>();
  const releases = new Map<number, FakeRelease[]>();
  const requests: { method: string; path: string; body: unknown }[] = [];
  let nextId = 1;
  let clock = Date.parse('2026-10-19T10:00:00Z');
  const state = { emailVerified, failNext: 0 };

  function stamp(): string {
    clock += 1000;
    return new Date(clock).toISOString();
  }

  function addGame(partial: Partial<FakeGame> = {}): FakeGame {
    const now = stamp();
    const game: FakeGame = {
      id: nextId++,
      title: 'untitled',
      owner: username,
      cover: '',
      data: '',
      released: false,
      release_number: null,
      released_at: null,
      has_unreleased_changes: false,
      listing_slug: '',
      in_library: false,
      created_at: now,
      updated_at: now,
      ...partial,
      slug: '',
    };
    game.slug = partial.slug ?? slugify(game.title);
    games.push(game);
    // A game added as released has its release 1, as the platform's migration gave them.
    if (game.released && game.release_number === null) publish(game);
    return game;
  }

  function publish(game: FakeGame) {
    const list = releases.get(game.id) ?? [];
    const release = { number: list.length + 1, title: game.title, data: game.data, created_at: stamp() };
    releases.set(game.id, [...list, release]);
    game.released = true;
    game.release_number = release.number;
    game.released_at = release.created_at;
    game.has_unreleased_changes = false;
    game.updated_at = release.created_at;
  }

  function releaseOf(id: number): FakeRelease | undefined {
    return releases.get(id)?.at(-1);
  }

  function view(game: FakeGame, viewer: string | null): FakeGame {
    const owner = viewer === game.owner;
    return { ...game, data: owner ? game.data : '', has_unreleased_changes: owner && game.has_unreleased_changes };
  }

  function newestFirst(list: FakeGame[]): FakeGame[] {
    return [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
  }

  function page(list: FakeGame[], url: URL, viewer: string | null) {
    const number = Number(url.searchParams.get('page') ?? '1');
    const start = (number - 1) * PAGE_SIZE;
    const link = (n: number) => {
      const next = new URL(url);
      next.searchParams.set('page', String(n));
      return next.toString();
    };
    return {
      count: list.length,
      next: start + PAGE_SIZE < list.length ? link(number + 1) : null,
      previous: number > 1 ? link(number - 1) : null,
      results: list.slice(start, start + PAGE_SIZE).map((game) => view(game, viewer)),
    };
  }

  function validate(body: Record<string, unknown>, partial: boolean): Response | null {
    const errors: Record<string, string[]> = {};
    if (!partial || 'title' in body) {
      if (typeof body.title !== 'string' || !body.title.trim()) errors.title = ['This field may not be blank.'];
    }
    if (!partial || 'data' in body) {
      if (typeof body.data !== 'string') errors.data = ['This field is required.'];
      else if (new TextEncoder().encode(body.data).length > MAX_DATA_BYTES) {
        errors.data = ['Game data must be 1.5 MB or smaller.'];
      }
    }
    return Object.keys(errors).length ? json(400, errors) : null;
  }

  function write(game: FakeGame, body: Record<string, unknown>) {
    const changed =
      (typeof body.title === 'string' && body.title.trim() !== game.title) ||
      (typeof body.data === 'string' && body.data !== game.data);
    if (changed && game.released) game.has_unreleased_changes = true;
    if (typeof body.title === 'string') {
      game.title = body.title.trim();
      // A released game keeps its slug.
      if (!game.released) game.slug = slugify(game.title);
    }
    if (typeof body.data === 'string') game.data = body.data;
    if ('cover' in body) game.cover = body.cover ? `${origin}/media/games/covers/${game.id}/cover.png` : '';
    game.updated_at = stamp();
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method.toUpperCase();
    const text = method === 'GET' || method === 'DELETE' ? '' : await request.text();
    const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
    requests.push({ method, path: `${path}${url.search}`, body: text ? body : undefined });

    if (state.failNext > 0) {
      state.failNext--;
      return json(500, { detail: 'Server error.' });
    }

    const auth = request.headers.get('Authorization');
    const viewer = auth === `Bearer ${token}` ? username : null;
    if (auth && !viewer) return json(401, { detail: 'Given token not valid for any token type' });
    const writing = method !== 'GET';
    if (writing && !viewer) return json(401, { detail: 'Authentication credentials were not provided.' });
    if (writing && !state.emailVerified) return json(403, { detail: 'Verify your email before doing that.' });

    if (path === '/profiles/me/' && method === 'GET') {
      return viewer ? json(200, { username, display_name: 'Kacper' }) : json(401, { detail: 'Not signed in.' });
    }

    if (path === '/games/') {
      if (method === 'GET') {
        const projects = ['0', 'false', 'no'].includes((url.searchParams.get('released') ?? 'true').toLowerCase());
        const owner = url.searchParams.get('username');
        let list = owner ? games.filter((g) => g.owner === owner) : games;
        if (projects) {
          if (!viewer || (owner && owner !== viewer)) list = [];
          else list = list.filter((g) => g.owner === viewer && !g.released);
        } else {
          list = list.filter((g) => g.released);
        }
        return json(200, page(newestFirst(list), url, viewer));
      }
      if (method === 'POST') {
        if (games.filter((g) => g.owner === viewer).length >= MAX_PROJECTS) {
          return json(400, {
            detail: `You can keep ${MAX_PROJECTS} projects. Delete one before saving another.`,
          });
        }
        const invalid = validate(body, false);
        if (invalid) return invalid;
        const game = addGame({ owner: viewer!, title: String(body.title).trim(), data: String(body.data) });
        return json(201, view(game, viewer));
      }
    }

    const match = /^\/games\/(\d+)\/(release\/)?$/.exec(path);
    if (match) {
      const game = games.find((g) => g.id === Number(match[1]));
      const visible = game && (game.released || game.owner === viewer);
      if (!game || !visible) return json(404, { detail: 'No Game matches the given query.' });
      if (method === 'GET' && !match[2]) return json(200, view(game, viewer));
      if (method === 'GET' && match[2]) {
        const release = releaseOf(game.id);
        if (!release) return json(404, { detail: 'Not released yet.' });
        return json(200, { ...release, data: viewer === game.owner || bought.has(game.id) ? release.data : '' });
      }
      if (game.owner !== viewer) return json(403, { detail: 'You do not have permission to perform this action.' });
      if (match[2] && method === 'POST') {
        if (!game.released || game.has_unreleased_changes) publish(game);
        return json(200, view(game, viewer));
      }
      if (method === 'PUT' || method === 'PATCH') {
        const invalid = validate(body, method === 'PATCH');
        if (invalid) return invalid;
        write(game, body);
        return json(200, view(game, viewer));
      }
      if (method === 'DELETE') {
        if (bought.has(game.id)) {
          return json(409, {
            detail:
              'This game has been bought, so it cannot be deleted. Buyers keep their copy. Unpublish the listing instead.',
          });
        }
        games.splice(games.indexOf(game), 1);
        return json(204);
      }
    }
    return json(404, { detail: 'Not found.' });
  }

  return {
    games,
    requests,
    addGame,
    /** The release players get now. */
    releaseOf,
    /** The owner changes the working copy, as a PATCH would. */
    edit: (id: number, changes: { title?: string; data?: string }) => {
      const game = games.find((g) => g.id === id);
      if (game) write(game, changes);
    },
    /** Someone bought this game, so deleting it fails with 409. */
    markBought: (id: number) => bought.add(id),
    setEmailVerified: (value: boolean) => (state.emailVerified = value),
    /** The next n requests fail with a 500. */
    failNext: (n = 1) => (state.failNext = n),
    handle,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input, init))) as typeof fetch,
  };
}

export type FakePlatform = ReturnType<typeof createFakePlatform>;
