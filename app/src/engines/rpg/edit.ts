// Small changes to a Chili RPG game, shared by the tools and the agent tools.
import { LIMITS, type Action, type Condition, type Dialogue, type Game, type GameEvent, type Item, type Kind, type Quest, type Room, type Tile } from './model';

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

const CLEAR_PICTURE = (): string[] => Array(8).fill('........');

/** The game's own pictures, made when it has none yet. */
function pictures(game: Game) {
  game.art ??= { palette: 'sweetie16', pictures: [] };
  return game.art.pictures;
}

/** Sets one pixel: '0' to 'f' is a colour, '.' is clear. */
export function setPixel(game: Game, picture: number, x: number, y: number, colour: string) {
  const rows = pictures(game)[picture];
  if (!rows) throw new Error(`No picture ${picture}`);
  rows[y] = rows[y]!.slice(0, x) + colour + rows[y]!.slice(x + 1);
}

/** Adds a clear picture, or a copy of `from`. Returns its number. */
export function addPicture(game: Game, from?: number): number {
  const list = pictures(game);
  if (list.length >= LIMITS.pictures) throw new Error(`A game can have ${LIMITS.pictures} pictures.`);
  list.push(from === undefined ? CLEAR_PICTURE() : [...list[from]!]);
  return list.length - 1;
}

const TILE_KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#.,;:~^+=*%&@$!?<>/|-_[]{}()\'"`\\';

/** A new tile type with a key no tile has yet. */
export function addTile(game: Game, sprite: number): Tile {
  if (game.tiles.length >= LIMITS.tiles) throw new Error(`A game can have ${LIMITS.tiles} tiles.`);
  const used = new Set(game.tiles.map((t) => t.key));
  const key = [...TILE_KEYS].find((k) => !used.has(k))!;
  const tile: Tile = { key, sprite };
  game.tiles.push(tile);
  return tile;
}

/** Deletes a tile type. The first other tile takes its place on the ground; on top it becomes empty. */
export function deleteTile(game: Game, key: string) {
  if (game.tiles.length <= 1) throw new Error('A game needs at least one tile.');
  game.tiles = game.tiles.filter((t) => t.key !== key);
  const fill = game.tiles[0]!.key;
  for (const room of game.rooms) {
    room.ground = room.ground.map((row) => row.replaceAll(key, fill));
    if (room.top) {
      room.top = room.top.map((row) => row.replaceAll(key, ' '));
      if (room.top.every((row) => !row.trim())) delete room.top;
    }
  }
}

export function roomById(game: Game, id: string): Room {
  const room = game.rooms.find((r) => r.id === id);
  if (!room) throw new Error(`No room has id ${id}`);
  return room;
}

const roomWidth = (room: Room) => room.ground[0]?.length ?? 0;

/** Paints one cell of the ground or the top layer. On top, ' ' is empty. */
export function paintCell(game: Game, roomId: string, layer: 'ground' | 'top', x: number, y: number, key: string) {
  const room = roomById(game, roomId);
  const empty = ' '.repeat(roomWidth(room));
  const rows = layer === 'ground' ? room.ground : (room.top ??= room.ground.map(() => empty));
  rows[y] = rows[y]!.slice(0, x) + key + rows[y]!.slice(x + 1);
  if (layer === 'top' && rows.every((row) => row === empty)) delete room.top;
}

export function addRoom(game: Game): Room {
  if (game.rooms.length >= LIMITS.rooms) throw new Error(`A game can have ${LIMITS.rooms} rooms.`);
  const fill = game.tiles[0]!.key;
  const room: Room = { id: freshId('room', game.rooms.map((r) => r.id)), ground: Array(16).fill(fill.repeat(16)) };
  game.rooms.push(room);
  return room;
}

/** Deletes a room and the warps that lead to it. */
export function deleteRoom(game: Game, id: string) {
  if (game.start.room === id) throw new Error('The game starts in this room. Start somewhere else first.');
  game.rooms = game.rooms.filter((r) => r.id !== id);
  for (const room of game.rooms) {
    room.warps = room.warps?.filter((w) => w.to !== id);
    if (!room.warps?.length) delete room.warps;
  }
}

/** Drops empty lists so the file stays short. */
function tidy(room: Room) {
  for (const key of ['actors', 'items', 'warps', 'triggers'] as const) if (!room[key]?.length) delete room[key];
}

