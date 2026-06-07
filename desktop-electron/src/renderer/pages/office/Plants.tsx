import { memo } from "react";
import { useGLTF, Clone } from "@react-three/drei";
import { ROOM_POSITIONS } from "@/stores/officeStore";

// Preload all plant models immediately at module load
useGLTF.preload("/models/plant-small.glb");
useGLTF.preload("/models/plant-tall.glb");
useGLTF.preload("/models/plant-hanging.glb");

const SmallPlant = ({ pos, scale = 1 }: { pos: [number,number,number]; scale?: number }) => {
  const { scene } = useGLTF("/models/plant-small.glb");
  return <Clone object={scene} position={pos} scale={scale} />;
};

const TallPlant = ({ pos }: { pos: [number,number,number] }) => {
  const { scene } = useGLTF("/models/plant-tall.glb");
  return <Clone object={scene} position={pos} />;
};

const HangingPlant = ({ pos }: { pos: [number,number,number] }) => {
  const { scene } = useGLTF("/models/plant-hanging.glb");
  return <Clone object={scene} position={pos} />;
};

const Plants = () => {
  const ceo        = ROOM_POSITIONS["ceo-cabin"];
  const scrum      = ROOM_POSITIONS["scrum-room"];
  const confDev    = ROOM_POSITIONS["conf-dev"];
  const confDesign = ROOM_POSITIONS["conf-design"];
  const confSec    = ROOM_POSITIONS["conf-security"];
  const ws         = ROOM_POSITIONS["workstations"];
  const sleep      = ROOM_POSITIONS["sleeping-room"];
  const kitchen    = ROOM_POSITIONS["kitchen"];
  const play       = ROOM_POSITIONS["play-area"];

  return (
    <group>
      <TallPlant   pos={[ceo.x+3.5,        0, ceo.z-3]}         />
      <SmallPlant  pos={[ceo.x-3.5,        0, ceo.z-3]}         />
      <SmallPlant  pos={[scrum.x+3,        0, scrum.z-3]}       scale={0.8} />
      <SmallPlant  pos={[scrum.x-3,        0, scrum.z-3]}       scale={0.8} />
      <SmallPlant  pos={[confDev.x+2.5,    0, confDev.z-3]}     scale={0.8} />
      <SmallPlant  pos={[confDesign.x-2.5, 0, confDesign.z-3]}  scale={0.8} />
      <SmallPlant  pos={[confSec.x+2.5,    0, confSec.z-3]}     scale={0.8} />
      <TallPlant   pos={[ws.x-10.5,        0, ws.z-3.5]}         />
      <TallPlant   pos={[ws.x+10.5,        0, ws.z-3.5]}         />
      <TallPlant   pos={[ws.x-10.5,        0, ws.z+3.5]}         />
      <TallPlant   pos={[ws.x+10.5,        0, ws.z+3.5]}         />
      <SmallPlant  pos={[sleep.x+3.5,      0, sleep.z-3.5]}      />
      <SmallPlant  pos={[sleep.x-3.5,      0, sleep.z-3.5]}      />
      <TallPlant   pos={[kitchen.x+3.5,    0, kitchen.z-3.5]}    />
      <SmallPlant  pos={[kitchen.x+3.5,    0, kitchen.z+3.5]}    />
      <TallPlant   pos={[play.x+4.5,       0, play.z-3.5]}       />
      <SmallPlant  pos={[play.x-4.5,       0, play.z+3.5]}       />
      <TallPlant   pos={[-12, 0, -16]} />
      <TallPlant   pos={[10,  0, -16]} />
      <TallPlant   pos={[26,  0, -16]} />
      <SmallPlant  pos={[-22, 0, -8]}  />
      <SmallPlant  pos={[26,  0, -8]}  />
      <SmallPlant  pos={[-22, 0,  2]}  />
      <SmallPlant  pos={[26,  0,  2]}  />
      <TallPlant   pos={[-22, 0, 10]}  />
      <TallPlant   pos={[26,  0, 10]}  />
      <HangingPlant pos={[ceo.x,       2.3, ceo.z-3.5]}       />
      <HangingPlant pos={[kitchen.x,   2.3, kitchen.z-4]}     />
      <HangingPlant pos={[confDesign.x,2.3, confDesign.z-3.5]} />
    </group>
  );
};

export default memo(Plants);
