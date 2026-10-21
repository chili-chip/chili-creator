import { byId } from './by-id';
import { AVATAR, nextId, type DrawingKind } from './edit';
import { renameVariableInScript, scriptBody, toScript } from './script';
import type { Exit, Id, Placement, Room, World } from './types';

// Edits for the story side of a game: dialogs, exits, endings, variables and
// rooms. Like edit.ts, they change the world in place.

/** Dialog and ending ids share one space: an ending's text is the dialog with its id. */
function storyIds(world: World): Id[] {
  return [...world.dialogs.map((d) => d.id), ...world.endings.map((e) => e.id)];
}

/** Adds a dialog and returns its id. */
export function addDialog(world: World, text = '', name?: string): Id {
  const id = nextId(storyIds(world));
  world.dialogs.push({ id, script: toScript(text), ...(name === undefined ? {} : { name }) });
  return id;
}

/** A dialog's text without the `"""` wrapper. Endings from before Bitsy 7 count too. */
export function dialogText(world: World, id: Id): string | undefined {
  const entry = byId(world.dialogs, id) ?? byId(world.endings, id);
  return entry && scriptBody(entry.script);
}

export function setDialogText(world: World, id: Id, text: string): void {
  const entry = byId(world.dialogs, id) ?? byId(world.endings, id);
  if (entry) entry.script = toScript(text);
}

/** The dialog of a sprite or item, made the first time it is asked for. Tiles do not talk. */
export function giveDialog(world: World, kind: DrawingKind, drawingId: Id): Id | null {
  if (kind === 'tiles') return null;
  const drawing = byId(kind === 'sprites' ? world.sprites : world.items, drawingId);
  if (!drawing) return null;
  if (drawing.dialog !== undefined && byId(world.dialogs, drawing.dialog)) return drawing.dialog;
  drawing.dialog = addDialog(world);
  return drawing.dialog;
}

/** Removes a dialog and the sprites, items and exits that pointed to it. */
export function removeDialog(world: World, id: Id): boolean {
  const index = world.dialogs.findIndex((d) => d.id === id);
  if (index < 0) return false;
  world.dialogs.splice(index, 1);
  for (const drawing of [...world.sprites, ...world.items]) {
    if (drawing.dialog === id) delete drawing.dialog;
  }
  for (const room of world.rooms) {
    for (const exit of room.exits) if (exit.dialog === id) delete exit.dialog;
  }
  return true;
}

function dialogInUse(world: World, id: Id): boolean {
  return (
    [...world.sprites, ...world.items].some((d) => d.dialog === id) ||
    world.rooms.some((room) => room.exits.some((e) => e.dialog === id) || room.endings.some((e) => e.id === id))
  );
}

export function exitAt(room: Room, x: number, y: number): number {
  return room.exits.findIndex((exit) => exit.x === x && exit.y === y);
}

export function endingAt(room: Room, x: number, y: number): Placement | undefined {
  return room.endings.find((ending) => ending.x === x && ending.y === y);
}

function cellTaken(room: Room, x: number, y: number): boolean {
  return exitAt(room, x, y) >= 0 || endingAt(room, x, y) !== undefined;
}

/** Where an exit is: its room and its index there. */
export interface ExitRef {
  room: Id;
  index: number;
}

/** The exit that leads back: in the destination room, leading to this exit's cell. */
export function returnExitOf(world: World, roomId: Id, index: number): ExitRef | undefined {
  const exit = byId(world.rooms, roomId)?.exits[index];
  const dest = exit && byId(world.rooms, exit.dest.room);
  if (!exit || !dest) return undefined;
  const back = dest.exits.findIndex((e) => e !== exit && e.dest.room === roomId && e.dest.x === exit.x && e.dest.y === exit.y);
  return back < 0 ? undefined : { room: dest.id, index: back };
}

/** Adds the way back at an exit's destination, unless something is on that cell. */
function addReturn(world: World, roomId: Id, exit: Exit): void {
  const dest = byId(world.rooms, exit.dest.room);
  if (!dest || cellTaken(dest, exit.dest.x, exit.dest.y)) return;
  dest.exits.push({ x: exit.dest.x, y: exit.dest.y, dest: { room: roomId, x: exit.x, y: exit.y } });
}

function removeRef(world: World, ref: ExitRef | undefined): Exit | undefined {
  const room = ref && byId(world.rooms, ref.room);
  return room?.exits.splice(ref!.index, 1)[0];
}

