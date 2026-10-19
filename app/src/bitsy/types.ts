// The typed Bitsy world: what a `.bitsy` file holds, in a form tools can edit.
//
// Collections are arrays in file order (object keys would reorder ids like
// "10" before "a"). `layout` remembers how the file was written, so
// unchanged parts serialize back byte for byte.

export type Id = string;

/** 8×8 pixels, row by row: 0 is the background colour, 1 the drawing colour. */
export type Frame = number[];

export type Rgb = [number, number, number];

export interface Palette {
  id: Id;
  name?: string;
  colors: Rgb[];
  /** Lines this model does not know, kept as they were. */
  extra: string[];
}

export interface Position {
  room: Id;
  x: number;
  y: number;
}

export interface Placement {
  id: Id;
  x: number;
  y: number;
}

export interface Exit {
  x: number;
  y: number;
  dest: Position;
  /** Transition effect, like `fade_w`. */
  transition?: string;
  dialog?: Id;
}

export interface Room {
  id: Id;
  name?: string;
  /** 16 rows of 16 tile ids; "0" is an empty cell. */
  tilemap: Id[][];
  /** Room-specific walls (older games). */
  walls: Id[];
  items: Placement[];
  exits: Exit[];
  endings: Placement[];
  palette?: Id;
  /** Sprite drawn as the avatar in this room. */
  avatar?: Id;
  tune?: Id;
  extra: string[];
}

export interface Drawing {
  id: Id;
  name?: string;
  /** One or more animation frames. */
  frames: Frame[];
  /** Palette index of the drawing colour, when not the default. */
  color?: number;
  /** Palette index of the background, or transparent. */
  background?: number | 'transparent';
  extra: string[];
}

export interface Tile extends Drawing {
  wall?: boolean;
}

export interface InventoryEntry {
  id: Id;
  count: number;
}

export interface Sprite extends Drawing {
  dialog?: Id;
  position?: Position;
  inventory: InventoryEntry[];
  blip?: Id;
}

export interface Item extends Drawing {
  dialog?: Id;
  blip?: Id;
}

export interface Dialog {
  id: Id;
  name?: string;
  /** Script source as written, `"""` blocks included. */
  script: string;
}

/** Ending text from games made before Bitsy 7. */
export interface Ending {
  id: Id;
  name?: string;
  script: string;
}

export interface Variable {
  id: Id;
  value: string;
  extra: string[];
}

/**
 * Tunes, blips and fonts keep their lines as written until the sound and font
 * tools need them typed.
 */
export interface RawBlock {
  id: Id;
  name?: string;
  lines: string[];
}

export interface World {
  title: string;
  /** `! NAME value` lines, like ROOM_FORMAT and VER_MAJ. */
  flags: Record<string, string>;
  defaultFont?: string;
  textDirection?: string;
  palettes: Palette[];
  rooms: Room[];
  tiles: Tile[];
  sprites: Sprite[];
  items: Item[];
  dialogs: Dialog[];
  endings: Ending[];
  variables: Variable[];
  tunes: RawBlock[];
  blips: RawBlock[];
  fonts: RawBlock[];
  layout?: Layout;
}

export type Collection =
  | 'palettes'
  | 'rooms'
  | 'tiles'
  | 'sprites'
  | 'items'
  | 'dialogs'
  | 'endings'
  | 'variables'
  | 'tunes'
  | 'blips'
  | 'fonts';

/** What a unit of the file stands for. */
export type UnitRef =
  | { kind: 'title'; style: 'first-line' | 'name' }
  | { kind: 'flag'; key: string }
  | { kind: 'default-font' }
  | { kind: 'text-direction' }
  | { kind: 'entity'; collection: Collection; id: Id }
  | { kind: 'raw' };

export interface LayoutUnit {
  ref: UnitRef;
  /** Blank lines before this unit. */
  gap: number;
  /** The lines as they were in the file. */
  text: string[];
  /** What the serializer wrote for the parsed value; equal means unchanged. */
  canonical: string[];
}

export interface Layout {
  eol: '\n' | '\r\n';
  units: LayoutUnit[];
  /** Blank lines after the last unit ("…\n" ends with one). */
  trailing: number;
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface ParseResult {
  world: World;
  issues: ParseIssue[];
}
