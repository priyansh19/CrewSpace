/**
 * Generates GLB model files for the office 3D scene.
 * Run with: node scripts/generate-models.mjs  (from ui/ directory)
 * Output: public/models/*.glb
 */

// Polyfill FileReader for Node.js (GLTFExporter uses it for the binary blob)
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend({ target: this });
      });
    }
  };
}

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const OUT    = path.join(__dir, "../public/models");
mkdirSync(OUT, { recursive: true });

// ─── Shared material palette ──────────────────────────────────────────────────
function stdMat(params) {
  const m = new THREE.MeshStandardMaterial(params);
  m.name  = params.name ?? "Mat";
  return m;
}

const WOOD_COL    = 0xc8a878;
const WOOD_DK_COL = 0xa88858;
const METAL_COL   = 0xb0b8c0;
const CUSHION_COL = 0xd4c8b8;
const SCR_COL     = 0x88ccee;
const SCR_FR_COL  = 0x4a4a5a;
const DARK_COL    = 0x2a2a35;

const matWood    = stdMat({ color: WOOD_COL,    roughness: 0.75, name: "Wood" });
const matWoodDk  = stdMat({ color: WOOD_DK_COL, roughness: 0.80, name: "WoodDark" });
const matMetal   = stdMat({ color: METAL_COL,   roughness: 0.50, metalness: 0.2, name: "Metal" });
const matCushion = stdMat({ color: CUSHION_COL, roughness: 0.85, name: "Cushion" });
const matScreen  = stdMat({ color: SCR_COL,     roughness: 0.30, emissive: new THREE.Color(SCR_COL), emissiveIntensity: 0.2, name: "Screen" });
const matFrame   = stdMat({ color: SCR_FR_COL,  roughness: 0.60, name: "Frame" });
const matDark    = stdMat({ color: DARK_COL,    roughness: 0.50, metalness: 0.15, name: "Dark" });
const matPot     = stdMat({ color: 0xc87850,    roughness: 0.80, name: "Pot" });
const matSoil    = stdMat({ color: 0x6a4a2a,    roughness: 0.90, name: "Soil" });
const matTrunk   = stdMat({ color: 0x7a6a4a,    roughness: 0.85, name: "Trunk" });
const matGreenA  = stdMat({ color: 0x5aaa5a,    roughness: 0.80, name: "GreenA" });
const matGreenB  = stdMat({ color: 0x4a9a4a,    roughness: 0.80, name: "GreenB" });
const matGreenC  = stdMat({ color: 0x6abb6a,    roughness: 0.80, name: "GreenC" });
const matWhite   = stdMat({ color: 0xf8f8f8,    roughness: 0.50, name: "White" });
const matRack    = stdMat({ color: DARK_COL,    roughness: 0.50, metalness: 0.2, name: "Rack" });
const matLedG    = stdMat({ color: 0x00ff44,    emissive: new THREE.Color(0x00ff44), emissiveIntensity: 0.8, name: "LedG" });
const matLedB    = stdMat({ color: 0x00aaff,    emissive: new THREE.Color(0x00aaff), emissiveIntensity: 0.8, name: "LedB" });
const matLedO    = stdMat({ color: 0xffaa00,    emissive: new THREE.Color(0xffaa00), emissiveIntensity: 0.8, name: "LedO" });
const matFile    = stdMat({ color: METAL_COL,   roughness: 0.50, metalness: 0.15, name: "Cabinet" });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mesh(name, geo, mat, pos = [0,0,0], rx = 0, ry = 0) {
  const m    = new THREE.Mesh(geo, mat);
  m.name     = name;
  m.castShadow = true;
  m.receiveShadow = true;
  m.position.set(...pos);
  m.rotation.x = rx;
  m.rotation.y = ry;
  return m;
}

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function cyl(rt, rb, h, s = 8) { return new THREE.CylinderGeometry(rt, rb, h, s); }
function sph(r, w = 8, h = 7) { return new THREE.SphereGeometry(r, w, h); }

