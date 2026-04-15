import { useRef, useMemo, useEffect } from "react";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AgentRole, RoomId } from "@/stores/officeStore";
import { ROOM_SEATS, useOfficeStore } from "@/stores/officeStore";

useGLTF.preload("/models/agent-figure.glb");

const ROLE_COLOR: Record<AgentRole, string> = {
  ceo:        "#d97706",
  pm:         "#f97316",
  engineer:   "#4a8ad4",
  researcher: "#8b5cf6",
  developer:  "#4a8ad4",
  designer:   "#9a5ec8",
  security:   "#3aaa6a",
  manager:    "#e87d3e",
};

const ROLE_OUTFIT: Record<AgentRole, { shirt: string }> = {
  ceo:        { shirt: "#d97706" },
  pm:         { shirt: "#f97316" },
  engineer:   { shirt: "#4a8ad4" },
  researcher: { shirt: "#8b5cf6" },
  developer:  { shirt: "#4a8ad4" },
  designer:   { shirt: "#9a5ec8" },
  security:   { shirt: "#3aaa6a" },
  manager:    { shirt: "#e87d3e" },
};

// Pre-created selection ring materials per role (never recreated)
const _ringMats: Partial<Record<AgentRole, THREE.MeshBasicMaterial>> = {};
function ringMat(role: AgentRole) {
  if (!_ringMats[role]) _ringMats[role] = new THREE.MeshBasicMaterial({ color: ROLE_COLOR[role], transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  return _ringMats[role]!;
}

const STATUS_ICONS: Record<string, string> = {
  working: "💻", collaborating: "💬", sleeping: "😴",
  idle: "☕", meeting: "🗣️", walking: "🚶", "standing-up": "🧍",
};

function getAnim(status: string, isSitting: boolean): string {
  if (isSitting) return "Sitting";
  switch (status) {
    case "walking":       return "Walking";
    case "sleeping":      return "Death";
    case "collaborating": return "Wave";
    case "meeting":       return "ThumbsUp";
    case "standing-up":   return "Standing";
    default:              return "Idle";
  }
}

const RING_GEO = new THREE.RingGeometry(0.14, 0.2, 24);

function useSeatRot(currentRoom: RoomId, targetRoom: RoomId, seatIndex: number): number {
  return useMemo(() => {
    if (currentRoom !== targetRoom) return 0;
    const seats = ROOM_SEATS[currentRoom];
    if (!seats?.length) return 0;
    return seats[seatIndex % seats.length].rot;
  }, [currentRoom, targetRoom, seatIndex]);
}

function applyRoleTint(clone: THREE.Group, roleColor: string, intensity = 0.18) {
  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.SkinnedMesh)) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const tinted = mats.map((m: THREE.Material) => {
      const c = (m as THREE.MeshStandardMaterial).clone();
      c.emissive = new THREE.Color(roleColor);
      c.emissiveIntensity = intensity;
      return c;
    });
    child.material = tinted.length === 1 ? tinted[0] : tinted;
  });
}

