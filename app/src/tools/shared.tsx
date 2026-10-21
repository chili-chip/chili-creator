import type { ReactNode } from 'react';
import type { DrawingKind, Location } from '../bitsy';
import { useCreator } from '../shell/creator-context';
import { Button } from '../ui/button';

// Small things the editing tools share. Tools never import each other.

export const kinds: Record<DrawingKind, { one: string; title: string; many: string }> = {
  tiles: { one: 'tile', title: 'Tile', many: 'Tiles' },
  sprites: { one: 'sprite', title: 'Sprite', many: 'Sprites' },
  items: { one: 'item', title: 'Item', many: 'Items' },
};

export { dialogName, drawingName, roomName } from '../bitsy';

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

/** Shows a place in the game in the tool that edits it. */
export function useGoTo(): (location: Location) => void {
  const creator = useCreator();
  return (location) => {
    const tool = creator.editor.goTo(location);
    creator.commands.execute(`tool.open.${tool}`);
  };
}

/** Asks before something that removes work; undo can still bring it back. */
export function Confirm({ question, onKeep, onDelete }: { question: ReactNode; onKeep(): void; onDelete(): void }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 pt-2 text-xs">
      <span className="mr-auto">{question}</span>
      <Button size="sm" variant="ghost" onClick={onKeep}>
        Keep it
      </Button>
      <Button size="sm" variant="destructive" onClick={onDelete}>
        Delete for good
      </Button>
    </div>
  );
}

/** "1 dialog", "2 dialogs". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
