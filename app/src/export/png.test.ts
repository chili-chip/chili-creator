import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng, pngDataUrl } from './png';

function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const found: { type: string; data: Uint8Array }[] = [];
  for (let at = 8; at < png.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    found.push({ type, data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return found;
}

// 2×1 pixels: red, then blue. RGBA, as the player paints them.
const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);

describe('encodePng', () => {
  it('writes a PNG of the pixels, scaled up', () => {
    const png = encodePng(pixels, 2, 1, { scale: 2 });
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const [header, ...rest] = chunks(png);
    expect(header!.type).toBe('IHDR');
    const view = new DataView(header!.data.buffer, header!.data.byteOffset);
    expect([view.getUint32(0), view.getUint32(4)]).toEqual([4, 2]);
    expect(rest.map((c) => c.type)).toEqual(['IDAT', 'IEND']);

    const rows = inflateSync(rest[0]!.data);
    const row = [0, 255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255];
    expect([...rows]).toEqual([...row, ...row]);
  });

  it('gives each chunk a checksum zlib accepts', () => {
    // inflateSync checks the Adler-32; a bad CRC would show in the chunk.
    const png = encodePng(new Uint8ClampedArray(128 * 128 * 4), 128, 128, { scale: 4 });
    const idat = chunks(png).find((c) => c.type === 'IDAT')!;
    expect(inflateSync(idat.data).length).toBe(512 * (512 * 3 + 1));
    // CRC of an empty IEND chunk is fixed.
    expect([...png.subarray(-4)]).toEqual([0xae, 0x42, 0x60, 0x82]);
  });
});

describe('pngDataUrl', () => {
  it('is a base64 PNG data URL', () => {
    const url = pngDataUrl(encodePng(pixels, 2, 1));
    expect(url).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  });
});
