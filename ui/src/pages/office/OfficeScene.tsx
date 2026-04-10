import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useOfficeStore } from "@/stores/officeStore";
import OfficeFloor from "./OfficeFloor";
import HumanAgent from "./HumanAgent";
import Particles from "./Particles";

const DEFAULT_CAM:    [number, number, number] = [25, 30, 35];
const DEFAULT_TARGET: [number, number, number] = [2, 0, 0];

const SimLoop = () => {
  const tick = useOfficeStore((s) => s.tick);
  useEffect(() => {
    const id = setInterval(() => tick(), 50);
    return () => clearInterval(id);
  }, [tick]);
  return null;
};

const CameraController = ({ controlsRef }: { controlsRef: React.RefObject<any> }) => {
  const { camera }   = useThree();
  const selectedId   = useOfficeStore((s) => s.selectedAgentId);
  const agents       = useOfficeStore((s) => s.officeAgents);
  const targetPos    = useRef(new THREE.Vector3(...DEFAULT_TARGET));
  const targetCam    = useRef(new THREE.Vector3(...DEFAULT_CAM));
  const isAnimating  = useRef(false);

  useFrame(() => {
    if (!controlsRef.current) return;
    const selected = selectedId ? agents.find((a) => a.id === selectedId) : null;
    if (selected) {
      const agentPos = new THREE.Vector3(selected.position[0], 1, selected.position[2]);
      targetPos.current.lerp(agentPos, 0.05);
      const camTarget = new THREE.Vector3(selected.position[0] + 5, 6, selected.position[2] + 5);
      targetCam.current.lerp(camTarget, 0.04);
      isAnimating.current = true;
    } else if (isAnimating.current) {
      targetPos.current.lerp(new THREE.Vector3(...DEFAULT_TARGET), 0.03);
      targetCam.current.lerp(new THREE.Vector3(...DEFAULT_CAM), 0.03);
      if (targetCam.current.distanceTo(new THREE.Vector3(...DEFAULT_CAM)) < 0.5)
        isAnimating.current = false;
    }
    if (isAnimating.current) {
      camera.position.lerp(targetCam.current, 0.06);
      controlsRef.current.target.lerp(targetPos.current, 0.06);
      controlsRef.current.update();
    }
  });
  return null;
};

const OfficeScene = () => {
  const agents      = useOfficeStore((s) => s.officeAgents);
  const selectedId  = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const isNight     = useOfficeStore((s) => s.isNightMode);
  const controlsRef = useRef<any>(null);

  return (
    <Canvas
      camera={{ position: DEFAULT_CAM, fov: 50, near: 0.5, far: 180 }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      style={{ background: isNight ? "#1a1a2e" : "#f5efe6", width: "100%", height: "100%" }}
      onPointerMissed={() => selectAgent(null)}
      frameloop="always"
      shadows
    >
      <ambientLight intensity={isNight ? 0.35 : 1.2} color={isNight ? "#8090c0" : "#fff5e8"} />
      <directionalLight
        position={[20, 30, 15]}
        intensity={isNight ? 0.5 : 1.6}
        color={isNight ? "#6080c0" : "#fff0d8"}
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-camera-far={80}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <hemisphereLight
        args={[
          isNight ? "#2a2a4e" : "#ffeedd",
          isNight ? "#1a1a2a" : "#e8ddd0",
          isNight ? 0.25 : 0.6,
        ]}
      />

      <OfficeFloor />
      {agents.map((agent) => (
        <HumanAgent key={agent.id} agent={agent} isSelected={agent.id === selectedId} />
      ))}
      <Particles />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={70}
        maxPolarAngle={Math.PI / 2.2}
        target={DEFAULT_TARGET}
      />
      <CameraController controlsRef={controlsRef} />
      <SimLoop />
    </Canvas>
  );
};

export default OfficeScene;
