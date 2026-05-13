import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { tryDicebearDataUri } from "./AgentAvatar";
import type { Agent } from "@crewspaceai/shared";

interface AgentOrbProps {
  agent: Agent;
  position: [number, number, number];
  isWorking: boolean;
  isBlocked: boolean;
  taskLabel?: string;
}

function AgentOrb({ agent, position, isWorking, isBlocked, taskLabel }: AgentOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const avatarUri = useMemo(() => tryDicebearDataUri(agent.icon || agent.id, 64), [agent]);

  const emissiveColor = isBlocked ? "#c64545" : isWorking ? "#cc785c" : "#000000";
  const emissiveIntensity = isBlocked ? 0.5 : isWorking ? 0.6 : 0;
  const sphereColor = isWorking ? "#2a1a10" : isBlocked ? "#1a0808" : "#252320";

  useFrame((_, delta) => {
    if (!isWorking) return;
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.4;
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * 0.8;
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 0.5;
  });

  const seed = agent.icon || agent.id;

  return (
    <group position={position}>
      {/* Glow point light for working agents */}
      {isWorking && <pointLight color="#cc785c" intensity={1.2} distance={3} />}
      {isBlocked && <pointLight color="#c64545" intensity={0.8} distance={2.5} />}

      {/* Main sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshStandardMaterial
          color={sphereColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {/* Avatar on sphere face */}
      <Html center position={[0, 0, 0.73]} distanceFactor={3.5} zIndexRange={[0, 10]}>
        <div style={{ pointerEvents: "none" }}>
          {avatarUri ? (
            <img
              src={avatarUri}
              alt={agent.name}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: isWorking
                  ? "2px solid rgba(204,120,92,0.8)"
                  : isBlocked
                    ? "2px solid rgba(198,69,69,0.8)"
                    : "2px solid rgba(255,255,255,0.12)",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: `hsl(${seed.charCodeAt(0) % 360}, 55%, 45%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                border: "2px solid rgba(255,255,255,0.12)",
              }}
            >
              {(agent.name || "?")[0].toUpperCase()}
            </div>
          )}
        </div>
      </Html>

      {/* Animated rings for working agents */}
      {isWorking && (
        <>
          <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.05, 0.025, 8, 48]} />
            <meshStandardMaterial color="#cc785c" emissive="#cc785c" emissiveIntensity={0.8} transparent opacity={0.7} />
          </mesh>
          <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
            <torusGeometry args={[1.25, 0.015, 8, 48]} />
            <meshStandardMaterial color="#e8a55a" emissive="#e8a55a" emissiveIntensity={0.6} transparent opacity={0.45} />
          </mesh>
        </>
      )}

      {/* Name label below orb */}
      <Html center position={[0, -1.15, 0]} distanceFactor={4} zIndexRange={[0, 5]}>
        <div
          style={{
            pointerEvents: "none",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isWorking ? "#cc785c" : "#a09d96",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.02em",
            }}
          >
            {agent.name}
          </div>
          {taskLabel && (
            <div
              style={{
                fontSize: 9,
                color: "#6c6a64",
                maxWidth: 90,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 1,
              }}
            >
              {taskLabel}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function agentPositions(count: number): [number, number, number][] {
  if (count === 0) return [];
  const positions: [number, number, number][] = [];
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const rows = Math.ceil(count / cols);
  const spacingX = 3.2;
  const spacingZ = 3.2;
  const offsetX = ((cols - 1) * spacingX) / 2;
  const offsetZ = ((rows - 1) * spacingZ) / 2;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push([col * spacingX - offsetX, 0, row * spacingZ - offsetZ]);
  }
  return positions;
}

interface CommandBridgeSceneProps {
  agents: Agent[];
  workingAgentIds: Set<string>;
  blockedAgentIds: Set<string>;
  agentTaskMap: Map<string, string>;
}

export function CommandBridgeScene({
  agents,
  workingAgentIds,
  blockedAgentIds,
  agentTaskMap,
}: CommandBridgeSceneProps) {
  const positions = useMemo(() => agentPositions(agents.length), [agents.length]);

  return (
    <Canvas
      camera={{ fov: 50, position: [0, 8, 14], near: 0.1, far: 200 }}
      style={{ background: "transparent" }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={0.4} color="#faf9f5" />

      <Grid
        position={[0, -1.4, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2826"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#3a3632"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
      />

      {agents.map((agent, i) => (
        <AgentOrb
          key={agent.id}
          agent={agent}
          position={positions[i] ?? [0, 0, 0]}
          isWorking={workingAgentIds.has(agent.id)}
          isBlocked={blockedAgentIds.has(agent.id)}
          taskLabel={agentTaskMap.get(agent.id)}
        />
      ))}

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.4}
        enableZoom={true}
        enablePan={false}
        minDistance={5}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
