import { useSyncExternalStore } from 'react';
import type { Creator } from '../../creator';
import { useCreator, useProjects } from '../../shell/creator-context';
import type { EditOptions } from '../../project/store';
import type { Game } from './model';

/** What the Chili Beat tools have picked, and the rules the Play tool saw run. */
export interface BeatSelection {
  screen: string | null;
  thing: string | null;
  frame: number;
  layer: 'things' | 'ground';
  /** Rule indexes that just ran, for the rule trace. */
  lit: number[];
}

function createSelection() {
  let state: BeatSelection = { screen: null, thing: null, frame: 0, layer: 'things', lit: [] };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<BeatSelection>) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type BeatSelectionStore = ReturnType<typeof createSelection>;

// One selection per creator, so tests that make many creators don't share one.
const selections = new WeakMap<Creator, BeatSelectionStore>();

export function selectionOf(creator: Creator): BeatSelectionStore {
  let store = selections.get(creator);
  if (!store) selections.set(creator, (store = createSelection()));
  return store;
}

/** The open Chili Beat game, or null. */
export function useGame(): Game | null {
  const { open } = useProjects();
  return open.status === 'ready' && open.engine === 'beat' ? (open.doc as Game) : null;
}

/** Changes the open game; one undo step per call, or per `group`. */
export function useUpdate() {
  const { projects } = useCreator();
  return (recipe: (game: Game) => void, options?: EditOptions) => projects.updateDoc<Game>(recipe, options);
}

/** The selection, with what it points at checked against the game. */
export function useSelection(game: Game | null) {
  const creator = useCreator();
  const store = selectionOf(creator);
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const screen = game?.screens.find((s) => s.id === state.screen) ?? game?.screens.find((s) => s.id === game.start) ?? game?.screens[0];
  const thing = game?.things.find((t) => t.key === state.thing) ?? game?.things[0];
  const frame = thing && state.frame < thing.frames.length ? state.frame : 0;
  return { ...state, screen, thing, frame, set: store.set };
}
