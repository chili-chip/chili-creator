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

  it('can bind more than one key press', () => {
    const commands = createCommandRegistry();
    const run = vi.fn();
    commands.register({ id: 'edit.redo', title: 'Redo', keybinding: ['mod+shift+z', 'mod+y'], run });
    expect(commands.handleKeydown(key({ key: 'y', ctrlKey: true }))).toBe(true);
    expect(commands.handleKeydown(key({ key: 'Z', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('leaves key presses alone while someone types in a field, unless the command asks for them', () => {
    const commands = createCommandRegistry();
    const undo = vi.fn();
    const palette = vi.fn();
    commands.register({ id: 'edit.undo', title: 'Undo', keybinding: 'mod+z', run: undo });
    commands.register({ id: 'paint.fill', title: 'Fill', keybinding: 'f', run: undo });
    commands.register({ id: 'palette.open', title: 'Commands', keybinding: 'mod+k', whileTyping: true, run: palette });
    const field = document.createElement('input');
    document.body.append(field);
    const typed = (init: KeyboardEventInit) => {
      const event = key(init);
      Object.defineProperty(event, 'target', { value: field });
      return event;
    };
    expect(commands.handleKeydown(typed({ key: 'z', ctrlKey: true }))).toBe(false);
    expect(commands.handleKeydown(typed({ key: 'f' }))).toBe(false);
    expect(commands.handleKeydown(typed({ key: 'k', ctrlKey: true }))).toBe(true);
    expect(undo).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledOnce();
    field.remove();
  });
});