/** Changes a room's size. New cells get the first tile; what ends up outside is dropped or moved in. */
export function resizeRoom(game: Game, id: string, width: number, height: number) {
  const { roomMin: min, roomMax: max } = LIMITS;
  if (width < min || width > max || height < min || height > max) throw new Error(`A room is ${min} to ${max} tiles wide and tall.`);
  const room = roomById(game, id);
  const fill = game.tiles[0]!.key;
  const fit = (rows: string[], pad: string) =>
    Array.from({ length: height }, (_, y) => (rows[y] ?? '').slice(0, width).padEnd(width, pad));
  room.ground = fit(room.ground, fill);
  if (room.top) room.top = fit(room.top, ' ');
  const inside = (o: { x: number; y: number }) => o.x < width && o.y < height;
  room.actors = room.actors?.filter(inside);
  room.items = room.items?.filter(inside);
  room.warps = room.warps?.filter(inside);
  room.triggers = room.triggers?.filter(inside);
  tidy(room);
  const clampX = (x: number) => Math.min(x, width - 1);
  const clampY = (y: number) => Math.min(y, height - 1);
  if (game.start.room === id) game.start = { room: id, x: clampX(game.start.x), y: clampY(game.start.y) };
  for (const other of game.rooms) {
    for (const warp of other.warps ?? []) {
      if (warp.to !== id) continue;
      warp.tx = clampX(warp.tx);
      warp.ty = clampY(warp.ty);
    }
  }
}

export type Placeable = { kind: string } | { item: string } | { warp: true } | { trigger: true } | { start: true };
export type PlacedObject = { type: 'actor' | 'item' | 'warp' | 'trigger'; index: number };

/** What stands on one cell of a room. */
export function objectsAt(room: Room, x: number, y: number): PlacedObject[] {
  const found: PlacedObject[] = [];
  const at = (o: { x: number; y: number }) => o.x === x && o.y === y;
  room.actors?.forEach((o, index) => at(o) && found.push({ type: 'actor', index }));
  room.items?.forEach((o, index) => at(o) && found.push({ type: 'item', index }));
  room.warps?.forEach((o, index) => at(o) && found.push({ type: 'warp', index }));
  room.triggers?.forEach((o, index) => at(o) && found.push({ type: 'trigger', index }));
  return found;
}

/** Removes everything placed on a cell. The start stays. */
export function removeAt(game: Game, roomId: string, x: number, y: number) {
  const room = roomById(game, roomId);
  const away = (o: { x: number; y: number }) => o.x !== x || o.y !== y;
  room.actors = room.actors?.filter(away);
  room.items = room.items?.filter(away);
  room.warps = room.warps?.filter(away);
  room.triggers = room.triggers?.filter(away);
  tidy(room);
}

/**
 * Places something on a cell. A person or item takes the place of the
 * person or item there; a warp or trigger takes the place of the one there.
 */
export function place(game: Game, roomId: string, what: Placeable, x: number, y: number) {
  const room = roomById(game, roomId);
  const away = (o: { x: number; y: number }) => o.x !== x || o.y !== y;
  const limit = (list: unknown[] | undefined, n: number, name: string) => {
    if ((list?.length ?? 0) >= n) throw new Error(`A room can have ${n} ${name}.`);
  };
  if ('start' in what) {
    game.start = { room: roomId, x, y };
    return;
  }
  if ('kind' in what || 'item' in what) {
    room.actors = room.actors?.filter(away);
    room.items = room.items?.filter(away);
    if ('kind' in what) {
      limit(room.actors, LIMITS.actors, 'people and enemies');
      (room.actors ??= []).push({ kind: what.kind, x, y });
    } else {
      limit(room.items, LIMITS.roomItems, 'items');
      (room.items ??= []).push({ item: what.item, x, y });
    }
  } else if ('warp' in what) {
    room.warps = room.warps?.filter(away);
    limit(room.warps, LIMITS.warps, 'warps');
    (room.warps ??= []).push({ x, y, to: game.start.room, tx: game.start.x, ty: game.start.y });
  } else {
    room.triggers = room.triggers?.filter(away);
    limit(room.triggers, LIMITS.triggers, 'triggers');
    (room.triggers ??= []).push({ x, y, do: [] });
  }
  tidy(room);
}

