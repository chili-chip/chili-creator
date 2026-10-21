import { parse } from './parse';
import blank from './templates/blank.bitsy?raw';
import type { World } from './types';

export { byId } from './by-id';
export * from './edit';
export { emptyWorld, parse } from './parse';
export * from './render';
export { serialize } from './serialize';
export type * from './types';

/** A new game: the classic editor's starting room, cat and tea. */
export function createWorld({ title }: { title: string }): World {
  const { world } = parse(blank);
  world.title = title;
  return world;
}
