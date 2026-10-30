import {
  ApiError,
  createSaveController,
  type Profile,
  type Project,
  type ProfileService,
  type ProjectRepository,
  type ProjectSummary,
  type SaveStatus,
} from '../chili-api';
import type { EmbedMessage } from '../embed/bridge';
import type { EngineRegistry } from '../engines/registry';
import type { EngineModule } from '../engines/types';

export type NoticeKind = 'success' | 'error' | 'info';

export type OpenState =
  | { status: 'none' }
  | { status: 'loading'; id: string }
  /** `doc` is the engine's own type: a Bitsy `World`, a Chili Beat `Game`, … */
  | { status: 'ready'; project: Project; engine: string; doc: unknown; issues: { message: string }[] }
  | { status: 'error'; id: string; message: string };

export interface ProjectsState {
  /** Where projects are kept: the platform when signed in, else this device. */
  mode: 'unknown' | 'platform' | 'local';
  username?: string;
  profile?: Profile;
  list: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    projects: ProjectSummary[];
    released: ProjectSummary[];
    error?: string;
  };
  open: OpenState;
  save: SaveStatus;
  history: { canUndo: boolean; canRedo: boolean };
}

export interface EditOptions {
  /** Edits with the same group in a row are one undo step (one paint stroke, one typed title). */
  group?: string;
}

export interface ProjectStoreOptions {
  /** Parses, saves and titles each game with its own engine. */
  engines: EngineRegistry;
  profile: ProfileService;
  platform: ProjectRepository;
  local: ProjectRepository;
  /** Messages for the platform page around the creator. */
  post(message: Exclude<EmbedMessage, { type: 'chili-auth-request' }>): void;
  notify(kind: NoticeKind, message: string): void;
}

export const NEW_GAME_TITLE = 'Untitled game';

/** Undo steps kept per open game. */
export const HISTORY_LIMIT = 100;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isLocal(id: string): boolean {
  return id.startsWith('local-');
}

