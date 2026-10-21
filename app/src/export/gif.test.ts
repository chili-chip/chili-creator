import { describe, expect, it } from 'vitest';
import { encodeGif } from './gif';

/** Just enough of a GIF reader to check what the encoder wrote. */
function decodeGif(bytes: Uint8Array) {
  let at = 0;
  const u8 = () => bytes[at++]!;
  const u16 = () => u8() | (u8() << 8);
  const header = String.fromCharCode(...bytes.slice(0, 6));
  at = 6;
  const width = u16();
  const height = u16();
  const packed = u8();
  at += 2;
  const palette: number[][] = [];
  if (packed & 0x80) for (let i = 0; i < 2 << (packed & 7); i++) palette.push([u8(), u8(), u8()]);
  const frames: { delay: number; pixels: number[] }[] = [];
  let delay = 0;
  let loops = false;
  for (;;) {
    const block = u8();
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = u8();
      if (label === 0xf9) {
        u8();
        u8();
        delay = u16() * 10;
        u8();
        u8();
      } else {
        if (label === 0xff) loops = true;
        for (let size = u8(); size; size = u8()) at += size;
      }
      continue;
    }
    // Image descriptor.
    at += 8;
    u8();
    const minCode = u8();
    const data: number[] = [];
    for (let size = u8(); size; size = u8()) for (let i = 0; i < size; i++) data.push(u8());
    frames.push({ delay, pixels: lzwDecode(data, minCode, width * height) });
  }
  return { header, width, height, palette, frames, loops };
}

function lzwDecode(data: number[], minCode: number, count: number): number[] {
  const clear = 1 << minCode;
  const end = clear + 1;
  let size = minCode + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = Array.from({ length: clear }, (_, i) => [i]);
    dict.push([], []);
    size = minCode + 1;
  };
  reset();
  const out: number[] = [];
  let bit = 0;
  let previous: number[] | null = null;
  while (out.length < count) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3]! >> (bit & 7)) & 1) << i;
    if (code === clear) {
      reset();
      previous = null;
      continue;
    }
    if (code === end) break;
    let entry = dict[code];
    if (!entry) entry = [...previous!, previous![0]!];
    out.push(...entry);
    if (previous) dict.push([...previous, entry[0]!]);
    previous = entry;
    if (dict.length === 1 << size && size < 12) size++;
  }
  return out;
}

function frame(color: (x: number, y: number) => [number, number, number]) {
  const pixels = new Uint8ClampedArray(128 * 128 * 4);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) pixels.set([...color(x, y), 255], (y * 128 + x) * 4);
  }
  return pixels;
}

describe('encodeGif', () => {
  it('writes a looping GIF that reads back pixel for pixel, at the scale asked', () => {
    const a = frame((x, y) => ((x >> 3) + (y >> 3)) % 2 ? [255, 0, 0] : [0, 0, 255]);
    const b = frame((x) => (x < 64 ? [0, 255, 0] : [255, 255, 255]));
    const gif = decodeGif(encodeGif([{ pixels: a, delayMs: 100 }, { pixels: b, delayMs: 250 }], { scale: 2 }));
    expect(gif.header).toBe('GIF89a');
    expect([gif.width, gif.height]).toEqual([256, 256]);
    expect(gif.loops).toBe(true);
    expect(gif.frames.map((f) => f.delay)).toEqual([100, 250]);
    const rgb = (f: number, x: number, y: number) => gif.palette[gif.frames[f]!.pixels[y * 256 + x]!];
    expect(rgb(0, 0, 0)).toEqual([0, 0, 255]);
    expect(rgb(0, 17, 1)).toEqual([255, 0, 0]);
    expect(rgb(1, 127, 200)).toEqual([0, 255, 0]);
    expect(rgb(1, 128, 200)).toEqual([255, 255, 255]);
  });

  it('copes with more than 256 colours by rounding them', () => {
    const many = frame((x, y) => [x * 2, y * 2, (x + y) % 256]);
    const gif = decodeGif(encodeGif([{ pixels: many, delayMs: 100 }], { scale: 1 }));
    expect(gif.palette.length).toBeLessThanOrEqual(256);
    const [r, g] = gif.palette[gif.frames[0]!.pixels[10 * 128 + 100]!]!;
    expect(Math.abs(r! - 200)).toBeLessThan(40);
    expect(Math.abs(g! - 20)).toBeLessThan(40);
  });
});
