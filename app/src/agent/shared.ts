import { MAX_GAMES, type ProjectSummary } from '../chili-api';
import { fileName, gameFromFile } from '../export/files';
import { NEW_GAME_TITLE } from '../project/store';
import { docOf, editDoc, openGame, replaceDoc, titleOf } from './game';
import { defineAgentTool, type AgentTool } from './types';

// Tools for every engine: projects, the whole game as text, undo and problems.

const none = { type: 'object', properties: {} } as const;
const id = { type: 'string', description: 'The project id, from list_projects.' } as const;

function summary(project: ProjectSummary, defaultEngine: string) {
  return {
    id: project.id,
    title: project.title,
    engine: project.engine ?? defaultEngine,
    released: project.released,
    releaseNumber: project.releaseNumber,
    hasUnreleasedChanges: project.hasUnreleasedChanges,
    updatedAt: project.updatedAt,
  };
}

export const sharedAgentTools: AgentTool[] = [
  defineAgentTool({
    name: 'creator_status',
    title: 'Creator status',
    description:
      'Start here. Says if the person is signed in (games save to the platform) or not (games stay in this browser), ' +
      'how many of their 30 games are used, the open game, whether undo and redo are possible, and the engines with their templates. ' +
      'Every change you make shows in the editor at once and is one undo step for the person.',
    inputSchema: none,
    readOnly: true,
    run: (_input, { creator }) => {
      const state = creator.projects.getState();
      const { open } = state;
      return {
        signedIn: state.mode === 'platform',
        username: state.username ?? null,
        gamesUsed: creator.projects.gamesUsed(),
        gamesLimit: MAX_GAMES,
        editor: state.engine,
        open:
          open.status === 'ready'
            ? {
                id: open.project.id,
                title: titleOf(creator.engines.get(open.engine)!, open.doc),
                engine: open.engine,
                released: open.project.released,
                releaseNumber: open.project.releaseNumber,
                hasUnreleasedChanges: open.project.hasUnreleasedChanges,
              }
            : null,
        save: state.save.state,
        canUndo: state.history.canUndo,
        canRedo: state.history.canRedo,
        engines: creator.engines.offered().map((engine) => ({
          id: engine.id,
          title: engine.title,
          description: engine.description,
          fileExtension: engine.format.extension,
          templates: (engine.templates ?? []).map((t) => t.title),
        })),
      };
    },
  }),

  defineAgentTool<{ engine?: string }>({
    name: 'list_projects',
    title: 'List projects',
    description: 'The person’s games: projects they are making, and released games (which buyers have). Filter by engine id if you like.',
    inputSchema: { type: 'object', properties: { engine: { type: 'string', description: 'An engine id, like "bitsy" or "beat".' } } },
    readOnly: true,
    run: async ({ engine }, { creator }) => {
      await creator.projects.refresh();
      const { list } = creator.projects.getState();
      if (list.status === 'error') throw new Error(`Could not list the games: ${list.error}`);
      const fallback = creator.engines.default().id;
      const pick = (projects: ProjectSummary[]) =>
        projects.map((p) => summary(p, fallback)).filter((p) => engine === undefined || p.engine === engine);
      return { projects: pick(list.projects), released: pick(list.released) };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'open_project',
    title: 'Open project',
    description: 'Opens a game in the editor, after saving the open one. The editor switches to the game’s engine.',
    inputSchema: { type: 'object', properties: { id }, required: ['id'] },
    run: async ({ id }, { creator }) => {
      await creator.projects.open(id);
      const { open } = creator.projects.getState();
      if (open.status === 'error') throw new Error(`Could not open project ${id}: ${open.message}`);
      const { project, engine, doc } = openGame(creator);
      if (project.id !== id) throw new Error('The open game has changes that are not saved yet. Try again in a moment.');
      return { id, title: titleOf(engine, doc), engine: engine.id };
    },
  }),

  defineAgentTool<{ engine?: string; title?: string; template?: string }>({
    name: 'new_game',
    title: 'New game',
    description:
      'Makes a new game and opens it: blank, or from one of the engine’s templates (see creator_status). ' +
      'It counts against the person’s 30 games.',
    inputSchema: {
      type: 'object',
      properties: {
        engine: { type: 'string', description: 'The engine id. The chosen editor’s engine when left out.' },
        title: { type: 'string' },
        template: { type: 'string', description: 'A template title, like "Bee Home".' },
      },
    },
    run: async ({ engine: engineId, title = NEW_GAME_TITLE, template }, { creator }) => {
      const offered = creator.engines.offered();
      const engine = engineId === undefined ? (creator.engines.get(creator.projects.getState().engine ?? undefined) ?? offered[0]!) : offered.find((e) => e.id === engineId);
      if (!engine) throw new Error(`No engine is called "${engineId}". Engines: ${offered.map((e) => e.id).join(', ')}.`);
      let data: string | undefined;
      if (template !== undefined) {
        const templates = engine.templates ?? [];
        const found = templates.find((t) => t.title.toLowerCase() === template.toLowerCase());
        if (!found) {
          const list = templates.length ? `Templates: ${templates.map((t) => t.title).join(', ')}.` : 'It has no templates.';
          throw new Error(`${engine.title} has no template called "${template}". ${list}`);
        }
        data = found.make(title);
      }
      await creator.projects.create(title, data, engine.id);
      const { project, doc } = openGame(creator);
      return { id: project.id, title: titleOf(engine, doc), engine: engine.id };
    },
  }),

  defineAgentTool<{ text: string; fileName?: string }>({
    name: 'import_game',
    title: 'Import game',
    description: 'Makes a new project from a game file’s text: .bitsy, a Bitsy web page (.html) or .beat. Then opens it.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' }, fileName: { type: 'string', description: 'The file name, if there is one.' } },
      required: ['text'],
    },
    run: async ({ text, fileName: name }, { creator }) => {
      const other = creator.engines.list().find((e) => e.id !== 'bitsy' && e.format.detect(text));
      let game: { title: string; data: string; engine: string };
      if (other) {
        const { doc, issues } = other.format.parse(text);
        if (issues.length) throw new Error(issues.map((i) => i.message).join(' '));
        game = { title: titleOf(other, doc), data: text, engine: other.id };
      } else {
        const found = gameFromFile(name ?? 'game.bitsy', text);
        if ('error' in found) throw new Error(found.error);
        game = { ...found, engine: 'bitsy' };
      }
      await creator.projects.create(game.title, game.data, game.engine);
      const { project } = openGame(creator);
      return { id: project.id, title: game.title, engine: game.engine };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'copy_project',
    title: 'Copy project',
    description: 'Makes a copy of a game. The copy counts against the 30 games.',
    inputSchema: { type: 'object', properties: { id }, required: ['id'] },
    run: async ({ id }, { creator }) => {
      await creator.projects.duplicate(id);
      return { ok: true };
    },
  }),

  defineAgentTool<{ id: string }>({
    name: 'delete_project',
    title: 'Delete project',
    description: 'Deletes a game for good. The person is asked first.',
    inputSchema: { type: 'object', properties: { id }, required: ['id'] },
    asksFirst: true,
    run: async ({ id }, { creator, confirm }) => {
      const { list } = creator.projects.getState();
      const project = [...list.projects, ...list.released].find((p) => p.id === id);
      if (!project) throw new Error(`No project has id "${id}". See list_projects.`);
      if (!(await confirm(`Delete “${project.title}”? This cannot be undone.`))) throw new Error('The person said no. Nothing changed.');
      await creator.projects.remove(id);
      return { ok: true };
    },
  }),

  defineAgentTool<{ id?: string }>({
    name: 'release_game',
    title: 'Release game',
    description:
      'Releases a game on the platform so it can be sold, or publishes a released game’s changes as its next release. ' +
      'Buyers get what was last saved. The person is asked first. Needs the person to be signed in.',
    inputSchema: { type: 'object', properties: { id: { ...id, description: 'The project id. The open game when left out.' } } },
    asksFirst: true,
    run: async ({ id: given }, { creator, confirm }) => {
      const { list, open } = creator.projects.getState();
      const id = given ?? (open.status === 'ready' ? open.project.id : undefined);
      if (id === undefined) throw new Error('Say which game to release, or open it first.');
      const project = open.status === 'ready' && open.project.id === id ? open.project : [...list.projects, ...list.released].find((p) => p.id === id);
      if (!project) throw new Error(`No project has id "${id}". See list_projects.`);
      const question = project.released
        ? `Publish your changes to “${project.title}” as release ${(project.releaseNumber ?? 0) + 1}? Buyers and devices get them.`
        : `Release “${project.title}”? It becomes a game you can sell. Buyers get the version you last saved; later changes reach them only when you publish an update.`;
      if (!(await confirm(question))) throw new Error('The person said no. Nothing changed.');
      await creator.projects.release(id);
      const after = creator.projects.getState().list;
      const released = [...after.released, ...after.projects].find((p) => p.id === id)!;
      return { id, released: released.released, releaseNumber: released.releaseNumber, slug: released.slug };
    },
  }),

  defineAgentTool({
    name: 'remove_cover',
    title: 'Remove cover',
    description: 'Takes the cover picture off the open game. Each engine has its own tool to set one.',
    inputSchema: none,
    run: async (_input, { creator }) => {
      openGame(creator);
      await creator.projects.setCover(null);
      return { ok: true };
    },
  }),

  defineAgentTool({
    name: 'close_game',
    title: 'Close game',
    description: 'Saves and closes the open game.',
    inputSchema: none,
    run: async (_input, { creator }) => {
      await creator.projects.close();
      if (creator.projects.getState().open.status !== 'none') throw new Error('The game could not be saved, so it stays open.');
      return { ok: true };
    },
  }),

  defineAgentTool<{ title: string }>({
    name: 'set_title',
    title: 'Set title',
    description: 'Changes the open game’s title.',
    inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    run: ({ title }, { creator }) => {
      const { engine } = openGame(creator);
      editDoc(creator, engine.id, (doc) => engine.setTitle(doc, title));
      return { ok: true };
    },
  }),

  defineAgentTool({
    name: 'get_game_text',
    title: 'Get game text',
    description: 'The whole open game as its file text (.bitsy text, or .beat JSON).',
    inputSchema: none,
    readOnly: true,
    run: (_input, { creator }) => {
      const { engine } = openGame(creator);
      return { engine: engine.id, text: creator.projects.data() };
    },
  }),

  defineAgentTool<{ text: string }>({
    name: 'set_game_text',
    title: 'Set game text',
    description:
      'Replaces the whole open game with new file text of the same engine. Good for big changes. ' +
      'Text that does not read as a game is refused. One undo step.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    run: ({ text }, { creator }) => {
      const { engine } = openGame(creator);
      const { doc, issues } = engine.format.parse(text);
      if (issues.length) throw new Error(`The text is not a good ${engine.title} game: ${issues.map((i) => i.message).join(' ')}`);
      editDoc<object>(creator, engine.id, (current) => replaceDoc(current, doc as object));
      return { ok: true, problems: engine.check(docOf(creator, engine.id)) };
    },
  }),

  defineAgentTool({
    name: 'undo',
    title: 'Undo',
    description: 'Takes back the last change to the open game, yours or the person’s.',
    inputSchema: none,
    run: (_input, { creator }) => {
      openGame(creator);
      if (!creator.projects.undo()) throw new Error('There is nothing to undo.');
      return { ok: true, ...creator.projects.getState().history };
    },
  }),

  defineAgentTool({
    name: 'redo',
    title: 'Redo',
    description: 'Does the last undone change again.',
    inputSchema: none,
    run: (_input, { creator }) => {
      openGame(creator);
      if (!creator.projects.redo()) throw new Error('There is nothing to redo.');
      return { ok: true, ...creator.projects.getState().history };
    },
  }),

  defineAgentTool({
    name: 'list_problems',
    title: 'List problems',
    description: 'Things in the open game that would stop it working as meant, worst first. Check this after making changes.',
    inputSchema: none,
    readOnly: true,
    run: (_input, { creator }) => {
      const { engine, doc } = openGame(creator);
      return { problems: engine.check(doc) };
    },
  }),

  defineAgentTool({
    name: 'download_game_file',
    title: 'Download game file',
    description: 'Gives the person the open game’s file to save (.bitsy or .beat).',
    inputSchema: none,
    run: (_input, { creator, download }) => {
      const { engine, doc } = openGame(creator);
      const name = fileName(titleOf(engine, doc), engine.format.extension.replace(/^\./, ''));
      download(name, creator.projects.data(), 'text/plain');
      return { ok: true, fileName: name };
    },
  }),
];
