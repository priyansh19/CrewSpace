import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useState } from "react";
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
  const [isLoading, setIsLoading] = useState(true);
  const agentIds    = useOfficeStore(useShallow((s) => s.officeAgents.map((a) => a.id)));
  const selectedId  = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const controlsRef = useRef<any>(null);

  const handleSceneReady = () => setTimeout(() => setIsLoading(false), 10_000);

  return (
    <>
      {isLoading && (
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(15, 23, 42, 0.95)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)"
        }}>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: "24px", fontWeight: 600, marginBottom: "20px" }}>
              Loading your interactive 3D office
            </div>
            <div style={{
              width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.2)",
              borderTop: "3px solid #fff", borderRadius: "50%",
              animation: "spin 1s linear infinite", margin: "0 auto"
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}

    <Canvas
      camera={{ position: DEFAULT_CAM, fov: 50, near: 0.5, far: 180 }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      performance={{ min: 0.5 }}
      style={{ background: "#f0e8e0", width: "100%", height: "100%" }}
      onPointerMissed={() => selectAgent(null)}
      frameloop="always"
      shadows="soft"
    >
      <ambientLight intensity={0.85} color="#ffd9a8" />
      <directionalLight
        position={[20, 30, 15]}
        intensity={1.2}
        color="#ffd4a8"
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
          "#ffe8cc",
          "#d8cfc0",
          0.5,
        ]}
      />

      <OfficeFloor />
      {agentIds.map((id) => (
        <HumanAgent key={id} agentId={id} isSelected={id === selectedId} />
      ))}
      <RenderComplete onReady={handleSceneReady} />
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
    </>
  );
};

const RenderComplete = ({ onReady }: { onReady: () => void }) => {
  const hasRun = useRef(false);
  useFrame(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      onReady();
    }
  });
  return null;
};

export default OfficeScene;
