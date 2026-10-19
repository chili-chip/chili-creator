import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommandDefinition } from '../plugin-api';
import { cn } from '../ui/cn';

interface CommandPaletteProps {
  commands: readonly CommandDefinition[];
  onRun: (id: string) => void;
  onClose: () => void;
}

function label(command: CommandDefinition) {
  return command.category ? `${command.category}: ${command.title}` : command.title;
}

/** Every command in one searchable list (Ctrl+K / Cmd+K). */
export function CommandPalette({ commands, onRun, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return commands.filter(
      (command) =>
        (!command.enabled || command.enabled()) && label(command).toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => setActive(0), [query]);

  function run(command: CommandDefinition | undefined) {
    if (command) {
      onClose();
      onRun(command.id);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Commands"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-bg-1 shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            run(matches[active]);
          }
        }}
      >
        <input
          ref={input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a command"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted"
        />
        <ul id="command-list" role="listbox" className="max-h-80 overflow-auto p-1">
          {matches.map((command, index) => (
            <li
              key={command.id}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => run(command)}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm',
                index === active ? 'bg-bg-3 text-text' : 'text-muted',
              )}
            >
              <span>{label(command)}</span>
              {command.keybinding && (
                <kbd className="text-[11px] text-muted">{command.keybinding.replace('mod', 'Ctrl')}</kbd>
              )}
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 py-6 text-center text-muted">No commands match</li>}
        </ul>
      </div>
    </div>
  );
}
