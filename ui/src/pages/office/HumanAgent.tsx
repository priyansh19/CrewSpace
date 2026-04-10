import { useRef, useMemo, useEffect } from "react";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { OfficeAgent, AgentRole } from "@/stores/officeStore";
import { ROOM_SEATS, useOfficeStore } from "@/stores/officeStore";

useGLTF.preload("/models/agent-figure.glb");

// ─── Role → emissive tint colour ─────────────────────────────────────────────
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

function useSeatRot(agent: OfficeAgent) {
  return useMemo(() => {
    if (agent.currentRoom !== agent.targetRoom) return 0;
    const seats = ROOM_SEATS[agent.currentRoom];
    if (!seats?.length) return 0;
    return seats[agent.seatIndex % seats.length].rot;
  }, [agent.currentRoom, agent.targetRoom, agent.seatIndex]);
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

// ─── VIP Agent (Detroit: Become Human model — CEO & Manager) ─────────────────
const VipAgent = ({ agent, isSelected }: { agent: OfficeAgent; isSelected: boolean }) => {
  const selectAgent  = useOfficeStore((s) => s.selectAgent);
  const modelPath = "/models/agent-figure.glb";

  const { scene, animations } = useGLTF(modelPath);
  const clone = useMemo(() => {
    const g = SkeletonUtils.clone(scene) as THREE.Group;
    applyRoleTint(g, ROLE_COLOR[agent.role], 0.12);
    return g;
  }, [scene, agent.role]);

  const groupRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, groupRef);
  const seatRot = useSeatRot(agent);
  const outfit  = ROLE_OUTFIT[agent.role];

  useEffect(() => {
    const clip = actions["idle"] ?? Object.values(actions)[0];
    clip?.reset().setEffectiveWeight(1).play();
  }, [actions]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.x = THREE.MathUtils.lerp(g.position.x, agent.position[0], 0.05);
    g.position.z = THREE.MathUtils.lerp(g.position.z, agent.position[2], 0.05);
    g.position.y = THREE.MathUtils.lerp(g.position.y, agent.isSitting ? -0.18 : 0, 0.06);
    if (agent.status === "walking") {
      const dx = agent.targetPosition[0] - g.position.x;
      const dz = agent.targetPosition[2] - g.position.z;
      if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1)
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(dx, dz), 0.07);
    } else {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, seatRot, 0.06);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[agent.position[0], 0, agent.position[2]]}
      onClick={(e) => { e.stopPropagation(); selectAgent(isSelected ? null : agent.id); }}
    >
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={RING_GEO}>
          <meshBasicMaterial color={ROLE_COLOR[agent.role]} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Detroit chars are ~80–100 units tall in local space; scale to ~0.9 world units */}
      <primitive object={clone} scale={0.012} />
      <Html position={[0, 0.9, 0]} center distanceFactor={15} style={{ pointerEvents: "none" }}>
        <div style={{
          whiteSpace: "nowrap", fontSize: "10px", padding: "2px 8px", borderRadius: "4px",
          color: outfit.shirt, background: isSelected ? "#fff" : "#1a1a2e",
          border: `1.5px solid ${outfit.shirt}`, fontWeight: 700, fontFamily: "monospace",
          boxShadow: `0 0 10px ${outfit.shirt}50`,
        }}>
          ★ {agent.name}
        </div>
      </Html>
      {isSelected && (
        <Html position={[0, 1.5, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div style={{
            whiteSpace: "nowrap", padding: "8px 12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.95)", border: `2px solid ${outfit.shirt}`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.15)`, fontSize: "11px", color: "#3a3a4a", lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 800, fontSize: "13px", marginBottom: 4 }}>
              {agent.name} <span style={{ fontSize: 9, color: outfit.shirt, fontWeight: 700 }}>VIP</span>
            </div>
            <div>📍 {agent.currentRoom.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
            <div>⚡ {agent.task}</div>
          </div>
        </Html>
      )}
    </group>
  );
};

// ─── Standard RobotExpressive agent ──────────────────────────────────────────
const StandardAgent = ({ agent, isSelected }: { agent: OfficeAgent; isSelected: boolean }) => {
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const { scene, animations } = useGLTF("/models/agent-figure.glb");

  const clone = useMemo(() => {
    const g = SkeletonUtils.clone(scene) as THREE.Group;
    applyRoleTint(g, ROLE_COLOR[agent.role], 0.18);
    return g;
  }, [scene, agent.role]);

  const groupRef  = useRef<THREE.Group>(null);
  const prevAnim  = useRef("");
  const { actions } = useAnimations(animations, groupRef);
  const seatRot   = useSeatRot(agent);
  const outfit    = ROLE_OUTFIT[agent.role];

  useEffect(() => {
    const next = getAnim(agent.status, agent.isSitting);
    if (next === prevAnim.current) return;
    prevAnim.current = next;
    Object.values(actions).forEach((a) => a?.fadeOut(0.35));
    const target = actions[next] ?? actions["Idle"];
    target?.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.35).play();
  }, [agent.status, agent.isSitting, actions]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.x = THREE.MathUtils.lerp(g.position.x, agent.position[0], 0.05);
    g.position.z = THREE.MathUtils.lerp(g.position.z, agent.position[2], 0.05);
    if (agent.status === "sleeping") {
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -Math.PI / 2, 0.04);
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0.4, 0.04);
    } else {
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0, 0.07);
      g.position.y = THREE.MathUtils.lerp(g.position.y, agent.isSitting ? -0.18 : 0, 0.06);
    }
    if (agent.status === "walking") {
      const dx = agent.targetPosition[0] - g.position.x;
      const dz = agent.targetPosition[2] - g.position.z;
      if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1)
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(dx, dz), 0.07);
    } else {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, seatRot, 0.06);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[agent.position[0], 0, agent.position[2]]}
      onClick={(e) => { e.stopPropagation(); selectAgent(isSelected ? null : agent.id); }}
    >
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={RING_GEO}>
          <meshBasicMaterial color={ROLE_COLOR[agent.role]} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
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
          {STATUS_ICONS[agent.status] || "🧍"} {agent.name}
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
            <div style={{ fontWeight: 800, fontSize: "13px", color: "#2a2a3a", marginBottom: 4 }}>
              {agent.name}
            </div>
            <div>📍 {agent.currentRoom.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
            <div>⚡ {agent.task}</div>
            <div style={{
              marginTop: 4, padding: "1px 5px", borderRadius: 3,
              fontSize: "9px", fontWeight: 600, textTransform: "uppercase", display: "inline-block",
              background: agent.status === "working" ? "#dcfce7" : agent.status === "sleeping" ? "#ede9fe" : "#dbeafe",
              color:      agent.status === "working" ? "#166534" : agent.status === "sleeping" ? "#5b21b6" : "#1e40af",
            }}>
              {agent.status}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// ─── Router — picks VIP or Standard ──────────────────────────────────────────
const HumanAgent = ({ agent, isSelected = false }: { agent: OfficeAgent; isSelected?: boolean }) => {
  return <StandardAgent agent={agent} isSelected={isSelected} />;
};

export default HumanAgent;
