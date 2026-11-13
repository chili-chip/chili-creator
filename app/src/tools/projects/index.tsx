import { Copy, ExternalLink, FolderOpen, Gamepad2, LayoutGrid, Plus, Rocket, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { AI_USE_HELP_URL, AI_USE_KINDS, aiUseLabel, type AiUseKind, MAX_GAMES, type ProjectSummary } from '../../chili-api';
import { defineTool } from '../../plugin-api';
import { useCreator, useProjects, useT } from '../../shell/creator-context';
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

/** The answer being given: null until the person ticks something. */
type AiAnswer = { none: boolean; kinds: AiUseKind[] };

function answered(answer: AiAnswer): AiUseKind[] | null {
  if (answer.none) return [];
  return answer.kinds.length ? answer.kinds : null;
}

/** "Did you use generative AI?" (chili-platform#179): No AI, or the kinds. The platform needs it to release. */
function AiQuestion({ answer, onChange }: { answer: AiAnswer; onChange(answer: AiAnswer): void }) {
  function kind(value: AiUseKind, checked: boolean) {
    const chosen = new Set(answer.kinds);
    if (checked) chosen.add(value);
    else chosen.delete(value);
    onChange({ none: false, kinds: AI_USE_KINDS.map((k) => k.value).filter((k) => chosen.has(k)) });
  }
  return (
    <fieldset className="w-full space-y-1">
      <legend className="font-medium">Did you use generative AI?</legend>
      <p className="text-xs text-muted">
        Players see your answer and can filter for No AI. Spell check and plain editor tools do not count.{' '}
        <a className="underline" href={AI_USE_HELP_URL} target="_blank" rel="noreferrer">
          What counts
        </a>
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={answer.none}
            onChange={(event) => onChange({ none: event.target.checked, kinds: [] })}
          />
          No AI
        </label>
        {AI_USE_KINDS.map((item) => (
          <label key={item.value} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={answer.kinds.includes(item.value)}
              onChange={(event) => kind(item.value, event.target.checked)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface RowProps {
  project: ProjectSummary;
  open: boolean;
  onOpen(): void;
  onDuplicate?(): void;
  onDelete?(): Promise<void>;
  /** `aiUse` is the AI answer when the game has none yet. */
  onRelease?(aiUse?: AiUseKind[]): Promise<void>;
  /** Releases a released game's unpublished changes as its next release. */
  onPublish?(aiUse?: AiUseKind[]): Promise<void>;
  /** Opens the released game's page on the platform. */
  onGamePage?(): void;
}

function ProjectRow({ project, open, onOpen, onDuplicate, onDelete, onRelease, onPublish, onGamePage }: RowProps) {
  const [confirming, setConfirming] = useState<'delete' | 'release' | 'publish' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ai, setAi] = useState<AiAnswer>({ none: false, kinds: [] });
  // Games released before the question, and new projects, answer it once; then the platform keeps it.
  const asksAi = !project.aiDeclared;
  const aiAnswer = asksAi ? answered(ai) : undefined;
  const aiMissing = asksAi && aiAnswer === null;
  const declared = aiUseLabel(project.aiDeclared ?? false, project.aiUse ?? []);

  async function run(action?: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirming(null);
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
            {project.released && project.releaseNumber ? ` · Release ${project.releaseNumber}` : ''}
            {project.hasUnreleasedChanges && <span className="text-amber"> · unpublished changes</span>}
            {open && <span className="text-chili"> · open</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="secondary" onClick={onOpen} aria-label={`Open ${project.title}`}>
            <FolderOpen />
            <span className="hidden sm:inline">Open</span>
          </Button>
          {onRelease && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming('release')}
              aria-label={`Release ${project.title}`}
              title="Release"
            >
              <Rocket />
              <span className="hidden sm:inline">Release</span>
            </Button>
          )}
          {onPublish && project.hasUnreleasedChanges && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming('publish')}
              aria-label={`Publish update for ${project.title}`}
              title="Publish update"
            >
              <Rocket />
              <span className="hidden sm:inline">Publish update</span>
            </Button>
          )}
          {onGamePage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onGamePage}
              aria-label={`Game page for ${project.title}`}
              title="Game page"
            >
              <ExternalLink />
              <span className="hidden sm:inline">Game page</span>
            </Button>
          )}
          {onDuplicate && (
            <Button size="icon" variant="ghost" onClick={onDuplicate} aria-label={`Duplicate ${project.title}`} title="Duplicate">
              <Copy />
            </Button>
          )}
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setConfirming('delete')}
              aria-label={`Delete ${project.title}`}
              title="Delete"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {confirming === 'delete' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
          <span className="mr-auto">Delete “{project.title}”? This cannot be undone.</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
            Keep it
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void run(onDelete)} disabled={busy}>
            Delete for good
          </Button>
        </div>
      )}
      {confirming === 'release' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
          <span className="mr-auto">
            Release “{project.title}”? It becomes a game you can sell, and you can keep editing it here. Buyers get
            the version you last saved; later edits reach them only when you publish an update. Listing it for sale is
            a separate step on the platform.
          </span>
          {asksAi ? <AiQuestion answer={ai} onChange={setAi} /> : declared && <span className="w-full text-xs text-muted">{declared}</span>}
          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
            Not yet
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void run(() => onRelease!(aiAnswer ?? undefined))}
            disabled={busy || aiMissing}
          >
            Release it
          </Button>
        </div>
      )}
      {confirming === 'publish' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
          <span className="mr-auto">
            Publish your changes to “{project.title}” as release {(project.releaseNumber ?? 0) + 1}? Buyers and devices
            get this version from now on.
          </span>
          {asksAi ? <AiQuestion answer={ai} onChange={setAi} /> : declared && <span className="w-full text-xs text-muted">{declared}</span>}
          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
            Not yet
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void run(() => onPublish!(aiAnswer ?? undefined)).then(() => setConfirming(null))}
            disabled={busy || aiMissing}
          >
            Publish it
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
  const t = useT();
  const state = useProjects();
  const [creating, setCreating] = useState(false);
  // Each editor lists its own games; games with no engine are the default engine's.
  const engine = creator.engines.get(state.engine ?? undefined) ?? creator.engines.default();
  const mine = (list: ProjectSummary[]) => list.filter((p) => (p.engine ?? creator.engines.default().id) === engine.id);
  const projects = mine(state.list.projects);
  const released = mine(state.list.released);
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

  async function create(data?: string, title?: string) {
    setCreating(true);
    await act(() => creator.projects.create(title, data, engine.id));
    setCreating(false);
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h1 className="font-display text-2xl font-bold">{t('Your games')}</h1>
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
          <Button
            variant="primary"
            onClick={() => void create()}
            disabled={creating || atLimit || state.mode === 'unknown'}
          >
            <Plus />
            New game
          </Button>
        </div>

        {engine.templates && (
          <p className="-mt-3 flex flex-wrap items-center gap-1 text-xs text-muted">
            Or start from
            {engine.templates.map((template) => (
              <Button
                key={template.title}
                size="sm"
                variant="ghost"
                disabled={creating || atLimit || state.mode === 'unknown'}
                onClick={() => void create(template.make(template.title), template.title)}
              >
                {template.title}
              </Button>
            ))}
          </p>
        )}

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
          {state.list.status === 'ready' && projects.length === 0 && (
            <p className="text-sm text-muted">No projects yet.</p>
          )}
          <ul aria-label="Projects" className="space-y-2">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                open={project.id === openId}
                onOpen={() => void creator.projects.open(project.id)}
                onDuplicate={atLimit ? undefined : () => void act(() => creator.projects.duplicate(project.id))}
                onDelete={() => creator.projects.remove(project.id)}
                onRelease={state.mode === 'platform' ? (aiUse) => creator.projects.release(project.id, aiUse) : undefined}
              />
            ))}
          </ul>
        </section>

        {released.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">Released</h2>
            <p className="text-sm text-muted">
              Buyers keep the version you released. Edits stay with you until you publish an update.
            </p>
            <ul aria-label="Released games" className="space-y-2">
              {released.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  open={project.id === openId}
                  onOpen={() => void creator.projects.open(project.id)}
                  onPublish={(aiUse) => creator.projects.release(project.id, aiUse)}
                  onGamePage={() => creator.bridge.post({ type: 'chili-navigate', to: `/games/${project.id}` })}
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
  help: 'Your games: make a new one, open, copy, release or delete one, publish updates to a released game, or import a .bitsy file or web page.',
  icon: LayoutGrid,
  component: Projects,
  defaultPosition: 'center',
  openByDefault: true,
});
