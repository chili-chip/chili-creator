import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Creator } from '../creator';
import type { World } from '../bitsy';
import type { I18nState, Vars } from '../i18n';
import { resolveSelection, type EditorState, type Resolved } from '../project/editor';
import type { ProjectsState } from '../project/store';
import type { PreviewState } from '../sound/preview';

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

/** What the sound tools are playing, re-rendering when it changes. */
export function useSound(): PreviewState {
  const { sound } = useCreator();
  return useSyncExternalStore(sound.subscribe, sound.state, sound.state);
}

/** Translates English text into the chosen language, re-rendering when it changes. */
export function useT(): (text: string, vars?: Vars) => string {
  const { i18n } = useCreator();
  useSyncExternalStore(i18n.subscribe, i18n.getState, i18n.getState);
  return i18n.t;
}

/** The chosen language. */
export function useI18nState(): I18nState {
  const { i18n } = useCreator();
  return useSyncExternalStore(i18n.subscribe, i18n.getState, i18n.getState);
}
