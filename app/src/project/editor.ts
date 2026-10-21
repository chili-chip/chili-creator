import { AVATAR, byId, drawingsOf, type Drawing, type DrawingKind, type Id, type Room, type World } from '../bitsy';

// What the editing tools have picked: the room being edited, the drawing
// being painted and placed, and the tool modes. Tools share it, so picking a
// sprite in the Library opens it in Paint and places it in the Room.

export interface DrawingRef {
  kind: DrawingKind;
  id: Id;
}

export type RoomTool = 'place' | 'erase';
export type PaintTool = 'pencil' | 'fill';

export interface EditorState {
  room: Id | null;
  drawing: DrawingRef | null;
  /** The animation frame Paint shows. */
  frame: number;
  roomTool: RoomTool;
  paintTool: PaintTool;
  libraryTab: DrawingKind;
}

const initial: EditorState = {
  room: null,
  drawing: null,
  frame: 0,
  roomTool: 'place',
  paintTool: 'pencil',
  libraryTab: 'sprites',
};

export function createEditorState() {
  let state = initial;
  const listeners = new Set<() => void>();

  function set(patch: Partial<EditorState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  return {
    getState: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set,
    /** Picks a drawing for Paint and the Room, and shows its kind in the Library. */
    select(drawing: DrawingRef) {
      set({ drawing, libraryTab: drawing.kind, frame: 0 });
    },
    /** A game was opened: start where the avatar is, with the avatar picked. */
    reset(world: World) {
      const avatar = byId(world.sprites, AVATAR);
      const room = (avatar?.position && byId(world.rooms, avatar.position.room)) || world.rooms[0];
      set({
        ...initial,
        room: room?.id ?? null,
        drawing: avatar ? { kind: 'sprites', id: AVATAR } : null,
      });
    },
  };
}

export type EditorStore = ReturnType<typeof createEditorState>;

export interface Resolved {
  room: Room | undefined;
  kind: DrawingKind | undefined;
  drawing: Drawing | undefined;
  frame: number;
}

/** The picked room and drawing as they are in `world` now; gone ones fall back. */
export function resolveSelection(world: World, state: EditorState): Resolved {
  const room = (state.room !== null && byId(world.rooms, state.room)) || world.rooms[0];
  const drawing = state.drawing ? byId(drawingsOf(world, state.drawing.kind), state.drawing.id) : undefined;
  const frame = drawing ? Math.min(state.frame, drawing.frames.length - 1) : 0;
  return { room, kind: drawing ? state.drawing!.kind : undefined, drawing, frame: Math.max(frame, 0) };
}
