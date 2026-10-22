// Autosave, ported from the classic editor's chili-projects.js: every
// edit bumps a revision, the save follows once edits pause, one request is
// in flight at a time, and edits made during a save are sent after it.

export type SaveState = 'saved' | 'saving' | 'error';

export interface SaveStatus {
  state: SaveState;
  /** True while some edit has not reached the server. */
  unsaved: boolean;
  error?: unknown;
}

export interface SaveControllerOptions {
  save(data: string): Promise<void>;
  delayMs?: number;
  onChange?(status: SaveStatus): void;
}

export function createSaveController({ save, delayMs = 700, onChange }: SaveControllerOptions) {
  let editRevision = 0;
  let savedRevision = 0;
  let latest = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let current: SaveStatus = { state: 'saved', unsaved: false };
  let disposed = false;

  const dirty = () => editRevision !== savedRevision;

  function set(state: SaveState, error?: unknown) {
    current = { state, unsaved: dirty() || !!inFlight, ...(error !== undefined ? { error } : {}) };
    onChange?.(current);
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      flush().catch(() => {});
    }, delayMs);
  }

  async function flush(): Promise<void> {
    clearTimer();
    if (disposed) return;
    if (inFlight) {
      await inFlight.catch(() => {});
      return flush();
    }
    if (!dirty()) return;
    const revision = editRevision;
    const data = latest;
    const request = save(data);
    inFlight = request;
    if (current.state !== 'error') set('saving');
    try {
      await request;
    } catch (err) {
      inFlight = null;
      set('error', err);
      throw err;
    }
    inFlight = null;
    savedRevision = revision;
    if (dirty()) {
      set('saving');
      if (!timer) schedule();
    } else {
      set('saved');
    }
  }

  return {
    status: () => current,
    /** Records the game's new text; the save follows when edits pause. */
    edit(data: string) {
      if (disposed) return;
      latest = data;
      editRevision++;
      // After a failed save the error stays up until a save goes through.
      set(current.state === 'error' ? 'error' : 'saving', current.state === 'error' ? current.error : undefined);
      schedule();
    },
    /** Saves the latest edits now; waits for a save in flight first. */
    flush,
    /** Tries again after an error (back online, or the user asked). */
    retry: () => flush(),
    /** A project was just loaded: nothing is unsaved. */
    reset() {
      clearTimer();
      savedRevision = editRevision;
      set('saved');
    },
    hasUnsavedWork: () => dirty() || !!inFlight,
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}

export type SaveController = ReturnType<typeof createSaveController>;
