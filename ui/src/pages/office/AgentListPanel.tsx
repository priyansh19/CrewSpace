import { useMemo } from "react";
import type { OfficeAgent } from "@/stores/officeStore";
import { Users } from "lucide-react";

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

const ROLE_ICONS: Record<string, string> = {
  ceo: "👔",
  cmo: "📣",
  cto: "💻",
  pm: "📊",
  engineer: "⚙️",
  researcher: "🔬",
  developer: "👨‍💻",
  designer: "🎨",
  security: "🔐",
  manager: "👥",
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
  const activeAgents = useMemo(() => {
    return agents.filter((a) => a.status !== "sleeping");
  }, [agents]);

  const getRoleIcon = (role: string) => {
    return ROLE_ICONS[role.toLowerCase()] || "🧍";
  };

  return (
    <div
      className="absolute top-4 right-4 z-10 rounded-xl overflow-hidden"
      style={{
        width: "280px",
        maxHeight: "70vh",
        background: "rgba(8,10,24,0.92)",
        color: "#c0d0f0",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(100,140,220,0.35)",
        boxShadow: "0 4px 28px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(100,140,220,0.2)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "rgba(192,208,240,0.7)",
        }}
      >
        <Users className="h-3.5 w-3.5" />
        <span>Agents</span>
        <span
          style={{
            marginLeft: "auto",
            background: "rgba(100,140,220,0.2)",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "10px",
            color: "rgba(192,208,240,0.9)",
          }}
        >
          {activeAgents.length}
        </span>
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
              padding: "20px 16px",
              textAlign: "center",
              fontSize: "12px",
              color: "rgba(192,208,240,0.4)",
            }}
          >
            No agents in office
          </div>
        ) : (
          activeAgents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;
            const roleColor = ROLE_COLORS[agent.role.toLowerCase()] || "#999999";
            const roleIcon = getRoleIcon(agent.role);

            return (
              <div
                key={agent.id}
                onClick={() => onSelectAgent(isSelected ? null : agent.id)}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid rgba(100,140,220,0.1)",
                  cursor: "pointer",
                  background: isSelected
                    ? "rgba(100,140,220,0.25)"
                    : "transparent",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderLeft: isSelected ? `3px solid ${roleColor}` : "3px solid transparent",
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
                {/* Icon */}
                <div
                  style={{
                    fontSize: "16px",
                    minWidth: "24px",
                    textAlign: "center",
                  }}
                >
                  {roleIcon}
                </div>

                {/* Name and Role */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
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
                      fontSize: "11px",
                      color: "rgba(192,208,240,0.6)",
                      textTransform: "capitalize",
                    }}
                  >
                    {agent.role}
                  </div>
                </div>

                {/* Role color indicator */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
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
  );
}
