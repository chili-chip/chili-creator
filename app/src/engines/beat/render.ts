import { SWEETIE_16, type Game, type Picture, type Screen } from './model';

function rgb(game: Game, colour: number): [number, number, number] {
  const hex = SWEETIE_16[game.palette[colour] ?? 0]!;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** The CSS colour of one of the game's 4 colours. */
export function cssColour(game: Game, colour: number): string {
  return SWEETIE_16[game.palette[colour] ?? 0]!;
}

function drawPicture(out: Uint8ClampedArray, width: number, game: Game, picture: Picture, left: number, top: number, seeThrough: boolean) {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const colour = Number(picture[y]?.[x] ?? 0);
      if (seeThrough && colour === 0) continue;
      const at = ((top + y) * width + left + x) * 4;
      const [r, g, b] = rgb(game, colour);
      out[at] = r;
      out[at + 1] = g;
      out[at + 2] = b;
      out[at + 3] = 255;
    }
  }
}

/** One 8 × 8 picture as RGBA. With `seeThrough`, colour 0 is clear. */
export function pictureRGBA(game: Game, picture: Picture, seeThrough = false): Uint8ClampedArray {
  const out = new Uint8ClampedArray(8 * 8 * 4);
  drawPicture(out, 8, game, picture, 0, 0, seeThrough);
  return out;
}

/** A screen as the engine draws it at the start: 128 × 128 RGBA. */
export function boardRGBA(game: Game, screen: Screen, frame = 0): Uint8ClampedArray {
  const out = new Uint8ClampedArray(128 * 128 * 4);
  const [r, g, b] = rgb(game, 0);
  for (let i = 0; i < 128 * 128; i++) out.set([r, g, b, 255], i * 4);
  const byKey = new Map(game.things.map((t) => [t.key, t]));
  const layer = (rows: string[] | undefined, seeThrough: boolean) => {
    rows?.forEach((row, y) =>
      [...row].forEach((key, x) => {
        const thing = byKey.get(key);
        if (thing) drawPicture(out, 128, game, thing.frames[frame % thing.frames.length]!, x * 8, y * 8, seeThrough);
      }),
    );
  };
  layer(screen.ground, false);
  layer(screen.things, true);
  return out;
}
