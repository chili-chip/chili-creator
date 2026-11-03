import { describe, expect, it } from 'vitest';
import { blankGame as blankBeat } from '../engines/beat/model';
import { agentCreator, blankGame } from '../test/agent';

describe('shared agent tools', () => {
  it('registers the shared tools and every engine’s tools when the browser has WebMCP', async () => {
    const { modelContext } = await agentCreator();
    const names = [...modelContext.tools.keys()];
    expect(names).toEqual(expect.arrayContaining(['creator_status', 'list_projects', 'new_game', 'bitsy_get_world', 'beat_set_game']));
  });

  it('creator_status tells where games are kept, the open game and the engines', async () => {
    const { call } = await agentCreator({ data: blankGame });
    const status = await call('creator_status');
    expect(status).toMatchObject({
      signedIn: true,
      gamesUsed: 1,
      gamesLimit: 30,
      open: { title: 'Test game', engine: 'bitsy', released: false },
      canUndo: false,
    });
    expect(status.engines.map((e: { id: string }) => e.id)).toEqual(['bitsy', 'beat']);
    expect(status.engines[1].templates).toEqual(['Bee Home', 'Crate Puzzle', 'Garden Toy']);
  });

  it('new_game makes a game of an engine, from a template, and opens it', async () => {
    const { call, doc, creator } = await agentCreator();
    const made = await call('new_game', { engine: 'beat', title: 'Bees', template: 'Bee Home' });
    expect(made).toMatchObject({ title: 'Bees', engine: 'beat' });
    expect(creator.projects.getState().engine).toBe('beat');
    expect(doc<{ title: string; things: unknown[] }>().title).toBe('Bees');
    expect(doc<{ things: unknown[] }>().things.length).toBeGreaterThan(2);
    expect(await call('new_game', { engine: 'beat', template: 'Nope' })).toEqual({
      error: 'Chili Beat has no template called "Nope". Templates: Bee Home, Crate Puzzle, Garden Toy.',
    });
    expect(await call('new_game', { engine: 'zx' })).toEqual({ error: 'No engine is called "zx". Engines: bitsy, beat.' });
  });

  it('list_projects, open_project, copy_project and close_game work on the person’s games', async () => {
    const { call, platform, creator } = await agentCreator();
    const other = platform.addGame({ title: 'Other', data: blankBeat('Other'), engine: 'beat' });
    const listed = await call('list_projects');
    expect(listed.projects).toEqual([expect.objectContaining({ id: String(other.id), title: 'Other', engine: 'beat' })]);
    expect(await call('open_project', { id: String(other.id) })).toMatchObject({ title: 'Other', engine: 'beat' });
    expect(await call('copy_project', { id: String(other.id) })).toMatchObject({ ok: true });
    expect((await call('list_projects')).projects).toHaveLength(2);
    await call('close_game');
    expect(creator.projects.getState().open.status).toBe('none');
    expect(await call('open_project', { id: '999' })).toMatchObject({ error: expect.stringContaining('999') });
  });

  it('delete_project asks the person first and keeps the game when they say no', async () => {
    const no = await agentCreator({ data: blankGame, answer: false });
    const id = String(no.game!.id);
    expect(await no.call('delete_project', { id })).toEqual({ error: 'The person said no. Nothing changed.' });
    expect(no.confirm).toHaveBeenCalledWith('Delete “Test game”? This cannot be undone.');
    expect(no.platform.games).toHaveLength(1);

    const yes = await agentCreator({ data: blankGame });
    expect(await yes.call('delete_project', { id: String(yes.game!.id) })).toEqual({ ok: true });
    expect(yes.creator.projects.getState().list.projects).toHaveLength(0);
  });

  it('release_game asks first, then releases the open game', async () => {
    const { call, confirm, creator } = await agentCreator({ data: blankGame });
    const released = await call('release_game');
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Release “Test game”?'));
    expect(released).toMatchObject({ released: true, releaseNumber: 1 });
    const { open } = creator.projects.getState();
    expect(open.status === 'ready' && open.project.released).toBe(true);
  });

  it('set_title, undo and redo change the open game as one step each', async () => {
    const { call, doc } = await agentCreator({ data: blankGame });
    await call('set_title', { title: 'Tea time' });
    expect(doc().title).toBe('Tea time');
    expect(await call('undo')).toEqual({ ok: true, canUndo: false, canRedo: true });
    expect(doc().title).toBe('Test game');
    await call('redo');
    expect(doc().title).toBe('Tea time');
    expect(await call('redo')).toEqual({ error: 'There is nothing to redo.' });
  });

  it('get_game_text and set_game_text read and replace the whole game, refusing text that does not parse', async () => {
    const { call, doc } = await agentCreator({ data: blankGame });
    const { engine, text } = await call('get_game_text');
    expect(engine).toBe('bitsy');
    expect(text).toContain('# BITSY VERSION');
    expect(await call('set_game_text', { text: text.replace('Test game', 'Replaced') })).toMatchObject({ ok: true });
    expect(doc().title).toBe('Replaced');

    const beat = await agentCreator({ data: blankBeat('B') });
    expect(await beat.call('set_game_text', { text: '{"format":"nope"}' })).toEqual({
      error: 'The text is not a good Chili Beat game: This is not a Chili Beat game.',
    });
    await beat.call('undo');
    expect(await beat.call('undo')).toEqual({ error: 'There is nothing to undo.' });
  });

  it('list_problems gives the open game’s problems', async () => {
    const { call } = await agentCreator({ data: blankBeat('B') });
    const { problems } = await call('list_problems');
    expect(problems).toEqual([{ severity: 'info', message: 'No rule wins or loses. That is fine for a toy.' }]);
  });

  it('import_game makes a project from .bitsy text, a Bitsy page or .beat text', async () => {
    const { call, doc } = await agentCreator();
    expect(await call('import_game', { text: blankBeat('Imported bees') })).toMatchObject({ title: 'Imported bees', engine: 'beat' });
    expect(await call('import_game', { text: blankGame, fileName: 'tea.bitsy' })).toMatchObject({ title: 'Test game', engine: 'bitsy' });
    expect(doc().title).toBe('Test game');
    expect(await call('import_game', { text: 'hello', fileName: 'x.txt' })).toEqual({ error: 'x.txt has no Bitsy game in it.' });
  });

  it('download_game_file hands the person the game file', async () => {
    const { call, download } = await agentCreator({ data: blankGame });
    expect(await call('download_game_file')).toEqual({ ok: true, fileName: 'Test game.bitsy' });
    expect(download).toHaveBeenCalledWith('Test game.bitsy', expect.stringContaining('# BITSY VERSION'), 'text/plain');
  });

  it('tools that need a game say so when none is open', async () => {
    const { call } = await agentCreator();
    expect(await call('get_game_text')).toEqual({ error: 'No game is open. Open one with open_project or make one with new_game.' });
  });

  it('registers nothing when the browser has no WebMCP', async () => {
    const { creator } = await agentCreator({ modelContext: null });
    expect(creator.projects.getState().mode).toBe('platform');
  });
});