/**
 * Puts an exit on a cell, leading to the same spot in the next room, and the
 * way back there unless `twoWay` is false. Returns its index.
 */
export function addExit(world: World, roomId: Id, x: number, y: number, { twoWay = true }: { twoWay?: boolean } = {}): number {
  const room = byId(world.rooms, roomId);
  if (!room) return -1;
  const existing = exitAt(room, x, y);
  if (existing >= 0) return existing;
  removeEndingAt(world, roomId, x, y);
  const index = world.rooms.indexOf(room);
  const dest = world.rooms[index + 1] ?? world.rooms.find((r) => r !== room) ?? room;
  const exit: Exit = { x, y, dest: { room: dest.id, x, y } };
  room.exits.push(exit);
  if (twoWay) addReturn(world, roomId, exit);
  return room.exits.indexOf(exit);
}

/** Makes an exit two-way (adding the way back) or one-way (removing it). */
export function setTwoWay(world: World, roomId: Id, index: number, twoWay: boolean): void {
  const exit = byId(world.rooms, roomId)?.exits[index];
  if (!exit) return;
  const back = returnExitOf(world, roomId, index);
  if (twoWay && !back) addReturn(world, roomId, exit);
  if (!twoWay && back) removeRef(world, back);
}

/** Turns a one-way exit around: it now leads from its destination to its cell. Returns where it is now. */
export function reverseExit(world: World, roomId: Id, index: number): ExitRef | undefined {
  const room = byId(world.rooms, roomId);
  const exit = room?.exits[index];
  const dest = exit && byId(world.rooms, exit.dest.room);
  if (!room || !exit || !dest || returnExitOf(world, roomId, index)) return undefined;
  if (cellTaken(dest, exit.dest.x, exit.dest.y) && !(dest === room && exit.dest.x === exit.x && exit.dest.y === exit.y)) return undefined;
  room.exits.splice(index, 1);
  const reversed: Exit = { ...exit, x: exit.dest.x, y: exit.dest.y, dest: { room: roomId, x: exit.x, y: exit.y } };
  dest.exits.push(reversed);
  return { room: dest.id, index: dest.exits.length - 1 };
}

/** Moves an exit to another cell of its room; the way back follows. False when the cell is taken. */
export function moveExit(world: World, roomId: Id, index: number, x: number, y: number): boolean {
  const room = byId(world.rooms, roomId);
  const exit = room?.exits[index];
  if (!room || !exit || cellTaken(room, x, y)) return false;
  const back = returnExitOf(world, roomId, index);
  exit.x = x;
  exit.y = y;
  const backExit = back && byId(world.rooms, back.room)?.exits[back.index];
  if (backExit) backExit.dest = { room: roomId, x, y };
  return true;
}

/** Changes where an exit leads; the way back moves there too. */
export function setExitDest(world: World, roomId: Id, index: number, dest: Exit['dest']): void {
  const exit = byId(world.rooms, roomId)?.exits[index];
  if (!exit) return;
  const back = returnExitOf(world, roomId, index);
  const backExit = removeRef(world, back);
  exit.dest = { ...dest };
  if (!backExit) return;
  const target = byId(world.rooms, dest.room);
  if (target && !cellTaken(target, dest.x, dest.y)) target.exits.push({ ...backExit, x: dest.x, y: dest.y });
}

/** Takes an exit and its way back off the map. */
export function removeExit(world: World, roomId: Id, x: number, y: number): boolean {
  const room = byId(world.rooms, roomId);
  const index = room ? exitAt(room, x, y) : -1;
  if (!room || index < 0) return false;
  const back = returnExitOf(world, roomId, index);
  const exit = room.exits[index]!;
  removeRef(world, back);
  room.exits.splice(room.exits.indexOf(exit), 1);
  if (exit.dialog !== undefined && !dialogInUse(world, exit.dialog)) removeDialog(world, exit.dialog);
  return true;
}

/** Takes the exit off one cell only, leaving any way back. */
export function removeExitAt(room: Room, x: number, y: number): boolean {
  const index = exitAt(room, x, y);
  if (index < 0) return false;
  room.exits.splice(index, 1);
  return true;
}

export type ExitDialogKind = 'narration' | 'lock';

/** The item a lock asks for: one called key, or else the first item. */
function keyItem(world: World): Id | undefined {
  return (world.items.find((i) => /key/i.test(i.name ?? '')) ?? world.items[0])?.id;
}

