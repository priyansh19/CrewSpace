import { ROOM_POSITIONS, ROOM_DIMS, type RoomId } from "@/stores/officeStore";
import { Clone, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useEffect, useRef } from "react";
import { useOfficeStore } from "@/stores/officeStore";
import Room from "./Room";
import Furniture from "./Furniture";
import Plants from "./Plants";

// ─── Edge-geometry cache ──────────────────────────────────────────────────────
const _edgesCache = new Map<string, THREE.EdgesGeometry>();
function edgesGeo(w: number, h: number, d: number) {
  const key = `${w}|${h}|${d}`;
  if (!_edgesCache.has(key))
    _edgesCache.set(key, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  return _edgesCache.get(key)!;
}
const _boundaryMat = new THREE.MeshStandardMaterial({ color: "#b8a080", roughness: 0.7 });
const BoundaryWall = ({ args, position }: { args: [number,number,number]; position: [number,number,number] }) => {
  const [w, h, d] = args;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const BEAM_SIZE = 0.08;

  return (
    <group position={position}>
      {/* Vertical beams */}
      <mesh position={[hw - BEAM_SIZE/2, 0, hd - BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[BEAM_SIZE, h, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[-hw + BEAM_SIZE/2, 0, hd - BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[BEAM_SIZE, h, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[hw - BEAM_SIZE/2, 0, -hd + BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[BEAM_SIZE, h, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[-hw + BEAM_SIZE/2, 0, -hd + BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[BEAM_SIZE, h, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>

      {/* Top horizontal beams */}
      <mesh position={[0, hh - BEAM_SIZE/2, hd - BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[w - BEAM_SIZE, BEAM_SIZE, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[0, hh - BEAM_SIZE/2, -hd + BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[w - BEAM_SIZE, BEAM_SIZE, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[hw - BEAM_SIZE/2, hh - BEAM_SIZE/2, 0]} castShadow>
        <boxGeometry args={[BEAM_SIZE, BEAM_SIZE, d - BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[-hw + BEAM_SIZE/2, hh - BEAM_SIZE/2, 0]} castShadow>
        <boxGeometry args={[BEAM_SIZE, BEAM_SIZE, d - BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>

      {/* Bottom horizontal beams */}
      <mesh position={[0, -hh + BEAM_SIZE/2, hd - BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[w - BEAM_SIZE, BEAM_SIZE, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[0, -hh + BEAM_SIZE/2, -hd + BEAM_SIZE/2]} castShadow>
        <boxGeometry args={[w - BEAM_SIZE, BEAM_SIZE, BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[hw - BEAM_SIZE/2, -hh + BEAM_SIZE/2, 0]} castShadow>
        <boxGeometry args={[BEAM_SIZE, BEAM_SIZE, d - BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
      <mesh position={[-hw + BEAM_SIZE/2, -hh + BEAM_SIZE/2, 0]} castShadow>
        <boxGeometry args={[BEAM_SIZE, BEAM_SIZE, d - BEAM_SIZE]} />
        <primitive object={_boundaryMat} attach="material" />
      </mesh>
    </group>
  );
};

// ─── Shared floor / outdoor materials ────────────────────────────────────────
const FLOOR_MAT       = new THREE.MeshStandardMaterial({ color: "#d8ccb8", roughness: 0.95 });
const CARPET_MAT      = new THREE.MeshStandardMaterial({ color: "#a89070", roughness: 0.98 });
const HALLWAY_MAT     = new THREE.MeshStandardMaterial({ color: "#ece4d4", roughness: 0.85 });
const PLAZA_MAT       = new THREE.MeshStandardMaterial({ color: "#c8c0b0", roughness: 0.88 });
const PAVEMENT_MAT    = new THREE.MeshStandardMaterial({ color: "#b0a8a0", roughness: 0.90 });
const GRASS_MAT       = new THREE.MeshStandardMaterial({ color: "#3e7022", roughness: 0.92 });
const PARK_PATH_MAT   = new THREE.MeshStandardMaterial({ color: "#c0b8a8", roughness: 0.88 });
const FENCE_MAT       = new THREE.MeshStandardMaterial({ color: "#6a5a3a", roughness: 0.85 });
const PARK_SMOKE_MAT  = new THREE.MeshStandardMaterial({ color: "#909088", roughness: 0.92 });
const SMOKE_POST_MAT  = new THREE.MeshStandardMaterial({ color: "#555555" });
const SMOKE_ROPE_MAT  = new THREE.MeshStandardMaterial({ color: "#888888", metalness: 0.6 });
const PARKING_MAT     = new THREE.MeshStandardMaterial({ color: "#9a9590", roughness: 0.94 });
const PARKING_LINE_MAT = new THREE.MeshStandardMaterial({ color: "#e8e4d8", roughness: 0.85 });
const PARKING_SIGN_MAT = new THREE.MeshStandardMaterial({ color: "#555555", metalness: 0.5 });

// ─── Lamp posts (instanced for performance) ───────────────────────────────────
const _poleMat      = new THREE.MeshStandardMaterial({ color: "#888888", roughness: 0.6, metalness: 0.5 });
const _poleGeo      = new THREE.CylinderGeometry(0.06, 0.09, 3, 8);
const _headGeo      = new THREE.SphereGeometry(0.22, 8, 8);
const _headMatShared = new THREE.MeshStandardMaterial({ color: "#fffde8", emissive: "#fffde8", emissiveIntensity: 0.65, roughness: 0.25 });
const _dummy        = new THREE.Object3D();

const ENTRANCE_LAMP_XS: number[] = [-22, -10, 2, 14, 26, 38];
const ENTRANCE_LAMPS: [number,number,number][] = ENTRANCE_LAMP_XS.map(x => [x, 0, 21.5]);

// All lamp positions: 24 perimeter + 6 entrance = 30 total
// Perimeter arrays defined after this component since they reference NORTH/SOUTH/EAST/WEST consts below
// We declare them here too so the component can reference them
const _ALL_LAMP_POSITIONS: [number,number,number][] = [
  ...[-22,-10,2,14,26,38].map(x => [x,0,-19] as [number,number,number]),   // NORTH
  ...[-22,-10,2,14,26,38].map(x => [x,0,45]  as [number,number,number]),   // SOUTH
  ...[-14,-4,6,16,26,36].map(z => [-25,0,z]  as [number,number,number]),   // WEST
  ...[-14,-4,6,16,26,36].map(z => [45,0,z]   as [number,number,number]),   // EAST
  ...ENTRANCE_LAMPS,                                                         // ENTRANCE (6)
];

const AllLampPosts = () => {
  const poleRef  = useRef<THREE.InstancedMesh>(null);
  const headRef  = useRef<THREE.InstancedMesh>(null);

  // Build instance matrices once on mount
  useEffect(() => {
    const pm = poleRef.current;
    const hm = headRef.current;
    if (!pm || !hm) return;
    _ALL_LAMP_POSITIONS.forEach((pos, i) => {
      _dummy.position.set(pos[0], 1.5, pos[2]);
      _dummy.updateMatrix();
      pm.setMatrixAt(i, _dummy.matrix);
      _dummy.position.set(pos[0], 3.1, pos[2]);
      _dummy.updateMatrix();
      hm.setMatrixAt(i, _dummy.matrix);
    });
    pm.instanceMatrix.needsUpdate = true;
    hm.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={poleRef} args={[_poleGeo, _poleMat, _ALL_LAMP_POSITIONS.length]} />
      <instancedMesh ref={headRef} args={[_headGeo, _headMatShared, _ALL_LAMP_POSITIONS.length]} />
      {/* Entrance lamps emit point lights for ambient lighting (max 6) */}
      {ENTRANCE_LAMPS.map((pos, i) => (
        <pointLight key={i} position={[pos[0], 3.1, pos[2]]} intensity={0.8} distance={6} decay={2} color="#ffe8c0" />
      ))}
    </>
  );
};

// ─── Park tree (procedural) ───────────────────────────────────────────────────
const TREE_MODEL = "/models/tree/mango_tree.glb";
useGLTF.preload(TREE_MODEL);

const ParkTree = ({ position, s = 1.0 }: { position: [number,number,number]; s?: number }) => {
  const { scene } = useGLTF(TREE_MODEL);
  const tintedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      // Detect trunk: mesh name contains "tree" but NOT "leaves"
      // (mango_tree.glb uses: tree_Material.004_0, tree_Material.002_0 = trunk; leaves_Material.001_0 = foliage)
      const name = child.name.toLowerCase();
      const isTrunk = name.includes("tree") && !name.includes("leave") && !name.includes("leaf")
        || /trunk|bark|stem|wood|branch|tronc/.test(name);
      const sourceMaterial = child.material;
      const materials = Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial];
      const tintedMaterials = materials.map((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material;
        const next = material.clone();
        if (isTrunk) {
          next.color = new THREE.Color("#1a1008");
          next.emissive = new THREE.Color("#000000");
          next.emissiveIntensity = 0;
          next.roughness = 0.98;
        } else {
          next.color = new THREE.Color("#5f9f3a");
          next.emissive = new THREE.Color("#102408");
          next.emissiveIntensity = 0.06;
          next.roughness = 0.92;
        }
        return next;
      });
      child.material = Array.isArray(sourceMaterial) ? tintedMaterials : tintedMaterials[0];
    });
    return cloned;
  }, [scene]);
  const fitted = useMemo(() => {
    const box = new THREE.Box3().setFromObject(tintedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const targetHeight = 4.2 * s;
    const scale = targetHeight / Math.max(size.y, 0.001);

    return {
      scale,
      centerX: center.x,
      centerZ: center.z,
      groundOffset: -box.min.y * scale,
    };
  }, [s, scene]);

  return (
    <group position={position}>
      <group
        position={[
          -fitted.centerX * fitted.scale,
          fitted.groundOffset,
          -fitted.centerZ * fitted.scale,
        ]}
        scale={fitted.scale}
      >
        <Clone object={tintedScene} />
      </group>
    </group>
  );
};

// ─── Branded luxury cars ──────────────────────────────────────────────────────
const CAR_MODELS = [
  {
    name: "Ferrari F40",
    path: "/models/cars/1987_ferrari_f40.glb",
    yawOffset: 0,
    bayLength: 3.5,
    labelY: 1.05,
    parkingOffset: [0.05, 0.0] as [number, number],
  },
  {
    name: "Mazda RX-7 FC",
    path: "/models/cars/1987_mazda_rx-7_fc.glb",
    yawOffset: 0,
    bayLength: 3.4,
    labelY: 1.05,
    parkingOffset: [0.0, 0.0] as [number, number],
  },
  {
    name: "Veilside RX-7 FD",
    path: "/models/cars/1997_veilside_fortune_mazda_rx-7_fd_tokyo_drift.glb",
    yawOffset: 0,
    bayLength: 3.6,
    labelY: 1.1,
    parkingOffset: [-0.1, 0.05] as [number, number],
  },
  {
    name: "R Magic RX-7 FD3S",
    path: "/models/cars/2010_r_magic_fd_armor_mazda_rx-7_fd3s.glb",
    yawOffset: 0,
    bayLength: 3.55,
    labelY: 1.1,
    parkingOffset: [0.1, 0.0] as [number, number],
  },
  {
    name: "LB Super Silhouette RX-7",
    path: "/models/cars/2023_lbsuper_silhouette_mazda_fd3s_rx-7.glb",
    yawOffset: 0,
    bayLength: 3.7,
    labelY: 1.15,
    parkingOffset: [0.0, -0.05] as [number, number],
  },
] as const;

CAR_MODELS.forEach((car) => useGLTF.preload(car.path));

const PARKED_CARS = [
  { position: [36.75, 0, 25.75] as [number, number, number], rot: Math.PI / 2, car: CAR_MODELS[0] },
  { position: [36.75, 0, 29.25] as [number, number, number], rot: Math.PI / 2, car: CAR_MODELS[1] },
  { position: [36.75, 0, 32.75] as [number, number, number], rot: Math.PI / 2, car: CAR_MODELS[2] },
  { position: [42.25, 0, 25.75] as [number, number, number], rot: -Math.PI / 2, car: CAR_MODELS[3] },
  { position: [42.25, 0, 29.25] as [number, number, number], rot: -Math.PI / 2, car: CAR_MODELS[4] },
  { position: [42.25, 0, 36.25] as [number, number, number], rot: -Math.PI / 2, car: CAR_MODELS[0] },
] as const;

const ParkedCar = ({
  position,
  rot = 0,
  car,
}: {
  position: [number, number, number];
  rot?: number;
  car: (typeof CAR_MODELS)[number];
}) => {
  const { scene } = useGLTF(car.path);

  const { carScene, fitted } = useMemo(() => {
    // Deep-clone so each parked car is independent
    const carScene = scene.clone(true);

    // Force-fix all meshes: ensure visible, fix near-black or invisible materials
    carScene.traverse((child) => {
      child.visible = true;
      child.frustumCulled = false;
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;
        mat.visible = true;
        mat.depthWrite = true;
        mat.depthTest = true;
        // Fix near-black baseColor that makes meshes invisible (e.g. caliper badges)
        const c = mat.color;
        if (c.r < 0.05 && c.g < 0.05 && c.b < 0.05 && !mat.map) {
          c.set(0.15, 0.15, 0.15); // replace invisible black with dark grey
        }
        // Fix near-zero alpha on opaque materials
        if (mat.opacity < 0.1 && mat.alphaMap == null) {
          mat.opacity = 1;
          mat.transparent = false;
        }
      });
    });

    // Compute bounding box from the fixed clone
    carScene.updateMatrixWorld(true);
    const box = new THREE.Box3().expandByObject(carScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const longest = Math.max(size.x, size.z, 0.001);
    const scale = car.bayLength / longest;
    const groundOffset = -box.min.y * scale;

    return {
      carScene,
      fitted: { scale, centerX: center.x, centerZ: center.z, groundOffset },
    };
  }, [car.bayLength, scene]);

  return (
    <group position={position} rotation={[0, rot + car.yawOffset, 0]}>
      <group
        position={[
          -fitted.centerX * fitted.scale + car.parkingOffset[0],
          fitted.groundOffset,
          -fitted.centerZ * fitted.scale + car.parkingOffset[1],
        ]}
        scale={fitted.scale}
      >
        <primitive object={carScene} />
      </group>
      <Html position={[0, car.labelY, 0]} center distanceFactor={28} style={{ pointerEvents: "none" }}>
        <div style={{ fontSize: "6px", color: "#ffffff", background: "rgba(0,0,0,0.55)",
          padding: "1px 5px", borderRadius: "2px", fontFamily: "monospace",
          letterSpacing: "0.06em", whiteSpace: "nowrap", fontWeight: 700 }}>
          {car.name}
        </div>
      </Html>
    </group>
  );
};

// ─── Ashtray post ─────────────────────────────────────────────────────────────
const _ashMat = new THREE.MeshStandardMaterial({ color: "#606060", roughness: 0.65, metalness: 0.5 });
const AshtrayPost = ({ position }: { position:[number,number,number] }) => (
  <group position={position}>
    <mesh position={[0, 0.52, 0]}>
      <cylinderGeometry args={[0.04, 0.04, 1.04, 8]} />
      <primitive object={_ashMat} attach="material" />
    </mesh>
    <mesh position={[0, 1.08, 0]}>
      <cylinderGeometry args={[0.13, 0.11, 0.13, 12]} />
      <primitive object={_ashMat} attach="material" />
    </mesh>
  </group>
);

// ─── Bench ────────────────────────────────────────────────────────────────────
const _benchMat    = new THREE.MeshStandardMaterial({ color: "#8a6a3a", roughness: 0.85 });
const _benchLegMat = new THREE.MeshStandardMaterial({ color: "#5a4a2a", roughness: 0.9 });
const Bench = ({ position, rot = 0 }: { position: [number,number,number]; rot?: number }) => (
  <group position={position} rotation={[0, rot, 0]}>
    <mesh position={[0, 0.42, 0]}>
      <boxGeometry args={[1.8, 0.1, 0.45]} />
      <primitive object={_benchMat} attach="material" />
    </mesh>
    {([-0.7, 0.7] as number[]).map((x, i) => (
      <mesh key={i} position={[x, 0.2, 0]}>
        <boxGeometry args={[0.12, 0.4, 0.4]} />
        <primitive object={_benchLegMat} attach="material" />
      </mesh>
    ))}
  </group>
);

// ─── Nike Shoebox Building ────────────────────────────────────────────────────
const NIKE_RED   = "#cc2222";
const NIKE_DARK  = "#991111";
// 20% translucent so interior is visible
const _nikeBoxMat  = new THREE.MeshStandardMaterial({ color: NIKE_RED,  roughness: 0.6, transparent: true, opacity: 0.2 });
const _nikeDarkMat = new THREE.MeshStandardMaterial({ color: NIKE_DARK, roughness: 0.55, transparent: true, opacity: 0.2 });
const _nikeWhiteMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, emissive: "#ffffff", emissiveIntensity: 0.05 });
const NIKE_LOGO_MODEL = "/models/logos/nike_logo.glb";
useGLTF.preload(NIKE_LOGO_MODEL);

const NikeStore = ({ position }: { position: [number,number,number] }) => {
  const [px, py, pz] = position;
  const bw = 14, bh = 6, bd = 10;

  // Extruded swoosh — solid, projects outward from front face
  const { scene: logoScene } = useGLTF(NIKE_LOGO_MODEL);
  const fittedLogo = useMemo(() => {
    const box = new THREE.Box3().setFromObject(logoScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const targetWidth = 7.2;
    const scale = targetWidth / Math.max(size.x, 0.001);

    return {
      scale,
      centerX: center.x,
      centerY: center.y,
      centerZ: center.z,
    };
  }, [logoScene]);

  return (
    <group position={[px, py, pz]}>
      {/* Main box */}
      <mesh position={[0, bh / 2, 0]} castShadow>
        <boxGeometry args={[bw, bh, bd]} />
        <primitive object={_nikeBoxMat} attach="material" />
      </mesh>
      {/* Roof lid */}
      <mesh position={[0, bh + 0.18, 0]} castShadow>
        <boxGeometry args={[bw + 0.3, 0.36, bd + 0.3]} />
        <primitive object={_nikeDarkMat} attach="material" />
      </mesh>
      {/* White stripe band at base */}
      <mesh position={[0, 1.8, bd / 2 + 0.02]}>
        <boxGeometry args={[bw, 0.5, 0.06]} />
        <primitive object={_nikeWhiteMat} attach="material" />
      </mesh>
      {/* Entry door gap */}
      <mesh position={[0, 1.1, bd / 2 + 0.03]}>
        <boxGeometry args={[2.6, 2.2, 0.06]} />
        <primitive object={_nikeWhiteMat} attach="material" />
      </mesh>
      {/* ── Extruded Nike swoosh on front face ── */}
      {/* Positioned so swoosh (0→6.2 wide) is centered on 14-unit front face */}
      <group position={[0, 2.45, bd / 2 + 0.18]} scale={fittedLogo.scale}>
        <group position={[-fittedLogo.centerX, -fittedLogo.centerY, -fittedLogo.centerZ]}>
          <Clone object={logoScene} />
        </group>
      </group>
      <Html position={[0, bh + 1.0, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
        <div style={{
          fontSize: "13px", letterSpacing: "0.25em", fontWeight: 900,
          padding: "3px 14px", borderRadius: "4px", color: "#fff",
          background: NIKE_RED, border: "2px solid #fff",
          fontFamily: "system-ui", whiteSpace: "nowrap",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}>
          NIKE
        </div>
      </Html>
    </group>
  );
};

// ─── Outdoor venue room configs ───────────────────────────────────────────────
const VENUE_CONFIGS: { id: RoomId; label: string; color: string }[] = [
  { id: "nike-store",  label: "Nike Store",  color: NIKE_RED },
  { id: "food-court",  label: "Food Court",  color: "#e8a840" },
  { id: "gaming-room", label: "Gaming Room", color: "#9a40c8" },
];

const ROOM_CONFIGS: {
  id: RoomId; label: string; accentColor: string;
  doorOffsets?: number[]; backDoorOffsets?: number[];
}[] = [
  { id: "ceo-cabin",     label: "CEO Cabin",         accentColor: "#e87d3e" },
  { id: "scrum-room",    label: "Daily Scrum",        accentColor: "#4aa84a" },
  { id: "conf-dev",      label: "Dev Conference",     accentColor: "#4a8ad4" },
  { id: "conf-design",   label: "Design Conference",  accentColor: "#9a5ec8" },
  { id: "conf-security", label: "Security Conf",      accentColor: "#3aaa6a" },
  { id: "conf-qa",       label: "QA Conference",      accentColor: "#6aaa3a" },
  { id: "conf-data",     label: "Data Science Lab",   accentColor: "#4a6ad4" },
  { id: "conf-ops",      label: "DevOps Room",        accentColor: "#d4844a" },
  { id: "conf-product",  label: "Product War Room",   accentColor: "#d44a6a", doorOffsets: [-2], backDoorOffsets: [2] },
  { id: "workstations",  label: "Workstations",       accentColor: "#4a8ad4", doorOffsets: [-6, 6], backDoorOffsets: [0] },
  { id: "sleeping-room", label: "Rest Area",          accentColor: "#7a5acd", doorOffsets: [-2], backDoorOffsets: [2] },
  { id: "kitchen",       label: "Kitchen & Lounge",   accentColor: "#e87d3e", doorOffsets: [-1.5], backDoorOffsets: [1.5] },
  { id: "play-area",     label: "Play Zone",          accentColor: "#d45a8a", doorOffsets: [-2], backDoorOffsets: [2] },
  { id: "server-room",   label: "Server Room",        accentColor: "#2a6ad4" },
  { id: "file-room",     label: "File Room",          accentColor: "#8a7a5a" },
  { id: "collab-area",   label: "Collaboration Hub",  accentColor: "#e8a84a" },
];

const HALLWAY_PATHS: [number,number,number,number][] = [
  [-20,-7,56,2],[-20,5,50,2],[-20,17,60,2],
  [-18,-7,2,12],[-9,-7,2,12],[-1,-7,2,12],[7,-7,2,12],[15,-7,2,12],[23,-7,2,12],[32,-7,2,12],
  [-8,5,2,12],[4,5,2,12],[15,5,2,12],[24,5,2,4],[38,5,2,12],
];

// ─── Perimeter lamp positions ─────────────────────────────────────────────────
// Building spans x: -25→45, z: -19→19. Courtyard z: 19→45.

const OfficeFloor = () => {
  const bw = 70, bd = 38, wh = 3, wt = 0.12, cx = 10, cz = 0;
  const plazaD = 26, plazaCZ = (19 + 45) / 2;

  return (
    <group>
      {/* ── Indoor base floor ── */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[cx,-0.02,cz]} receiveShadow material={FLOOR_MAT}>
        <planeGeometry args={[bw, bd]} />
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[cx,-0.005,cz]} receiveShadow material={CARPET_MAT}>
        <planeGeometry args={[69, 37]} />
      </mesh>

      {/* ── Boundary walls ── */}
      <BoundaryWall args={[bw,wh,wt]}  position={[cx,wh/2,cz-bd/2]} />
      <BoundaryWall args={[wt,wh,bd]}  position={[cx-bw/2,wh/2,cz]} />
      <BoundaryWall args={[wt,wh,bd]}  position={[cx+bw/2,wh/2,cz]} />
      <BoundaryWall args={[27,wh,wt]}  position={[cx-21.5,wh/2,cz+bd/2]} />
      <BoundaryWall args={[27,wh,wt]}  position={[cx+21.5,wh/2,cz+bd/2]} />

      {/* ── Hallways ── */}
      {HALLWAY_PATHS.map(([x,z,w,d],i) => (
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[x+w/2-4,0.005,z+d/2-4]} receiveShadow material={HALLWAY_MAT}>
          <planeGeometry args={[w,d]} />
        </mesh>
      ))}

      {/* ── Indoor rooms ── */}
      {ROOM_CONFIGS.map((room) => {
        const pos  = ROOM_POSITIONS[room.id];
        const dims = ROOM_DIMS[room.id];
        const isOpen = room.id === "collab-area";
        return (
          <group key={room.id}>
            {!isOpen ? (
              <Room
                position={[pos.x,0,pos.z]} width={dims.width} depth={dims.depth}
                accentColor={room.accentColor} label={room.label}
                doorOffsets={room.doorOffsets} backDoorOffsets={room.backDoorOffsets}
              />
            ) : (
              <>
                <mesh rotation={[-Math.PI/2,0,0]} position={[pos.x,0.02,pos.z]} receiveShadow>
                  <planeGeometry args={[dims.width, dims.depth]} />
                  <meshStandardMaterial color="#e8dcc8" roughness={0.85} />
                </mesh>
                <Html position={[pos.x,3.2,pos.z]} center distanceFactor={20} style={{ pointerEvents:"none" }}>
                  <div style={{ fontSize:"11px",letterSpacing:"0.08em",padding:"2px 10px",borderRadius:"5px",
                    color:"#5a4a3a",background:"#faf5ee",border:`2px solid ${room.accentColor}`,
                    fontWeight:600,fontFamily:"system-ui" }}>
                    {room.label}
                  </div>
                </Html>
              </>
            )}
            <mesh rotation={[-Math.PI/2,0,0]} position={[pos.x,0.035,pos.z]} receiveShadow>
              <planeGeometry args={[dims.width*0.65, dims.depth*0.55]} />
              <meshStandardMaterial color={room.accentColor} transparent opacity={0.1} roughness={0.95} />
            </mesh>
            <Furniture roomId={room.id} position={[pos.x,0,pos.z]} />
          </group>
        );
      })}

      {/* ── Outdoor courtyard base ── */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[cx,-0.01,plazaCZ]} receiveShadow material={PLAZA_MAT}>
        <planeGeometry args={[bw, plazaD]} />
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[cx,0.005,22]} receiveShadow material={PAVEMENT_MAT}>
        <planeGeometry args={[bw, 3]} />
      </mesh>
      <BoundaryWall args={[bw,wh,wt]}   position={[cx,wh/2,45]} />
      <BoundaryWall args={[wt,wh,plazaD]} position={[cx-bw/2,wh/2,plazaCZ]} />
      <BoundaryWall args={[wt,wh,plazaD]} position={[cx+bw/2,wh/2,plazaCZ]} />

      {/* ── Benches ── */}
      {[-24,-8,8,24,40].map((x,i) => <Bench key={i}    position={[x,0,23]} rot={0} />)}
      {[-24,-8,8,24,40].map((x,i) => <Bench key={`r${i}`} position={[x,0,20]} rot={Math.PI} />)}

      {/* ── Nike Store building + venue rooms ── */}
      <NikeStore position={[ROOM_POSITIONS["nike-store"].x, 0, ROOM_POSITIONS["nike-store"].z]} />
      {VENUE_CONFIGS.map(({ id, label, color }) => {
        const pos  = ROOM_POSITIONS[id];
        const dims = ROOM_DIMS[id];
        return (
          <group key={id}>
            <Room position={[pos.x,0,pos.z]} width={dims.width} depth={dims.depth} accentColor={color} label={label} />
            <mesh rotation={[-Math.PI/2,0,0]} position={[pos.x,0.035,pos.z]} receiveShadow>
              <planeGeometry args={[dims.width*0.65, dims.depth*0.55]} />
              <meshStandardMaterial color={color} transparent opacity={0.1} roughness={0.95} />
            </mesh>
            <Furniture roomId={id} position={[pos.x,0,pos.z]} />
          </group>
        );
      })}

      {/* ══════════════════════════════════════════════════════════════
          GREEN PARK — L-shaped, hugging WEST + SOUTH walls:
            Vertical leg  : x -25→-14,  z 22→45  (11×23)
            Horizontal leg: x -14→+20,  z 37→45  (34×8)
          Corner shared at bottom-left (x -25→-14, z 37→45)
         ══════════════════════════════════════════════════════════════ */}

      {/* ── Vertical leg grass (west wall, full courtyard height) ── */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[-19.5,0.008,33.5]} receiveShadow material={GRASS_MAT}>
        <planeGeometry args={[11,23]} />
      </mesh>

      {/* ── Horizontal leg grass (south wall strip, east of vertical leg) ── */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[3,0.008,41]} receiveShadow material={GRASS_MAT}>
        <planeGeometry args={[34,8]} />
      </mesh>

      {/* ── Paths ── */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[-19.5,0.015,33.5]} material={PARK_PATH_MAT}><planeGeometry args={[1.0,23]} /></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[-19.5,0.015,33.5]} material={PARK_PATH_MAT}><planeGeometry args={[11,1.0]}  /></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[3,0.015,41]}        material={PARK_PATH_MAT}><planeGeometry args={[34,1.0]} /></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[-19.5,0.015,41]}    material={PARK_PATH_MAT}><planeGeometry args={[1.0,8]}  /></mesh>

      {/* ── Fence — outer perimeter of the L ── */}
      <mesh position={[-25,0.22,33.5]}  material={FENCE_MAT}><boxGeometry args={[0.08,0.44,23]}  /></mesh>
      <mesh position={[-19.5,0.22,22]}  material={FENCE_MAT}><boxGeometry args={[11,0.44,0.08]}  /></mesh>
      <mesh position={[-14,0.22,29.5]}  material={FENCE_MAT}><boxGeometry args={[0.08,0.44,15]}  /></mesh>
      <mesh position={[3,0.22,45]}      material={FENCE_MAT}><boxGeometry args={[34,0.44,0.08]}  /></mesh>
      <mesh position={[3,0.22,37]}      material={FENCE_MAT}><boxGeometry args={[34,0.44,0.08]}  /></mesh>
      <mesh position={[20,0.22,41]}     material={FENCE_MAT}><boxGeometry args={[0.08,0.44,8]}   /></mesh>

      {/* ── Vertical leg: benches & trees ── */}
      <Bench position={[-22.5,0,26]} rot={Math.PI/2} />
      <Bench position={[-16.5,0,26]} rot={-Math.PI/2} />
      <Bench position={[-22.5,0,33]} rot={Math.PI/2} />
      <Bench position={[-16.5,0,33]} rot={-Math.PI/2} />
      <ParkTree position={[-24,0,23.5]}  s={1.05} />
      <ParkTree position={[-15,0,23.8]}  s={0.88} />
      <ParkTree position={[-23.5,0,29.5]} s={1.1} />
      <ParkTree position={[-21.5,0,31.5]} s={0.80} />
      <ParkTree position={[-24,0,35.5]}  s={0.95} />

      {/* ── Horizontal leg: benches & trees ── */}
      <Bench position={[-8,0,39]}   rot={0} />
      <Bench position={[-8,0,43]}   rot={Math.PI} />
      <Bench position={[4,0,39]}    rot={0} />
      <Bench position={[4,0,43]}    rot={Math.PI} />
      <Bench position={[14,0,39]}   rot={0} />
      <Bench position={[14,0,43]}   rot={Math.PI} />
      <ParkTree position={[-10,0,38.2]} s={1.0} />
      <ParkTree position={[-5,0,43.5]}  s={0.90} />
      <ParkTree position={[1,0,38.5]}   s={1.05} />
      <ParkTree position={[8,0,43.2]}   s={0.85} />
      <ParkTree position={[14,0,38.0]}  s={1.1} />
      <ParkTree position={[18.5,0,43.0]} s={0.80} />

      {/* ── Designated Smoking Area — south-east corner of horizontal leg ── */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[16.5,0.012,41.5]} material={PARK_SMOKE_MAT}>
        <planeGeometry args={[6,5]} />
      </mesh>
      {([13.5,19.5] as number[]).map((x,i) => (
        <mesh key={`sp${i}`}  position={[x,0.3,39.1]} material={SMOKE_POST_MAT}><cylinderGeometry args={[0.05,0.05,0.6,8]}/></mesh>
      ))}
      {([13.5,19.5] as number[]).map((x,i) => (
        <mesh key={`sp2${i}`} position={[x,0.3,43.9]} material={SMOKE_POST_MAT}><cylinderGeometry args={[0.05,0.05,0.6,8]}/></mesh>
      ))}
      <mesh position={[16.5,0.55,39.1]} material={SMOKE_ROPE_MAT}><boxGeometry args={[6,0.04,0.04]}/></mesh>
      <mesh position={[16.5,0.55,43.9]} material={SMOKE_ROPE_MAT}><boxGeometry args={[6,0.04,0.04]}/></mesh>
      <AshtrayPost position={[14.5,0,40.5]} />
      <AshtrayPost position={[17.5,0,42.0]} />
      <AshtrayPost position={[19,0,40.0]} />
      <Html position={[16.5,2.0,41.5]} center distanceFactor={20} style={{ pointerEvents:"none" }}>
        <div style={{ fontSize:"8px",background:"#222222",color:"#ddddcc",padding:"2px 8px",
          borderRadius:"3px",border:"1px solid #666",fontFamily:"monospace",
          whiteSpace:"nowrap",letterSpacing:"0.06em" }}>
          🚬 Smoking Area Only
        </div>
      </Html>

      {/* ══════════════════════════════════════════════════════════════
          PARKING LOT — east strip (x 34→45, z 22→45)
         ══════════════════════════════════════════════════════════════ */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[39.5,0.006,33.5]} material={PARKING_MAT}>
        <planeGeometry args={[11,23]} />
      </mesh>
      {/* Bay lines */}
      {([24,27.5,31,34.5,38,41.5] as number[]).map((z,i) => (
        <mesh key={`pl${i}`} rotation={[-Math.PI/2,0,0]} position={[39.5,0.012,z]} material={PARKING_LINE_MAT}>
          <planeGeometry args={[11,0.12]} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI/2,0,0]} position={[39.5,0.011,33.5]} material={PARKING_LINE_MAT}>
        <planeGeometry args={[0.12,23]} />
      </mesh>
      {/* Sign */}
      <mesh position={[39.5,1.0,23]} material={PARKING_SIGN_MAT}><cylinderGeometry args={[0.05,0.05,2,8]}/></mesh>
      <Html position={[39.5,2.4,23]} center distanceFactor={20} style={{ pointerEvents:"none" }}>
        <div style={{ fontSize:"8px",background:"#1a44aa",color:"#fff",padding:"2px 7px",
          borderRadius:"3px",border:"1px solid #88aaff",fontFamily:"monospace",
          whiteSpace:"nowrap",letterSpacing:"0.05em",fontWeight:700 }}>
          🅿 Employee Parking
        </div>
      </Html>
      {/* Imported parked cars */}
      {PARKED_CARS.map((car, i) => (
        <ParkedCar key={`parked-car-${i}`} position={car.position} rot={car.rot} car={car.car} />
      ))}

      {/* All 30 lamp posts rendered as 2 InstancedMeshes + 6 entrance point lights */}
      <AllLampPosts />

      <Plants />
    </group>
  );
};

export default OfficeFloor;
