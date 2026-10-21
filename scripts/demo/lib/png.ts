import { crc32, deflateSync } from "node:zlib";

// Tiny generated placeholder evidence pictures (R137). PNG, not JPEG: Node can write a valid PNG with
// zlib alone (no image dependency), and the evidence bucket accepts image/png (0007).
// A light background with a coloured band and a "scale" block, so the review page shows a real picture.

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

const PALETTE: [number, number, number][] = [
  [46, 125, 50],
  [21, 101, 192],
  [249, 168, 37],
  [109, 76, 65],
  [0, 137, 123],
  [123, 31, 162],
];

/** A 96 x 72 RGB PNG; `variant` picks the colours. */
export function placeholderPng(variant: number): Buffer {
  const w = 96;
  const h = 72;
  const [r, g, b] = PALETTE[Math.abs(variant) % PALETTE.length];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const band = y >= 20 && y < 52;
      const scale = x >= 30 && x < 66 && y >= 52 && y < 64;
      const px = scale ? [90, 90, 90] : band ? [r, g, b] : [240, 244, 238];
      raw.set(px, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
