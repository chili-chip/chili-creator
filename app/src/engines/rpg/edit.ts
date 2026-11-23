// Small changes to a Chili RPG game, shared by the tools and the agent tools.
import type { Game } from './model';

/** A whole number from a field, kept between `min` and `max`. */
export function whole(value: string | number, min: number, max: number): number {
  const n = Math.round(Number(value));
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

/** Sets a rule, or removes it when it is the default, so the file stays short. */
export function setRule<K extends keyof NonNullable<Game['rules']>>(game: Game, key: K, value: NonNullable<Game['rules']>[K], fallback: NonNullable<Game['rules']>[K]) {
  const rules = { ...game.rules };
  if (value === fallback) delete rules[key];
  else rules[key] = value;
  if (Object.keys(rules).length) game.rules = rules;
  else delete game.rules;
}

/** A new id like "room-2" that the list doesn't have yet. */
export function freshId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let n = 1; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}
