import { useGLTF, Clone, Html } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomId } from "@/stores/officeStore";
import { useOfficeStore } from "@/stores/officeStore";

// Preload all furniture models at module load for immediate availability
useGLTF.preload("/models/programmer_desktop_3d_pc.glb");
useGLTF.preload("/models/chair.glb");
useGLTF.preload("/models/desk.glb");
useGLTF.preload("/models/monitor.glb");
useGLTF.preload("/models/table.glb");
useGLTF.preload("/models/table-round.glb");
useGLTF.preload("/models/sofa.glb");
useGLTF.preload("/models/whiteboard.glb");
useGLTF.preload("/models/bed.glb");
useGLTF.preload("/models/server-rack.glb");
useGLTF.preload("/models/filing-cabinet.glb");
// Upgraded models
useGLTF.preload("/models/office_chair (4).glb");
useGLTF.preload("/models/simple_bunk_bed.glb");
useGLTF.preload("/models/rhyzome_plant.glb");
// Store decor characters
useGLTF.preload("/models/knuckles_sonic_rumble.glb");
useGLTF.preload("/models/movie_sonic_sonic_rumble.glb");

interface FurnitureProps {
  roomId: RoomId;
  position: [number, number, number];
}

// Minimal cache for the few non-GLB primitives (net, TV frame, coffee table, ping pong ball)
const _gc = new Map<string, THREE.BufferGeometry>();
const _mc = new Map<string, THREE.MeshStandardMaterial>();
function sg(type: "box" | "cyl" | "sph", ...a: number[]): THREE.BufferGeometry {
  const k = `${type}:${a}`;
  if (!_gc.has(k)) {
    _gc.set(k, type === "box" ? new THREE.BoxGeometry(...(a as [number,number,number]))
            : type === "cyl" ? new THREE.CylinderGeometry(...(a as [number,number,number,number]))
            :                  new THREE.SphereGeometry(...(a as [number,number,number])));
  }
  return _gc.get(k)!;
}
function sm(color: string, roughness = 0.75, emissive?: string, ei = 0): THREE.MeshStandardMaterial {
  const k = `${color}|${roughness}|${emissive ?? ""}`;
  if (!_mc.has(k)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness });
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
    _mc.set(k, m);
  }
  return _mc.get(k)!;
}

// ─── GLB-backed furniture components ─────────────────────────────────────────

const Chair = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/chair.glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} />;
};

// Upgraded office chair (replaces dev-chair)
const DevChair = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/office_chair (4).glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} scale={0.9} />;
};

// Programmer desktop — new GLB
const DevWorkstation = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/programmer_desktop_3d_pc.glb");
  return <Clone object={scene} position={[pos[0], pos[1] + 0.02, pos[2]]} rotation={[0, rot, 0]} scale={0.075} />;
};

const Monitor = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/monitor.glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} />;
};

// Base model is 2×1 units; scale X and Z to match requested size
const Table = ({ pos, size = [2, 0.06, 1] as [number,number,number] }: { pos: [number,number,number]; size?: [number,number,number] }) => {
  const { scene } = useGLTF("/models/table.glb");
  return <Clone object={scene} position={pos} scale={[size[0] / 2, 1, size[2]]} />;
};

const RoundTable = ({ pos }: { pos: [number,number,number] }) => {
  const { scene } = useGLTF("/models/table-round.glb");
  return <Clone object={scene} position={pos} />;
};

const Sofa = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/sofa.glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} />;
};

const Whiteboard = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/whiteboard.glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} />;
};

const Bed = ({ pos }: { pos: [number,number,number] }) => {
  const { scene } = useGLTF("/models/bed.glb");
  return <Clone object={scene} position={pos} />;
};

// Upgraded bunk bed
const BunkBed = ({ pos }: { pos: [number,number,number] }) => {
  const { scene } = useGLTF("/models/simple_bunk_bed.glb");
  return <Clone object={scene} position={pos} scale={0.18} />;
};

