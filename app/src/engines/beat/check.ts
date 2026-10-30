import type { EngineProblem } from '../types';
import type { Game } from './model';

/** Problems in a game, worst first. The engine still checks everything when it plays. */
export function checkGame(game: Game): EngineProblem[] {
  const problems: EngineProblem[] = [];
  const keys = new Set(game.things.map((t) => t.key));
  const you = new Set(game.things.filter((t) => t.you).map((t) => t.key));
  const counters = new Set((game.counters ?? []).map((c) => c.id));
  const blips = new Set((game.blips ?? []).map((b) => b.id));
  const screens = new Set(game.screens.map((s) => s.id));

  const start = game.screens.find((s) => s.id === game.start);
  if (!start?.things.some((row) => [...row].some((key) => you.has(key)))) {
    problems.push({ severity: 'error', message: 'Nothing on the start screen is "you", so nobody can play.' });
  }

  game.rules.forEach((rule, i) => {
    const n = i + 1;
    const missing = (what: string, name: string) => problems.push({ severity: 'error', message: `Rule ${n} uses ${what} that is gone (${name}).` });
    const thing = (key: string) => key !== 'you' && key !== 'any' && !keys.has(key) && missing('a thing', key);
    const counter = (id: string) => !counters.has(id) && missing('a counter', id);
    const when = rule.when as Record<string, unknown>;
    if ('bump' in when) (when.bump as string[]).forEach(thing);
    if ('every' in when) thing(when.thing as string);
    if ('reaches' in when) counter(when.counter as string);
    for (const condition of rule.if ?? []) if ('counter' in condition) counter(condition.counter);
    for (const action of rule.do as Record<string, unknown>[]) {
      if ('become' in action) thing(action.become as string);
      if ('make' in action) thing(action.make as string);
      if ('count' in action) counter(action.count as string);
      if ('sound' in action && !blips.has(action.sound as string)) missing('a sound', action.sound as string);
      if ('go' in action && !screens.has(action.go as string)) missing('a screen', action.go as string);
    }
    if (rule.do.length === 0) problems.push({ severity: 'warning', message: `Rule ${n} does nothing.` });
  });

  const ends = game.rules.some((rule) => rule.do.some((a) => 'win' in a || 'lose' in a));
  if (!ends) problems.push({ severity: 'info', message: 'No rule wins or loses. That is fine for a toy.' });

  // Screens you can reach: the start, any "go" target, and neighbours through a gap in the edge.
  const reached = new Set<string>([game.start]);
  for (const rule of game.rules) for (const a of rule.do) if ('go' in a) reached.add(a.go);
  const open = (rows: string[], side: 'top' | 'bottom' | 'left' | 'right') => {
    const cells = side === 'top' ? [...rows[0]!] : side === 'bottom' ? [...rows[15]!] : rows.map((r) => r[side === 'left' ? 0 : 15]!);
    return cells.some((key) => !keys.has(key) || you.has(key));
  };
  const sides = [
    ['right', 1, 0, 'left'],
    ['left', -1, 0, 'right'],
    ['bottom', 0, 1, 'top'],
    ['top', 0, -1, 'bottom'],
  ] as const;
  for (let changed = true; changed; ) {
    changed = false;
    for (const screen of game.screens) {
      if (!reached.has(screen.id)) continue;
      for (const [side, dx, dy, back] of sides) {
        const next = game.screens.find((s) => s.map[0] === screen.map[0] + dx && s.map[1] === screen.map[1] + dy);
        if (next && !reached.has(next.id) && open(screen.things, side) && open(next.things, back)) {
          reached.add(next.id);
          changed = true;
        }
      }
    }
  }
  for (const screen of game.screens) {
    if (!reached.has(screen.id)) problems.push({ severity: 'info', message: `Screen "${screen.id}" can't be reached.` });
  }

  const order = { error: 0, warning: 1, info: 2 };
  return problems.sort((a, b) => order[a.severity] - order[b.severity]);
}
