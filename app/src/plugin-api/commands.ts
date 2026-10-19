import { createRegistry, type Registry } from './registry';

export interface CommandDefinition {
  id: string;
  title: string;
  /** Shown next to the title in the command palette, e.g. "Layout". */
  category?: string;
  /** Like "mod+k" or "mod+shift+z"; `mod` is Ctrl, or Cmd on a Mac. */
  keybinding?: string;
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
      const command = registry
        .list()
        .find((item) => item.keybinding && matchesKeybinding(event, item.keybinding));
      return command ? execute(command.id) : false;
    },
  };
}