/** Every list of actions in the game: events, dialogue lines and choices, triggers. */
export function allActions(game: Game): Action[][] {
  const lists: Action[][] = [];
  const event = (e: GameEvent | undefined) => {
    if (!e) return;
    if (Array.isArray(e)) lists.push(e);
    else for (const list of [e.do, e.else]) if (list) lists.push(list);
  };
  for (const room of game.rooms) {
    room.actors?.forEach((a) => event(a.bump));
    room.triggers?.forEach((t) => event(t));
  }
  game.kinds?.forEach((k) => (event(k.bump), event(k.death)));
  game.items?.forEach((i) => event(i.use));
  game.dialogue?.forEach((d) => d.lines.forEach((l) => (event(l), l.choices?.forEach(event))));
  game.quests?.forEach((q) => q.stages.forEach((s) => event(s.done)));
  event(game.lose);
  return lists;
}

/** Gives a room a new id, and changes everything that names it. */
export function renameRoom(game: Game, from: string, to: string) {
  if (!/^[a-z0-9_-]{1,24}$/.test(to)) throw new Error('A room id is 1 to 24 lower case letters, digits, - or _.');
  if (game.rooms.some((r) => r.id === to)) throw new Error(`There is a room "${to}" already.`);
  roomById(game, from).id = to;
  if (game.start.room === from) game.start.room = to;
  for (const room of game.rooms) for (const warp of room.warps ?? []) if (warp.to === from) warp.to = to;
  for (const list of allActions(game)) for (const action of list) if ('warp' in action && action.warp === from) action.warp = to;
  for (const quest of game.quests ?? []) for (const stage of quest.stages) if (stage.goal?.reach === from) stage.goal.reach = to;
}

/** Every list of conditions in the game. */
export function allConditions(game: Game): Condition[][] {
  const lists: Condition[][] = [];
  const event = (e: GameEvent | { if?: Condition[] } | undefined) => {
    if (e && !Array.isArray(e) && e.if) lists.push(e.if);
  };
  for (const room of game.rooms) {
    room.actors?.forEach((a) => event(a.bump));
    room.triggers?.forEach((t) => event(t));
  }
  game.kinds?.forEach((k) => (event(k.bump), event(k.death)));
  game.items?.forEach((i) => event(i.use));
  game.dialogue?.forEach((d) => d.lines.forEach((l) => (event(l), l.choices?.forEach(event))));
  game.quests?.forEach((q) => q.stages.forEach((s) => event(s.done)));
  event(game.lose);
  return lists;
}

function checkId(id: string, taken: { id: string }[] | undefined, what: string) {
  if (!/^[a-z0-9_-]{1,24}$/.test(id)) throw new Error(`An id is 1 to 24 lower case letters, digits, - or _.`);
  if (taken?.some((x) => x.id === id)) throw new Error(`There is ${what} "${id}" already.`);
}

/** Gives a character, item, dialogue or quest a new id, and changes everything that names it. */
export function renameId(game: Game, type: 'kind' | 'item' | 'dialogue' | 'quest', from: string, to: string) {
  const list = { kind: game.kinds, item: game.items, dialogue: game.dialogue, quest: game.quests }[type];
  checkId(to, list, type === 'item' ? 'an item' : `a ${type === 'kind' ? 'character' : type}`);
  const own = list?.find((x) => x.id === from);
  if (!own) throw new Error(`No ${type} has id ${from}`);
  own.id = to;
  const swap = <T extends object>(o: T | undefined, key: keyof T) => {
    if (o && o[key] === (from as T[keyof T])) o[key] = to as T[keyof T];
  };
  const actions = allActions(game).flat();
  const conditions = allConditions(game).flat();
  const goals = (game.quests ?? []).flatMap((q) => q.stages.map((s) => s.goal));
  const actors = game.rooms.flatMap((r) => r.actors ?? []);
  if (type === 'kind') {
    actors.forEach((a) => swap(a, 'kind'));
    goals.forEach((g) => (swap(g, 'talk'), swap(g, 'defeat')));
    game.dialogue?.forEach((d) => (swap(d, 'who'), d.lines.forEach((l) => swap(l, 'who'))));
  } else if (type === 'item') {
    game.rooms.forEach((r) => r.items?.forEach((i) => swap(i, 'item')));
    game.kinds?.forEach((k) => k.drops?.forEach((d) => swap(d, 'item')));
    actions.forEach((a) => (swap(a as { give?: string }, 'give'), swap(a as { take?: string }, 'take')));
    conditions.forEach((c) => swap(c as { has?: string }, 'has'));
    goals.forEach((g) => swap(g, 'collect'));
  } else if (type === 'dialogue') {
    game.kinds?.forEach((k) => swap(k, 'talk'));
    actors.forEach((a) => swap(a, 'talk'));
    actions.forEach((a) => swap(a as { say?: string }, 'say'));
  } else {
    actions.forEach((a) => swap(a as { quest?: string }, 'quest'));
    conditions.forEach((c) => swap(c as { quest?: string }, 'quest'));
  }
}

