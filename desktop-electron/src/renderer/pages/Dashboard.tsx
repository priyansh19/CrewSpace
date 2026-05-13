import { useCallback, useEffect, useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useChat } from "../context/ChatContext";
import { useTheme } from "../context/ThemeContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentGlobe } from "../components/AgentGlobe";
import { formatCents } from "../lib/utils";
import type { PendingApprovalEntry, RecentActivityEntry } from "@crewspaceai/shared";
import {
  LayoutDashboard,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Zap,
  AlertTriangle,
  CheckSquare,
  Clock,
  GitMerge,
  TrendingUp,
} from "lucide-react";

// ── Theme tokens ────────────────────────────────────────────────────────────

function tokens(isDark: boolean) {
  return {
    cardBg: isDark ? "rgba(24,23,21,0.88)" : "rgba(250,249,245,0.92)",
    cardBorder: isDark ? "rgba(255,255,255,0.07)" : "rgba(230,223,216,0.6)",
    cardBorderStrong: isDark ? "rgba(255,255,255,0.11)" : "rgba(204,120,92,0.25)",
    text: isDark ? "#faf9f5" : "#141413",
    textMuted: isDark ? "#a09d96" : "#6c6a64",
    textDim: isDark ? "#6c6a64" : "#8e8b82",
    barBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    bottomBg: isDark ? "rgba(15,13,11,0.92)" : "rgba(250,249,245,0.95)",
    bottomBorder: isDark ? "rgba(255,255,255,0.07)" : "rgba(230,223,216,0.8)",
    divider: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function approvalLabel(type: string): string {
  if (type === "hire_agent") return "Hire Agent";
  if (type === "approve_ceo_strategy") return "CEO Strategy";
  if (type === "budget_override_required") return "Budget Override";
  if (type === "pr_merge") return "Merge PR";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatBubble({
  value,
  label,
  color,
  isDark,
  to,
}: {
  value: string;
  label: string;
  color: string;
  isDark: boolean;
  to: string;
}) {
  const tk = tokens(isDark);
  return (
    <Link
      to={to}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 100,
        height: 100,
        borderRadius: "50%",
        background: tk.cardBg,
        border: `1px solid ${tk.cardBorderStrong}`,
        backdropFilter: "blur(16px)",
        textDecoration: "none",
        gap: 2,
        boxShadow: isDark
          ? `0 0 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`
          : `0 2px 16px rgba(0,0,0,0.06)`,
      }}
      className="hover:scale-105 transition-transform"
    >
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          color,
          fontFamily: "StyreneB, Inter, sans-serif",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 10,
          color: isDark ? "#6c6a64" : "#8e8b82",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 500,
          textAlign: "center",
          maxWidth: 72,
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

function ApprovalsPanel({
  approvals,
  agents,
  isDark,
  onApprove,
  onReject,
  approvePending,
  rejectPending,
  approveVar,
  rejectVar,
}: {
  approvals: PendingApprovalEntry[];
  agents: { id: string; name: string }[];
  isDark: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
  approveVar: string | undefined;
  rejectVar: string | undefined;
}) {
  const tk = tokens(isDark);
  if (approvals.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 20,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 20,
        width: 260,
        background: tk.cardBg,
        border: `1px solid ${tk.cardBorder}`,
        borderRadius: 14,
        backdropFilter: "blur(18px)",
        padding: "14px 0 8px",
        maxHeight: "calc(100vh - 160px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "0 14px 10px",
          borderBottom: `1px solid ${tk.divider}`,
        }}
      >
        <AlertTriangle style={{ width: 12, height: 12, color: "#e8a55a", flexShrink: 0 }} />
        <span
          style={{
            color: "#e8a55a",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Approvals needed
        </span>
        <span
          style={{
            marginLeft: "auto",
            background: "#e8a55a",
            color: "#141413",
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 9999,
            padding: "1px 7px",
          }}
        >
          {approvals.length}
        </span>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
        {approvals.slice(0, 5).map((ap) => {
          const agentName =
            ap.requestedByAgentName ??
            agents.find((a) => a.id === ap.requestedByAgentId)?.name;
          const isActing =
            (approvePending && approveVar === ap.id) ||
            (rejectPending && rejectVar === ap.id);
          const isPR = ap.type === "pr_merge";

          return (
            <div
              key={ap.id}
              style={{
                padding: "8px 14px",
                borderBottom: `1px solid ${tk.divider}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 5,
                }}
              >
                {isPR ? (
                  <GitMerge
                    style={{ width: 11, height: 11, color: "#8b5cf6", flexShrink: 0 }}
                  />
                ) : (
                  <AlertTriangle
                    style={{ width: 11, height: 11, color: "#e8a55a", flexShrink: 0 }}
                  />
                )}
                <span
                  style={{
                    color: isPR ? "#8b5cf6" : "#e8a55a",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {approvalLabel(ap.type)}
                </span>
                {agentName && (
                  <span style={{ color: tk.textDim, fontSize: 10, marginLeft: "auto" }}>
                    {agentName}
                  </span>
                )}
              </div>
              <div
                style={{ display: "flex", gap: 5, opacity: isActing ? 0.5 : 1 }}
              >
                <button
                  onClick={() => onApprove(ap.id)}
                  disabled={isActing}
                  style={{
                    flex: 1,
                    padding: "3px 0",
                    borderRadius: 6,
                    background: "rgba(93,184,114,0.15)",
                    border: "1px solid rgba(93,184,114,0.3)",
                    color: "#5db872",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                  }}
                >
                  <CheckCircle2 style={{ width: 9, height: 9 }} />
                  Approve
                </button>
                <button
                  onClick={() => onReject(ap.id)}
                  disabled={isActing}
                  style={{
                    flex: 1,
                    padding: "3px 0",
                    borderRadius: 6,
                    background: "rgba(198,69,69,0.12)",
                    border: "1px solid rgba(198,69,69,0.25)",
                    color: "#c64545",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                  }}
                >
                  <XCircle style={{ width: 9, height: 9 }} />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {approvals.length > 5 && (
        <Link
          to="/approvals"
          style={{
            display: "block",
            textAlign: "center",
            color: tk.textDim,
            fontSize: 11,
            textDecoration: "underline",
            padding: "8px 14px 4px",
          }}
        >
          +{approvals.length - 5} more approvals
        </Link>
      )}
    </div>
  );
}

function ActivityPanel({
  items,
  isDark,
}: {
  items: RecentActivityEntry[];
  isDark: boolean;
}) {
  const tk = tokens(isDark);
  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 20,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 20,
        width: 240,
        background: tk.cardBg,
        border: `1px solid ${tk.cardBorder}`,
        borderRadius: 14,
        backdropFilter: "blur(18px)",
        padding: "14px 0 8px",
        maxHeight: "calc(100vh - 160px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "0 14px 10px",
          borderBottom: `1px solid ${tk.divider}`,
        }}
      >
        <TrendingUp style={{ width: 12, height: 12, color: "#5db8a6", flexShrink: 0 }} />
        <span
          style={{
            color: "#5db8a6",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Recent activity
        </span>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: "7px 14px",
              borderBottom: `1px solid ${tk.divider}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <CheckSquare
                style={{
                  width: 11,
                  height: 11,
                  color: "#5db872",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    color: tk.text,
                    fontSize: 11,
                    margin: 0,
                    lineHeight: 1.4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  <Clock style={{ width: 9, height: 9, color: tk.textDim }} />
                  <span style={{ color: tk.textDim, fontSize: 10 }}>
                    {formatTimeAgo(item.completedAt)}
                  </span>
                  {item.assigneeAgentName && (
                    <>
                      <span style={{ color: tk.textDim, fontSize: 10 }}>·</span>
                      <span style={{ color: tk.textMuted, fontSize: 10 }}>
                        {item.assigneeAgentName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { theme } = useTheme();
  const { openChatWithAgent, setIsChatOpen } = useChat();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending"),
    queryFn: () => approvalsApi.list(selectedCompanyId!, "pending"),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending") });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId!) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending") });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId!) });
    },
  });

  const workingAgentIds = useMemo(() => {
    if (!liveRuns) return new Set<string>();
    return new Set(
      liveRuns
        .filter((r) => r.status === "running" || r.status === "in_progress")
        .map((r) => r.agentId),
    );
  }, [liveRuns]);

  const blockedAgentIds = useMemo(() => {
    if (!agents) return new Set<string>();
    return new Set(
      agents.filter((a) => a.status === "error" || a.status === "paused").map((a) => a.id),
    );
  }, [agents]);

  const agentTaskMap = useMemo(() => {
    if (!liveRuns) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const run of liveRuns) {
      if (!map.has(run.agentId) && run.triggerDetail) {
        map.set(run.agentId, run.triggerDetail);
      }
    }
    return map;
  }, [liveRuns]);

  const handleSelectAgent = useCallback(
    (agentId: string) => {
      const agent = agents?.find((a) => a.id === agentId);
      if (!agent) return;
      openChatWithAgent({
        id: agent.id,
        name: agent.name,
        icon: agent.icon ?? null,
        status: agent.status,
      });
      setIsChatOpen(true);
    },
    [agents, openChatWithAgent, setIsChatOpen],
  );

  const activeCount = workingAgentIds.size;
  const totalAgents = agents?.length ?? 0;
  const approvalsList = data?.pendingApprovalsList ?? [];
  const recentActivity = data?.recentCompleted ?? [];
  const blockedCount = data?.tasks?.blocked ?? 0;

  const tk = tokens(isDark);
  const hasBudgetIncident = (data?.budgets?.activeIncidents ?? 0) > 0;
  const topOffset = hasBudgetIncident ? 46 : 20;

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to CrewSpace. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState
        icon={LayoutDashboard}
        message="Create or select a company to view the dashboard."
      />
    );
  }

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        background: isDark ? "#0a0908" : "#faf9f5",
        overflow: "hidden",
      }}
    >
      {/* ── Agent Globe fills entire viewport ─────────────────────── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <AgentGlobe
          agents={agents ?? []}
          workingAgentIds={workingAgentIds}
          blockedAgentIds={blockedAgentIds}
          agentTaskMap={agentTaskMap}
          onSelectAgent={handleSelectAgent}
          isDark={isDark}
        />
      </div>

      {/* ── Budget incident banner ──────────────────────────────────── */}
      {hasBudgetIncident ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "rgba(198,69,69,0.15)",
            borderBottom: "1px solid rgba(198,69,69,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 20px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PauseCircle style={{ color: "#c64545", width: 14, height: 14, flexShrink: 0 }} />
            <span style={{ color: "#c64545", fontSize: 12 }}>
              {data!.budgets.activeIncidents} budget incident
              {data!.budgets.activeIncidents === 1 ? "" : "s"} —{" "}
              {data!.budgets.pausedAgents} agents paused
            </span>
          </div>
          <Link to="/costs" style={{ color: "#c64545", fontSize: 12, textDecoration: "underline" }}>
            Open budgets
          </Link>
        </div>
      ) : null}

      {/* ── Top-left: LIVE badge ────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: topOffset,
          left: 20,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 20,
            background:
              activeCount > 0
                ? "rgba(93,184,114,0.15)"
                : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            border: `1px solid ${
              activeCount > 0 ? "rgba(93,184,114,0.3)" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"
            }`,
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: activeCount > 0 ? "#5db872" : "#4a4a48",
              boxShadow: activeCount > 0 ? "0 0 6px rgba(93,184,114,0.7)" : "none",
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: activeCount > 0 ? "#5db872" : "#6c6a64",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {activeCount > 0 ? "LIVE" : "IDLE"}
          </span>
          <span style={{ color: "#6c6a64", fontSize: 11 }}>
            {activeCount}/{totalAgents} active
          </span>
        </div>
      </div>

      {/* ── Top-right: click hint ───────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: topOffset,
          right: 20,
          zIndex: 20,
        }}
      >
        <div
          style={{
            padding: "4px 10px",
            borderRadius: 20,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ color: tk.textDim, fontSize: 10 }}>
            Click an agent to chat
          </span>
        </div>
      </div>

      {/* ── Corner stat bubbles ─────────────────────────────────────── */}
      {/* Top-left bubble (below LIVE badge) */}
      <div
        style={{
          position: "absolute",
          top: topOffset + 50,
          left: 20,
          zIndex: 20,
        }}
      >
        <StatBubble
          value={String(data?.tasks?.todayCompleted ?? "—")}
          label="Done Today"
          color="#5db872"
          isDark={isDark}
          to="/issues"
        />
      </div>

      {/* Top-right bubble */}
      <div
        style={{
          position: "absolute",
          top: topOffset + 50,
          right: 20,
          zIndex: 20,
        }}
      >
        <StatBubble
          value={data ? formatCents(data.costs.todaySpendCents) : "—"}
          label="Today Burn"
          color="#e8a55a"
          isDark={isDark}
          to="/costs"
        />
      </div>

      {/* Bottom-left bubble */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 20,
          zIndex: 20,
        }}
      >
        <StatBubble
          value={String(activeCount)}
          label="Active Agents"
          color="#5db8a6"
          isDark={isDark}
          to="/agents"
        />
      </div>

      {/* Bottom-right bubble */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          right: 20,
          zIndex: 20,
        }}
      >
        <StatBubble
          value={String(blockedCount)}
          label="Blocked"
          color={blockedCount > 0 ? "#c64545" : tk.textMuted}
          isDark={isDark}
          to="/issues"
        />
      </div>

      {/* ── Left panel: Approvals ───────────────────────────────────── */}
      <ApprovalsPanel
        approvals={approvalsList}
        agents={(agents ?? []).map((a) => ({ id: a.id, name: a.name }))}
        isDark={isDark}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id) => rejectMutation.mutate(id)}
        approvePending={approveMutation.isPending}
        rejectPending={rejectMutation.isPending}
        approveVar={approveMutation.variables}
        rejectVar={rejectMutation.variables}
      />

      {/* ── Right panel: Recent Activity ────────────────────────────── */}
      <ActivityPanel items={recentActivity} isDark={isDark} />

      {/* ── Bottom metric bar ───────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: tk.bottomBg,
          borderTop: `1px solid ${tk.bottomBorder}`,
          backdropFilter: "blur(16px)",
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <MetricTile
          value={String(activeCount)}
          label="Active Agents"
          valueColor="#5db872"
          to="/agents"
          icon={<Zap style={{ width: 12, height: 12 }} />}
          isDark={isDark}
        />
        <MetricTile
          value={data ? String(data.tasks.inProgress) : "—"}
          label="In Progress"
          valueColor={tk.text}
          to="/issues"
          isDark={isDark}
        />
        <MetricTile
          value={data ? String(data.tasks.todayCompleted) : "—"}
          label="Done Today"
          valueColor="#5db872"
          to="/issues"
          isDark={isDark}
        />
        <MetricTile
          value={data ? formatCents(data.costs.todaySpendCents) : "—"}
          label="Today Spend"
          valueColor="#e8a55a"
          to="/costs"
          isDark={isDark}
        />
        <MetricTile
          value={data ? formatCents(data.costs.monthSpendCents) : "—"}
          label="Month Spend"
          valueColor="#e8a55a"
          to="/costs"
          isDark={isDark}
        />
        <MetricTile
          value={String(blockedCount)}
          label="Blocked"
          valueColor={blockedCount > 0 ? "#c64545" : tk.textMuted}
          to="/issues"
          isDark={isDark}
          last
        />
      </div>
    </div>
  );
}

// ── MetricTile ─────────────────────────────────────────────────────────────

interface MetricTileProps {
  value: string;
  label: string;
  valueColor?: string;
  to: string;
  icon?: React.ReactNode;
  last?: boolean;
  isDark: boolean;
}

function MetricTile({ value, label, valueColor = "#faf9f5", to, icon, last, isDark }: MetricTileProps) {
  const tk = tokens(isDark);
  return (
    <Link
      to={to}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 10px",
        borderRight: last ? "none" : `1px solid ${tk.divider}`,
        textDecoration: "none",
        gap: 2,
      }}
      className="hover:bg-white/[0.03] transition-colors"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {icon && <span style={{ color: valueColor, opacity: 0.7 }}>{icon}</span>}
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: valueColor,
            fontFamily: "StyreneB, Inter, sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontSize: 10,
          color: tk.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
