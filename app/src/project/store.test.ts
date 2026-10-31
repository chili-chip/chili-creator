import type { World } from '../bitsy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse, serialize } from '../bitsy';
import {
  createLocalProjects,
  createMemoryStore,
  createPlatformProjects,
  createProfileService,
  createTransport,
} from '../chili-api';
import { createFakePlatform, type FakePlatform } from '../chili-api/fake-platform';
import type { EmbedMessage } from '../embed/bridge';
import { bitsyEngine } from '../engines/bitsy';
import { fakeEngine } from '../engines/fake';
import { createEngineRegistry } from '../engines/registry';
import { createProjectStore } from './store';

const game = (title: string) => `${title}\n\n# BITSY VERSION 8.12\n\n! ROOM_FORMAT 1\n`;

let platform: FakePlatform;

function setup({ signedIn = true } = {}) {
  const transport = createTransport({
    baseUrl: 'https://api.test/api',
    tokens: { getToken: async () => (signedIn ? 'good-token' : null) },
    fetch: platform.fetch,
  });
  const posted: EmbedMessage[] = [];
  const notices: { kind: string; message: string }[] = [];
  const store = createProjectStore({
    engines: createEngineRegistry([bitsyEngine]),
    profile: createProfileService(transport),
    platform: createPlatformProjects(transport),
    local: createLocalProjects(createMemoryStore()),
    post: (message) => posted.push(message),
    notify: (kind, message) => notices.push({ kind, message }),
  });
  return { store, posted, notices };
}

