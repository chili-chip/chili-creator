import { useSyncExternalStore } from 'react';
import type { Creator } from '../../creator';
import type { EditOptions } from '../../project/store';
import { useCreator, useProjects } from '../../shell/creator-context';
import type { Game } from './model';

/** What the Chili RPG tools have picked. Ids that are gone fall back to the first one. */
export interface RpgSelection {
  room: string | null;
  /** The tile key the Rooms brush paints. */
  tile: string | null;
  picture: number;
  kind: string | null;
  item: string | null;
  dialogue: string | null;
  quest: string | null;
}

function createSelection() {
  let state: RpgSelection = { room: null, tile: null, picture: 0, kind: null, item: null, dialogue: null, quest: null };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<RpgSelection>) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type RpgSelectionStore = ReturnType<typeof createSelection>;

// One selection per creator, so tests that make many creators don't share one.
const selections = new WeakMap<Creator, RpgSelectionStore>();

export function selectionOf(creator: Creator): RpgSelectionStore {
  let store = selections.get(creator);
  if (!store) selections.set(creator, (store = createSelection()));
  return store;
}

/** The open Chili RPG game, or null. */
export function useGame(): Game | null {
  const { open } = useProjects();
  return open.status === 'ready' && open.engine === 'rpg' ? (open.doc as Game) : null;
}

/** Changes the open game; one undo step per call, or per `group`. */
export function useUpdate() {
  const { projects } = useCreator();
  return (recipe: (game: Game) => void, options?: EditOptions) => projects.updateDoc<Game>(recipe, options);
}

/** The selection, with what it points at checked against the game. */
export function useSelection(game: Game | null) {
  const store = selectionOf(useCreator());
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const find = <T extends { id: string }>(list: T[] | undefined, id: string | null) => list?.find((x) => x.id === id) ?? list?.[0];
  const room = game?.rooms.find((r) => r.id === state.room) ?? game?.rooms.find((r) => r.id === game.start.room) ?? game?.rooms[0];
  const tile = game?.tiles.find((t) => t.key === state.tile) ?? game?.tiles[0];
  const pictures = game?.art?.pictures.length ?? 0;
  return {
    ...state,
    room,
    tile,
    picture: Math.min(state.picture, Math.max(0, pictures - 1)),
    kind: find(game?.kinds, state.kind),
    item: find(game?.items, state.item),
    dialogue: find(game?.dialogue, state.dialogue),
    quest: find(game?.quests, state.quest),
    set: store.set,
  };
}
