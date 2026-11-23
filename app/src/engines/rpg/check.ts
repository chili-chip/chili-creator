import type { EngineProblem } from '../types';
import type { Action, Condition, Game, GameEvent, Goal, Look } from './model';

type Ref = 'room' | 'character' | 'item' | 'dialogue' | 'quest' | 'song' | 'stat' | 'line';
const article = (what: Ref) => (what === 'item' ? 'an item' : `a ${what}`);

/** Each id an action, condition or goal names, with what kind of thing it is. */
function actionRefs(action: Action): [Ref, string][] {
  const a = action as Record<string, unknown>;
  const refs: [Ref, string][] = [];
  if (typeof a.give === 'string') refs.push(['item', a.give]);
  if (typeof a.take === 'string') refs.push(['item', a.take]);
  if (typeof a.warp === 'string') refs.push(['room', a.warp]);
  if (typeof a.say === 'string') refs.push(['dialogue', a.say]);
  if (typeof a.quest === 'string') refs.push(['quest', a.quest]);
  if (typeof a.music === 'string') refs.push(['song', a.music]);
  if (typeof a.stat === 'string') refs.push(['stat', a.stat]);
  return refs;
}

function conditionRefs(condition: Condition): [Ref, string][] {
  const c = condition as Record<string, unknown>;
  const refs: [Ref, string][] = [];
  if (typeof c.has === 'string') refs.push(['item', c.has]);
  if (typeof c.quest === 'string') refs.push(['quest', c.quest]);
  if (typeof c.stat === 'string') refs.push(['stat', c.stat]);
  return refs;
}

function eventRefs(event: GameEvent | { if?: Condition[]; do?: Action[]; else?: Action[] } | undefined): [Ref, string][] {
  if (!event) return [];
  if (Array.isArray(event)) return event.flatMap(actionRefs);
  return [...(event.if ?? []).flatMap(conditionRefs), ...[...(event.do ?? []), ...(event.else ?? [])].flatMap(actionRefs)];
}

function goalRefs(goal: Goal | undefined): [Ref, string][] {
  if (!goal) return [];
  const refs: [Ref, string][] = [];
  if (goal.talk) refs.push(['character', goal.talk]);
  if (goal.collect) refs.push(['item', goal.collect]);
  if (goal.defeat) refs.push(['character', goal.defeat]);
  if (goal.reach) refs.push(['room', goal.reach]);
  return refs;
}

function lookSprites(look: Look): number[] {
  const first = [look.sprite, ...Object.values(look.sprites ?? {})].filter((n): n is number => n !== undefined);
  return first.flatMap((n) => Array.from({ length: look.frames ?? 1 }, (_, i) => n + i));
}

function events(value: unknown, found: Action[][]): void {
  // Every list of actions anywhere in the game, to see if one ends it.
  if (Array.isArray(value)) {
    if (value.some((v) => v && typeof v === 'object' && 'end' in v)) found.push(value as Action[]);
    value.forEach((v) => events(v, found));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => events(v, found));
  }
}

