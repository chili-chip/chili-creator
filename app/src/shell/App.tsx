import type { DockviewApi } from 'dockview-react';
import { Command, ExternalLink, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Creator } from '../creator';
import { Button } from '../ui/button';
import { classicEditorUrl } from './classic';
import { CommandPalette } from './CommandPalette';
import { clearLayout } from './layout-storage';
import { useProfile } from './use-profile';
import { useRegistry } from './use-registry';
import { openDefaultTools, openTool, Workspace } from './Workspace';

export function App({ creator }: { creator: Creator }) {
  const tools = useRegistry(creator.tools);
  const commands = useRegistry(creator.commands);
  const profile = useProfile(creator.profile);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const dock = useRef<DockviewApi | null>(null);

  // Shell commands. Tools contribute their own the same way.
  useEffect(() => {
    const unregister = [
      creator.commands.register({
        id: 'palette.open',
        title: 'Show all commands',
        keybinding: 'mod+k',
        run: () => setPaletteOpen(true),
      }),
      creator.commands.register({
        id: 'layout.reset',
        title: 'Reset layout',
        category: 'Layout',
        run: () => {
          clearLayout();
          if (dock.current) openDefaultTools(dock.current, creator.tools.list());
        },
      }),
    ];
    return () => unregister.forEach((fn) => fn());
  }, [creator]);

  useEffect(() => {
    const unregister = tools.map((tool) =>
      creator.commands.register({
        id: `tool.open.${tool.id}`,
        title: `Open ${tool.title}`,
        category: 'Tools',
        run: () => dock.current && openTool(dock.current, tool),
      }),
    );
    return () => unregister.forEach((fn) => fn());
  }, [creator, tools]);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (creator.commands.handleKeydown(event)) {
        event.preventDefault();
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [creator]);

  return (
    <div className="grid h-full grid-cols-[auto_1fr] grid-rows-[auto_1fr_auto]">
      <header className="col-span-2 flex h-12 items-center gap-3 border-b border-line bg-bg-2 px-3">
        <span className="font-display text-base font-bold whitespace-nowrap">
          Chili <span className="text-chili">Creator</span>
        </span>
        <span className="hidden rounded border border-amber/40 px-1.5 py-0.5 text-[10px] tracking-widest text-amber sm:inline">
          PREVIEW
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            aria-label="Show all commands"
          >
            <Command />
            <span className="hidden sm:inline">Commands</span>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={classicEditorUrl()} aria-label="Classic editor">
              <ExternalLink />
              <span className="hidden sm:inline">Classic editor</span>
            </a>
          </Button>
          <span className="flex min-w-0 items-center gap-2 border-l border-line pl-3 text-xs whitespace-nowrap text-muted">
            <UserRound className="size-4" />
            {profile.status === 'signed-in' && (
              <span className="max-w-32 truncate text-text">{profile.profile.displayName}</span>
            )}
            {profile.status === 'signed-out' && <span>Not signed in</span>}
            {profile.status === 'loading' && <span>…</span>}
          </span>
        </div>
      </header>

      <nav aria-label="Tools" className="flex w-12 flex-col items-center gap-1 border-r border-line bg-bg-2 py-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              variant="ghost"
              size="icon"
              aria-label={tool.title}
              title={tool.title}
              onClick={() => dock.current && openTool(dock.current, tool)}
            >
              <Icon />
            </Button>
          );
        })}
      </nav>

      <main className="min-h-0 min-w-0">
        <Workspace tools={tools} onReady={(api) => (dock.current = api)} />
      </main>

      <footer className="col-span-2 flex h-6 items-center gap-4 border-t border-line bg-bg-2 px-3 text-[11px] text-muted">
        <span>{creator.bridge.embedded ? 'In Chili Platform' : 'Standalone'}</span>
        <span className="ml-auto hidden sm:inline">Ctrl+K for commands</span>
      </footer>

      {paletteOpen && (
        <CommandPalette
          commands={commands.filter((command) => command.id !== 'palette.open')}
          onRun={(id) => creator.commands.execute(id)}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
