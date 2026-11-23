import { SWEETIE_16, type Game, type Look, type Picture, type Room } from './model';

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const PALETTE = SWEETIE_16.map(rgb);

/** Draws a picture into `out` (an RGBA image `width` wide). Clear pixels are skipped. */
function drawPicture(out: Uint8ClampedArray, width: number, picture: Picture | undefined, left: number, top: number) {
  if (!picture) return;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const colour = parseInt(picture[y]?.[x] ?? '.', 16);
      if (Number.isNaN(colour)) continue;
      const at = ((top + y) * width + left + x) * 4;
      out.set([...PALETTE[colour]!, 255], at);
    }
  }
}

/** One 8 × 8 picture as RGBA; clear pixels have alpha 0. */
export function pictureRGBA(picture: Picture | undefined): Uint8ClampedArray {
  const out = new Uint8ClampedArray(8 * 8 * 4);
  drawPicture(out, 8, picture, 0, 0);
  return out;
}

/** The picture a look shows when it faces down. */
export function lookSprite(look: Look): number {
  return look.sprites?.down ?? look.sprite ?? 0;
}

/** The first picture of a tile. */
export function tileSprite(sprite: number | number[]): number {
  return Array.isArray(sprite) ? (sprite[0] ?? 0) : sprite;
}

/** A room as the game shows it at the start, ground to top layer: (width × 8) × (height × 8) RGBA. */
export function roomRGBA(game: Game, room: Room, { top = true } = {}): Uint8ClampedArray {
  const w = (room.ground[0]?.length ?? 0) * 8;
  const h = room.ground.length * 8;
  const out = new Uint8ClampedArray(w * h * 4);
  const [r, g, b] = rgb(game.background ?? '#000000');
  for (let i = 0; i < w * h; i++) out.set([r, g, b, 255], i * 4);
  const pictures = game.art?.pictures ?? [];
  const tiles = new Map(game.tiles.map((t) => [t.key, pictures[tileSprite(t.sprite)]]));
  const layer = (rows: string[]) =>
    rows.forEach((row, y) => [...row].forEach((key, x) => drawPicture(out, w, tiles.get(key), x * 8, y * 8)));
  layer(room.ground);
  const kinds = new Map((game.kinds ?? []).map((k) => [k.id, k]));
  const items = new Map((game.items ?? []).map((i) => [i.id, i]));
  for (const item of room.items ?? []) {
    const icon = items.get(item.item)?.icon;
    if (icon !== undefined) drawPicture(out, w, pictures[icon], item.x * 8, item.y * 8);
  }
  for (const actor of room.actors ?? []) {
    const kind = kinds.get(actor.kind);
    if (kind) drawPicture(out, w, pictures[lookSprite(kind)], actor.x * 8, actor.y * 8);
  }
  if (game.start.room === room.id) drawPicture(out, w, pictures[lookSprite(game.player)], game.start.x * 8, game.start.y * 8);
  if (top && room.top) layer(room.top);
  return out;
}
