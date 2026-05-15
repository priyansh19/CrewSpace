#!/usr/bin/env node
/**
 * Generate NSIS BMP installer artwork and macOS DMG background PNG.
 * Pure Node.js — no external dependencies.
 *
 * Output files (relative to desktop-electron/):
 *   assets/installer/installerSidebar.bmp   164 x 314  NSIS welcome/finish sidebar
 *   assets/installer/installerHeader.bmp    150 x 57   NSIS header (all pages)
 *   assets/installer/dmgBackground.png      540 x 380  macOS DMG background
 *   assets/installer/dmgBackground@2x.png  1080 x 760  macOS DMG background @2x
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createDeflateRaw } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../assets/installer");
mkdirSync(outDir, { recursive: true });

// ── Brand palette ────────────────────────────────────────────────────────────
const BG     = [15,  23,  42];   // slate-900  #0f172a
const ACCENT = [99, 102, 241];   // indigo-500 #6366f1
const DIM    = [30,  41,  59];   // slate-800  accent divider

// ── Raster canvas ────────────────────────────────────────────────────────────
function makeCanvas(w, h, fill = BG) {
  const pixels = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    pixels[i * 3]     = fill[0];
    pixels[i * 3 + 1] = fill[1];
    pixels[i * 3 + 2] = fill[2];
  }

  function setPixel(x, y, color) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 3;
    pixels[i]     = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
  }

  function fillRect(x0, y0, rw, rh, color) {
    for (let dy = 0; dy < rh; dy++)
      for (let dx = 0; dx < rw; dx++)
        setPixel(x0 + dx, y0 + dy, color);
  }

  function fillCircle(cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r)
          setPixel(cx + dx, cy + dy, color);
  }

  function drawLine(x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      setPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
  }

  // CrewSpace triangle logo: three circles connected by lines
  function drawLogo(cx, cy, size) {
    cx = Math.round(cx); cy = Math.round(cy);
    const r    = Math.max(2, Math.round(size * 0.18));
    const dist = size * 0.38;
    const top  = { x: cx,                        y: cy - dist };
    const bl   = { x: cx - dist * 0.866,         y: cy + dist * 0.5 };
    const br   = { x: cx + dist * 0.866,          y: cy + dist * 0.5 };
    drawLine(top.x, top.y, bl.x, bl.y, ACCENT);
    drawLine(top.x, top.y, br.x, br.y, ACCENT);
    drawLine(bl.x,  bl.y,  br.x, br.y, ACCENT);
    fillCircle(Math.round(top.x), Math.round(top.y), r, ACCENT);
    fillCircle(Math.round(bl.x),  Math.round(bl.y),  r, ACCENT);
    fillCircle(Math.round(br.x),  Math.round(br.y),  r, ACCENT);
  }

  return { pixels, w, h, fillRect, fillCircle, drawLogo };
}

// ── BMP encoder (24-bit, bottom-up, no compression) ─────────────────────────
function encodeBMP(canvas) {
  const { pixels, w, h } = canvas;
  const rowStride    = Math.ceil(w * 3 / 4) * 4;
  const pixelDataSize = rowStride * h;
  const buf = Buffer.alloc(54 + pixelDataSize, 0);

  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(54 + pixelDataSize, 2);
  buf.writeUInt32LE(54, 10);

  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);    // positive = bottom-up rows
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);

  for (let y = 0; y < h; y++) {
    const bmpRow = h - 1 - y;
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 3;
      const dst = 54 + bmpRow * rowStride + x * 3;
      buf[dst]     = pixels[src + 2]; // B
      buf[dst + 1] = pixels[src + 1]; // G
      buf[dst + 2] = pixels[src];     // R
    }
  }
  return buf;
}

// ── PNG encoder (deflate + zlib wrapper, filter-none) ───────────────────────
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf) {
  let a = 1, b = 0;
  for (const byte of buf) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

async function encodePNG(canvas) {
  const { pixels, w, h } = canvas;

  // Raw scanlines: filter=0x00 + RGB per pixel
  const raw = Buffer.alloc((1 + w * 3) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 3;
      const dst = y * (1 + w * 3) + 1 + x * 3;
      raw[dst] = pixels[src]; raw[dst + 1] = pixels[src + 1]; raw[dst + 2] = pixels[src + 2];
    }
  }

  const compressed = await new Promise((res, rej) => {
    const chunks = [];
    const z = createDeflateRaw({ level: 6 });
    z.on("data", (c) => chunks.push(c));
    z.on("end",  () => res(Buffer.concat(chunks)));
    z.on("error", rej);
    z.end(raw);
  });

  // Wrap deflate stream in minimal zlib container
  const zlibData = Buffer.alloc(compressed.length + 6);
  zlibData[0] = 0x78; zlibData[1] = 0x9c;
  compressed.copy(zlibData, 2);
  zlibData.writeUInt32BE(adler32(raw), zlibData.length - 4);

  function chunk(type, data) {
    const buf = Buffer.alloc(12 + data.length);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, "ascii");
    data.copy(buf, 8);
    buf.writeUInt32BE(crc32(buf.slice(4, 8 + data.length)), 8 + data.length);
    return buf;
  }

  const ihdr = Buffer.alloc(13, 0);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Asset definitions ────────────────────────────────────────────────────────

function drawSidebar() {
  const c = makeCanvas(164, 314);
  c.fillRect(0, 0, 4, 314, ACCENT);               // left accent bar
  for (let y = 0; y < 80; y++) {                  // subtle top fade
    const t = y / 80;
    c.fillRect(4, y, 160, 1, [
      Math.round(BG[0] + (ACCENT[0] - BG[0]) * t * 0.2),
      Math.round(BG[1] + (ACCENT[1] - BG[1]) * t * 0.2),
      Math.round(BG[2] + (ACCENT[2] - BG[2]) * t * 0.2),
    ]);
  }
  c.drawLogo(82, 110, 52);
  c.fillRect(24, 166, 116, 1, DIM);               // divider
  c.fillRect(0, 300, 164, 14, [10, 16, 30]);      // bottom bar
  return c;
}

function drawHeader() {
  const c = makeCanvas(150, 57);
  c.fillRect(0, 0, 3, 57, ACCENT);               // left accent bar
  c.drawLogo(118, 28, 24);                        // logo right-aligned
  for (let x = 16; x < 90; x += 10)              // dot-row decoration
    c.fillRect(x, 27, 2, 2, DIM);
  return c;
}

function drawDMG(w, h) {
  const c = makeCanvas(w, h);
  // Soft radial highlight from centre
  const cx = w / 2, cy = h * 0.44;
  const maxR = Math.sqrt(cx * cx + (h * 0.56) * (h * 0.56));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const t = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / maxR) * 0.07;
      const i = (y * w + x) * 3;
      c.pixels[i]     = Math.min(255, Math.round(BG[0] + t * 255));
      c.pixels[i + 1] = Math.min(255, Math.round(BG[1] + t * 255));
      c.pixels[i + 2] = Math.min(255, Math.round(BG[2] + t * 255));
    }
  }
  const ls = Math.round(h * 0.28);
  c.drawLogo(cx, cy - ls * 0.08, ls);
  const ry = Math.round(cy + ls * 0.72);
  c.fillRect(Math.round(cx - 70), ry, 140, 1, DIM);
  return c;
}

// ── Write ────────────────────────────────────────────────────────────────────
async function main() {
  writeFileSync(`${outDir}/installerSidebar.bmp`, encodeBMP(drawSidebar()));
  console.log("✓ installerSidebar.bmp (164×314)");

  writeFileSync(`${outDir}/installerHeader.bmp`, encodeBMP(drawHeader()));
  console.log("✓ installerHeader.bmp (150×57)");

  writeFileSync(`${outDir}/dmgBackground.png`,    await encodePNG(drawDMG(540, 380)));
  console.log("✓ dmgBackground.png (540×380)");

  writeFileSync(`${outDir}/dmgBackground@2x.png`, await encodePNG(drawDMG(1080, 760)));
  console.log("✓ dmgBackground@2x.png (1080×760)");

  console.log("\nAll installer assets generated.");
}

main().catch((e) => { console.error(e); process.exit(1); });
