import { byId } from './by-id';
import { AVATAR, EMPTY_TILE, ROOM_SIZE } from './edit';
import { dialogName, drawingName, roomName } from './names';
import type { Location } from './references';
import { scriptReferences } from './script';
import type { World } from './types';

// Checks run before play and release: broken references and games that
// cannot be finished. Errors break the game; warnings are worth a look.

export interface Problem {
  severity: 'error' | 'warning';
  message: string;
  at: Location;
}

export function validate(world: World): Problem[] {
  const problems: Problem[] = [];
  const error = (message: string, at: Location) => problems.push({ severity: 'error', message, at });
  const warning = (message: string, at: Location) => problems.push({ severity: 'warning', message, at });

  if (!world.title.trim()) warning('The game has no title.', { type: 'game' });

  const avatar = byId(world.sprites, AVATAR);
  if (!avatar) error('The game has no avatar (sprite A).', { type: 'game' });
  else if (!avatar.position || !byId(world.rooms, avatar.position.room)) {
    error('The avatar is not in any room.', { type: 'drawing', kind: 'sprites', id: AVATAR });
  }

  const tiles = new Set(world.tiles.map((t) => t.id));
  const items = new Set(world.items.map((i) => i.id));
  const dialogs = new Set([...world.dialogs, ...world.endings].map((d) => d.id));
  const inside = (n: number) => Number.isInteger(n) && n >= 0 && n < ROOM_SIZE;

  for (const room of world.rooms) {
    const name = roomName(room);
    const here = { type: 'room', room: room.id } as const;
    if (room.palette !== undefined && !byId(world.palettes, room.palette)) {
      error(`${name} uses palette ${room.palette}, which does not exist.`, here);
    }
    const missing = new Set<string>();
    room.tilemap.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell === EMPTY_TILE || tiles.has(cell) || missing.has(cell)) return;
        missing.add(cell);
        error(`${name} has tile ${cell}, which does not exist.`, { ...here, x, y });
      }),
    );
    for (const item of room.items) {
      if (!items.has(item.id)) error(`${name} has item ${item.id}, which does not exist.`, { ...here, x: item.x, y: item.y });
    }
    for (const exit of room.exits) {
      const at = { ...here, x: exit.x, y: exit.y };
      const which = `The exit at ${exit.x},${exit.y} in ${name}`;
      if (!byId(world.rooms, exit.dest.room)) error(`${which} leads to room ${exit.dest.room}, which does not exist.`, at);
      else if (!inside(exit.dest.x) || !inside(exit.dest.y)) error(`${which} leads off the room (${exit.dest.x},${exit.dest.y}).`, at);
      if (exit.dialog !== undefined && !dialogs.has(exit.dialog)) {
        warning(`${which} uses dialog ${exit.dialog}, which does not exist.`, at);
      }
    }
    for (const ending of room.endings) {
      if (!dialogs.has(ending.id)) {
        warning(`The ending at ${ending.x},${ending.y} in ${name} has no text.`, { ...here, x: ending.x, y: ending.y });
      }
    }
  }

  for (const kind of ['sprites', 'items'] as const) {
    for (const drawing of world[kind]) {
      const name = drawingName(kind, drawing);
      const at = { type: 'drawing', kind, id: drawing.id } as const;
      if (drawing.dialog !== undefined && !dialogs.has(drawing.dialog)) {
        error(`${name} uses dialog ${drawing.dialog}, which does not exist.`, at);
      }
      if (kind === 'sprites' && drawing.id !== AVATAR) {
        const position = world.sprites.find((s) => s.id === drawing.id)!.position;
        if (position && !byId(world.rooms, position.room)) {
          error(`${name} stands in room ${position.room}, which does not exist.`, at);
        }
      }
      if ('inventory' in drawing) {
        for (const entry of drawing.inventory) {
          if (!items.has(entry.id)) warning(`${name} carries item ${entry.id}, which does not exist.`, at);
        }
      }
    }
  }

  const all = [...world.dialogs, ...world.endings].map((entry) => ({ entry, refs: scriptReferences(entry.script) }));
  const assigned = new Set([...world.variables.map((v) => v.id), ...all.flatMap(({ refs }) => [...refs.assigned])]);
  const roomNames = new Set(world.rooms.flatMap((r) => (r.name ? [r.id, r.name] : [r.id])));
  const itemNames = new Set(world.items.flatMap((i) => (i.name ? [i.id, i.name] : [i.id])));
  for (const { entry, refs } of all) {
    const name = dialogName(entry);
    const at = { type: 'dialog', id: entry.id } as const;
    for (const room of refs.rooms) if (!roomNames.has(room)) error(`${name} exits to room "${room}", which does not exist.`, at);
    for (const item of refs.items) if (!itemNames.has(item)) warning(`${name} checks item "${item}", which does not exist.`, at);
    for (const variable of refs.variables) {
      if (!assigned.has(variable)) warning(`${name} reads ${variable}, a variable that is never set.`, at);
    }
  }

  const endings = world.rooms.some((room) => room.endings.length > 0) || all.some(({ refs }) => refs.endsGame);
  if (!endings) warning('Players cannot finish this game yet: add an ending.', { type: 'game' });

  return problems;
}

/** "1 error, 2 warnings". */
export function problemSummary(problems: readonly Problem[]): string {
  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.length - errors;
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [errors && count(errors, 'error'), warnings && count(warnings, 'warning')].filter(Boolean).join(', ');
}
