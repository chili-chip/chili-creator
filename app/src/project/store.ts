import { createWorld, parse, serialize, type ParseIssue, type World } from '../bitsy';
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

export type NoticeKind = 'success' | 'error' | 'info';

export type OpenState =
  | { status: 'none' }
  | { status: 'loading'; id: string }
  | { status: 'ready'; project: Project; world: World; issues: ParseIssue[] }
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
}

export interface ProjectStoreOptions {
  profile: ProfileService;
  platform: ProjectRepository;
  local: ProjectRepository;
  /** Messages for the platform page around the creator. */
  post(message: Exclude<EmbedMessage, { type: 'chili-auth-request' }>): void;
  notify(kind: NoticeKind, message: string): void;
}

export const NEW_GAME_TITLE = 'Untitled game';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isLocal(id: string): boolean {
  return id.startsWith('local-');
}

/** The open project, the project lists and autosave, for every tool to share. */
export function createProjectStore({ profile, platform, local, post, notify }: ProjectStoreOptions) {
  let state: ProjectsState = {
    mode: 'unknown',
    list: { status: 'idle', projects: [], released: [] },
    open: { status: 'none' },
    save: { state: 'saved', unsaved: false },
  };
  const listeners = new Set<() => void>();
  let reportedFailure = false;
  let started: Promise<void> | null = null;

  function set(patch: Partial<ProjectsState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  const repo = (id?: string) => (state.mode === 'local' || (id && isLocal(id)) ? local : platform);

  function openProject(): Project | null {
    return state.open.status === 'ready' ? state.open.project : null;
  }

  async function saveOpen(data: string) {
    const project = openProject();
    if (!project || state.open.status !== 'ready') return;
    const title = state.open.world.title.split('\n')[0]!.trim() || 'untitled';
    const saved = await repo(project.id).update(project.id, { title, data });
    if (openProject()?.id === saved.id && state.open.status === 'ready') {
      set({ open: { ...state.open, project: { ...saved, data } } });
    }
    const { data: _data, ...summary } = saved;
    set({
      list: {
        ...state.list,
        projects: [summary, ...state.list.projects.filter((p) => p.id !== saved.id)],
      },
    });
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

  function show(project: Project) {
    const { world, issues } = parse(project.data);
    autosave.reset();
    set({ open: { status: 'ready', project, world, issues } });
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
      set({ open: { status: 'none' } });
      post({ type: 'chili-project-new' });
    },

    /** Starts a new game from the blank template and opens it. */
    async create(title = NEW_GAME_TITLE) {
      if (!(await settle())) return;
      const project = await repo().create({ title, data: serialize(createWorld({ title })) });
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
        set({ open: { status: 'none' } });
        post({ type: 'chili-project-new' });
      }
      set({ list: { ...state.list, projects: state.list.projects.filter((p) => p.id !== id) } });
    },

    /** Changes the open world and autosaves it. Phase 2 replaces this with undoable patches. */
    updateWorld(recipe: (world: World) => void) {
      if (state.open.status !== 'ready') return;
      const world = structuredClone(state.open.world);
      recipe(world);
      set({ open: { ...state.open, world } });
      autosave.edit(serialize(world));
    },

    setTitle(title: string) {
      store.updateWorld((world) => {
        world.title = title;
      });
    },

    /** The open game's `.bitsy` text, for the player. */
    data(): string {
      return state.open.status === 'ready' ? serialize(state.open.world) : '';
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
