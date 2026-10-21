import { Copy, FolderOpen, Gamepad2, LayoutGrid, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { MAX_GAMES, type ProjectSummary } from '../../chili-api';
import { defineTool } from '../../plugin-api';
import { useCreator, useProjects } from '../../shell/creator-context';
import { gameFromFile } from '../../export/files';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function Cover({ project }: { project: ProjectSummary }) {
  return (
    <div className="grid aspect-square w-14 shrink-0 place-items-center overflow-hidden rounded border border-line bg-bg-0">
      {project.cover ? (
        <img src={project.cover} alt="" className="size-full object-cover [image-rendering:pixelated]" />
      ) : (
        <Gamepad2 className="size-5 text-muted" aria-hidden />
      )}
    </div>
  );
}

interface RowProps {
  project: ProjectSummary;
  open: boolean;
  onOpen(): void;
  onDuplicate?(): void;
  onDelete?(): Promise<void>;
}

function ProjectRow({ project, open, onOpen, onDuplicate, onDelete }: RowProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await onDelete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-line bg-bg-2 p-3 data-[open=true]:border-chili/60" data-open={open}>
      <div className="flex items-center gap-3">
        <Cover project={project} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{project.title}</p>
          <p className="text-xs text-muted">
            {project.released ? 'Released' : 'Edited'} {when(project.updatedAt)}
            {open && <span className="text-chili"> · open</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="secondary" onClick={onOpen} aria-label={`Open ${project.title}`}>
            <FolderOpen />
            <span className="hidden sm:inline">Open</span>
          </Button>
          {onDuplicate && (
            <Button size="icon" variant="ghost" onClick={onDuplicate} aria-label={`Duplicate ${project.title}`} title="Duplicate">
              <Copy />
            </Button>
          )}
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${project.title}`}
              title="Delete"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
          <span className="mr-auto">Delete “{project.title}”? This cannot be undone.</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Keep it
          </Button>
          <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
            Delete for good
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-chili">
          {error}
        </p>
      )}
    </li>
  );
}

function Projects() {
  const creator = useCreator();
  const state = useProjects();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const openId = state.open.status === 'ready' ? state.open.project.id : null;
  const used = creator.projects.gamesUsed();
  const atLimit = state.mode === 'platform' && used >= MAX_GAMES;

  async function act(action: () => Promise<void>) {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function importFile(file: File) {
    const game = gameFromFile(file.name, await file.text());
    if ('error' in game) {
      setError(game.error);
      return;
    }
    setCreating(true);
    await act(() => creator.projects.create(game.title, game.data));
    setCreating(false);
  }

  async function create() {
    setCreating(true);
    await act(() => creator.projects.create());
    setCreating(false);
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h1 className="font-display text-2xl font-bold">Your games</h1>
            <p className="text-sm text-muted">
              {state.mode === 'local' &&
                'Not signed in: games are saved in this browser only. Sign in on Chili Platform to keep them on your account.'}
              {state.mode === 'platform' && `${used} of ${MAX_GAMES} games`}
              {state.mode === 'unknown' && 'Loading…'}
            </p>
          </div>
          <Button asChild variant="secondary">
            <label
              title="Open a .bitsy file or a game page exported from Bitsy as a new game"
              className={cn(
                'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-phosphor',
                (creating || atLimit || state.mode === 'unknown') && 'pointer-events-none opacity-50',
              )}
            >
              <Upload />
              Import
              <input
                type="file"
                aria-label="Import a game"
                accept=".bitsy,.txt,.html,.htm,text/plain,text/html"
                className="sr-only"
                disabled={creating || atLimit || state.mode === 'unknown'}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void importFile(file);
                }}
              />
            </label>
          </Button>
          <Button variant="primary" onClick={create} disabled={creating || atLimit || state.mode === 'unknown'}>
            <Plus />
            New game
          </Button>
        </div>

        {atLimit && (
          <p className="rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
            You can keep {MAX_GAMES} games, released ones included. Delete a project to start a new one.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-chili/40 bg-chili/10 p-3 text-sm text-chili">
            {error}
          </p>
        )}
        {state.list.status === 'error' && (
          <p role="alert" className="text-sm text-chili">
            Could not load your games: {state.list.error}{' '}
            <button className="underline" onClick={() => void creator.projects.refresh()}>
              Try again
            </button>
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">Projects</h2>
          {state.list.status === 'ready' && state.list.projects.length === 0 && (
            <p className="text-sm text-muted">No projects yet.</p>
          )}
          <ul aria-label="Projects" className="space-y-2">
            {state.list.projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                open={project.id === openId}
                onOpen={() => void creator.projects.open(project.id)}
                onDuplicate={atLimit ? undefined : () => void act(() => creator.projects.duplicate(project.id))}
                onDelete={() => creator.projects.remove(project.id)}
              />
            ))}
          </ul>
        </section>

        {state.list.released.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">Released</h2>
            <p className="text-sm text-muted">Saved edits to a released game reach its players.</p>
            <ul aria-label="Released games" className="space-y-2">
              {state.list.released.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  open={project.id === openId}
                  onOpen={() => void creator.projects.open(project.id)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default defineTool({
  id: 'projects',
  title: 'Projects',
  icon: LayoutGrid,
  component: Projects,
  defaultPosition: 'center',
  openByDefault: true,
});
