/** The entity with this id, or undefined. */
export function byId<T extends { id: string }>(list: readonly T[], id: string): T | undefined {
  return list.find((entry) => entry.id === id);
}
