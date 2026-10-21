import { AVATAR, type DrawingKind } from './edit';
import type { Dialog, Drawing, Room } from './types';

// What people call things in a game, for lists, messages and references.

const singular: Record<DrawingKind, string> = { tiles: 'tile', sprites: 'sprite', items: 'item' };

/** A drawing's name, else "tile b". The avatar is "avatar". */
export function drawingName(kind: DrawingKind, drawing: Drawing): string {
  if (drawing.name) return drawing.name;
  if (kind === 'sprites' && drawing.id === AVATAR) return 'avatar';
  return `${singular[kind]} ${drawing.id}`;
}

export function roomName(room: Room): string {
  return room.name || `Room ${room.id}`;
}

export function dialogName(dialog: Pick<Dialog, 'id' | 'name'>): string {
  return dialog.name || `dialog ${dialog.id}`;
}