// ─── Agent component (subscribes only to display fields, not position) ────────
const StandardAgent = ({ agentId, isSelected }: { agentId: string; isSelected: boolean }) => {
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  // Only the fields needed for React rendering (labels, animation state).
  // Position/targetPosition are read from getState() in useFrame — no re-renders for movement.
  const { name, role, task, currentRoom, targetRoom, status, isSitting, seatIndex } = useOfficeStore(
    useShallow((s) => {
      const a = s.officeAgents.find((x) => x.id === agentId);
      return {
        name:        a?.name        ?? "",
        role:        (a?.role       ?? "engineer") as AgentRole,
        task:        a?.task        ?? "",
        currentRoom: (a?.currentRoom ?? "workstations") as RoomId,
        targetRoom:  (a?.targetRoom  ?? "workstations") as RoomId,
        status:      a?.status      ?? "idle",
        isSitting:   a?.isSitting   ?? false,
        seatIndex:   a?.seatIndex   ?? 0,
      };
    }),
  );

  const outfit   = ROLE_OUTFIT[role];
  const seatRot  = useSeatRot(currentRoom, targetRoom, seatIndex);

  const { scene, animations } = useGLTF("/models/agent-figure.glb");
  const clone = useMemo(() => {
    const g = SkeletonUtils.clone(scene) as THREE.Group;
    applyRoleTint(g, ROLE_COLOR[role], 0.18);
    return g;
  }, [scene, role]);

  const groupRef = useRef<THREE.Group>(null);
  const prevAnim = useRef("");
  const { actions } = useAnimations(animations, groupRef);

  // Read initial world position once at mount — set directly on the ref before first useFrame
  const initPos = useMemo(() => {
    const a = useOfficeStore.getState().officeAgents.find((x) => x.id === agentId);
    return a?.targetPosition ?? ([0, 0, 0] as [number, number, number]);
  }, [agentId]);

  // Animation switching (runs only when status/isSitting changes)
  useEffect(() => {
    const next = getAnim(status, isSitting);
    if (next === prevAnim.current) return;
    prevAnim.current = next;
    Object.values(actions).forEach((a) => a?.fadeOut(0.2));
    const target = actions[next] ?? actions["Idle"];
    if (!target) return;
    if (next === "Sitting") {
      target.reset();
      target.setLoop(THREE.LoopOnce, 1);
      target.clampWhenFinished = true;
      target.play();
      target.time = target.getClip().duration;
    } else {
      target.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2);
      target.setLoop(THREE.LoopRepeat, Infinity);
      target.play();
    }
  }, [status, isSitting, actions]);

  // Track when target changes so we can unsettled
  const lastTgtX = useRef(initPos[0]);
  const lastTgtZ = useRef(initPos[2]);
  const settled   = useRef(false);

  // ── useFrame: ALL position/rotation lerps — reads store via getState() (no React re-render) ──
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    // Read live agent data without subscribing (avoids re-render)
    const agent = useOfficeStore.getState().officeAgents.find((a) => a.id === agentId);
    if (!agent) return;

    const tgtX = agent.targetPosition[0];
    const tgtZ = agent.targetPosition[2];

    // Unsettled when target changes
    if (lastTgtX.current !== tgtX || lastTgtZ.current !== tgtZ) {
      lastTgtX.current = tgtX;
      lastTgtZ.current = tgtZ;
      settled.current = false;
    }
    if (settled.current) return;

    const tgtY  = agent.status === "sleeping" ? 0.4 : agent.isSitting ? 0.0 : 0;
    const tgtRx = agent.status === "sleeping" ? -Math.PI / 2 : 0;

    let tgtRy: number;
    if (agent.status === "walking") {
      const dx = tgtX - g.position.x;
      const dz = tgtZ - g.position.z;
      tgtRy = (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) ? Math.atan2(dx, dz) : g.rotation.y;
    } else {
      tgtRy = seatRot;
    }

    g.position.x = THREE.MathUtils.lerp(g.position.x, tgtX, 0.04);
    g.position.z = THREE.MathUtils.lerp(g.position.z, tgtZ, 0.04);
    g.position.y = THREE.MathUtils.lerp(g.position.y, tgtY, agent.status === "sleeping" ? 0.04 : 0.08);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tgtRx, agent.status === "sleeping" ? 0.04 : 0.07);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, tgtRy, 0.07);

    if (
      Math.abs(g.position.x - tgtX) < 0.005 &&
      Math.abs(g.position.z - tgtZ) < 0.005 &&
      Math.abs(g.position.y - tgtY) < 0.005 &&
      agent.status !== "walking"
    ) {
      g.position.set(tgtX, tgtY, tgtZ);
      g.rotation.set(tgtRx, tgtRy, 0);
      settled.current = true;
    }
  });

  return (
    <group
      ref={groupRef}
      position={initPos}
      onClick={(e) => { e.stopPropagation(); selectAgent(isSelected ? null : agentId); }}
    >
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={RING_GEO} material={ringMat(role)} />
      )}
      <primitive object={clone} scale={0.25} />
      <Html position={[0, 0.7, 0]} center distanceFactor={15} style={{ pointerEvents: "none" }}>
        <div style={{
          whiteSpace: "nowrap", fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
          color: outfit.shirt, background: isSelected ? "#fff" : "#faf5ee",
          border: `1.5px solid ${isSelected ? outfit.shirt : outfit.shirt + "60"}`,
          fontWeight: 600, fontFamily: "monospace",
          boxShadow: isSelected ? `0 0 8px ${outfit.shirt}40` : "0 1px 4px rgba(0,0,0,0.08)",
        }}>
          {STATUS_ICONS[status] || "🧍"} {name}
        </div>
      </Html>
      {isSelected && (
        <Html position={[0, 1.2, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div style={{
            whiteSpace: "nowrap", padding: "8px 12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.95)", border: `2px solid ${outfit.shirt}`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.12), 0 0 12px ${outfit.shirt}20`,
            fontSize: "11px", color: "#5a5a6a", lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 800, fontSize: "13px", color: "#2a2a3a", marginBottom: 4 }}>{name}</div>
            <div>📍 {currentRoom.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
            <div>⚡ {task}</div>
            <div style={{
              marginTop: 4, padding: "1px 5px", borderRadius: 3,
              fontSize: "9px", fontWeight: 600, textTransform: "uppercase", display: "inline-block",
              background: status === "working" ? "#dcfce7" : status === "sleeping" ? "#ede9fe" : "#dbeafe",
              color:      status === "working" ? "#166534" : status === "sleeping" ? "#5b21b6" : "#1e40af",
            }}>
              {status}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

const HumanAgent = ({ agentId, isSelected = false }: { agentId: string; isSelected?: boolean }) => (
  <StandardAgent agentId={agentId} isSelected={isSelected} />
);

export default HumanAgent;
