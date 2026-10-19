import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry, matchesKeybinding } from './commands';

function key(init: KeyboardEventInit) {
  return new KeyboardEvent('keydown', init);
}

describe('matchesKeybinding', () => {
  it('treats mod as Ctrl or Cmd', () => {
    expect(matchesKeybinding(key({ key: 'k', ctrlKey: true }), 'mod+k')).toBe(true);
    expect(matchesKeybinding(key({ key: 'k', metaKey: true }), 'mod+k')).toBe(true);
    expect(matchesKeybinding(key({ key: 'k' }), 'mod+k')).toBe(false);
  });

  it('needs the exact modifiers', () => {
    expect(matchesKeybinding(key({ key: 'Z', ctrlKey: true, shiftKey: true }), 'mod+shift+z')).toBe(true);
    expect(matchesKeybinding(key({ key: 'z', ctrlKey: true, shiftKey: true }), 'mod+z')).toBe(false);
    expect(matchesKeybinding(key({ key: 'p', altKey: true }), 'alt+p')).toBe(true);
  });
});

describe('createCommandRegistry', () => {
  it('runs a command by id', () => {
    const commands = createCommandRegistry();
    const run = vi.fn();
    commands.register({ id: 'layout.reset', title: 'Reset layout', run });
    expect(commands.execute('layout.reset')).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it('reports a command that does not exist or is turned off', () => {
    const commands = createCommandRegistry();
    const run = vi.fn();
    commands.register({ id: 'play.toggle', title: 'Play', run, enabled: () => false });
    expect(commands.execute('missing')).toBe(false);
    expect(commands.execute('play.toggle')).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the command bound to a key press', () => {
    const commands = createCommandRegistry();
    const run = vi.fn();
    commands.register({ id: 'palette.open', title: 'Commands', keybinding: 'mod+k', run });
    expect(commands.handleKeydown(key({ key: 'k', ctrlKey: true }))).toBe(true);
    expect(commands.handleKeydown(key({ key: 'j', ctrlKey: true }))).toBe(false);
    expect(run).toHaveBeenCalledOnce();
  });
});