/** Problems in a game, worst first. The engine still checks everything when it plays. */
export function checkGame(game: Game): EngineProblem[] {
  const problems: EngineProblem[] = [];
  const error = (message: string) => problems.push({ severity: 'error', message });
  const ids: Record<Ref, Set<string>> = {
    room: new Set(game.rooms.map((r) => r.id)),
    character: new Set((game.kinds ?? []).map((k) => k.id)),
    item: new Set((game.items ?? []).map((i) => i.id)),
    dialogue: new Set((game.dialogue ?? []).map((d) => d.id)),
    quest: new Set((game.quests ?? []).map((q) => q.id)),
    song: new Set((game.songs ?? []).map((s) => s.id)),
    stat: new Set(game.stats.map((s) => s.id)),
    line: new Set(),
  };
  const tiles = new Map(game.tiles.map((t) => [t.key, t]));
  const reported = new Set<string>();
  const check = (owner: string, refs: [Ref, string][]) => {
    for (const [what, id] of refs) {
      const message = `${owner} uses ${article(what)} that is gone (${id}).`;
      if (!ids[what].has(id) && !reported.has(message)) {
        reported.add(message);
        error(message);
      }
    }
  };

  if (!ids.stat.has('hp') || !ids.stat.has('max_hp')) error('The hero needs the stats "hp" and "max_hp".');

  const startRoom = game.rooms.find((r) => r.id === game.start.room);
  if (!startRoom) error(`The start room "${game.start.room}" is gone.`);
  else {
    const row = startRoom.ground[game.start.y];
    const key = row?.[game.start.x];
    if (key === undefined) error('The hero starts outside the room.');
    else if (tiles.get(key)?.solid) error('The hero starts inside a solid tile.');
  }

  for (const room of game.rooms) {
    const owner = `Room "${room.id}"`;
    const width = room.ground[0]?.length ?? 0;
    if (room.ground.length < 16 || room.ground.length > 64) error(`${owner} must be 16 to 64 tiles tall.`);
    if (room.ground.some((row) => row.length !== width)) error(`${owner} has rows of different widths.`);
    else if (width < 16 || width > 64) error(`${owner} must be 16 to 64 tiles wide.`);
    const unknown = new Set<string>();
    for (const row of room.ground) for (const key of row) if (!tiles.has(key)) unknown.add(key);
    // In the top layer a space is empty.
    for (const row of room.top ?? []) for (const key of row) if (key !== ' ' && !tiles.has(key)) unknown.add(key);
    for (const key of unknown) error(`${owner} uses a tile that is gone (${key}).`);
    check(owner, (room.actors ?? []).map((a) => ['character', a.kind]));
    check(owner, (room.actors ?? []).flatMap((a) => [...(a.talk ? ([['dialogue', a.talk]] as [Ref, string][]) : []), ...eventRefs(a.bump)]));
    check(owner, (room.items ?? []).map((i) => ['item', i.item]));
    check(owner, (room.warps ?? []).map((w) => ['room', w.to]));
    check(owner, (room.triggers ?? []).flatMap((t) => eventRefs(t)));
    if (room.music) check(owner, [['song', room.music]]);
  }

  for (const kind of game.kinds ?? []) {
    const owner = `Character "${kind.id}"`;
    if (kind.talk) check(owner, [['dialogue', kind.talk]]);
    check(owner, [...eventRefs(kind.bump), ...eventRefs(kind.death)]);
    check(owner, (kind.drops ?? []).map((d) => ['item', d.item]));
    check(owner, Object.keys(kind.stats ?? {}).map((id) => ['stat', id]));
  }

  for (const item of game.items ?? []) {
    const owner = `Item "${item.id}"`;
    check(owner, eventRefs(item.use));
    check(owner, Object.keys(item.bonus ?? {}).map((id) => ['stat', id]));
    if (item.kind === 'equip' && !(game.slots ?? []).includes(item.slot ?? '')) error(`${owner} needs a slot to be worn in.`);
  }

  for (const dialogue of game.dialogue ?? []) {
    const owner = `Dialogue "${dialogue.id}"`;
    ids.line = new Set(dialogue.lines.flatMap((l) => (l.id ? [l.id] : [])));
    for (const line of dialogue.lines) {
      check(owner, eventRefs(line));
      for (const choice of line.choices ?? []) {
        check(owner, eventRefs(choice));
        if (choice.goto) check(owner, [['line', choice.goto]]);
      }
    }
  }

  for (const quest of game.quests ?? []) {
    const owner = `Quest "${quest.id}"`;
    for (const stage of quest.stages) check(owner, [...goalRefs(stage.goal), ...eventRefs(stage.done)]);
  }
  check('Losing', eventRefs(game.lose));

  // Pictures the game draws that are empty.
  const pictures = game.art?.pictures.length ?? 256;
  const empty = (owner: string, sprites: number[]) => {
    const n = sprites.find((s) => s >= pictures);
    if (n !== undefined && game.art) problems.push({ severity: 'warning', message: `${owner} uses picture ${n}, which is empty.` });
  };
  empty('The hero', lookSprites(game.player));
  for (const kind of game.kinds ?? []) empty(`Character "${kind.id}"`, lookSprites(kind));
  for (const tile of game.tiles) empty(`Tile "${tile.key}"`, [tile.sprite].flat());
  for (const item of game.items ?? []) if (item.icon !== undefined) empty(`Item "${item.id}"`, [item.icon]);

  // Rooms you can reach: the start, and any warp or warp action from a room you can reach.
  const reached = new Set([game.start.room]);
  const warpActions: string[] = [];
  JSON.stringify(game, (key, value) => {
    if (key === 'warp' && typeof value === 'string') warpActions.push(value);
    return value;
  });
  warpActions.forEach((id) => reached.add(id));
  for (let changed = true; changed; ) {
    changed = false;
    for (const room of game.rooms) {
      if (!reached.has(room.id)) continue;
      for (const warp of room.warps ?? []) {
        if (!reached.has(warp.to)) {
          reached.add(warp.to);
          changed = true;
        }
      }
    }
  }
  for (const room of game.rooms) if (!reached.has(room.id)) problems.push({ severity: 'info', message: `Room "${room.id}" can't be reached.` });

  const ends: Action[][] = [];
  events(game, ends);
  if (!ends.some((list) => list.some((a) => 'end' in a && a.end === 'win'))) {
    problems.push({ severity: 'info', message: 'Nothing ends the game with a win. That is fine while you build.' });
  }

  const order = { error: 0, warning: 1, info: 2 };
  return problems.sort((a, b) => order[a.severity] - order[b.severity]);
}
