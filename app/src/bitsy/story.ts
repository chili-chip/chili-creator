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

/** Puts an exit on a cell, leading to the same spot in the next room. Returns its index. */
export function addExit(world: World, roomId: Id, x: number, y: number): number {
  const room = byId(world.rooms, roomId);
  if (!room) return -1;
  const existing = exitAt(room, x, y);
  if (existing >= 0) return existing;
  removeEndingAt(world, roomId, x, y);
  const index = world.rooms.indexOf(room);
  const dest = world.rooms[index + 1] ?? world.rooms.find((r) => r !== room) ?? room;
  const exit: Exit = { x, y, dest: { room: dest.id, x, y } };
  room.exits.push(exit);
  return room.exits.length - 1;
}

export function removeExitAt(room: Room, x: number, y: number): boolean {
  const index = exitAt(room, x, y);
  if (index < 0) return false;
  room.exits.splice(index, 1);
  return true;
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
  const room = byId(world.rooms, roomId);
  if (!room) return false;
  return removeExitAt(room, x, y) || removeEndingAt(world, roomId, x, y);
}
