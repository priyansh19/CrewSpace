import { useState, useMemo } from "react";
import type { OfficeAgent } from "@/stores/officeStore";
import { Users, X } from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";

const ROLE_COLORS: Record<string, string> = {
  ceo: "#d97706",
  pm: "#f97316",
  engineer: "#4a8ad4",
  researcher: "#8b5cf6",
  developer: "#4a8ad4",
  designer: "#9a5ec8",
  security: "#3aaa6a",
  manager: "#e87d3e",
};

interface AgentListPanelProps {
  agents: OfficeAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
}

export function AgentListPanel({
  agents,
  selectedAgentId,
  onSelectAgent,
}: AgentListPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeAgents = useMemo(() => {
    return agents.filter((a) => a.status !== "sleeping");
  }, [agents]);

  return (
    <>
      {/* Collapsed Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            zIndex: 10,
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(8,10,24,0.92)",
            color: "#c0d0f0",
            border: "1px solid rgba(100,140,220,0.35)",
            backdropFilter: "blur(14px)",
            boxShadow: "0 4px 28px rgba(0,0,0,0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 600,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(8,10,24,0.98)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(100,140,220,0.6)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(8,10,24,0.92)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(100,140,220,0.35)";
          }}
        >
          <Users className="h-4 w-4" />
          <span>{activeAgents.length}</span>
        </button>
      )}

      {/* Expanded Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            zIndex: 20,
            width: "240px",
            maxHeight: "47vh",
            background: "rgba(8,10,24,0.92)",
            color: "#c0d0f0",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(100,140,220,0.35)",
            boxShadow: "0 4px 28px rgba(0,0,0,0.4)",
            borderRadius: "12px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid rgba(100,140,220,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "rgba(192,208,240,0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Users className="h-3 w-3" />
              <span>Agents</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(192,208,240,0.6)",
                cursor: "pointer",
                padding: "0",
                display: "flex",
                alignItems: "center",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(192,208,240,1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(192,208,240,0.6)";
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* List */}
          <div
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              flex: 1,
              scrollBehavior: "smooth",
            }}
          >
            {activeAgents.length === 0 ? (
              <div
                style={{
                  padding: "16px 12px",
                  textAlign: "center",
                  fontSize: "11px",
                  color: "rgba(192,208,240,0.4)",
                }}
              >
                No agents
              </div>
            ) : (
              activeAgents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                const roleColor =
                  ROLE_COLORS[agent.role.toLowerCase()] || "#999999";
                return (
                  <div
                    key={agent.id}
                    onClick={() => {
                      onSelectAgent(isSelected ? null : agent.id);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid rgba(100,140,220,0.1)",
                      cursor: "pointer",
                      background: isSelected
                        ? "rgba(100,140,220,0.25)"
                        : "transparent",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      borderLeft: isSelected
                        ? `3px solid ${roleColor}`
                        : "3px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(100,140,220,0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                      }
                    }}
                  >
                    {/* Avatar */}
                    <div className="shrink-0">
                      <AgentAvatar
                        agent={agent as { id: string; name: string; icon?: string | null }}
                        size="xs"
                        variant="square"
                        animate={false}
                      />
                    </div>

                    {/* Name and Role */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "1px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: isSelected ? "#ffffff" : "#c0d0f0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agent.name}
                      </div>
                      <div
                        style={{
                          fontSize: "9px",
                          color: "rgba(192,208,240,0.5)",
                          textTransform: "capitalize",
                        }}
                      >
                        {agent.role}
                      </div>
                    </div>

                    {/* Role color indicator */}
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: roleColor,
                        opacity: isSelected ? 1 : 0.6,
                        boxShadow: isSelected
                          ? `0 0 8px ${roleColor}80`
                          : "none",
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Backdrop overlay when open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 15,
            cursor: "pointer",
          }}
        />
      )}
    </>
  );
}