function exitDialogScript(world: World, kind: ExitDialogKind): { text: string; name: string } {
  if (kind === 'narration') return { text: 'You walk through the doorway', name: 'exit narration' };
  const key = keyItem(world) ?? '1';
  return {
    name: 'locked exit',
    text: [
      '{',
      `  - {item "${key}"} >= 1 ?`,
      '    {property locked false}',
      '    The key opens the door!',
      '  - else ?',
      '    {property locked true}',
      '    The door is locked...',
      '}',
    ].join('\n'),
  };
}

/**
 * Gives an exit a new dialog (narration, or a lock opened by a key), or none.
 * The old one goes when nothing else uses it. Returns the new dialog's id.
 */
export function setExitDialog(world: World, roomId: Id, index: number, kind: ExitDialogKind | null): Id | undefined {
  const exit = byId(world.rooms, roomId)?.exits[index];
  if (!exit) return undefined;
  const old = exit.dialog;
  delete exit.dialog;
  if (old !== undefined && !dialogInUse(world, old)) world.dialogs = world.dialogs.filter((d) => d.id !== old);
  if (!kind) return undefined;
  const { text, name } = exitDialogScript(world, kind);
  exit.dialog = addDialog(world, text, name);
  return exit.dialog;
}

/** Puts an ending on a cell, with its own text. Returns the ending's id. */
export function addEnding(world: World, roomId: Id, x: number, y: number, text = 'The end'): Id {
  const room = byId(world.rooms, roomId);
  if (!room) return '';
  const existing = endingAt(room, x, y);
  if (existing) return existing.id;
  removeExitAt(room, x, y);
  const id = addDialog(world, text);
  room.endings.push({ id, x, y });
  return id;
}

/** Takes an ending off a cell, and its text when nothing else uses it. */
export function removeEndingAt(world: World, roomId: Id, x: number, y: number): boolean {
  const room = byId(world.rooms, roomId);
  const ending = room && endingAt(room, x, y);
  if (!room || !ending) return false;
  room.endings.splice(room.endings.indexOf(ending), 1);
  if (!dialogInUse(world, ending.id)) {
    world.dialogs = world.dialogs.filter((d) => d.id !== ending.id);
  }
  return true;
}

const variableName = /^[A-Za-z_]\w*$/;
const reserved = new Set(['true', 'false', 'else', 'sequence', 'cycle', 'shuffle']);

/** Adds a variable under the first free letter, starting at 0, and returns its name. */
export function addVariable(world: World): Id {
  const taken = new Set(world.variables.map((v) => v.id));
  let name = 'abcdefghijklmnopqrstuvwxyz'.split('').find((letter) => !taken.has(letter));
  for (let n = 1; !name; n++) if (!taken.has(`var${n}`)) name = `var${n}`;
  world.variables.push({ id: name, value: '0', extra: [] });
  return name;
}

/** Renames a variable in VAR and every script. False when the name is taken or not a name. */
export function renameVariable(world: World, from: Id, to: string): boolean {
  const variable = byId(world.variables, from);
  if (!variable || !variableName.test(to) || reserved.has(to) || byId(world.variables, to)) return false;
  variable.id = to;
  for (const entry of [...world.dialogs, ...world.endings]) {
    entry.script = renameVariableInScript(entry.script, from, to);
  }
  return true;
}

export function removeVariable(world: World, id: Id): boolean {
  const before = world.variables.length;
  world.variables = world.variables.filter((v) => v.id !== id);
  return world.variables.length < before;
}

/** Removes a room, the exits into it and the sprites standing in it. The avatar's room stays. */
export function removeRoom(world: World, id: Id): boolean {
  const avatar = byId(world.sprites, AVATAR);
  if (world.rooms.length < 2 || avatar?.position?.room === id) return false;
  const before = world.rooms.length;
  world.rooms = world.rooms.filter((room) => room.id !== id);
  if (world.rooms.length === before) return false;
  for (const room of world.rooms) room.exits = room.exits.filter((exit) => exit.dest.room !== id);
  for (const sprite of world.sprites) if (sprite.position?.room === id) delete sprite.position;
  return true;
}

/** Takes the exit or ending off a cell, for the room's eraser. */
export function eraseMarkerAt(world: World, roomId: Id, x: number, y: number): boolean {
  return removeExit(world, roomId, x, y) || removeEndingAt(world, roomId, x, y);
}
