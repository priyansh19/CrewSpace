import { Html } from "@react-three/drei";
import * as THREE from "three";
import { memo, useMemo } from "react";

interface RoomProps {
  position: [number, number, number];
  width: number;
  depth: number;
  accentColor: string;
  label: string;
  wallHeight?: number;
  doorOffsets?: number[];
  backDoorOffsets?: number[];
}

const WALL_H     = 2.5;
const WALL_T     = 0.12;
const DOOR_W     = 1.5;
const DOOR_H     = 2.2;

// Shared line material cache
const _lineMats = new Map<string, THREE.LineBasicMaterial>();
function lineMat(color: string): THREE.LineBasicMaterial {
  if (!_lineMats.has(color)) _lineMats.set(color, new THREE.LineBasicMaterial({ color }));
  return _lineMats.get(color)!;
}

// Shared solid material cache
const _solidMats = new Map<string, THREE.MeshStandardMaterial>();
function solidMat(color: string, roughness = 0.7): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  if (!_solidMats.has(key)) _solidMats.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return _solidMats.get(key)!;
}

// Build and cache an EdgesGeometry for a box of given dimensions
const _edgesCache = new Map<string, THREE.EdgesGeometry>();
function edgesGeo(w: number, h: number, d: number): THREE.EdgesGeometry {
  const key = `${w}|${h}|${d}`;
  if (!_edgesCache.has(key)) {
    _edgesCache.set(key, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  }
  return _edgesCache.get(key)!;
}

const WireBox = ({ args, position, color }: { args: [number, number, number]; position: [number, number, number]; color: string }) => (
  <lineSegments position={position} geometry={edgesGeo(...args)} material={lineMat(color)} />
);

// Door gap helpers
function doorSegments(halfW: number, doorOffsets: number[]): { x: number; w: number }[] {
  const sorted = [...doorOffsets].sort((a, b) => a - b);
  const segs: { x: number; w: number }[] = [];
  let left = -halfW;
  for (const dc of sorted) {
    const segW = dc - DOOR_W / 2 - left;
    if (segW > 0.1) segs.push({ x: left + segW / 2, w: segW });
    left = dc + DOOR_W / 2;
  }
  const last = halfW - left;
  if (last > 0.1) segs.push({ x: left + last / 2, w: last });
  return segs;
}

const DoorFrame = ({ dc, z, color }: { dc: number; z: number; color: string }) => (
  <group>
    <mesh position={[dc, DOOR_H + 0.06, z]}>
      <boxGeometry args={[DOOR_W + 0.2, 0.12, 0.15]} />
      <primitive object={solidMat(color)} attach="material" />
    </mesh>
    <mesh position={[dc - DOOR_W / 2 - 0.05, DOOR_H / 2, z]}>
      <boxGeometry args={[0.1, DOOR_H, 0.15]} />
      <primitive object={solidMat(color)} attach="material" />
    </mesh>
    <mesh position={[dc + DOOR_W / 2 + 0.05, DOOR_H / 2, z]}>
      <boxGeometry args={[0.1, DOOR_H, 0.15]} />
      <primitive object={solidMat(color)} attach="material" />
    </mesh>
    {WALL_H - DOOR_H > 0.15 && (
      <WireBox
        args={[DOOR_W, WALL_H - DOOR_H - 0.12, WALL_T]}
        position={[dc, DOOR_H + (WALL_H - DOOR_H) / 2 + 0.06, z]}
        color={color}
      />
    )}
  </group>
);

const Room = ({
  position,
  width,
  depth,
  accentColor,
  label,
  wallHeight = WALL_H,
  doorOffsets = [0],
  backDoorOffsets = [],
}: RoomProps) => {
  const halfW = width / 2;
  const halfD = depth / 2;

  // Pre-compute door segments (stable as long as props don't change)
  const frontSegs = useMemo(() => doorSegments(halfW, doorOffsets), [halfW, doorOffsets]);
  const backSegs  = useMemo(
    () => backDoorOffsets.length > 0 ? doorSegments(halfW, backDoorOffsets) : null,
    [halfW, backDoorOffsets],
  );

  return (
    <group position={position}>
      {/* Floor tile */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <primitive object={solidMat("#8a7a68", 0.92)} attach="material" />
      </mesh>

      {/* Back wall */}
      {backSegs ? (
        <>
          {backSegs.map((s, i) => (
            <WireBox key={i} args={[s.w, WALL_H, WALL_T]} position={[s.x, WALL_H / 2, -halfD]} color={accentColor} />
          ))}
          {[...(backDoorOffsets)].map((dc, i) => (
            <DoorFrame key={i} dc={dc} z={-halfD} color={accentColor} />
          ))}
        </>
      ) : (
        <WireBox args={[width, wallHeight, WALL_T]} position={[0, wallHeight / 2, -halfD]} color={accentColor} />
      )}

      {/* Side walls */}
      <WireBox args={[WALL_T, wallHeight, depth]} position={[-halfW, wallHeight / 2, 0]} color={accentColor} />
      <WireBox args={[WALL_T, wallHeight, depth]} position={[ halfW, wallHeight / 2, 0]} color={accentColor} />

      {/* Front wall with door */}
      {frontSegs.map((s, i) => (
        <WireBox key={i} args={[s.w, wallHeight, WALL_T]} position={[s.x, wallHeight / 2, halfD]} color={accentColor} />
      ))}
      {doorOffsets.map((dc, i) => (
        <DoorFrame key={i} dc={dc} z={halfD} color={accentColor} />
      ))}

      {/* Ceiling outline */}
      <WireBox args={[width, 0.06, depth]} position={[0, wallHeight, 0]} color={accentColor} />

      {/* Accent strip */}
      <mesh position={[0, 0.04, halfD]}>
        <boxGeometry args={[width, 0.03, 0.12]} />
        <primitive object={solidMat(accentColor, 0.7)} attach="material" />
      </mesh>

      {/* Emissive ceiling light (replaces per-room point lights) */}
      <mesh position={[0, wallHeight - 0.05, 0]}>
        <boxGeometry args={[width * 0.6, 0.04, depth * 0.4]} />
        <meshStandardMaterial
          color="#fffde8"
          emissive="#fffde8"
          emissiveIntensity={0.15}
          roughness={0.5}
        />
      </mesh>

      {/* Room label */}
      <Html position={[0, wallHeight + 0.7, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.08em",
            padding: "2px 10px",
            borderRadius: "5px",
            color: "#5a4a3a",
            background: "#faf5ee",
            border: `2px solid ${accentColor}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            fontWeight: 600,
            fontFamily: "system-ui",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
};

// Room geometry is purely static — memo prevents re-renders from parent OfficeFloor
export default memo(Room);