// Merge 4-leg cylinder geometries into one mesh (fewer draw calls)
function legsMesh(legGeo, positions, mat, name) {
  const clones = positions.map(([x, y, z]) => {
    const g = legGeo.clone();
    g.translate(x, y, z);
    return g;
  });
  const merged = mergeGeometries(clones);
  return mesh(name, merged, mat);
}

async function saveGLB(group, filename) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      group,
      (buf) => {
        writeFileSync(path.join(OUT, filename), Buffer.from(buf));
        console.log(`  ✓ ${filename} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
        resolve();
      },
      reject,
      { binary: true },
    );
  });
}

// ─── Model builders ───────────────────────────────────────────────────────────

function buildChair() {
  const g = new THREE.Group(); g.name = "Chair";
  g.add(mesh("Seat", box(0.35, 0.05, 0.35), matCushion, [0, 0.3, 0]));
  g.add(mesh("Back", box(0.35, 0.40, 0.05), matCushion, [0, 0.5, -0.15]));
  g.add(legsMesh(cyl(0.02, 0.02, 0.28, 6), [
    [-0.14, 0.14, -0.14],[0.14, 0.14, -0.14],
    [-0.14, 0.14,  0.14],[0.14, 0.14,  0.14],
  ], matMetal, "Legs"));
  return g;
}

function buildDevChair() {
  const g = new THREE.Group(); g.name = "DevChair";
  g.add(mesh("Seat", box(0.38, 0.05, 0.38), matDark,   [0, 0.35, 0]));
  g.add(mesh("Back", box(0.36, 0.48, 0.05), matDark,   [0, 0.60, -0.17]));
  g.add(mesh("Post", cyl(0.025, 0.025, 0.28, 6), matMetal, [0, 0.20, 0]));
  return g;
}

function buildMonitor() {
  const g = new THREE.Group(); g.name = "Monitor";
  g.add(mesh("Stand", cyl(0.015, 0.02, 0.24, 6), matMetal, [0, -0.12, 0.02]));
  g.add(mesh("Bezel", box(0.52, 0.34, 0.025), matFrame,  [0, 0, 0]));
  g.add(mesh("Screen",box(0.47, 0.29, 0.005), matScreen, [0, 0, 0.014]));
  return g;
}

function buildDesk() {
  const g = new THREE.Group(); g.name = "Desk";
  g.add(mesh("Top",    box(1.5, 0.05, 0.65), matWood, [0, 0.55, 0]));
  g.add(mesh("Side",   box(0.5, 0.05, 0.45), matWood, [0.85, 0.55, -0.38]));
  g.add(legsMesh(cyl(0.025, 0.025, 0.55, 6), [
    [-0.65, 0.275, -0.28],[0.65, 0.275, -0.28],
    [-0.65, 0.275,  0.28],[0.65, 0.275,  0.28],
  ], matMetal, "Legs"));
  const mon1 = buildMonitor(); mon1.position.set(-0.28, 0.87, -0.2);
  const mon2 = buildMonitor(); mon2.position.set( 0.25, 0.87, -0.2);
  g.add(mon1, mon2);
  return g;
}

function buildTable() {
  // Generic rectangular table (scaleable via parent group scale)
  const g = new THREE.Group(); g.name = "Table";
  g.add(mesh("Top", box(2.0, 0.06, 1.0), matWood, [0, 0.55, 0]));
  g.add(legsMesh(cyl(0.03, 0.03, 0.55, 6), [
    [-0.9, 0.275, -0.45],[0.9, 0.275, -0.45],
    [-0.9, 0.275,  0.45],[0.9, 0.275,  0.45],
  ], matMetal, "Legs"));
  return g;
}

function buildRoundTable() {
  const g = new THREE.Group(); g.name = "RoundTable";
  g.add(mesh("Top",  new THREE.CylinderGeometry(1.2, 1.2, 0.06, 24), matWood,  [0, 0.55, 0]));
  g.add(mesh("Post", cyl(0.15, 0.15, 0.55, 8), matMetal, [0, 0.275, 0]));
  return g;
}

function buildSofa() {
  const g = new THREE.Group(); g.name = "Sofa";
  g.add(mesh("Seat", box(1.5, 0.30, 0.60), matCushion, [0, 0.25, 0]));
  g.add(mesh("Back", box(1.5, 0.30, 0.10), matCushion, [0, 0.50, -0.25]));
  return g;
}

function buildWhiteboard() {
  const g = new THREE.Group(); g.name = "Whiteboard";
  g.add(mesh("Frame", box(1.90, 1.30, 0.03), matMetal,  [0, 1.3, -0.02]));
  g.add(mesh("Board", box(1.80, 1.20, 0.06), matWhite,  [0, 1.3,  0]));
  return g;
}

function buildBed() {
  const g = new THREE.Group(); g.name = "Bed";
  g.add(mesh("Frame",    box(1.0, 0.08, 1.8), matWood,   [0, 0.15, 0]));
  g.add(mesh("Mattress", box(0.9, 0.12, 1.7), matCushion,[0, 0.25, 0]));
  g.add(mesh("Head",     box(1.0, 0.35, 0.06), matWoodDk,[0, 0.45, -0.88]));
  return g;
}

function buildBunkBed() {
  const g = new THREE.Group(); g.name = "BunkBed";
  const postGeo = box(0.06, 2.0, 0.06);
  const posts = mergeGeometries([
    postGeo.clone().translate(-0.45, 1.0, -0.85),
    postGeo.clone().translate( 0.45, 1.0, -0.85),
    postGeo.clone().translate(-0.45, 1.0,  0.85),
    postGeo.clone().translate( 0.45, 1.0,  0.85),
  ]);
  g.add(mesh("Posts",     posts,               matWoodDk));
  g.add(mesh("Frame1",    box(0.95,0.06,1.7),  matWood,   [0, 0.3,  0]));
  g.add(mesh("Bed1",      box(0.85,0.12,1.6),  matCushion,[0, 0.42, 0]));
  g.add(mesh("Frame2",    box(0.95,0.06,1.7),  matWood,   [0, 1.2,  0]));
  g.add(mesh("Bed2",      box(0.85,0.12,1.6),  matCushion,[0, 1.32, 0]));
  return g;
}

function buildServerRack() {
  const g = new THREE.Group(); g.name = "ServerRack";
  g.add(mesh("Body", box(0.65, 2.0, 0.5), matRack, [0, 1.0, 0]));
  // LED panels — merge by colour
  const panelGeo = box(0.55, 0.18, 0.01);
  const panelMerged = mergeGeometries(
    [-0.6,-0.3,0,0.3,0.6].map((y) => { const g2 = panelGeo.clone(); g2.translate(0, 1.0+y, 0.27); return g2; })
  );
  g.add(mesh("Panels", panelMerged, matDark));
  // LEDs in 3 colours
  const ledGeo = box(0.02, 0.02, 0.005);
  const gLeds = [], bLeds = [], oLeds = [];
  for (let i = 0; i < 5; i++) {
    const y = 1.0 + [-0.6,-0.3,0,0.3,0.6][i];
    const arr = i % 3 === 0 ? gLeds : i % 3 === 1 ? bLeds : oLeds;
    arr.push(ledGeo.clone().translate(-0.18, y, 0.28));
    arr.push(ledGeo.clone().translate(-0.12, y, 0.28));
    arr.push(ledGeo.clone().translate(-0.06, y, 0.28));
  }
  if (gLeds.length) g.add(mesh("LedG", mergeGeometries(gLeds), matLedG));
  if (bLeds.length) g.add(mesh("LedB", mergeGeometries(bLeds), matLedB));
  if (oLeds.length) g.add(mesh("LedO", mergeGeometries(oLeds), matLedO));
  return g;
}

function buildFilingCabinet() {
  const g = new THREE.Group(); g.name = "FilingCabinet";
  g.add(mesh("Body", box(0.5, 1.3, 0.45), matFile, [0, 0.65, 0]));
  const drawerGeo = box(0.44, 0.22, 0.01);
  const drawers = mergeGeometries(
    [0.25, 0.55, 0.85, 1.15].map((y) => drawerGeo.clone().translate(0, y, 0.23))
  );
  g.add(mesh("Drawers", drawers, matMetal));
  return g;
}

function buildPottedPlant() {
  const g = new THREE.Group(); g.name = "PlantSmall";
  g.add(mesh("Pot",  cyl(0.18, 0.14, 0.3, 7),  matPot,   [0, 0.15, 0]));
  g.add(mesh("Soil", cyl(0.16, 0.16, 0.02, 7),  matSoil,  [0, 0.31, 0]));
  g.add(mesh("Stem", cyl(0.03, 0.03, 0.2, 5),   matGreenA,[0, 0.40, 0]));
  const fol = mergeGeometries([
    sph(0.22, 7, 5).translate( 0,    0.55,  0),
    sph(0.15, 7, 5).translate( 0.08, 0.72,  0.05),
    sph(0.13, 7, 5).translate(-0.06, 0.68, -0.06),
  ]);
  g.add(mesh("Foliage", fol, matGreenA));
  return g;
}

function buildTallPlant() {
  const g = new THREE.Group(); g.name = "PlantTall";
  g.add(mesh("Pot",   cyl(0.25, 0.2, 0.5, 7), matPot,   [0, 0.25, 0]));
  g.add(mesh("Trunk", cyl(0.04, 0.05, 1.1, 5), matTrunk, [0, 0.8,  0]));
  const fol = mergeGeometries([
    sph(0.30, 7, 5).translate(  0,    1.30,  0),
    sph(0.20, 7, 5).translate(-0.15,  1.15,  0.1),
    sph(0.18, 7, 5).translate( 0.12,  1.05, -0.08),
    sph(0.22, 7, 5).translate(  0,    1.50,  0),
  ]);
  g.add(mesh("Foliage", fol, matGreenA));
  const fol2 = mergeGeometries([
    sph(0.16, 7, 5).translate( 0.1, 1.40, 0.08),
  ]);
  g.add(mesh("Foliage2", fol2, matGreenB));
  return g;
}

function buildHangingPlant() {
  const g = new THREE.Group(); g.name = "PlantHanging";
  g.add(mesh("Basket", cyl(0.15, 0.12, 0.2, 7), stdMat({ color: 0xe0c8a0, roughness: 0.8, name: "Basket" }), [0,0,0]));
  const drops = mergeGeometries([
    sph(0.10, 5, 4).translate(-0.08, -0.15, 0),
    sph(0.10, 5, 4).translate( 0.08, -0.20, 0),
    sph(0.09, 5, 4).translate( 0,    -0.25, 0),
  ]);
  g.add(mesh("Foliage", drops, matGreenB));
  return g;
}

// ─── Generate all models ──────────────────────────────────────────────────────
console.log("Generating office GLB models → public/models/");
await saveGLB(buildChair(),        "chair.glb");
await saveGLB(buildDevChair(),     "dev-chair.glb");
await saveGLB(buildMonitor(),      "monitor.glb");
await saveGLB(buildDesk(),         "desk.glb");
await saveGLB(buildTable(),        "table.glb");
await saveGLB(buildRoundTable(),   "table-round.glb");
await saveGLB(buildSofa(),         "sofa.glb");
await saveGLB(buildWhiteboard(),   "whiteboard.glb");
await saveGLB(buildBed(),          "bed.glb");
await saveGLB(buildBunkBed(),      "bunk-bed.glb");
await saveGLB(buildServerRack(),   "server-rack.glb");
await saveGLB(buildFilingCabinet(),"filing-cabinet.glb");
await saveGLB(buildPottedPlant(),  "plant-small.glb");
await saveGLB(buildTallPlant(),    "plant-tall.glb");
await saveGLB(buildHangingPlant(), "plant-hanging.glb");
console.log("Done.");
