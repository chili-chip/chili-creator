import {
  AVATAR,
  byId,
  drawingsOf,
  endingAt,
  exitAt,
  type Dialog,
  type Drawing,
  type DrawingKind,
  type Id,
  type Location,
  type Room,
  type World,
} from '../bitsy';

// What the editing tools have picked: the room being edited, the drawing
// being painted and placed, the dialog being written, the exit or ending
// being changed, and the tool modes. Tools share it, so picking a sprite in
// the Library opens it in Paint, places it in the Room and shows its dialog.

export interface DrawingRef {
  kind: DrawingKind;
  id: Id;
}

export type RoomTool = 'place' | 'erase' | 'exit' | 'ending';
export type PaintTool = 'pencil' | 'fill';

export interface EditorState {
  room: Id | null;
  drawing: DrawingRef | null;
  /** The animation frame Paint shows. */
  frame: number;
  roomTool: RoomTool;
  paintTool: PaintTool;
  libraryTab: DrawingKind;
  /** The dialog picked in the Dialog tool; null follows the picked drawing. */
  dialog: Id | null;
  /** The cell in the room whose exit or ending is being changed. */
  marker: { x: number; y: number } | null;
  /** The tune and blip picked in the sound tools. */
  tune: Id | null;
  blip: Id | null;
}

const initial: EditorState = {
  room: null,
  drawing: null,
  frame: 0,
  roomTool: 'place',
  paintTool: 'pencil',
  libraryTab: 'sprites',
  dialog: null,
  marker: null,
  tune: null,
  blip: null,
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
      set({ drawing, libraryTab: drawing.kind, frame: 0, dialog: null });
    },
    /** Shows a place in the game; returns the id of the tool that shows it. */
    goTo(location: Location): string {
      switch (location.type) {
        case 'room':
          set({ room: location.room, marker: location.x === undefined ? null : { x: location.x, y: location.y! } });
          return 'room';
        case 'drawing':
          set({ drawing: { kind: location.kind, id: location.id }, libraryTab: location.kind, frame: 0, dialog: null });
          return 'paint';
        case 'dialog':
          set({ dialog: location.id });
          return 'dialog';
        case 'variable':
          return 'variables';
        case 'palette':
          return 'colors';
        case 'game':
          return 'game';
        case 'tune':
          set({ tune: location.id });
          return 'tunes';
        case 'blip':
          set({ blip: location.id });
          return 'blips';
      }
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

export interface Marker {
  x: number;
  y: number;
  /** Index of the exit on the cell. */
  exit?: number;
  /** Id of the ending on the cell. */
  ending?: Id;
}

export interface Resolved {
  room: Room | undefined;
  kind: DrawingKind | undefined;
  drawing: Drawing | undefined;
  frame: number;
  dialog: Dialog | undefined;
  marker: Marker | undefined;
}

/** The picked room and drawing as they are in `world` now; gone ones fall back. */
export function resolveSelection(world: World, state: EditorState): Resolved {
  const room = (state.room !== null && byId(world.rooms, state.room)) || world.rooms[0];
  const drawing = state.drawing ? byId(drawingsOf(world, state.drawing.kind), state.drawing.id) : undefined;
  const frame = drawing ? Math.min(state.frame, drawing.frames.length - 1) : 0;
  const own = drawing && 'dialog' in drawing ? (drawing as { dialog?: Id }).dialog : undefined;
  const dialog =
    (state.dialog !== null && byId(world.dialogs, state.dialog)) || (own !== undefined ? byId(world.dialogs, own) : undefined);
  let marker: Marker | undefined;
  if (room && state.marker) {
    const { x, y } = state.marker;
    const exit = exitAt(room, x, y);
    const ending = endingAt(room, x, y);
    if (exit >= 0) marker = { x, y, exit };
    else if (ending) marker = { x, y, ending: ending.id };
  }
  return {
    room,
    kind: drawing ? state.drawing!.kind : undefined,
    drawing,
    frame: Math.max(frame, 0),
    dialog: dialog || undefined,
    marker,
  };
}
