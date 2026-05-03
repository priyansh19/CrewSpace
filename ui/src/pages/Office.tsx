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

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <LiveDataBridge />

      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <OfficeScene />
      </div>

      {/* Agent count + live indicator */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-background/90 text-muted-foreground backdrop-blur border border-border/40">
          {liveMode
            ? <Wifi    className="h-3.5 w-3.5 text-green-500" />
            : <WifiOff className="h-3.5 w-3.5 text-yellow-500" />}
          <span>{liveMode ? "Live" : "Demo"}</span>
          <span className="opacity-50">·</span>
          <Users className="h-3.5 w-3.5" />
          <span>{agents.length > 0 ? agents.length : officeAgents.length} agents</span>
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
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-lg text-sm z-10 bg-card/95 text-muted-foreground backdrop-blur border border-border/35 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{agent.name}</span>
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
              className="ml-2 opacity-40 hover:opacity-100 transition-opacity text-xs text-muted-foreground"
            >
              ✕
            </button>
          </div>
        );
      })()}

      {/* Hint */}
      <div
        className="absolute bottom-4 right-4 text-[10px] opacity-35 z-10 pointer-events-none text-muted-foreground"
      >
        Click an agent · Drag to orbit · Scroll to zoom
      </div>
    </div>
  );
}