// Rhyzome plant for decoration
const RhyzoPlant = ({ pos, rot = 0, scale = 1 }: { pos: [number,number,number]; rot?: number; scale?: number }) => {
  const { scene } = useGLTF("/models/rhyzome_plant.glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} scale={scale} />;
};

const ServerRack = ({ pos }: { pos: [number,number,number] }) => {
  const { scene } = useGLTF("/models/server-rack.glb");
  return <Clone object={scene} position={pos} />;
};

const FilingCabinet = ({ pos }: { pos: [number,number,number] }) => {
  const { scene } = useGLTF("/models/filing-cabinet.glb");
  return <Clone object={scene} position={pos} />;
};

// ─── Animated ping-pong ball (stays procedural — needs useFrame) ──────────────

const PingPongBall = ({ tablePos }: { tablePos: [number,number,number] }) => {
  const ballRef = useRef<THREE.Mesh>(null);
  const agents  = useOfficeStore((s) => s.officeAgents);
  const hasPlayers = agents.filter(
    (a) => a.currentRoom === "play-area" && a.seatIndex <= 1 &&
           a.status !== "walking" && a.status !== "standing-up",
  ).length >= 2;

  useFrame(() => {
    if (!ballRef.current) return;
    ballRef.current.visible = hasPlayers;
    if (!hasPlayers) return;
    const t = Date.now() * 0.003;
    ballRef.current.position.set(
      tablePos[0] + Math.sin(t) * 0.9,
      Math.abs(Math.sin(t * 2)) * 0.15 + 0.72,
      tablePos[2] + Math.sin(t * 0.7) * 0.15,
    );
  });

  return <mesh ref={ballRef} geometry={sg("sph", 0.02, 6, 5)} material={sm("#ff8800", 0.5)} />;
};

// ─── Shared emissive screen panel ─────────────────────────────────────────────

const SCR = "#88ccee";
const ScreenPanel = ({ pos, w, h }: { pos: [number,number,number]; w: number; h: number }) => (
  <mesh position={pos} geometry={sg("box", w, h, 0.01)} material={sm(SCR, 0.4, SCR, 0.1)} />
);

// ─── Nike staff (salesperson) — procedural humanoid ──────────────────────────
const NikeStaff = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => (
  <group position={pos} rotation={[0, rot, 0]}>
    {/* Legs */}
    <mesh position={[-0.09,0.22,0]} castShadow>
      <cylinderGeometry args={[0.07,0.07,0.44,8]} />
      <meshStandardMaterial color="#1a1a2a" roughness={0.8} />
    </mesh>
    <mesh position={[0.09,0.22,0]} castShadow>
      <cylinderGeometry args={[0.07,0.07,0.44,8]} />
      <meshStandardMaterial color="#1a1a2a" roughness={0.8} />
    </mesh>
    {/* Body — white Nike polo */}
    <mesh position={[0,0.62,0]} castShadow>
      <cylinderGeometry args={[0.15,0.17,0.52,10]} />
      <meshStandardMaterial color="#f5f5f5" roughness={0.75} />
    </mesh>
    {/* Name badge */}
    <mesh position={[0.06,0.72,0.16]}>
      <boxGeometry args={[0.1,0.06,0.01]} />
      <meshStandardMaterial color="#cc2222" roughness={0.5} />
    </mesh>
    {/* Head */}
    <mesh position={[0,1.02,0]} castShadow>
      <sphereGeometry args={[0.155,10,10]} />
      <meshStandardMaterial color="#e8c090" roughness={0.82} />
    </mesh>
    {/* Arms */}
    <mesh position={[-0.22,0.65,0]} rotation={[0,0,0.3]} castShadow>
      <cylinderGeometry args={[0.055,0.055,0.4,8]} />
      <meshStandardMaterial color="#f5f5f5" roughness={0.75} />
    </mesh>
    <mesh position={[0.22,0.65,0]} rotation={[0,0,-0.3]} castShadow>
      <cylinderGeometry args={[0.055,0.055,0.4,8]} />
      <meshStandardMaterial color="#f5f5f5" roughness={0.75} />
    </mesh>
  </group>
);

// ─── Sonic character decorations ─────────────────────────────────────────────
const KnucklesFigure = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/knuckles_sonic_rumble.glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} scale={1.2} />;
};

