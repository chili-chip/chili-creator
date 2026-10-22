import { parse } from '../bitsy';

// Games coming in from files and going out as downloads.

export type ImportedGame = { title: string; data: string } | { error: string };

const scriptStarts = [
  '<script type="text/bitsyGameData" id="exportedGameData">\n',
  '<script type="bitsyGameData" id="exportedGameData">\n',
];

/** The game data in a page exported by the classic editor or by this one. */
function dataInPage(html: string): string | null {
  html = html.replace(/\r\n/g, '\n');
  for (const start of scriptStarts) {
    const at = html.indexOf(start);
    if (at < 0) continue;
    const from = at + start.length;
    const end = html.indexOf('</script>', from);
    // A "</script>" in the game is written as "<\/script>" so the page stays whole.
    return html.slice(from, end < 0 ? undefined : end).replace(/<\\\/script/gi, '</script');
  }
  // Pages from before Bitsy 7.9 kept it in a JavaScript string.
  const old = /var exportedGameData\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  if (old) {
    return old[1]!.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c));
  }
  return null;
}

/** Reads a `.bitsy` file, or the game inside an exported page. */
export function gameFromFile(name: string, text: string): ImportedGame {
  const looksLikePage = /^\s*</.test(text) || /\.html?$/i.test(name);
  const data = looksLikePage ? dataInPage(text) : text;
  const none = { error: `${name} has no Bitsy game in it.` };
  if (data === null) return none;
  const { world } = parse(data);
  if (world.rooms.length === 0) return none;
  const title = world.title.trim() || name.replace(/\.[^.]+$/, '') || 'Imported game';
  return { title, data };
}

/** A file name from a game's title. */
export function fileName(title: string, extension: string): string {
  const base = title
    .replace(/["'!?*<>|]/g, '')
    .replace(/[/\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base || 'game'}.${extension}`;
}

/** Hands a file to the browser to save. */
export function download(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