/** The open project, the project lists and autosave, for every tool to share. */
export function createProjectStore({ engines, profile, platform, local, post, notify }: ProjectStoreOptions) {
  let state: ProjectsState = {
    mode: 'unknown',
    list: { status: 'idle', projects: [], released: [] },
    open: { status: 'none' },
    save: { state: 'saved', unsaved: false },
    history: { canUndo: false, canRedo: false },
  };
  const listeners = new Set<() => void>();
  let reportedFailure = false;
  let started: Promise<void> | null = null;
  // Documents are replaced, never changed, on every edit, so history keeps them as they are.
  let past: unknown[] = [];
  let future: unknown[] = [];
  let lastGroup: string | undefined;

  function set(patch: Partial<ProjectsState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  const repo = (id?: string) => (state.mode === 'local' || (id && isLocal(id)) ? local : platform);

  function openProject(): Project | null {
    return state.open.status === 'ready' ? state.open.project : null;
  }

  function openEngine(): EngineModule | null {
    return state.open.status === 'ready' ? engines.get(state.open.engine)! : null;
  }

  async function saveOpen(data: string) {
    const project = openProject();
    if (!project || state.open.status !== 'ready') return;
    const title = openEngine()!.gameTitle(state.open.doc).split('\n')[0]!.trim() || 'untitled';
    const saved = await repo(project.id).update(project.id, { title, data });
    if (openProject()?.id === saved.id && state.open.status === 'ready') {
      set({ open: { ...state.open, project: { ...saved, data } } });
    }
    const { data: _data, ...summary } = saved;
    set({ list: listed(summary) });
  }

  /** The lists with `summary` moved to the top of the one it belongs to: projects or released games. */
  function listed(summary: ProjectSummary): ProjectsState['list'] {
    const others = (list: ProjectSummary[]) => list.filter((p) => p.id !== summary.id);
    return {
      ...state.list,
      projects: summary.released ? others(state.list.projects) : [summary, ...others(state.list.projects)],
      released: summary.released ? [summary, ...others(state.list.released)] : others(state.list.released),
    };
  }

  const autosave = createSaveController({
    save: saveOpen,
    onChange(status) {
      if (status.state === 'saved') reportedFailure = false;
      if (status.state === 'error' && !reportedFailure) {
        reportedFailure = true;
        notify('error', `Could not save your game: ${messageOf(status.error)}`);
      }
      set({ save: status });
      post({ type: 'chili-save-state', state: status.state, unsaved: status.unsaved });
    },
  });

  async function refresh() {
    set({ list: { ...state.list, status: 'loading' } });
    try {
      const repository = repo();
      const [projects, released] = await Promise.all([
        repository.listProjects(),
        state.username ? repository.listReleased(state.username) : Promise.resolve([]),
      ]);
      set({ list: { status: 'ready', projects, released } });
    } catch (err) {
      set({ list: { ...state.list, status: 'error', error: messageOf(err) } });
    }
  }

  /** Saves what is open; false when that failed and the user should know first. */
  async function settle(): Promise<boolean> {
    if (!autosave.hasUnsavedWork()) return true;
    try {
      await autosave.flush();
      return true;
    } catch {
      return false;
    }
  }

  function forget() {
    past = [];
    future = [];
    lastGroup = undefined;
  }

  function historyState() {
    return { canUndo: past.length > 0, canRedo: future.length > 0 };
  }

  /** Puts a document from history back and saves it. */
  function restore(doc: unknown) {
    if (state.open.status !== 'ready') return;
    lastGroup = undefined;
    set({ open: { ...state.open, doc }, history: historyState() });
    autosave.edit(openEngine()!.format.serialize(doc));
  }

  function show(project: Project) {
    const engine = engines.of(project.data, project.engine);
    const { doc, issues } = engine.format.parse(project.data);
    autosave.reset();
    forget();
    set({ open: { status: 'ready', project, engine: engine.id, doc, issues }, history: historyState() });
    if (!isLocal(project.id)) post({ type: 'chili-project', id: project.id });
  }

  async function begin(initialId?: string) {
    try {
      const me = await profile.me();
      set({ mode: 'platform', username: me.username, profile: me });
    } catch (err) {
      if (!(err instanceof ApiError) || err.kind !== 'unauthorized') {
        set({ mode: 'platform', list: { ...state.list, status: 'error', error: messageOf(err) } });
        if (initialId) await store.open(initialId);
        return;
      }
      set({ mode: 'local' });
    }
    await refresh();
    if (initialId) await store.open(initialId);
  }

  const store = {
    getState: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Works out where projects live, lists them, and opens `initialId` if given. Runs once. */
    start(initialId?: string): Promise<void> {
      started ??= begin(initialId);
      return started;
    },

    refresh,

    async open(id: string) {
      if (!(await settle())) {
        notify('error', 'Your latest changes are not saved yet. Try again once they are.');
        return;
      }
      set({ open: { status: 'loading', id } });
      try {
        show(await repo(id).get(id));
      } catch (err) {
        set({ open: { status: 'error', id, message: messageOf(err) } });
      }
    },

    /** Saves and closes the open project. */
    async close() {
      if (!(await settle())) return;
      forget();
      set({ open: { status: 'none' }, history: historyState() });
      post({ type: 'chili-project-new' });
    },

    /** Starts a new game of an engine (the default one if not given), or from imported data, and opens it. */
    async create(title = NEW_GAME_TITLE, data?: string, engineId?: string) {
      if (!(await settle())) return;
      const engine = engines.get(engineId) ?? engines.default();
      const project = await repo().create({ title, data: data ?? engine.newGame(title), engine: engine.id });
      await refresh();
      show(project);
    },

    async duplicate(id: string) {
      await repo(id).duplicate(id);
      await refresh();
    },

    async remove(id: string) {
      await repo(id).remove(id);
      if (openProject()?.id === id) {
        autosave.reset();
        forget();
        set({ open: { status: 'none' }, history: historyState() });
        post({ type: 'chili-project-new' });
      }
      set({ list: { ...state.list, projects: state.list.projects.filter((p) => p.id !== id) } });
    },

    /** Releases a project, or a released game's unpublished changes, with its latest edits saved, and tells the platform page. */
    async release(id: string) {
      if (openProject()?.id === id) await autosave.flush();
      const released = await repo(id).release(id);
      const { data: _data, ...summary } = released;
      if (openProject()?.id === id && state.open.status === 'ready') {
        const { released: isReleased, releaseNumber, hasUnreleasedChanges, updatedAt } = released;
        set({
          open: {
            ...state.open,
            project: { ...state.open.project, released: isReleased, releaseNumber, hasUnreleasedChanges, updatedAt },
          },
        });
      }
      set({ list: listed(summary) });
      post({ type: 'chili-released', id, slug: released.slug });
    },

    /** Sets the open game's cover from a PNG data URL, or removes it with null. */
    async setCover(cover: string | null) {
      const project = openProject();
      if (!project) return;
      const saved = await repo(project.id).update(project.id, { cover });
      if (openProject()?.id === saved.id && state.open.status === 'ready') {
        set({ open: { ...state.open, project: { ...state.open.project, cover: saved.cover } } });
      }
      const withCover = (list: ProjectSummary[]) =>
        list.map((p) => (p.id === saved.id ? { ...p, cover: saved.cover } : p));
      set({ list: { ...state.list, projects: withCover(state.list.projects), released: withCover(state.list.released) } });
    },

    /** Changes the open document on a copy, keeps the old one for undo, and autosaves. */
    updateDoc<Doc>(recipe: (doc: Doc) => void, { group }: EditOptions = {}) {
      if (state.open.status !== 'ready') return;
      const before = state.open.doc;
      const doc = structuredClone(before) as Doc;
      recipe(doc);
      if (group === undefined || group !== lastGroup) {
        past.push(before);
        if (past.length > HISTORY_LIMIT) past.shift();
      }
      future = [];
      lastGroup = group;
      set({ open: { ...state.open, doc }, history: historyState() });
      autosave.edit(openEngine()!.format.serialize(doc));
    },

    /** Ends the current group, so the next edit is its own undo step. */
    endGroup() {
      lastGroup = undefined;
    },

    undo(): boolean {
      const doc = past.pop();
      if (doc === undefined || state.open.status !== 'ready') return false;
      future.push(state.open.doc);
      restore(doc);
      return true;
    },

    redo(): boolean {
      const doc = future.pop();
      if (doc === undefined || state.open.status !== 'ready') return false;
      past.push(state.open.doc);
      restore(doc);
      return true;
    },

    setTitle(title: string) {
      const engine = openEngine();
      if (engine) store.updateDoc((doc) => engine.setTitle(doc, title), { group: 'title' });
    },

    /** The open game's engine, or null when none is open. */
    engine: openEngine,

    /** The open game's text, for the player. */
    data(): string {
      return state.open.status === 'ready' ? openEngine()!.format.serialize(state.open.doc) : '';
    },

    flush: () => autosave.flush(),
    retrySave: () => autosave.retry(),
    hasUnsavedWork: () => autosave.hasUnsavedWork(),

    /** Games that count against the platform's limit (released ones count). */
    gamesUsed: () => state.list.projects.length + state.list.released.length,

    dispose: () => autosave.dispose(),
  };
  return store;
}

export type ProjectStore = ReturnType<typeof createProjectStore>;
