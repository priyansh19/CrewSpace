/**
 * Generates CrewSpace favicon PNGs (triangle-network logo) using pure Node.js.
 * No external dependencies — only built-in `zlib` and `fs`.
 */
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dir, "../public");

// ── PNG encoder ──────────────────────────────────────────────────────────────

function crc32(buf) {
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })());
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcBuf = Buffer.concat([typeB, data]);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeB, data, crcVal]);
}

function encodePNG(rgba, w, h) {
  // Build filtered scanlines (filter byte 0 = None per row)
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    row[0] = 0; // filter type None
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      row[1 + x * 4] = rgba[i];
      row[1 + x * 4 + 1] = rgba[i + 1];
      row[1 + x * 4 + 2] = rgba[i + 2];
      row[1 + x * 4 + 3] = rgba[i + 3];
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Rasteriser ───────────────────────────────────────────────────────────────

function drawLogo(size, fg = [24, 24, 27]) {
  const rgba = new Uint8Array(size * size * 4); // transparent default

  const S = size;
  // Node positions (proportional to 24x24 viewBox)
  const nodes = [
    { cx: S * 12 / 24, cy: S * 3.5 / 24, r: S * 2.5 / 24 },
    { cx: S * 20.5 / 24, cy: S * 18 / 24, r: S * 2.5 / 24 },
    { cx: S * 3.5 / 24, cy: S * 18 / 24, r: S * 2.5 / 24 },
  ];
  const edges = [
    [nodes[0], nodes[1]],
    [nodes[0], nodes[2]],
    [nodes[1], nodes[2]],
  ];

  const setPixel = (x, y, a = 255) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const i = (y * S + x) * 4;
    // Alpha-blend over transparent background
    const srcA = a / 255;
    const dstA = rgba[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA === 0) return;
    rgba[i] = Math.round((fg[0] * srcA + rgba[i] * dstA * (1 - srcA)) / outA);
    rgba[i + 1] = Math.round((fg[1] * srcA + rgba[i + 1] * dstA * (1 - srcA)) / outA);
    rgba[i + 2] = Math.round((fg[2] * srcA + rgba[i + 2] * dstA * (1 - srcA)) / outA);
    rgba[i + 3] = Math.round(outA * 255);
  };

  // Draw anti-aliased line via Xiaolin Wu
  function drawLine(x0, y0, x1, y1, w = S * 1.5 / 24) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len; // normal
    const steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x0 + dx * t, py = y0 + dy * t;
      for (let sw = -w; sw <= w; sw += 0.5) {
        const qx = px + nx * sw, qy = py + ny * sw;
        const dist = Math.abs(sw);
        const alpha = Math.max(0, 1 - Math.max(0, dist - (w - 0.7)) / 0.7);
        setPixel(qx, qy, Math.round(alpha * 255));
      }
    }
  }

  // Draw filled anti-aliased circle
  function drawCircle(cx, cy, r) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x - cx, y - cy);
        const alpha = Math.max(0, Math.min(1, r - d + 0.5));
        setPixel(x, y, Math.round(alpha * 255));
      }
    }
  }

  // Draw edges first, then nodes on top
  for (const [a, b] of edges) drawLine(a.cx, a.cy, b.cx, b.cy);
  for (const n of nodes) drawCircle(n.cx, n.cy, n.r);

  return rgba;
}

// ── Generate files ────────────────────────────────────────────────────────────

const sizes = [16, 32, 48, 192, 512];
const files = {
  16:  "favicon-16x16.png",
  32:  "favicon-32x32.png",
  192: "android-chrome-192x192.png",
  512: "android-chrome-512x512.png",
};

// Also generate apple-touch-icon at 180x180
const allSizes = { ...files, 180: "apple-touch-icon.png" };

for (const [size, name] of Object.entries(allSizes)) {
  const s = Number(size);
  const rgba = drawLogo(s);
  const png = encodePNG(rgba, s, s);
  writeFileSync(path.join(PUBLIC, name), png);
  console.log(`✓ ${name} (${s}x${s})`);
}

// Generate favicon.ico — contains 16x16 and 32x32 PNGs embedded
function buildIco(pngs) {
  // ICO format: header + directory + image data
  const count = pngs.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;
  const totalHeaderSize = headerSize + dirSize;

  let offset = totalHeaderSize;
  const entries = [];
  for (const { size, data } of pngs) {
    entries.push({ size, data, offset });
    offset += data.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: ICO
  header.writeUInt16LE(count, 4); // count

  const dirEntries = entries.map(({ size, data, offset }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // width (0 = 256)
    e[1] = size >= 256 ? 0 : size; // height
    e[2] = 0;   // color count
    e[3] = 0;   // reserved
    e.writeUInt16LE(1, 4);  // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    return e;
  });

  return Buffer.concat([header, ...dirEntries, ...entries.map(e => e.data)]);
}

const ico16 = encodePNG(drawLogo(16), 16, 16);
const ico32 = encodePNG(drawLogo(32), 32, 32);
const ico48 = encodePNG(drawLogo(48), 48, 48);
const ico = buildIco([
  { size: 16, data: ico16 },
  { size: 32, data: ico32 },
  { size: 48, data: ico48 },
]);
writeFileSync(path.join(PUBLIC, "favicon.ico"), ico);
console.log("✓ favicon.ico (16, 32, 48)");

console.log("\nAll favicon files generated.");