const MovieSonicFigure = ({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) => {
  const { scene } = useGLTF("/models/movie_sonic_sonic_rumble.glb");
  return <Clone object={scene} position={pos} rotation={[0, rot, 0]} scale={1.1} />;
};

// ─── Main Furniture switch ────────────────────────────────────────────────────

const Furniture = ({ roomId, position }: FurnitureProps) => {
  const [px, py, pz] = position;

  switch (roomId) {
    case "ceo-cabin":
      return (
        <group>
          <mesh position={[px, 0.55, pz-1]} geometry={sg("box", 2.2, 0.07, 0.8)} material={sm("#8b5e3c", 0.6)} castShadow />
          <Monitor pos={[px-0.35, 0.87, pz-1.2]} />
          <Monitor pos={[px+0.35, 0.87, pz-1.2]} />
          <Sofa pos={[px-2.5, py, pz+1.5]} rot={Math.PI/2} />
          <FilingCabinet pos={[px+3, py, pz-0.5]} />
          <mesh position={[px, 1.4, pz-3.2]}  geometry={sg("box", 2.4, 1.3, 0.06)} material={sm("#1a1a25", 0.5)} />
          <ScreenPanel pos={[px, 1.4, pz-3.16]} w={2.2} h={1.1} />
        </group>
      );

    case "scrum-room":
      return (
        <group>
          <RoundTable pos={[px, py, pz]} />
          {Array.from({length:6}).map((_,i) => {
            const angle = (i/6)*Math.PI*2;
            return <Chair key={i} pos={[px+Math.cos(angle)*1.8, py, pz+Math.sin(angle)*1.8]} rot={-angle+Math.PI} />;
          })}
          <Whiteboard pos={[px, py, pz-3.2]} />
        </group>
      );

    case "conf-dev":
    case "conf-design":
    case "conf-security":
      return (
        <group>
          <Table pos={[px, py, pz]} size={[2.5, 0.06, 1]} />
          {[-1, 0, 1].map((o) => <Chair key={`t${o}`} pos={[px+o*0.9, py, pz-0.9]} />)}
          {[-1, 0, 1].map((o) => <Chair key={`b${o}`} pos={[px+o*0.9, py, pz+0.9]} rot={Math.PI} />)}
          <ScreenPanel pos={[px, 1.3, pz-3.17]} w={1.85} h={1.05} />
        </group>
      );

    case "conf-qa":
      return (
        <group>
          <Table pos={[px, py, pz]} size={[3, 0.06, 1.2]} />
          {[-1.2, 0, 1.2].map((o) => <Chair key={`t${o}`} pos={[px+o, py, pz-0.8]} />)}
          {[-1.2, 0, 1.2].map((o) => <Chair key={`b${o}`} pos={[px+o, py, pz+0.8]} rot={Math.PI} />)}
          <Chair pos={[px-2.2, py, pz]} rot={Math.PI/2} />
          <Chair pos={[px+2.2, py, pz]} rot={-Math.PI/2} />
          <Whiteboard pos={[px, py, pz-2.7]} />
        </group>
      );

    case "conf-data":
      return (
        <group>
          <Table pos={[px, py, pz]} size={[3.5, 0.06, 1.4]} />
          {[-1.5,-0.5,0.5,1.5].map((o) => <Chair key={`t${o}`} pos={[px+o, py, pz-1]} />)}
          {[-1.5,-0.5,0.5,1.5].map((o) => <Chair key={`b${o}`} pos={[px+o, py, pz+1]} rot={Math.PI} />)}
          <Whiteboard pos={[px+3.5, py, pz]} rot={-Math.PI/2} />
        </group>
      );

    case "conf-ops":
      return (
        <group>
          <Table pos={[px, py, pz]} size={[2, 0.06, 0.9]} />
          {[-0.8, 0.8].map((o) => <Chair key={`t${o}`} pos={[px+o, py, pz-0.7]} />)}
          {[-0.8, 0.8].map((o) => <Chair key={`b${o}`} pos={[px+o, py, pz+0.7]} rot={Math.PI} />)}
        </group>
      );

    case "conf-product":
      return (
        <group>
          <Table pos={[px, py, pz]} size={[4.5, 0.06, 1.6]} />
          {[-2,-0.7,0.7,2].map((o) => <Chair key={`t${o}`} pos={[px+o, py, pz-1.2]} />)}
          {[-2,-0.7,0.7,2].map((o) => <Chair key={`b${o}`} pos={[px+o, py, pz+1.2]} rot={Math.PI} />)}
          <Chair pos={[px-3.2, py, pz]} rot={Math.PI/2} />
          <Chair pos={[px+3.2, py, pz]} rot={-Math.PI/2} />
          <ScreenPanel pos={[px, 1.4, pz-3.17]} w={3.3} h={1.35} />
          <Whiteboard pos={[px-4, py, pz]} rot={Math.PI/2} />
          <Whiteboard pos={[px+4, py, pz]} rot={-Math.PI/2} />
        </group>
      );

    case "workstations":
      return (
        <group>
          {[-12.5,-10,-7.5,-5,-2.5,0,2.5,5,7.5,10,12.5].map((xOff,i) => (
            <group key={`ws1${i}`}>
              <DevWorkstation pos={[px+xOff, py, pz-2.15]} rot={Math.PI / 2} />
              <DevChair       pos={[px+xOff, py, pz-0.95]} rot={-Math.PI / 2} />
            </group>
          ))}
          {[-12.5,-10,-7.5,-5,-2.5,0,2.5,5,7.5,10,12.5].map((xOff,i) => (
            <group key={`ws2${i}`}>
              <DevWorkstation pos={[px+xOff, py, pz+2.15]} rot={-Math.PI / 2} />
              <DevChair       pos={[px+xOff, py, pz+0.95]} rot={Math.PI / 2} />
            </group>
          ))}
          <Whiteboard pos={[px+12.5, py, pz-3.8]} />
          <Whiteboard pos={[px-12.5, py, pz-3.8]} />
        </group>
      );

    case "sleeping-room":
      return (
        <group>
          {([[-2.3,-2.0],[2.3,-2.0],[-2.3,2.0],[2.3,2.0]] as [number,number][]).map(([xOff,zOff],i) => (
            <BunkBed key={i} pos={[px+xOff, py, pz+zOff]} />
          ))}
        </group>
      );

    case "server-room":
      return (
        <group>
          {[-3,-2,-1,0,1,2,3].map((xOff,i) => <ServerRack key={`sb${i}`} pos={[px+xOff, py, pz-2]} />)}
          {[-3,-2,-1,0,1,2,3].map((xOff,i) => <ServerRack key={`sf${i}`} pos={[px+xOff, py, pz+2]} />)}
        </group>
      );

    case "file-room":
      return (
        <group>
          {[-2.5,-1.5,-0.5,0.5,1.5,2.5].map((xOff,i) => (
            <FilingCabinet key={`fb${i}`} pos={[px+xOff, py, pz-2.5]} />
          ))}
          {[-2.5,-1.5,-0.5,0.5,1.5,2.5].map((xOff,i) => (
            <FilingCabinet key={`ff${i}`} pos={[px+xOff, py, pz+2.5]} />
          ))}
          <Table pos={[px, py, pz]} size={[2.5, 0.06, 0.8]} />
          <Chair pos={[px-0.5, py, pz+0.6]} rot={Math.PI} />
          <Chair pos={[px+0.5, py, pz+0.6]} rot={Math.PI} />
        </group>
      );

    case "kitchen":
      return (
        <group>
          <mesh position={[px-2, 0.5, pz-2.5]} geometry={sg("box", 3, 0.8, 0.5)} material={sm("#c8a878", 0.75)} castShadow />
          <Sofa pos={[px+1, py, pz+1]} />
          <Sofa pos={[px-1.5, py, pz+1]} rot={Math.PI/4} />
          <Table pos={[px, py, pz+1]} size={[0.8, 0.04, 0.5]} />
          <RhyzoPlant pos={[px+3.5, py, pz-2.5]} rot={0.5} scale={0.8} />
          <RhyzoPlant pos={[px-3.5, py, pz+2.5]} rot={-0.8} scale={0.6} />
        </group>
      );

    case "play-area":
      return (
        <group>
          <Table pos={[px-1, py, pz-1]} size={[2.5, 0.05, 1.4]} />
          <mesh position={[px-1, 0.7, pz-1]} geometry={sg("box", 0.03, 0.15, 1.4)} material={sm("#ffffff", 0.5)} />
          <PingPongBall tablePos={[px-1, 0, pz-1]} />
          <Sofa pos={[px+2, py, pz+2]} />
        </group>
      );

    case "collab-area":
      return (
        <group>
          <RhyzoPlant pos={[px+4.5, py, pz-3.5]} rot={1.2} scale={0.9} />
          <RhyzoPlant pos={[px-4.5, py, pz+3.5]} rot={-0.6} scale={0.75} />
          {/* Low coffee table — simple flat cylinder */}
          <mesh position={[px, 0.35, pz]} geometry={sg("cyl", 0.8, 0.8, 0.04, 16)} material={sm("#c8a878", 0.75)} castShadow />
          {([[-2.5,-2],[2.5,-2],[-2.5,2],[2.5,2]] as [number,number][]).map(([cx,cz],i) => (
            <group key={i} position={[px+cx, 0, pz+cz]} rotation={[0, (i*Math.PI)/2, 0]}>
              <mesh position={[0,0.25,0]}    geometry={sg("box",1.4,0.15,0.6)} material={sm(["#d4a574","#b8956a","#c49868","#dab882"][i],0.85)} castShadow />
              <mesh position={[0,0.45,-0.25]} geometry={sg("box",1.4,0.3,0.1)}  material={sm(["#c49868","#a88558","#b89060","#caa878"][i],0.85)} castShadow />
            </group>
          ))}
          <mesh position={[px, 1.3, pz-3.5]} geometry={sg("box", 2.5, 1.5, 0.08)} material={sm("#f8f8f0", 0.4)} castShadow />
        </group>
      );

    case "nike-store":
      return (
        <group>
          {/* ── Knuckles mascot ── */}
          <KnucklesFigure pos={[px+5, py, pz-3]} rot={-0.4} />

          {/* ── Shoe display shelves (back wall) ── */}
          {([-5,-2.5,0,2.5,5] as number[]).map((xOff,i) => (
            <group key={`shelf${i}`}>
              <mesh position={[px+xOff,0.6, pz-4.2]} geometry={sg("box",2.2,0.06,0.45)} material={sm("#f0ece4",0.6)} castShadow />
              <mesh position={[px+xOff,1.2, pz-4.2]} geometry={sg("box",2.2,0.06,0.45)} material={sm("#f0ece4",0.6)} castShadow />
              <mesh position={[px+xOff,1.8, pz-4.2]} geometry={sg("box",2.2,0.06,0.45)} material={sm("#f0ece4",0.6)} castShadow />
              <mesh position={[px+xOff-0.4,0.7,pz-4.2]} geometry={sg("box",0.5,0.2,0.3)} material={sm("#cc2222",0.7)} castShadow />
              <mesh position={[px+xOff+0.4,0.7,pz-4.2]} geometry={sg("box",0.5,0.2,0.3)} material={sm("#cc2222",0.7)} castShadow />
            </group>
          ))}

          {/* ── Left side shelves ── */}
          {([0.5,1.1,1.7] as number[]).map((yOff,i) => (
            <mesh key={`lshelf${i}`} position={[px-6.8,yOff,pz-0.5]} geometry={sg("box",0.06,0.06,7.5)} material={sm("#d0c8bc",0.6)} castShadow />
          ))}

          {/* ── Central display table ── */}
          <Table pos={[px, py, pz-1]} size={[4,0.08,1.2]} />

          {/* ── Try-on seating bench ── */}
          <mesh position={[px-3.5,0.44,pz+1.5]} geometry={sg("box",3.5,0.12,0.55)} material={sm("#c8a070",0.85)} castShadow />
          {([-1,0,1] as number[]).map((xOff,i) => (
            <mesh key={`bs${i}`} position={[px-3.5+xOff,0.22,pz+1.5]} geometry={sg("box",0.12,0.44,0.5)} material={sm("#8a5a28",0.9)} castShadow />
          ))}

          {/* ── Sofa corner ── */}
          <Sofa pos={[px+2.5, py, pz+3.5]} rot={Math.PI} />
          <Table pos={[px-0.5, py, pz+3.5]} size={[0.8,0.04,0.5]} />

          {/* ══ Cash register counter (prominent, against right wall) ══ */}
          {/* Counter body — L-shaped: long front + short side */}
          <mesh position={[px+5.6,0.52,pz+0.5]} geometry={sg("box",1.8,0.88,3.5)} material={sm("#1a1a25",0.5)} castShadow />
          <mesh position={[px+4.8,0.52,pz+2.1]} geometry={sg("box",0.2,0.88,0.3)} material={sm("#1a1a25",0.5)} castShadow />
          {/* Counter top surface */}
          <mesh position={[px+5.6,0.97,pz+0.5]} geometry={sg("box",1.85,0.06,3.55)} material={sm("#2a2a38",0.4)} castShadow />
          {/* POS monitor */}
          <Monitor pos={[px+5.6, 1.0, pz-0.6]} />
          {/* Cash drawer */}
          <mesh position={[px+5.6,0.62,pz-0.8]} geometry={sg("box",0.9,0.08,0.35)} material={sm("#333344",0.5)} castShadow />
          {/* Card reader */}
          <mesh position={[px+5.6,1.04,pz+0.1]} geometry={sg("box",0.18,0.12,0.28)} material={sm("#111111",0.5)} castShadow />
          <mesh position={[px+5.6,1.04,pz+0.1]} geometry={sg("box",0.14,0.02,0.22)} material={sm(SCR,0.3,SCR,0.15)} />
          {/* "PAY HERE" label */}
          <Html position={[px+5.6,1.6,pz+0.5]} center distanceFactor={20} style={{ pointerEvents:"none" }}>
            <div style={{ fontSize:"7px",background:"#cc2222",color:"#fff",padding:"1px 6px",
              borderRadius:"2px",fontFamily:"monospace",letterSpacing:"0.1em",fontWeight:700,whiteSpace:"nowrap" }}>
              PAY HERE
            </div>
          </Html>

          {/* ── Queue markers on floor (rope stanchions look) ── */}
          {([pz+1.8, pz+0.9, pz+0.0] as number[]).map((qz,i) => (
            <group key={`q${i}`}>
              <mesh position={[px+3.8,0.5,qz]}><cylinderGeometry args={[0.04,0.06,1.0,8]}/><meshStandardMaterial color="#c8a020" metalness={0.6} roughness={0.3}/></mesh>
              <mesh position={[px+3.8,0.02,qz]}><cylinderGeometry args={[0.18,0.18,0.04,12]}/><meshStandardMaterial color="#c8a020" metalness={0.5}/></mesh>
            </group>
          ))}
          {/* Rope between stanchions */}
          <mesh position={[px+3.8,0.5,pz+1.35]}><boxGeometry args={[0.03,0.03,0.9]}/><meshStandardMaterial color="#8a2020" roughness={0.6}/></mesh>
          <mesh position={[px+3.8,0.5,pz+0.45]}><boxGeometry args={[0.03,0.03,0.9]}/><meshStandardMaterial color="#8a2020" roughness={0.6}/></mesh>

          {/* ── Staff ── */}
          {/* Salesperson 1 — near shoe shelves */}
          <NikeStaff pos={[px-2,py,pz-2.5]} rot={0.4} />
          {/* Salesperson 2 — helping at display table */}
          <NikeStaff pos={[px+1.5,py,pz-0.8]} rot={Math.PI+0.3} />
          {/* Cashier behind counter */}
          <NikeStaff pos={[px+5.6,py,pz+1.8]} rot={Math.PI} />
        </group>
      );

    case "food-court":
      return (
        <group>
          <MovieSonicFigure pos={[px-4.5, py, pz+3]} rot={0.6} />
          {/* Food stalls/kiosks along back */}
          {([-5, 0, 5] as number[]).map((xOff,i) => (
            <group key={`kiosk${i}`}>
              <mesh position={[px+xOff, 0.7, pz-4.2]} geometry={sg("box", 2.8, 1.2, 0.7)} material={sm(["#e87d3e","#4a8ad4","#4aa84a"][i], 0.6)} castShadow />
              <mesh position={[px+xOff, 1.4, pz-4.2]} geometry={sg("box", 2.8, 0.06, 0.7)} material={sm("#f0ece4", 0.7)} castShadow />
              <Monitor pos={[px+xOff, 1.1, pz-3.85]} />
            </group>
          ))}
          {/* Dining tables with chairs */}
          {([-4, -1.5, 1.5, 4] as number[]).map((xOff,i) => (
            <group key={`table${i}`}>
              <Table pos={[px+xOff, py, pz-1.5]} size={[1.2, 0.05, 0.7]} />
              <Chair pos={[px+xOff, py, pz-2.1]} />
              <Chair pos={[px+xOff, py, pz-0.9]} rot={Math.PI} />
            </group>
          ))}
          {([-4, -1.5, 1.5, 4] as number[]).map((xOff,i) => (
            <group key={`table2${i}`}>
              <Table pos={[px+xOff, py, pz+1.8]} size={[1.2, 0.05, 0.7]} />
              <Chair pos={[px+xOff, py, pz+1.2]} />
              <Chair pos={[px+xOff, py, pz+2.4]} rot={Math.PI} />
            </group>
          ))}
          {/* Umbrella stands over outdoor tables */}
          {([-4, 0, 4] as number[]).map((xOff,i) => (
            <group key={`umb${i}`}>
              <mesh position={[px+xOff, 1.3, pz+1.8]} geometry={sg("cyl", 0.05, 0.05, 2.6, 6)} material={sm("#888888", 0.5)} castShadow />
              <mesh position={[px+xOff, 2.65, pz+1.8]} geometry={sg("cyl", 1.6, 0.2, 0.12, 12)} material={sm(["#cc2222","#2255cc","#22aa44"][i], 0.7)} castShadow />
            </group>
          ))}
        </group>
      );

    case "gaming-room":
      return (
        <group>
          <RhyzoPlant pos={[px-5.5, py, pz+4]} rot={0.3} scale={0.7} />
          <RhyzoPlant pos={[px+5.5, py, pz+4]} rot={-0.5} scale={0.7} />
          {/* Arcade machines along back wall */}
          {([-4.5, -2, 0.5, 3] as number[]).map((xOff,i) => (
            <group key={`arcade${i}`}>
              <mesh position={[px+xOff, 0.8, pz-4.2]} geometry={sg("box", 0.8, 1.6, 0.5)} material={sm(["#cc2222","#2244cc","#22aa44","#cc8800"][i], 0.6)} castShadow />
              <ScreenPanel pos={[px+xOff, 1.1, pz-3.94]} w={0.6} h={0.55} />
              {/* Joystick top */}
              <mesh position={[px+xOff, 0.52, pz-3.97]} geometry={sg("cyl", 0.04, 0.04, 0.12, 8)} material={sm("#222222", 0.5)} castShadow />
              <mesh position={[px+xOff, 0.6, pz-3.97]}  geometry={sg("sph", 0.06, 8, 8)} material={sm("#cc2222", 0.5)} castShadow />
            </group>
          ))}
          {/* Big screen TV wall */}
          <mesh position={[px+4.5, 1.5, pz-4.8]} geometry={sg("box", 2.8, 1.8, 0.1)} material={sm("#1a1a25", 0.5)} castShadow />
          <ScreenPanel pos={[px+4.5, 1.5, pz-4.74]} w={2.6} h={1.6} />
          {/* Bean bags / gaming chairs */}
          {([-4, -1.5, 0.5, 2.5] as number[]).map((xOff,i) => (
            <mesh key={`bean${i}`} position={[px+xOff, 0.2, pz-2.5]} geometry={sg("sph", 0.38, 10, 10)} material={sm(["#cc2222","#2244cc","#22aa44","#cc8800"][i], 0.9)} castShadow />
          ))}
          {/* Sofa facing big screen */}
          <Sofa pos={[px-2.5, py, pz+2.5]} rot={Math.PI} />
          <Sofa pos={[px+1.5, py, pz+2.5]} rot={Math.PI} />
          {/* Coffee table */}
          <Table pos={[px-0.5, py, pz+1.5]} size={[1.4, 0.04, 0.5]} />
        </group>
      );

    default:
      return null;
  }
};

export default Furniture;
