// A small GIF89a encoder for recordings of the game: 128×128 RGBA frames,
// scaled up, with one shared palette. Bitsy games use a handful of colours;
// a recording with more than 256 is rounded to 3-3-2 bit colour.

export interface GifFrame {
  pixels: Uint8ClampedArray;
  delayMs: number;
}

const SIZE = 128;

class Bytes {
  private data: Uint8Array<ArrayBuffer> = new Uint8Array(1 << 16);
  length = 0;
  byte(b: number) {
    if (this.length === this.data.length) {
      const bigger = new Uint8Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    this.data[this.length++] = b;
  }
  word(w: number) {
    this.byte(w & 0xff);
    this.byte((w >> 8) & 0xff);
  }
  text(s: string) {
    for (const c of s) this.byte(c.charCodeAt(0));
  }
  done(): Uint8Array<ArrayBuffer> {
    return this.data.slice(0, this.length);
  }
}

function palette(frames: GifFrame[]): { colors: number[]; index: (rgb: number) => number } {
  const seen = new Map<number, number>();
  for (const { pixels } of frames) {
    for (let i = 0; i < pixels.length && seen.size <= 256; i += 4) {
      const rgb = (pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!;
      if (!seen.has(rgb)) seen.set(rgb, seen.size);
    }
  }
  if (seen.size <= 256) return { colors: [...seen.keys()], index: (rgb) => seen.get(rgb)! };
  // 8 reds, 8 greens, 4 blues, each the middle of its range.
  const colors = Array.from({ length: 256 }, (_, i) => (((i >> 5) * 32 + 16) << 16) | ((((i >> 2) & 7) * 32 + 16) << 8) | ((i & 3) * 64 + 32));
  return { colors, index: (rgb) => (((rgb >> 21) & 7) << 5) | (((rgb >> 13) & 7) << 2) | ((rgb >> 6) & 3) };
}

function lzw(out: Bytes, indices: Uint8Array, minCode: number) {
  const clear = 1 << minCode;
  let size = minCode + 1;
  let next = clear + 2;
  let dict = new Map<number, number>();
  let block: number[] = [];
  let bits = 0;
  let bitCount = 0;
  const emit = (code: number) => {
    bits |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      block.push(bits & 0xff);
      bits >>>= 8;
      bitCount -= 8;
      if (block.length === 255) {
        out.byte(255);
        block.forEach((b) => out.byte(b));
        block = [];
      }
    }
  };
  out.byte(minCode);
  emit(clear);
  let prefix = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    const pixel = indices[i]!;
    const key = prefix * 256 + pixel;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict = new Map();
      size = minCode + 1;
      next = clear + 2;
    } else {
      if (next === 1 << size) size++;
      dict.set(key, next++);
    }
    prefix = pixel;
  }
  emit(prefix);
  emit(clear + 1);
  if (bitCount > 0) block.push(bits & 0xff);
  for (let i = 0; i < block.length; i += 255) {
    const chunk = block.slice(i, i + 255);
    out.byte(chunk.length);
    chunk.forEach((b) => out.byte(b));
  }
  out.byte(0);
}

/** Encodes frames as a looping GIF, `scale` times 128 pixels wide. */
export function encodeGif(frames: GifFrame[], { scale = 2 }: { scale?: number } = {}): Uint8Array<ArrayBuffer> {
  const width = SIZE * scale;
  const { colors, index } = palette(frames);
  let depth = 1;
  while (1 << depth < colors.length) depth++;
  const out = new Bytes();
  out.text('GIF89a');
  out.word(width);
  out.word(width);
  out.byte(0x80 | ((depth - 1) << 4) | (depth - 1));
  out.byte(0);
  out.byte(0);
  for (let i = 0; i < 1 << depth; i++) {
    const rgb = colors[i] ?? 0;
    out.byte((rgb >> 16) & 0xff);
    out.byte((rgb >> 8) & 0xff);
    out.byte(rgb & 0xff);
  }
  // Loop for ever.
  out.byte(0x21);
  out.byte(0xff);
  out.byte(11);
  out.text('NETSCAPE2.0');
  out.byte(3);
  out.byte(1);
  out.word(0);
  out.byte(0);

  const indices = new Uint8Array(width * width);
  for (const frame of frames) {
    out.byte(0x21);
    out.byte(0xf9);
    out.byte(4);
    out.byte(0);
    out.word(Math.max(2, Math.round(frame.delayMs / 10)));
    out.byte(0);
    out.byte(0);

    out.byte(0x2c);
    out.word(0);
    out.word(0);
    out.word(width);
    out.word(width);
    out.byte(0);
    for (let y = 0; y < width; y++) {
      const row = ((y / scale) | 0) * SIZE;
      for (let x = 0; x < width; x++) {
        const at = (row + ((x / scale) | 0)) * 4;
        const p = frame.pixels;
        indices[y * width + x] = index((p[at]! << 16) | (p[at + 1]! << 8) | p[at + 2]!);
      }
    }
    lzw(out, indices, Math.max(2, depth));
  }
  out.byte(0x3b);
  return out.done();
}
