// アイコン(PNG)を生成する。依存ライブラリなし: node tools/make-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'icons');
const BG = [0x6c, 0x5c, 0xe7];
const FG = [0xff, 0xff, 0xff];

function roundedRect(x, y, r) {
  const m = r;
  const cx = Math.min(Math.max(x, m), 1 - m);
  const cy = Math.min(Math.max(y, m), 1 - m);
  return (x - cx) ** 2 + (y - cy) ** 2 <= m * m + 1e-9;
}

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function inTriangleCone(x, y) {
  // (0.40,0.5) を頂点に右へ広がる台形
  if (x < 0.40 || x > 0.63) return false;
  const t = (x - 0.40) / (0.63 - 0.40);
  const half = 0.06 + t * 0.24;
  return Math.abs(y - 0.5) <= half;
}

function onSegment(x, y, x0, y0, x1, y1, w) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = ((x - x0) * dx + (y - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + t * dx, py = y0 + t * dy;
  return (x - px) ** 2 + (y - py) ** 2 <= (w / 2) ** 2;
}

function sample(x, y) {
  if (!roundedRect(x, y, 0.22)) return null;              // 透明
  const speaker = inRect(x, y, 0.22, 0.39, 0.41, 0.61) || inTriangleCone(x, y);
  const cross = onSegment(x, y, 0.70, 0.36, 0.86, 0.64, 0.075) ||
                onSegment(x, y, 0.86, 0.36, 0.70, 0.64, 0.075);
  return (speaker || cross) ? FG : BG;
}

function render(size) {
  const ss = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let py = 0; py < size; py++) {
    raw[p++] = 0; // フィルタ none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
        }
      }
      const n = ss * ss;
      if (a === 0) { p += 4; continue; }
      raw[p++] = Math.round(r / (a / 255));
      raw[p++] = Math.round(g / (a / 255));
      raw[p++] = Math.round(b / (a / 255));
      raw[p++] = Math.round(a / n);
    }
  }
  return raw;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(file, png(size));
  console.log('wrote', file);
}
