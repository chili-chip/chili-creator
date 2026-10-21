import { byId } from './by-id';
import { drawingsOf, type DrawingKind } from './edit';
import { dialogName, drawingName, roomName } from './names';
import { scriptBody, scriptReferences } from './script';
import type { Id, World } from './types';

// Who uses what, for Find, safe delete and the validators.

/** A place in the game a tool can show. */
export type Location =
  | { type: 'game' }
  | { type: 'room'; room: Id; x?: number; y?: number }
  | { type: 'drawing'; kind: DrawingKind; id: Id }
  | { type: 'dialog'; id: Id }
  | { type: 'variable'; id: Id }
  | { type: 'palette'; id: Id };

export type Target =
  | { type: 'room'; room: Id }
  | { type: 'drawing'; kind: DrawingKind; id: Id }
  | { type: 'dialog'; id: Id }
  | { type: 'variable'; id: Id }
  | { type: 'palette'; id: Id };

export interface Reference {
  label: string;
  at: Location;
}

/** Dialogs and old-style ending texts, each with its name. */
function scripts(world: World) {
  return [...world.dialogs, ...world.endings].map((entry) => ({ entry, name: dialogName(entry) }));
}

export function referencesTo(world: World, target: Target): Reference[] {
  const refs: Reference[] = [];
  const dialogsWhere = (test: (refs: ReturnType<typeof scriptReferences>) => boolean) => {
    for (const { entry, name } of scripts(world)) {
      if (test(scriptReferences(entry.script))) refs.push({ label: name, at: { type: 'dialog', id: entry.id } });
    }
  };

  switch (target.type) {
    case 'room': {
      const room = byId(world.rooms, target.room);
      for (const from of world.rooms) {
        for (const exit of from.exits) {
          if (exit.dest.room !== target.room) continue;
          refs.push({
            label: `Exit in ${roomName(from)} at ${exit.x},${exit.y}`,
            at: { type: 'room', room: from.id, x: exit.x, y: exit.y },
          });
        }
      }
      dialogsWhere((r) => r.rooms.has(target.room) || (!!room?.name && r.rooms.has(room.name)));
      break;
    }
    case 'drawing': {
      const drawing = byId(drawingsOf(world, target.kind), target.id);
      if (target.kind === 'tiles') {
        for (const room of world.rooms) {
          const cells = room.tilemap.flat().filter((cell) => cell === target.id).length;
          if (cells) refs.push({ label: `${roomName(room)}: ${cells} cells`, at: { type: 'room', room: room.id } });
        }
      } else if (target.kind === 'items') {
        for (const room of world.rooms) {
          for (const item of room.items) {
            if (item.id !== target.id) continue;
            refs.push({ label: `${roomName(room)} at ${item.x},${item.y}`, at: { type: 'room', room: room.id, x: item.x, y: item.y } });
          }
        }
        for (const sprite of world.sprites) {
          const entry = sprite.inventory.find((e) => e.id === target.id);
          if (entry) {
            refs.push({
              label: `${drawingName('sprites', sprite)} carries ${entry.count}`,
              at: { type: 'drawing', kind: 'sprites', id: sprite.id },
            });
          }
        }
        dialogsWhere((r) => r.items.has(target.id) || (!!drawing?.name && r.items.has(drawing.name)));
      } else if (drawing && 'position' in drawing && drawing.position) {
        const { room: roomId, x, y } = drawing.position as { room: Id; x: number; y: number };
        const room = byId(world.rooms, roomId);
        refs.push({ label: `Stands in ${room ? roomName(room) : `room ${roomId}`} at ${x},${y}`, at: { type: 'room', room: roomId, x, y } });
      }
      break;
    }
    case 'dialog': {
      for (const kind of ['sprites', 'items'] as const) {
        for (const drawing of world[kind]) {
          if (drawing.dialog === target.id) {
            refs.push({ label: drawingName(kind, drawing), at: { type: 'drawing', kind, id: drawing.id } });
          }
        }
      }
      for (const room of world.rooms) {
        for (const exit of room.exits) {
          if (exit.dialog !== target.id) continue;
          refs.push({ label: `Exit in ${roomName(room)} at ${exit.x},${exit.y}`, at: { type: 'room', room: room.id, x: exit.x, y: exit.y } });
        }
        for (const ending of room.endings) {
          if (ending.id !== target.id) continue;
          refs.push({ label: `Ending in ${roomName(room)} at ${ending.x},${ending.y}`, at: { type: 'room', room: room.id, x: ending.x, y: ending.y } });
        }
      }
      break;
    }
    case 'variable':
      dialogsWhere((r) => r.variables.has(target.id));
      break;
    case 'palette':
      for (const room of world.rooms) {
        if (room.palette === target.id) refs.push({ label: roomName(room), at: { type: 'room', room: room.id } });
      }
      break;
  }
  return refs;
}

export interface SearchResult extends Reference {
  detail?: string;
}

function firstLine(text: string): string {
  const line = text.split('\n').find((l) => l.trim() && l.trim() !== '"""') ?? '';
  return line.trim().length > 80 ? `${line.trim().slice(0, 79)}…` : line.trim();
}

/** Things whose name, id or text has `query` in it. */
export function search(world: World, query: string): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const has = (...texts: (string | undefined)[]) => texts.some((t) => t?.toLowerCase().includes(needle));
  const results: SearchResult[] = [];
  for (const kind of ['tiles', 'sprites', 'items'] as const) {
    for (const drawing of world[kind]) {
      const name = drawingName(kind, drawing);
      if (has(name) || drawing.id.toLowerCase() === needle) results.push({ label: name, at: { type: 'drawing', kind, id: drawing.id } });
    }
  }
  for (const room of world.rooms) {
    if (has(roomName(room))) results.push({ label: roomName(room), at: { type: 'room', room: room.id } });
  }
  for (const { entry, name } of scripts(world)) {
    const text = scriptBody(entry.script);
    if (!has(name, text)) continue;
    const hit = text.split('\n').find((line) => line.toLowerCase().includes(needle));
    results.push({ label: name, detail: firstLine(hit ?? text), at: { type: 'dialog', id: entry.id } });
  }
  for (const variable of world.variables) {
    if (has(variable.id)) results.push({ label: variable.id, detail: `starts at ${variable.value}`, at: { type: 'variable', id: variable.id } });
  }
  for (const palette of world.palettes) {
    const name = palette.name || `Palette ${palette.id}`;
    if (has(name)) results.push({ label: name, at: { type: 'palette', id: palette.id } });
  }
  return results;
}
