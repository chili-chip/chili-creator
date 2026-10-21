import { Redo2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { useCreator, useProjects } from './creator-context';

/** The open game's title (editable) and whether it is saved. */
export function ProjectBar() {
  const creator = useCreator();
  const state = useProjects();
  const worldTitle = state.open.status === 'ready' ? state.open.world.title : '';
  const [title, setTitle] = useState(worldTitle);
  const openId = state.open.status === 'ready' ? state.open.project.id : null;

  // Follow the world when another game opens or something else renames it.
  useEffect(() => setTitle(worldTitle), [worldTitle, openId]);

  if (state.open.status !== 'ready') return null;
  const { save, history } = state;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden border-l border-line pl-2 sm:gap-2 sm:pl-3">
      <input
        aria-label="Game title"
        className="w-24 min-w-0 shrink rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-text hover:border-line focus:border-phosphor focus:outline-none sm:w-56"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          creator.projects.setTitle(event.target.value);
        }}
      />
      <span className="flex shrink-0 items-center">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!history.canUndo}
          onClick={() => creator.projects.undo()}
        >
          <Undo2 />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!history.canRedo}
          onClick={() => creator.projects.redo()}
        >
          <Redo2 />
        </Button>
      </span>
      <span role="status" aria-label="Save state" className="flex items-center gap-1 text-[11px] whitespace-nowrap text-muted">
        {save.state === 'saved' && (
          <>
            <span className="size-1.5 rounded-full bg-phosphor" aria-hidden />
            <span className="sr-only sm:not-sr-only">Saved</span>
          </>
        )}
        {save.state === 'saving' && (
          <>
            <span className="size-1.5 animate-pulse rounded-full bg-amber" aria-hidden />
            <span className="sr-only sm:not-sr-only">Saving…</span>
          </>
        )}
        {save.state === 'error' && (
          <>
            <span className="text-chili">Not saved</span>
            <button
              type="button"
              className="text-phosphor underline-offset-2 hover:underline"
              aria-label="Retry saving"
              onClick={() => creator.projects.retrySave().catch(() => {})}
            >
              Retry
            </button>
          </>
        )}
      </span>
    </div>
  );
}
