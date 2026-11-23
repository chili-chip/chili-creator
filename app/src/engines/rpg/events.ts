// Events: conditions, then actions, or else other actions (the game SDK's
// docs/rpg/events.md). The editor shows each one as rows of a form.
import type { Action, Condition, Game, GameEvent, Op } from './model';

export interface EventParts {
  if: Condition[];
  do: Action[];
  else: Action[];
}

export function eventParts(event: GameEvent | { if?: Condition[]; do?: Action[]; else?: Action[] } | undefined): EventParts {
  if (!event) return { if: [], do: [], else: [] };
  if (Array.isArray(event)) return { if: [], do: event, else: [] };
  return { if: event.if ?? [], do: event.do ?? [], else: event.else ?? [] };
}

/** The shortest event for these parts: a plain list of actions when it can be. */
export function eventFrom(parts: EventParts): GameEvent | undefined {
  if (!parts.if.length && !parts.else.length) return parts.do.length ? parts.do : undefined;
  return { ...(parts.if.length ? { if: parts.if } : {}), ...(parts.do.length ? { do: parts.do } : {}), ...(parts.else.length ? { else: parts.else } : {}) };
}

/** Puts if / do / else on an object that holds them itself (a dialogue line, a choice, a trigger). */
export function setInline(target: { if?: Condition[]; do?: Action[]; else?: Action[] }, parts: EventParts) {
  for (const key of ['if', 'do', 'else'] as const) {
    if (parts[key].length) (target as Record<string, unknown>)[key] = parts[key];
    else delete target[key];
  }
}

export const OPS: Op[] = ['=', '!=', '<', '<=', '>', '>='];

/** The actions the editor offers. `call` and `music` need C++ or songs, which the editor does not make. */
export const ACTIONS = [
  ['say', 'Say dialogue'],
  ['give', 'Give item'],
  ['take', 'Take item'],
  ['set', 'Turn flag on'],
  ['clear', 'Turn flag off'],
  ['add', 'Add to variable'],
  ['quest', 'Set quest'],
  ['heal', 'Heal'],
  ['hurt', 'Hurt'],
  ['xp', 'Give XP'],
  ['stat', 'Raise stat'],
  ['warp', 'Warp'],
  ['sound', 'Play sound'],
  ['save', 'Save the game'],
  ['remove', 'Remove this'],
  ['end', 'End the game'],
] as const;
export type ActionType = (typeof ACTIONS)[number][0] | 'music' | 'call';

export const CONDITIONS = [
  ['flag', 'Flag is on'],
  ['not', 'Flag is off'],
  ['has', 'Has item'],
  ['quest', 'Quest'],
  ['var', 'Variable'],
  ['stat', 'Stat'],
] as const;
export type ConditionType = (typeof CONDITIONS)[number][0];

const ACTION_KEYS: ActionType[] = ['say', 'give', 'take', 'set', 'clear', 'add', 'quest', 'heal', 'hurt', 'xp', 'warp', 'sound', 'save', 'remove', 'end', 'music', 'call', 'stat'];

export function actionType(action: Action): ActionType {
  return ACTION_KEYS.find((key) => key in action) ?? 'save';
}

export function conditionType(condition: Condition): ConditionType {
  return (['flag', 'not', 'has', 'quest', 'var', 'stat'] as const).find((key) => key in condition) ?? 'flag';
}

/** A new action of a type, pointing at the first thing of the game it needs. */
export function newAction(type: ActionType, game: Game): Action {
  const first = <T extends { id: string }>(list: T[] | undefined, fallback: string) => list?.[0]?.id ?? fallback;
  switch (type) {
    case 'say': return { say: first(game.dialogue, 'talk') };
    case 'give': return { give: first(game.items, 'item') };
    case 'take': return { take: first(game.items, 'item') };
    case 'set': return { set: knownFlags(game)[0] ?? 'flag' };
    case 'clear': return { clear: knownFlags(game)[0] ?? 'flag' };
    case 'add': return { add: knownVars(game)[0] ?? 'count', value: 1 };
    case 'quest': return { quest: first(game.quests, 'quest'), stage: 1 };
    case 'heal': return { heal: 5 };
    case 'hurt': return { hurt: 1 };
    case 'xp': return { xp: 5 };
    case 'stat': return { stat: 'atk', value: 1 };
    case 'warp': return { warp: game.start.room, x: game.start.x, y: game.start.y };
    case 'sound': return { sound: 'pickup' };
    case 'save': return { save: true };
    case 'remove': return { remove: true };
    case 'end': return { end: 'win' };
    case 'music': return { music: first(game.songs, 'song') };
    case 'call': return { call: 'hook' };
  }
}

export function newCondition(type: ConditionType, game: Game): Condition {
  switch (type) {
    case 'flag': return { flag: knownFlags(game)[0] ?? 'flag' };
    case 'not': return { not: knownFlags(game)[0] ?? 'flag' };
    case 'has': return { has: game.items?.[0]?.id ?? 'item' };
    case 'quest': return { quest: game.quests?.[0]?.id ?? 'quest', stage: 1 };
    case 'var': return { var: knownVars(game)[0] ?? 'count', op: '>=', value: 1 };
    case 'stat': return { stat: 'hp', op: '>=', value: 1 };
  }
}

/** Walks every condition and action in the game. */
function walk(game: Game, visit: (row: Record<string, unknown>) => void) {
  const seen = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(seen);
    else if (value && typeof value === 'object') {
      visit(value as Record<string, unknown>);
      Object.values(value).forEach(seen);
    }
  };
  seen(game);
}

/** The flags the game names, sorted. Naming a flag creates it. */
export function knownFlags(game: Game): string[] {
  const flags = new Set<string>();
  walk(game, (row) => {
    for (const key of ['flag', 'not', 'set', 'clear']) if (typeof row[key] === 'string') flags.add(row[key] as string);
  });
  return [...flags].sort();
}

export function knownVars(game: Game): string[] {
  const vars = new Set<string>();
  walk(game, (row) => {
    if (typeof row.var === 'string') vars.add(row.var);
    if (typeof row.add === 'string') vars.add(row.add);
  });
  return [...vars].sort();
}
