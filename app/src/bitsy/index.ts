import { parse } from './parse';
import blank from './templates/blank.bitsy?raw';
import type { World } from './types';

export { emptyWorld, parse } from './parse';
export { serialize } from './serialize';
export type * from './types';

/** The entity with this id, or undefined. */
export function byId<T extends { id: string }>(list: readonly T[], id: string): T | undefined {
  return list.find((entry) => entry.id === id);
}

/** A new game: the classic editor's starting room, cat and tea. */
export function createWorld({ title }: { title: string }): World {
  const { world } = parse(blank);
  world.title = title;
  return world;
}
