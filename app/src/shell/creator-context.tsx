import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Creator } from '../creator';
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