export function addKind(game: Game): Kind {
  if ((game.kinds?.length ?? 0) >= LIMITS.kinds) throw new Error(`A game can have ${LIMITS.kinds} characters.`);
  const id = freshId('character', (game.kinds ?? []).map((k) => k.id));
  const kind: Kind = { id, name: `Character ${id.slice(10)}`, sprite: game.player.sprite ?? 0, friendly: true };
  (game.kinds ??= []).push(kind);
  return kind;
}

/** Deletes a character and its people in every room. */
export function deleteKind(game: Game, id: string) {
  game.kinds = game.kinds?.filter((k) => k.id !== id);
  if (!game.kinds?.length) delete game.kinds;
  for (const room of game.rooms) {
    room.actors = room.actors?.filter((a) => a.kind !== id);
    tidy(room);
  }
}

export function addItem(game: Game): Item {
  if ((game.items?.length ?? 0) >= LIMITS.items) throw new Error(`A game can have ${LIMITS.items} items.`);
  const id = freshId('item', (game.items ?? []).map((i) => i.id));
  const item: Item = { id, name: `Item ${id.slice(5)}`, icon: game.player.sprite ?? 0 };
  (game.items ??= []).push(item);
  return item;
}

/** Deletes an item, the ones lying in rooms, and drops of it. */
export function deleteItem(game: Game, id: string) {
  game.items = game.items?.filter((i) => i.id !== id);
  if (!game.items?.length) delete game.items;
  for (const room of game.rooms) {
    room.items = room.items?.filter((i) => i.item !== id);
    tidy(room);
  }
  for (const kind of game.kinds ?? []) {
    kind.drops = kind.drops?.filter((d) => d.item !== id);
    if (!kind.drops?.length) delete kind.drops;
  }
}

export function addDialogue(game: Game): Dialogue {
  if ((game.dialogue?.length ?? 0) >= LIMITS.dialogue) throw new Error(`A game can have ${LIMITS.dialogue} dialogues.`);
  const dialogue: Dialogue = { id: freshId('talk', (game.dialogue ?? []).map((d) => d.id)), lines: [{ text: 'Hello!' }] };
  (game.dialogue ??= []).push(dialogue);
  return dialogue;
}

export function deleteDialogue(game: Game, id: string) {
  game.dialogue = game.dialogue?.filter((d) => d.id !== id);
  if (!game.dialogue?.length) delete game.dialogue;
}

export function addQuest(game: Game): Quest {
  if ((game.quests?.length ?? 0) >= LIMITS.quests) throw new Error(`A game can have ${LIMITS.quests} quests.`);
  const id = freshId('quest', (game.quests ?? []).map((q) => q.id));
  const quest: Quest = { id, title: `Quest ${id.slice(6)}`, stages: [{ log: 'What to do.' }] };
  (game.quests ??= []).push(quest);
  return quest;
}

export function deleteQuest(game: Game, id: string) {
  game.quests = game.quests?.filter((q) => q.id !== id);
  if (!game.quests?.length) delete game.quests;
}

/** "6,10 16,10" to [[6, 10], [16, 10]]: up to 16 points, each 0 to 63. */
export function parsePatrol(text: string): [number, number][] {
  return [...text.matchAll(/(\d+)\s*,\s*(\d+)/g)].slice(0, 16).map((m) => [Math.min(63, Number(m[1])), Math.min(63, Number(m[2]))]);
}
