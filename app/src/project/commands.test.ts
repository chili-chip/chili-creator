import { describe, expect, it } from 'vitest';
import { createCommandRegistry } from '../plugin-api';
import { blankGame } from '../test/creator';
import { createCreator } from '../creator';
import { createMemoryStore } from '../chili-api';
import { createFakePlatform } from '../chili-api/fake-platform';
import { editingCommands } from './commands';

async function setup() {
  localStorage.setItem('chili.accessToken', 'good-token');
  const platform = createFakePlatform();
  const game = platform.addGame({ title: 'Test game', data: blankGame });
  const creator = createCreator({
    apiBase: 'https://api.test/api',
    parent: null,
    origin: 'http://localhost',
    fetch: platform.fetch,
    localStore: createMemoryStore(),
  });
  await creator.projects.start(String(game.id));
  const commands = createCommandRegistry();
  editingCommands(creator).forEach((command) => commands.register(command));
  const press = (init: KeyboardEventInit) => commands.handleKeydown(new KeyboardEvent('keydown', init));
  return { creator, commands, press };
}

describe('editingCommands', () => {
  it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z or Ctrl+Y, only when there is something to do', async () => {
    const { creator, press } = await setup();
    expect(press({ key: 'z', ctrlKey: true })).toBe(false);
    creator.projects.setTitle('New');
    expect(press({ key: 'z', ctrlKey: true })).toBe(true);
    expect(creator.projects.getState().history.canUndo).toBe(false);
    expect(press({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: 'z', metaKey: true })).toBe(true);
    expect(press({ key: 'y', ctrlKey: true })).toBe(true);
    expect(creator.projects.getState().history.canRedo).toBe(false);
  });

  it('switches paint and room tools with single keys', async () => {
    const { creator, press } = await setup();
    press({ key: 'f' });
    expect(creator.editor.getState().paintTool).toBe('fill');
    press({ key: 'b' });
    expect(creator.editor.getState().paintTool).toBe('pencil');
    press({ key: 'e' });
    expect(creator.editor.getState().roomTool).toBe('erase');
    press({ key: 'p' });
    expect(creator.editor.getState().roomTool).toBe('place');
  });

  it('is part of every creator', async () => {
    const { creator } = await setup();
    expect(creator.commands.get('edit.undo')).toBeDefined();
  });
});
