import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useOfficeStore } from "@/stores/officeStore";
import OfficeFloor from "./OfficeFloor";
import HumanAgent from "./HumanAgent";

const DEFAULT_CAM:    [number, number, number] = [25, 30, 35];
const DEFAULT_TARGET: [number, number, number] = [2, 0, 0];

// Pre-allocated vectors — never recreated per frame
const _defaultCamVec    = new THREE.Vector3(...DEFAULT_CAM);
const _defaultTargetVec = new THREE.Vector3(...DEFAULT_TARGET);
const _agentPos         = new THREE.Vector3();
const _camTarget        = new THREE.Vector3();

// ── CameraController: follows selected agent, returns to default when deselected ──
const CameraController = ({ controlsRef }: { controlsRef: React.RefObject<any> }) => {
  const { camera }  = useThree();
  const selectedId  = useOfficeStore((s) => s.selectedAgentId);
  const targetPos   = useRef(new THREE.Vector3(...DEFAULT_TARGET));
  const targetCam   = useRef(new THREE.Vector3(...DEFAULT_CAM));
  const isAnimating = useRef(false);

  useFrame(() => {
    if (!controlsRef.current) return;

    if (selectedId) {
      // Read directly from store — no React subscription, no re-render
      const agent = useOfficeStore.getState().officeAgents.find((a) => a.id === selectedId);
      if (agent) {
        // Follow targetPosition (where agent belongs) rather than the lerping visual position
        _agentPos.set(agent.targetPosition[0], 1, agent.targetPosition[2]);
        _camTarget.set(agent.targetPosition[0] + 5, 6, agent.targetPosition[2] + 5);
        targetPos.current.lerp(_agentPos, 0.05);
        targetCam.current.lerp(_camTarget, 0.04);
        isAnimating.current = true;
      }
    } else if (isAnimating.current) {
      targetPos.current.lerp(_defaultTargetVec, 0.03);
      targetCam.current.lerp(_defaultCamVec, 0.03);
      if (targetCam.current.distanceTo(_defaultCamVec) < 0.5)
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
  // Subscribe only to agent IDs — shallow comparison prevents re-render when agent moves
  const agentIds    = useOfficeStore(useShallow((s) => s.officeAgents.map((a) => a.id)));
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
      performance={{ min: 0.5 }}
      style={{ background: isNight ? "#1a1a2e" : "#f5efe6", width: "100%", height: "100%" }}
      onPointerMissed={() => selectAgent(null)}
      frameloop="always"
      shadows="soft"
    >
      <ambientLight intensity={isNight ? 0.35 : 1.2} color={isNight ? "#8090c0" : "#fff5e8"} />
      <directionalLight
        position={[20, 30, 15]}
        intensity={isNight ? 0.5 : 1.6}
        color={isNight ? "#6080c0" : "#fff0d8"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={120}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0005}
      />
      <hemisphereLight
        args={[
          isNight ? "#2a2a4e" : "#ffeedd",
          isNight ? "#1a1a2a" : "#e8ddd0",
          isNight ? 0.25 : 0.6,
        ]}
      />

      <OfficeFloor />
      {agentIds.map((id) => (
        <HumanAgent key={id} agentId={id} isSelected={id === selectedId} />
      ))}
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
    </Canvas>
  );
};

export default OfficeScene;