beforeEach(() => {
  platform = createFakePlatform();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

describe('createProjectStore', () => {
  it('lists projects and released games for a signed-in user', async () => {
    platform.addGame({ title: 'draft' });
    platform.addGame({ title: 'out', released: true });
    const { store } = setup();
    await store.start();
    const state = store.getState();
    expect(state.mode).toBe('platform');
    expect(state.username).toBe('kacper');
    expect(state.profile).toEqual({ username: 'kacper', displayName: 'Kacper' });
    expect(state.list.status).toBe('ready');
    expect(state.list.projects.map((p) => p.title)).toEqual(['draft']);
    expect(state.list.released.map((p) => p.title)).toEqual(['out']);
  });

  it('releases a project: it moves to released games and the platform is told', async () => {
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { store, posted } = setup();
    await store.start(String(saved.id));
    await store.release(String(saved.id));
    const state = store.getState();
    expect(platform.games[0]!.released).toBe(true);
    expect(state.list.projects).toEqual([]);
    expect(state.list.released.map((p) => p.title)).toEqual(['Mossland']);
    expect(state.open.status === 'ready' && state.open.project.released).toBe(true);
    expect(posted).toContainEqual({ type: 'chili-released', id: String(saved.id), slug: 'mossland' });
  });

  it('keeps a released game listed once when its edits are saved (#38)', async () => {
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { store } = setup();
    await store.start(String(saved.id));
    await store.release(String(saved.id));
    store.setTitle('Mossland 2');
    await store.flush();
    const state = store.getState();
    expect(state.list.projects).toEqual([]);
    expect(state.list.released.map((p) => p.title)).toEqual(['Mossland 2']);
    expect(store.gamesUsed()).toBe(1);
  });

  it("updates a released game's cover in the released list (#38)", async () => {
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { store } = setup();
    await store.start(String(saved.id));
    await store.release(String(saved.id));
    await store.setCover('data:image/png;base64,iVBORw0KGgo=');
    const state = store.getState();
    expect(state.list.projects).toEqual([]);
    expect(state.list.released[0]!.cover).not.toBe('');
  });

  it('keeps edits to a released game unpublished until it is released again (#38)', async () => {
    const saved = platform.addGame({ title: 'Mossland', data: game('Mossland') });
    const { store, posted } = setup();
    await store.start(String(saved.id));
    await store.release(String(saved.id));
    store.setTitle('Mossland 2');
    await store.flush();
    let state = store.getState();
    expect(state.list.released[0]).toMatchObject({ releaseNumber: 1, hasUnreleasedChanges: true });
    expect(state.open.status === 'ready' && state.open.project.hasUnreleasedChanges).toBe(true);
    expect(platform.releaseOf(saved.id)?.title).toBe('Mossland');

    await store.release(String(saved.id));
    state = store.getState();
    expect(state.list.released[0]).toMatchObject({ releaseNumber: 2, hasUnreleasedChanges: false });
    expect(state.open.status === 'ready' && state.open.project).toMatchObject({ releaseNumber: 2, hasUnreleasedChanges: false });
    expect(platform.releaseOf(saved.id)?.title).toBe('Mossland 2');
    expect(posted.filter((m) => m.type === 'chili-released')).toHaveLength(2);
  });

  it('keeps games on this device when nobody is signed in', async () => {
    const { store } = setup({ signedIn: false });
    await store.start();
    expect(store.getState().mode).toBe('local');
    await store.create();
    expect(store.getState().list.projects).toHaveLength(1);
    expect(store.getState().open.status).toBe('ready');
    expect(platform.requests.filter((r) => r.path.startsWith('/games'))).toEqual([]);
  });

  it('opens the project named in the URL and tells the platform', async () => {
    const saved = platform.addGame({ title: 'mossland', data: game('mossland') });
    const { store, posted } = setup();
    await store.start(String(saved.id));
    const open = store.getState().open;
    expect(open.status).toBe('ready');
    if (open.status !== 'ready') return;
    expect(open.project.title).toBe('mossland');
    expect((open.doc as World).title).toBe('mossland');
    expect(store.data()).toBe(game('mossland'));
    expect(posted).toContainEqual({ type: 'chili-project', id: String(saved.id) });
  });

  it('shows why a project could not open', async () => {
    const { store } = setup();
    await store.start('999');
    expect(store.getState().open).toEqual({ status: 'error', id: '999', message: 'No Game matches the given query.' });
  });

  it('creates a new game on the platform and opens it', async () => {
    const { store, posted } = setup();
    await store.start();
    await store.create();
    expect(platform.games).toHaveLength(1);
    const data = platform.games[0]!.data;
    expect(parse(data).world.rooms).toHaveLength(1);
    expect(platform.games[0]!.title).toBe('Untitled game');
    expect(store.getState().open.status).toBe('ready');
    expect(posted).toContainEqual({ type: 'chili-project', id: String(platform.games[0]!.id) });
  });

  it('imports a game as a new project and opens it', async () => {
    const { store } = setup();
    await store.start();
    await store.create('Mossland', game('Mossland'));
    expect(platform.games[0]!.title).toBe('Mossland');
    expect(platform.games[0]!.data).toBe(game('Mossland'));
    expect(store.getState().open.status).toBe('ready');
  });

  it('autosaves a rename and reports the save state to the platform', async () => {
    const saved = platform.addGame({ title: 'old', data: game('old') });
    const { store, posted } = setup();
    await store.start(String(saved.id));
    store.setTitle('New name');
    expect(store.getState().save).toEqual({ state: 'saving', unsaved: true });
    await vi.advanceTimersByTimeAsync(800);
    await store.flush();
    expect(platform.games[0]!.title).toBe('New name');
    expect(platform.games[0]!.data).toBe(game('New name'));
    expect(store.getState().save).toEqual({ state: 'saved', unsaved: false });
    expect(store.getState().list.projects[0]!.title).toBe('New name');
    expect(posted).toContainEqual({ type: 'chili-save-state', state: 'saving', unsaved: true });
    expect(posted.at(-1)).toEqual({ type: 'chili-save-state', state: 'saved', unsaved: false });
  });

  it('saves edits made to the world', async () => {
    const saved = platform.addGame({ title: 'old', data: game('old') });
    const { store } = setup();
    await store.start(String(saved.id));
    store.updateDoc<World>((world) => {
      world.flags.TXT_MODE = '1';
    });
    await store.flush();
    expect(platform.games[0]!.data).toBe(`${game('old')}`.replace('! ROOM_FORMAT 1\n', '! ROOM_FORMAT 1\n! TXT_MODE 1\n'));
    // The open world is a new object, so React sees the change.
    const open = store.getState().open;
    expect(open.status === 'ready' && serialize((open.doc as World))).toBe(platform.games[0]!.data);
  });

  it('tells the user once when saving fails', async () => {
    const saved = platform.addGame({ title: 'old', data: game('old') });
    const { store, notices } = setup();
    await store.start(String(saved.id));
    platform.failNext(2);
    store.setTitle('a');
    await store.flush().catch(() => {});
    store.setTitle('ab');
    await store.flush().catch(() => {});
    expect(store.getState().save.state).toBe('error');
    expect(notices).toEqual([{ kind: 'error', message: 'Could not save your game: Server error.' }]);
    await store.retrySave();
    expect(store.getState().save.state).toBe('saved');
    expect(platform.games[0]!.title).toBe('ab');
  });

  it('saves the open game before opening another', async () => {
    const a = platform.addGame({ title: 'a', data: game('a') });
    const b = platform.addGame({ title: 'b', data: game('b') });
    const { store } = setup();
    await store.start(String(a.id));
    store.setTitle('a2');
    await store.open(String(b.id));
    expect(platform.games.find((g) => g.id === a.id)!.title).toBe('a2');
    const open = store.getState().open;
    expect(open.status === 'ready' && open.project.id).toBe(String(b.id));
  });

  it('removes a project, closing it when it is open', async () => {
    const a = platform.addGame({ title: 'a', data: game('a') });
    const { store, posted } = setup();
    await store.start(String(a.id));
    await store.remove(String(a.id));
    expect(platform.games).toEqual([]);
    expect(store.getState().open).toEqual({ status: 'none' });
    expect(store.getState().list.projects).toEqual([]);
    expect(posted.at(-1)).toEqual({ type: 'chili-project-new' });
  });

  it('passes on why a project cannot be removed', async () => {
    const a = platform.addGame({ title: 'a' });
    platform.markBought(a.id);
    const { store } = setup();
    await store.start();
    await expect(store.remove(String(a.id))).rejects.toMatchObject({ kind: 'conflict' });
    expect(store.getState().list.projects).toHaveLength(1);
  });

  it('duplicates a project', async () => {
    platform.addGame({ title: 'a', data: game('a') });
    const { store } = setup();
    await store.start();
    await store.duplicate(store.getState().list.projects[0]!.id);
    expect(store.getState().list.projects.map((p) => p.title)).toEqual(['a (copy)', 'a']);
  });

  it('sets the open game\'s cover', async () => {
    const saved = platform.addGame({ title: 'a', data: game('a') });
    const { store } = setup();
    await store.start(String(saved.id));
    await store.setCover('data:image/png;base64,AAAA');
    expect(platform.games[0]!.cover).toMatch(/cover\.png$/);
    const open = store.getState().open;
    expect(open.status === 'ready' && open.project.cover).toMatch(/cover\.png$/);
  });

  it('counts released games against the limit', async () => {
    platform.addGame({ title: 'a' });
    platform.addGame({ title: 'b', released: true });
    const { store } = setup();
    await store.start();
    expect(store.gamesUsed()).toBe(2);
  });

  it('starts once, however often it is asked', async () => {
    const { store } = setup();
    await Promise.all([store.start(), store.start()]);
    expect(platform.requests.filter((r) => r.path === '/profiles/me/')).toHaveLength(1);
  });

  it('notifies subscribers', async () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    await store.start();
    expect(listener).toHaveBeenCalled();
  });

  describe('undo and redo', () => {
    async function opened() {
      const saved = platform.addGame({ title: 'old', data: game('old') });
      const other = platform.addGame({ title: 'other', data: game('other') });
      const setupResult = setup();
      await setupResult.store.start(String(saved.id));
      return { ...setupResult, other: String(other.id) };
    }
    const flag = (store: ReturnType<typeof setup>['store']) => {
      const open = store.getState().open;
      return open.status === 'ready' ? (open.doc as World).flags.TXT_MODE : 'not open';
    };
    const setFlag = (value: string) => (world: { flags: Record<string, string> }) => {
      world.flags.TXT_MODE = value;
    };

    it('undoes and redoes an edit, and saves each', async () => {
      const { store } = await opened();
      expect(store.getState().history).toEqual({ canUndo: false, canRedo: false });
      store.updateDoc<World>(setFlag('1'));
      expect(store.getState().history).toEqual({ canUndo: true, canRedo: false });

      expect(store.undo()).toBe(true);
      expect(flag(store)).toBeUndefined();
      expect(store.getState().history).toEqual({ canUndo: false, canRedo: true });
      await store.flush();
      expect(platform.games[0]!.data).toBe(game('old'));

      expect(store.redo()).toBe(true);
      expect(flag(store)).toBe('1');
      await store.flush();
      expect(platform.games[0]!.data).toContain('! TXT_MODE 1');
    });

    it('has nothing to undo or redo at first', async () => {
      const { store } = await opened();
      expect(store.undo()).toBe(false);
      expect(store.redo()).toBe(false);
    });

    it('makes one step of the edits in a group, like one paint stroke', async () => {
      const { store } = await opened();
      store.updateDoc<World>(setFlag('1'), { group: 'stroke-1' });
      store.updateDoc<World>(setFlag('2'), { group: 'stroke-1' });
      store.updateDoc<World>(setFlag('3'), { group: 'stroke-2' });
      store.updateDoc<World>(setFlag('4'));
      store.updateDoc<World>(setFlag('5'));
      store.undo();
      expect(flag(store)).toBe('4');
      store.undo();
      expect(flag(store)).toBe('3');
      store.undo();
      expect(flag(store)).toBe('2');
      store.undo();
      expect(flag(store)).toBeUndefined();
    });

    it('typing a title is one step', async () => {
      const { store } = await opened();
      store.setTitle('n');
      store.setTitle('ne');
      store.setTitle('new');
      store.undo();
      const open = store.getState().open;
      expect(open.status === 'ready' && (open.doc as World).title).toBe('old');
    });

    it('forgets what was undone once something new is done', async () => {
      const { store } = await opened();
      store.updateDoc<World>(setFlag('1'));
      store.undo();
      store.updateDoc<World>(setFlag('2'));
      expect(store.redo()).toBe(false);
      expect(store.getState().history.canRedo).toBe(false);
    });

    it('starts over when another game opens', async () => {
      const { store, other } = await opened();
      store.updateDoc<World>(setFlag('1'));
      await store.open(other);
      expect(store.getState().history).toEqual({ canUndo: false, canRedo: false });
    });

    it('keeps the last 100 steps', async () => {
      const { store } = await opened();
      for (let i = 1; i <= 105; i++) store.updateDoc<World>(setFlag(String(i)));
      let steps = 0;
      while (store.undo()) steps++;
      expect(steps).toBe(100);
      expect(flag(store)).toBe('5');
    });
  });
});

describe('createProjectStore with more than one engine', () => {
  function setupEngines() {
    const transport = createTransport({
      baseUrl: 'https://api.test/api',
      tokens: { getToken: async () => 'good-token' },
      fetch: platform.fetch,
    });
    return createProjectStore({
      engines: createEngineRegistry([bitsyEngine, fakeEngine]),
      profile: createProfileService(transport),
      platform: createPlatformProjects(transport),
      local: createLocalProjects(createMemoryStore()),
      post: () => {},
      notify: () => {},
    });
  }

  it('opens a game with the engine that reads it', async () => {
    const saved = platform.addGame({ title: 'f', data: 'FAKE\nMy fake' });
    const store = setupEngines();
    await store.start(String(saved.id));
    const open = store.getState().open;
    expect(open.status === 'ready' && open.engine).toBe('fake');
    expect(open.status === 'ready' && open.doc).toEqual({ title: 'My fake' });
    expect(store.engine()?.id).toBe('fake');
  });

  it('saves, titles and undoes with the open game engine', async () => {
    const saved = platform.addGame({ title: 'f', data: 'FAKE\nOne' });
    const store = setupEngines();
    await store.start(String(saved.id));
    store.setTitle('Two');
    await store.flush();
    expect(platform.games[0]!.data).toBe('FAKE\nTwo');
    expect(platform.games[0]!.title).toBe('Two');
    store.updateDoc<{ title: string }>((doc) => {
      doc.title = 'Three';
    });
    expect(store.data()).toBe('FAKE\nThree');
    store.undo();
    expect(store.data()).toBe('FAKE\nTwo');
  });

  it('creates a new game of the chosen engine', async () => {
    const store = setupEngines();
    await store.start();
    await store.create('New one', undefined, 'fake');
    expect(platform.games[0]!.data).toBe('FAKE\nNew one');
    expect(platform.games[0]!.engine).toBe('fake');
    expect(store.engine()?.id).toBe('fake');
    await store.create('Bitsy one', undefined, 'bitsy');
    expect(store.engine()?.id).toBe('bitsy');
  });
});

describe('createProjectStore: the chosen engine (#59)', () => {
  function setupEngines() {
    const transport = createTransport({
      baseUrl: 'https://api.test/api',
      tokens: { getToken: async () => 'good-token' },
      fetch: platform.fetch,
    });
    return createProjectStore({
      engines: createEngineRegistry([bitsyEngine, fakeEngine]),
      profile: createProfileService(transport),
      platform: createPlatformProjects(transport),
      local: createLocalProjects(createMemoryStore()),
      post: () => {},
      notify: () => {},
    });
  }

  it('starts with no engine chosen, and new games use the chosen one', async () => {
    const store = setupEngines();
    await store.start();
    expect(store.getState().engine).toBeNull();
    store.chooseEngine('fake');
    expect(store.getState().engine).toBe('fake');
    await store.create();
    expect(platform.games[0]!.data).toBe('FAKE\nUntitled game');
  });

  it('follows the engine of a game that opens', async () => {
    const saved = platform.addGame({ title: 'f', data: 'FAKE\nf', engine: 'fake' });
    const store = setupEngines();
    await store.start(String(saved.id));
    expect(store.getState().engine).toBe('fake');
  });

  it('going back to the engine choice closes the open game', async () => {
    const saved = platform.addGame({ title: 'f', data: 'FAKE\nf' });
    const store = setupEngines();
    await store.start(String(saved.id));
    await store.chooseEngine(null);
    expect(store.getState().engine).toBeNull();
    expect(store.getState().open.status).toBe('none');
  });

  it('lists the projects of one engine; games with none are Bitsy games', async () => {
    platform.addGame({ title: 'old' });
    platform.addGame({ title: 'beat', data: 'FAKE\nbeat', engine: 'fake' });
    const store = setupEngines();
    await store.start();
    expect(store.projectsOf('fake').map((p) => p.title)).toEqual(['beat']);
    expect(store.projectsOf('bitsy').map((p) => p.title)).toEqual(['old']);
    expect(store.gamesUsed()).toBe(2);
  });
});
