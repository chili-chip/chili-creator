import { ApiError } from './transport';
import { copyTitle, type Project, type ProjectRepository } from './projects';

/** A tiny async key-value store: IndexedDB in the app, a Map in tests. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, unknown>();
  return {
    get: async <T,>(key: string) => structuredClone(map.get(key)) as T | undefined,
    set: async (key, value) => void map.set(key, structuredClone(value)),
    delete: async (key) => void map.delete(key),
    keys: async () => [...map.keys()],
  };
}

function promised<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDbStore(name = 'chili-creator'): KeyValueStore {
  let db: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return db;
  }
  async function store(mode: IDBTransactionMode) {
    return (await open()).transaction('kv', mode).objectStore('kv');
  }
  return {
    get: async <T,>(key: string) => (await promised((await store('readonly')).get(key))) as T | undefined,
    set: async (key, value) => void (await promised((await store('readwrite')).put(value, key))),
    delete: async (key) => void (await promised((await store('readwrite')).delete(key))),
    keys: async () => (await promised((await store('readonly')).getAllKeys())).map(String),
  };
}

const prefix = 'project:';

function newId(): string {
  return `local-${crypto.randomUUID()}`;
}

/** Projects kept on this device, for people who are not signed in. */
export function createLocalProjects(
  store: KeyValueStore,
  { now = () => new Date().toISOString() }: { now?: () => string } = {},
): ProjectRepository {
  async function read(id: string): Promise<Project> {
    const project = await store.get<Project>(prefix + id);
    if (!project) throw new ApiError('not-found', 'This game is not on this device.', 404);
    return project;
  }

  const repository: ProjectRepository = {
    async listProjects() {
      const keys = (await store.keys()).filter((key) => key.startsWith(prefix));
      const projects = await Promise.all(keys.map((key) => store.get<Project>(key)));
      return projects
        .filter((p): p is Project => !!p)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(({ data: _data, ...summary }) => summary);
    },
    listReleased: async () => [],
    get: read,
    async create({ title, data }) {
      const project: Project = {
        id: newId(),
        title,
        slug: '',
        cover: '',
        released: false,
        listingSlug: '',
        updatedAt: now(),
        data,
      };
      await store.set(prefix + project.id, project);
      return project;
    },
    async update(id, changes) {
      const project = await read(id);
      const next: Project = {
        ...project,
        ...(changes.title !== undefined ? { title: changes.title } : {}),
        ...(changes.data !== undefined ? { data: changes.data } : {}),
        ...(changes.cover !== undefined ? { cover: changes.cover ?? '' } : {}),
        updatedAt: now(),
      };
      await store.set(prefix + id, next);
      return next;
    },
    async remove(id) {
      await store.delete(prefix + id);
    },
    async release() {
      throw new ApiError('unauthorized', 'Sign in on Chili Platform to release a game.', 401);
    },
    async duplicate(id) {
      const source = await read(id);
      return repository.create({ title: copyTitle(source.title), data: source.data });
    },
  };
  return repository;
}
