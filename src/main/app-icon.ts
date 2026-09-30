// App icon: the green diamond of the title bar (`.sigil` in theme.css), drawn in code so the tray,
// the window and the Windows executable share one app-owned image (no PoE2 artwork, SoT §16.3).
import { deflateSync } from 'node:zlib';

const ABYSS = [0x3f, 0xd4, 0x9a] as const; // --abyss
const INK = [0x07, 0x08, 0x0b] as const; // --ink

/** Straight-alpha RGBA pixels of the diamond, `size` x `size`, 4x4 supersampled. */
export function diamondRgba(size: number): Buffer {
  const out = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const outer = size * 0.4; // L1 radius of the diamond's outer edge
  const border = Math.max(1, size * 0.08);
  const glow = size * 0.1;
  const ss = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const d = Math.abs(x + (sx + 0.5) / ss - c) + Math.abs(y + (sy + 0.5) / ss - c);
          let px: readonly [number, number, number, number];
          if (d > outer) {
            const t = Math.max(0, 1 - (d - outer) / glow);
            px = [ABYSS[0], ABYSS[1], ABYSS[2], 0.45 * t * t];
          } else if (d > outer - border) {
            px = [ABYSS[0], ABYSS[1], ABYSS[2], 1];
          } else {
            // Ink fill with an inner glow fading towards the centre.
            const t = Math.max(0, 1 - (outer - border - d) / (size * 0.12));
            const m = 0.55 * t * t;
            px = [INK[0] + (ABYSS[0] - INK[0]) * m, INK[1] + (ABYSS[1] - INK[1]) * m, INK[2] + (ABYSS[2] - INK[2]) * m, 1];
          }
          r += px[0] * px[3];
          g += px[1] * px[3];
          b += px[2] * px[3];
          a += px[3];
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) out.set([Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / (ss * ss)) * 255)], i);
    }
  }
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** PNG (8-bit RGBA) of the diamond. */
export function diamondPng(size: number): Buffer {
  const rgba = diamondRgba(size);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Windows .ico with PNG-compressed entries (supported since Vista). */
export function diamondIco(sizes: readonly number[] = [16, 24, 32, 48, 64, 128, 256]): Buffer {
  const pngs = sizes.map(diamondPng);
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(pngs[i]!.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += pngs[i]!.length;
  });
  return Buffer.concat([header, ...pngs]);
}
