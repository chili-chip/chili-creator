import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Creator } from '../creator';
import type { World } from '../bitsy';
import { resolveSelection, type EditorState, type Resolved } from '../project/editor';
import type { ProjectsState } from '../project/store';

const CreatorContext = createContext<Creator | null>(null);

export const CreatorProvider = CreatorContext.Provider;

/** The creator a tool runs in. */
export function useCreator(): Creator {
  const creator = useContext(CreatorContext);
  if (!creator) throw new Error('useCreator needs a CreatorProvider');
  return creator;
}

/** The project store's state, re-rendering when it changes. */
export function useProjects(): ProjectsState {
  const { projects } = useCreator();
  return useSyncExternalStore(projects.subscribe, projects.getState, projects.getState);
}

/** What the editing tools have picked, re-rendering when it changes. */
export function useEditor(): EditorState {
  const { editor } = useCreator();
  return useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
}

/** The open game's world, or null when none is open. */
export function useWorld(): World | null {
  const { open } = useProjects();
  return open.status === 'ready' ? open.world : null;
}

/** The picked room and drawing as they are in the open world now. */
export function useSelection(): Resolved & { world: World | null } {
  const world = useWorld();
  const editor = useEditor();
  if (!world) return { world, room: undefined, kind: undefined, drawing: undefined, frame: 0, dialog: undefined, marker: undefined };
  return { world, ...resolveSelection(world, editor) };
}
