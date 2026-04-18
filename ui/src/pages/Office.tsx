import { useMemo } from "react";
import { useOfficeStore } from "@/stores/officeStore";
import OfficeScene from "./office/OfficeScene";
import LiveDataBridge from "./office/LiveDataBridge";
import { AgentListPanel } from "./office/AgentListPanel";
import { Users, Wifi, WifiOff } from "lucide-react";

export function Office() {
  const liveMode        = useOfficeStore((s) => s.liveMode);
  const agents          = useOfficeStore((s) => s.agents);
  const officeAgents    = useOfficeStore((s) => s.officeAgents);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent     = useOfficeStore((s) => s.selectAgent);

  const workingCount = useMemo(
    () => officeAgents.filter((a) => a.status === "working" || a.status === "collaborating" || a.status === "meeting").length,
    [officeAgents],
  );

  const hud = {
    background:    "rgba(255,250,240,0.88)",
    color:         "#5a4a3a",
    backdropFilter: "blur(10px)",
    border:        "1px solid rgba(180,160,120,0.4)",
  } as const;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: "#f5efe6" }}
    >
      <LiveDataBridge />

      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <OfficeScene />
      </div>

      {/* Agent count + live indicator */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={hud}>
          {liveMode
            ? <Wifi    className="h-3.5 w-3.5 text-green-500" />
            : <WifiOff className="h-3.5 w-3.5 text-yellow-500" />}
          <span>{liveMode ? "Live" : "Demo"}</span>
          <span className="opacity-50">·</span>
          <Users className="h-3.5 w-3.5" />
          <span>{agents.length > 0 ? agents.length : officeAgents.length} agents</span>
          <span className="opacity-50">·</span>
          <span style={{ color: "#4ade80" }}>{workingCount} active</span>
        </div>
      </div>

      {/* Floating agent list panel */}
      <AgentListPanel
        agents={officeAgents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={selectAgent}
      />

      {/* Selected agent detail card */}
      {selectedAgentId && (() => {
        const agent = officeAgents.find((a) => a.id === selectedAgentId);
        if (!agent) return null;
        return (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-xl text-sm z-10"
            style={{
              background:    "rgba(8,10,24,0.92)",
              color:         "#c0d0f0",
              backdropFilter: "blur(14px)",
              border:        "1px solid rgba(100,140,220,0.35)",
              boxShadow:     "0 4px 28px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ color: "#ffffff" }}>{agent.name}</span>
              <span className="opacity-40">·</span>
              <span className="opacity-80 capitalize">{agent.role}</span>
              <span className="opacity-40">·</span>
              <span className="opacity-75">
                {agent.currentRoom.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            <div className="opacity-65 max-w-[240px] truncate">⚡ {agent.task}</div>
            <button
              onClick={() => selectAgent(null)}
              className="ml-2 opacity-40 hover:opacity-100 transition-opacity text-xs"
            >
              ✕
            </button>
          </div>
        );
      })()}

      {/* Hint */}
      <div
        className="absolute bottom-4 right-4 text-[10px] opacity-35 z-10 pointer-events-none"
        style={{ color: "#888" }}
      >
        Click an agent · Drag to orbit · Scroll to zoom
      </div>
    </div>
  );
}
