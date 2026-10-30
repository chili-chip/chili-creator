import { ApiError, type Transport } from './transport';

/** chili-platform's MAX_GAME_DATA_BYTES. */
export const MAX_DATA_BYTES = 1_500_000;
/** chili-platform's MAX_PROJECTS_PER_USER; released games count too. */
export const MAX_GAMES = 30;

export interface ProjectSummary {
  id: string;
  title: string;
  /** The game's engine, when the platform knows it. Games without one are Bitsy games. */
  engine?: string;
  slug: string;
  /** Media URL of the PNG cover, or "". */
  cover: string;
  released: boolean;
  /** The release players get, from 1; null before the first release. */
  releaseNumber: number | null;
  /** The owner changed the title or data since that release (#38). */
  hasUnreleasedChanges: boolean;
  /** Marketplace listing, or "" when not listed. */
  listingSlug: string;
  updatedAt: string;
}

export interface Project extends ProjectSummary {
  /** The game's `.bitsy` text. */
  data: string;
}

export interface ProjectChanges {
  title?: string;
  data?: string;
  /** A PNG data URL, or null to remove the cover. */
  cover?: string | null;
}

/** Where projects live: the platform, or this device when signed out. */
export interface ProjectRepository {
  listProjects(): Promise<ProjectSummary[]>;
  listReleased(username: string): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project>;
  /** `engine` is saved with the game; the platform keeps games without one as Bitsy games. */
  create(input: { title: string; data: string; engine?: string }): Promise<Project>;
  update(id: string, changes: ProjectChanges): Promise<Project>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<Project>;
  /** Releases the version last saved: a project's first release, or a released game's next one. */
  release(id: string): Promise<Project>;
}

/** The game fields this client reads (chili-platform docs/openapi.yaml, Game). */
interface GameResponse {
  id: number;
  title: string;
  slug: string;
  cover: string;
  data: string;
  released: boolean;
  /** Missing on a platform from before releases (#38). */
  release_number?: number | null;
  has_unreleased_changes?: boolean;
  listing_slug: string;
  updated_at: string;
  /** Missing on a platform from before engines (chili-platform#170). */
  engine?: string;
}

interface Page<T> {
  next: string | null;
  results: T[];
}

function toProject(game: GameResponse): Project {
  return {
    id: String(game.id),
    title: game.title,
    slug: game.slug,
    cover: game.cover ?? '',
    released: game.released,
    releaseNumber: game.release_number ?? null,
    hasUnreleasedChanges: game.has_unreleased_changes ?? false,
    listingSlug: game.listing_slug ?? '',
    updatedAt: game.updated_at,
    ...(game.engine ? { engine: game.engine } : {}),
    data: game.data ?? '',
  };
}

function toSummary(game: GameResponse): ProjectSummary {
  const { data: _data, ...summary } = toProject(game);
  return summary;
}

export function checkSize(data: string): void {
  if (new TextEncoder().encode(data).length > MAX_DATA_BYTES) {
    throw new ApiError('too-large', 'This game is over 1.5 MB, the most the platform keeps. Make it smaller to save it.');
  }
}

export function copyTitle(title: string): string {
  return `${title} (copy)`;
}

export function createPlatformProjects(transport: Transport): ProjectRepository {
  async function all(path: string): Promise<ProjectSummary[]> {
    const out: ProjectSummary[] = [];
    let next: string | null = path;
    while (next) {
      const page: Page<GameResponse> = await transport.request<Page<GameResponse>>(next);
      out.push(...page.results.map(toSummary));
      next = page.next;
    }
    return out;
  }

  const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

  const repository: ProjectRepository = {
    listProjects: () => all('/games/?released=false'),
    listReleased: (username) => all(`/games/?username=${encodeURIComponent(username)}&released=true`),
    async get(id) {
      return toProject(await transport.request<GameResponse>(`/games/${id}/`));
    },
    async create(input) {
      checkSize(input.data);
      return toProject(await transport.request<GameResponse>('/games/', send('POST', input)));
    },
    async update(id, changes) {
      if (changes.data !== undefined) checkSize(changes.data);
      const body = { ...changes, ...(changes.cover === null ? { cover: '' } : {}) };
      return toProject(await transport.request<GameResponse>(`/games/${id}/`, send('PATCH', body)));
    },
    async remove(id) {
      await transport.request(`/games/${id}/`, { method: 'DELETE' });
    },
    async duplicate(id) {
      const source = await repository.get(id);
      return repository.create({ title: copyTitle(source.title), data: source.data, ...(source.engine ? { engine: source.engine } : {}) });
    },
    async release(id) {
      return toProject(await transport.request<GameResponse>(`/games/${id}/release/`, { method: 'POST' }));
    },
  };
  return repository;
}
