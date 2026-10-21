import type { RawBlock, World } from './types';

// Custom fonts in the `.bitsyfont` format. Like the classic editor, a game
// carries its custom font as a FONT block and names it as DEFAULT_FONT.

/** The font in a `.bitsyfont` file, or null when the file is not one. */
export function readFontFile(text: string): RawBlock | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const header = /^FONT\s+(\S+)/.exec(lines[0] ?? '');
  if (!header) return null;
  return { id: header[1]!, lines: lines.slice(1) };
}

/** Makes `font` the game's font, in place of any custom font it had. */
export function setCustomFont(world: World, font: RawBlock): void {
  world.fonts = [font];
  world.defaultFont = font.id;
}

/** The game's custom font as a `.bitsyfont` file, or null when it uses a built-in one. */
export function fontFile(world: World): string | null {
  const font = world.fonts.find((f) => f.id === world.defaultFont);
  if (!font) return null;
  return [`FONT ${font.id}`, ...(font.name ? [`NAME ${font.name}`] : []), ...font.lines, ''].join('\n');
}
