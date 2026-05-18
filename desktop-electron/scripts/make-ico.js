/**
 * Generates a valid Windows ICO file from a PNG by embedding it in the ICO container.
 * Modern ICO format supports raw PNG chunks — rcedit and Windows both accept this.
 * Usage: node scripts/make-ico.js <source.png> <output.ico>
 */
const fs = require("fs");
const [, , src, dest] = process.argv;
if (!src || !dest) {
  console.error("Usage: node make-ico.js <source.png> <output.ico>");
  process.exit(1);
}

const png = fs.readFileSync(src);

// Read actual PNG dimensions from IHDR chunk (bytes 16–23)
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);

// ICO ICONDIR header (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(1, 4); // image count

// ICONDIRENTRY (16 bytes) — one entry pointing at the embedded PNG
const entry = Buffer.alloc(16);
entry.writeUInt8(w >= 256 ? 0 : w, 0);  // width  (0 encodes 256)
entry.writeUInt8(h >= 256 ? 0 : h, 1);  // height (0 encodes 256)
entry.writeUInt8(0, 2);                  // color count (0 = truecolor)
entry.writeUInt8(0, 3);                  // reserved
entry.writeUInt16LE(1, 4);               // color planes
entry.writeUInt16LE(32, 6);              // bits per pixel
entry.writeUInt32LE(png.length, 8);      // size of PNG data
entry.writeUInt32LE(22, 12);             // offset: 6 (header) + 16 (entry)

const ico = Buffer.concat([header, entry, png]);
fs.writeFileSync(dest, ico);
console.log(`Written ${ico.length} bytes → ${dest}  (${w}×${h} source)`);
