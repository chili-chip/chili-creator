// A small PNG writer for snapshots of the game screen. The image is stored
// without compression: a 512×512 picture is under 1 MB, and a sync encoder
// with no dependencies is worth more here than the bytes.

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** A zlib stream of stored (uncompressed) deflate blocks. */
function zlibStored(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 0xffff));
  const out = new Uint8Array(2 + blocks * 5 + data.length + 4);
  const view = new DataView(out.buffer);
  out[0] = 0x78;
  out[1] = 0x01;
  let at = 2;
  for (let i = 0; i < blocks; i++) {
    const chunk = data.subarray(i * 0xffff, (i + 1) * 0xffff);
    out[at] = i === blocks - 1 ? 1 : 0;
    view.setUint16(at + 1, chunk.length, true);
    view.setUint16(at + 3, ~chunk.length & 0xffff, true);
    out.set(chunk, at + 5);
    at += 5 + chunk.length;
  }
  view.setUint32(at, adler32(data));
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Encodes RGBA pixels (alpha ignored) as an RGB PNG, each pixel `scale` times wider and taller. */
export function encodePng(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  { scale = 1 }: { scale?: number } = {},
): Uint8Array<ArrayBuffer> {
  const w = width * scale;
  const h = height * scale;
  const rows = new Uint8Array(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    const source = Math.floor(y / scale) * width;
    for (let x = 0; x < w; x++) {
      const from = (source + Math.floor(x / scale)) * 4;
      rows.set(pixels.subarray(from, from + 3), row + 1 + x * 3);
    }
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, w);
  view.setUint32(4, h);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlibStored(rows)),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A PNG as a data URL, the form the platform takes covers in. */
export function pngDataUrl(png: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < png.length; i += 0x8000) binary += String.fromCharCode(...png.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}
