import { createRegistry, type Registry } from './registry';

export interface CommandDefinition {
  id: string;
  title: string;
  /** Shown next to the title in the command palette, e.g. "Layout". */
  category?: string;
  /** Like "mod+k" or "mod+shift+z"; `mod` is Ctrl, or Cmd on a Mac. */
  keybinding?: string | readonly string[];
  /** Runs from its keys even while someone types in a field (most commands wait). */
  whileTyping?: boolean;
  enabled?: () => boolean;
  run: () => void;
}

export interface CommandRegistry extends Registry<CommandDefinition> {
  /** Runs a command; false when it does not exist or is turned off. */
  execute(id: string): boolean;
  /** Runs the command bound to this key press; true when one ran. */
  handleKeydown(event: KeyboardEvent): boolean;
}

export function matchesKeybinding(event: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+');
  const key = parts.pop();
  const wants = new Set(parts);
  const mod = event.ctrlKey || event.metaKey;
  return (
    event.key.toLowerCase() === key &&
    mod === wants.has('mod') &&
    event.shiftKey === wants.has('shift') &&
    event.altKey === wants.has('alt')
  );
}

export function keybindingsOf(command: CommandDefinition): readonly string[] {
  const { keybinding } = command;
  return keybinding === undefined ? [] : typeof keybinding === 'string' ? [keybinding] : keybinding;
}

/** Text fields keep their own keys: Ctrl+Z there undoes typing, not the game. */
function typing(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.closest !== 'function') return false;
  if (target.isContentEditable) return true;
  const field = target.closest('input, textarea, select');
  if (!field) return false;
  const type = (field as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'color', 'range', 'submit'].includes(type);
}

export function createCommandRegistry(): CommandRegistry {
  const registry = createRegistry<CommandDefinition>('command');

  function execute(id: string): boolean {
    const command = registry.get(id);
    if (!command || (command.enabled && !command.enabled())) {
      return false;
    }
    command.run();
    return true;
  }

  return {
    ...registry,
    execute,
    handleKeydown(event) {
      const inField = typing(event);
      const command = registry
        .list()
        .find(
          (item) =>
            (item.whileTyping || !inField) &&
            keybindingsOf(item).some((binding) => matchesKeybinding(event, binding)),
        );
      return command ? execute(command.id) : false;
    },
  };
}
