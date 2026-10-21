import player from './web-player.js?raw';

// A game as one web page that plays anywhere, offline: citsy, its wasm, a
// small player and the game data, all inline. The game sits in the same
// script tag the classic editor used, so either editor can import the page.

export interface HtmlParts {
  /** The text of citsy.js. */
  citsyScript: string;
  wasm: Uint8Array;
}

export interface HtmlOptions extends HtmlParts {
  data: string;
  title: string;
  /** The colour around the game. */
  pageColor: string;
  /** Fill the window, or a fixed size in pixels. */
  size: 'fill' | number;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Keeps "</script>" inside a script from ending it. */
const inScript = (text: string) => text.replace(/<\/script/gi, '<\\/script');

function base64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function exportHtml({ data, title, pageColor, size, citsyScript, wasm }: HtmlOptions): string {
  const color = /^#[0-9a-f]{3,8}$/i.test(pageColor) ? pageColor : '#000000';
  const fit = size === 'fill' ? 'min(100vw, 100vh)' : `min(100vw, 100vh, var(--size))`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root { --size: ${size === 'fill' ? '100vmin' : `${size}px`}; }
html, body { margin: 0; height: 100%; background: ${color}; overflow: hidden; }
body { display: grid; place-items: center; }
#game { width: ${fit}; height: ${fit}; image-rendering: pixelated; touch-action: none; outline: none; }
#message { position: fixed; inset: auto 0 1rem; color: #fff; font: 14px sans-serif; text-align: center; }
</style>
</head>
<body>
<canvas id="game" width="128" height="128" tabindex="0"></canvas>
<p id="message"></p>
<script type="text/bitsyGameData" id="exportedGameData">
${inScript(data)}</script>
<script type="application/octet-stream" id="citsyWasm">${base64(wasm)}</script>
<script>${inScript(citsyScript)}</script>
<script>${inScript(player)}</script>
</body>
</html>
`;
}

/** citsy.js and its wasm, loaded only when someone exports. */
export async function loadHtmlParts(): Promise<HtmlParts> {
  const [{ default: citsyScript }, { default: wasmUrl }] = await Promise.all([
    import('../../../citsy/citsy.js?raw'),
    import('../../../citsy/citsy.wasm?url'),
  ]);
  const response = await fetch(new URL(wasmUrl, import.meta.url));
  if (!response.ok) throw new Error(`citsy.wasm: ${response.status}`);
  return { citsyScript, wasm: new Uint8Array(await response.arrayBuffer()) };
}
