import type { ReactNode } from 'react';
import { AVATAR, type Drawing, type DrawingKind, type Room } from '../bitsy';

// Small things the editing tools share. Tools never import each other.

export const kinds: Record<DrawingKind, { one: string; title: string; many: string }> = {
  tiles: { one: 'tile', title: 'Tile', many: 'Tiles' },
  sprites: { one: 'sprite', title: 'Sprite', many: 'Sprites' },
  items: { one: 'item', title: 'Item', many: 'Items' },
};

/** What people call a drawing: its name, else "tile b". The avatar is "avatar". */
export function drawingName(kind: DrawingKind, drawing: Drawing): string {
  if (drawing.name) return drawing.name;
  if (kind === 'sprites' && drawing.id === AVATAR) return 'avatar';
  return `${kinds[kind].one} ${drawing.id}`;
}

export function roomName(room: Room): string {
  return room.name || `Room ${room.id}`;
}

let strokes = 0;

/** A fresh undo group, so one stroke or one picker drag is one undo step. */
export function newGroup(prefix: string): string {
  strokes += 1;
  return `${prefix}-${strokes}`;
}

/** What a tool shows when there is nothing to work on yet. */
export function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
      <div className="max-w-60 space-y-2">
        <div className="mx-auto w-fit [&_svg]:size-8" aria-hidden>
          {icon}
        </div>
        <p>{children}</p>
      </div>
    </div>
  );
}
