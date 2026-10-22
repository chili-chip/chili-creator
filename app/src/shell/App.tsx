import type { DockviewApi } from 'dockview-react';
import { AlertTriangle, CircleCheck, Command, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { problemSummary, validate } from '../bitsy';
import { Toaster } from 'sonner';
import type { Creator } from '../creator';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import { Select } from '../ui/input';
import { CommandPalette } from './CommandPalette';
import { CreatorProvider, useI18nState, useProjects, useT, useWorld } from './creator-context';
import { clearLayout } from './layout-storage';
import { PhoneWorkspace } from './PhoneWorkspace';
import { applyPreset, layoutPresets } from './presets';
import { ProjectBar } from './ProjectBar';
import { Help } from './Help';
import { Tour, tourDone } from './Tour';
import { PHONE, useMediaQuery } from './use-media-query';
import { useRegistry } from './use-registry';
import { openDefaultTools, openTool, showTool, Workspace } from './Workspace';

export function App({ creator }: { creator: Creator }) {
  return (
    <CreatorProvider value={creator}>
      <Shell creator={creator} />
    </CreatorProvider>
  );
}

function Account() {
  const projects = useProjects();
  return (
    <span className="flex min-w-0 items-center gap-2 border-l border-line pl-3 text-xs whitespace-nowrap text-muted">
      <UserRound className="size-4" />
      {projects.profile && <span className="max-w-32 truncate text-text">{projects.profile.displayName}</span>}
      {projects.mode === 'local' && <span>Not signed in</span>}
      {projects.mode === 'unknown' && <span>…</span>}
    </span>
  );
}

/** The open game's problem count; it opens the Problems tool. */
function ProblemCount({ onOpen }: { onOpen(): void }) {
  const world = useWorld();
  const problems = useMemo(() => (world ? validate(world) : []), [world]);
  if (!world) return null;
  const summary = problemSummary(problems);
  return (
    <button
      type="button"
      aria-label={`Problems: ${summary || 'none'}`}
      onClick={onOpen}
      className="flex items-center gap-1 hover:text-text [&_svg]:size-3"
    >
      {problems.length ? <AlertTriangle className="text-amber" aria-hidden /> : <CircleCheck aria-hidden />}
      {summary || 'No problems'}
    </button>
  );
}

function Shell({ creator }: { creator: Creator }) {
  const t = useT();
  const { language } = useI18nState();
  const tools = useRegistry(creator.tools);
  const commands = useRegistry(creator.commands);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [touring, setTouring] = useState(() => creator.tour && !tourDone());
  const [helping, setHelping] = useState(false);
  const dock = useRef<DockviewApi | null>(null);
  const phone = useMediaQuery(PHONE);
  const [phoneTool, setPhoneTool] = useState('projects');
  const isPhone = useRef(phone);
  isPhone.current = phone;

  /** Opens a tool: in front on a phone, as a docked panel elsewhere. */
  const open = useCallback(
    (id: string) => {
      if (isPhone.current) {
        if (creator.tools.list().some((tool) => tool.id === id)) setPhoneTool(id);
        return;
      }
      const tool = creator.tools.list().find((t) => t.id === id);
      if (tool && dock.current) openTool(dock.current, tool);
    },
    [creator],
  );

  // Shell commands. Tools contribute their own the same way.
  useEffect(() => {
    const unregister = [
      creator.commands.register({
        id: 'palette.open',
        title: 'Show all commands',
        keybinding: 'mod+k',
        whileTyping: true,
        run: () => setPaletteOpen(true),
      }),
      creator.commands.register({
        id: 'layout.reset',
        title: 'Reset layout',
        category: 'Layout',
        run: () => {
          clearLayout();
          if (dock.current && !isPhone.current) openDefaultTools(dock.current, creator.tools.list());
        },
      }),
      ...layoutPresets.map((preset) =>
        creator.commands.register({
          id: `layout.preset.${preset.id}`,
          title: `Layout: ${preset.title}`,
          category: 'Layout',
          run: () => {
            if (dock.current && !isPhone.current) applyPreset(dock.current, preset.id, creator.tools.list());
          },
        }),
      ),
      creator.commands.register({
        id: 'help.tour',
        title: 'Take the tour',
        category: 'Help',
        run: () => setTouring(true),
      }),
      creator.commands.register({
        id: 'help.open',
        title: 'What each tool does',
        category: 'Help',
        run: () => setHelping(true),
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
        run: () => open(tool.id),
      }),
    );
    return () => unregister.forEach((fn) => fn());
  }, [creator, tools, open]);

  // An opened game shows its room; closing it goes back to the dashboard.
  useEffect(() => {
    // Undefined until the first change, so a restored layout starts on the dashboard too.
    let shown: string | null | undefined;
    return creator.projects.subscribe(() => {
      const { open } = creator.projects.getState();
      const id = open.status === 'ready' ? open.project.id : null;
      if (id === shown) return;
      shown = id;
      if (isPhone.current) setPhoneTool(id ? 'room' : 'projects');
      else if (dock.current) showTool(dock.current, id ? 'room' : 'projects');
    });
  }, [creator]);

  // Load projects (and the one the platform asked for), and keep work safe.
  useEffect(() => {
    void creator.projects.start(creator.initialProject);
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!creator.projects.hasUnsavedWork()) return;
      creator.projects.flush().catch(() => {});
      event.preventDefault();
    }
    function onOnline() {
      if (creator.projects.getState().save.state === 'error') creator.projects.retrySave().catch(() => {});
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('online', onOnline);
    };
  }, [creator]);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (creator.commands.handleKeydown(event)) {
        event.preventDefault();
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [creator]);

  // The tool in front stays in sight on the phone's sliding tool bar.
  useEffect(() => {
    if (phone) document.querySelector('nav[aria-label="Tools"] [aria-current="page"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [phone, phoneTool]);

  const toolBar = (
    <nav
      aria-label="Tools"
      data-tour="tools"
      className={cn(
        'flex bg-bg-2',
        phone
          ? 'order-last h-14 items-stretch gap-0.5 overflow-x-auto border-t border-line px-1 pb-[env(safe-area-inset-bottom)]'
          : 'w-12 flex-col items-center gap-1 overflow-y-auto border-r border-line py-2',
      )}
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        const current = phone && tool.id === phoneTool;
        return (
          <Button
            key={tool.id}
            variant="ghost"
            size={phone ? 'sm' : 'icon'}
            aria-label={t(tool.title)}
            aria-current={current ? 'page' : undefined}
            title={t(tool.title)}
            className={cn(phone && 'h-full min-w-16 shrink-0 flex-col gap-0.5 px-1 text-[10px]', current && 'bg-bg-3 text-text')}
            onClick={() => open(tool.id)}
          >
            <Icon />
            {phone && <span className="max-w-16 truncate">{t(tool.title)}</span>}
          </Button>
        );
      })}
    </nav>
  );

  return (
    <div className={cn('grid h-full', phone ? 'grid-rows-[auto_1fr_auto_auto]' : 'grid-cols-[auto_1fr] grid-rows-[auto_1fr_auto]')}>
      <header className={cn('flex h-12 items-center gap-3 border-b border-line bg-bg-2 px-3', !phone && 'col-span-2')}>
        <span className="font-display text-base font-bold whitespace-nowrap">
          {phone ? (
            <>
              <span className="text-chili" aria-hidden>
                C
              </span>
              <span className="sr-only">Chili Creator</span>
            </>
          ) : (
            <>
              Chili <span className="text-chili">Creator</span>
            </>
          )}
        </span>
        <span className="hidden rounded border border-amber/40 px-1.5 py-0.5 text-[10px] tracking-widest text-amber sm:inline">
          PREVIEW
        </span>
        <ProjectBar />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            aria-label="Show all commands"
            data-tour="commands"
            // Phones have no keyboard shortcuts to look up; the tools have the same buttons.
            className="hidden sm:inline-flex"
          >
            <Command />
            <span className="hidden sm:inline">Commands</span>
          </Button>
          <Account />
        </div>
      </header>

      {!phone && toolBar}

      <main className="min-h-0 min-w-0" data-tour="workspace">
        {phone ? <PhoneWorkspace tools={tools} current={phoneTool} /> : <Workspace tools={tools} onReady={(api) => (dock.current = api)} />}
      </main>

      <footer className={cn('flex h-6 items-center gap-4 border-t border-line bg-bg-2 px-3 text-[11px] text-muted', !phone && 'col-span-2')}>
        <span>{creator.bridge.embedded ? 'In Chili Platform' : 'Standalone'}</span>
        <ProblemCount onOpen={() => creator.commands.execute('tool.open.problems')} />
        <button type="button" className="hover:text-text" onClick={() => setHelping((h) => !h)}>
          {t('Help')}
        </button>
        {creator.i18n.languages().length > 1 && (
          <Select
            aria-label={t('Language')}
            value={language}
            className="h-5 py-0 text-[11px]"
            onChange={(event) => void creator.i18n.setLanguage(event.target.value)}
          >
            {creator.i18n.languages().map((l) => (
              <option key={l.id} value={l.id} lang={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
        {!phone && (
          <>
            <Select
              aria-label="Layout"
              value=""
              className="ml-auto h-5 py-0 text-[11px]"
              onChange={(event) => event.target.value && creator.commands.execute(`layout.preset.${event.target.value}`)}
            >
              <option value="">Choose a layout</option>
              {layoutPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title}
                </option>
              ))}
            </Select>
            <span>Ctrl+K for commands</span>
          </>
        )}
      </footer>

      {phone && toolBar}

      {!creator.bridge.embedded && <Toaster theme="dark" position={phone ? 'top-center' : 'bottom-right'} />}

      {helping && (
        <Help
          tools={tools}
          phone={phone}
          onOpenTool={(id) => {
            setHelping(false);
            open(id);
          }}
          onTour={() => {
            setHelping(false);
            setTouring(true);
          }}
          onClose={() => setHelping(false)}
        />
      )}

      {touring && <Tour phone={phone} onOpenTool={open} onClose={() => setTouring(false)} />}

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
