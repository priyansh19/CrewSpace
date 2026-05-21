#!/usr/bin/env node
/**
 * Zip the main desktop-electron app into the installer's payload directory.
 *
 * Usage:
 *   node scripts/zip-installer-payload.mjs
 *   node scripts/zip-installer-payload.mjs --input desktop-electron/dist/win-unpacked --output desktop-electron/installer/assets/payload/app.zip
 */

import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { ZipArchive } from "archiver";

const input = process.argv.includes("--input")
  ? process.argv[process.argv.indexOf("--input") + 1]
  : "desktop-electron/dist3/win-unpacked";

const output = process.argv.includes("--output")
  ? process.argv[process.argv.indexOf("--output") + 1]
  : "desktop-electron/installer/assets/payload/app.zip";

const inputPath = resolve(input);
const outputPath = resolve(output);

console.log(`Creating payload zip…`);
console.log(`  Input:  ${inputPath}`);
console.log(`  Output: ${outputPath}`);

mkdirSync(dirname(outputPath), { recursive: true });

const archive = new ZipArchive({ zlib: { level: 9 } });
const stream = createWriteStream(outputPath);

archive.on("warning", (err) => {
  if (err.code === "ENOENT") {
    console.warn("Archive warning:", err.message);
  } else {
    throw err;
  }
});

archive.on("error", (err) => {
  throw err;
});

archive.directory(inputPath, false);
archive.finalize();

await pipeline(archive, stream);

console.log(`✓ Payload ready: ${outputPath}`);
