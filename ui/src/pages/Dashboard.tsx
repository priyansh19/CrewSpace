import { useEffect, useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { CommandBridgeScene } from "../components/CommandBridgeScene";
import type { ReactNode } from "react";
import { formatCents } from "../lib/utils";
import {
  LayoutDashboard,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Zap,
  AlertTriangle,
} from "lucide-react";

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
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
    return new Set(agents.filter((a) => a.status === "error" || a.status === "pending_approval").map((a) => a.id));
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

  const activeCount = workingAgentIds.size;
  const totalAgents = agents?.length ?? 0;

  const inProgressCount = data?.tasks?.inProgress ?? null;

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
    return <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />;
  }

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        background: "#0a0908",
        overflow: "hidden",
      }}
    >
      {/* ── 3D Scene fills entire viewport ─────────────────────── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <CommandBridgeScene
          agents={agents ?? []}
          workingAgentIds={workingAgentIds}
          blockedAgentIds={blockedAgentIds}
          agentTaskMap={agentTaskMap}
        />
      </div>

      {/* ── Budget incident banner ──────────────────────────────── */}
      {data?.budgets?.activeIncidents ? (
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
              {data.budgets.activeIncidents} budget incident{data.budgets.activeIncidents === 1 ? "" : "s"} —{" "}
              {data.budgets.pausedAgents} agents paused
            </span>
          </div>
          <Link to="/costs" style={{ color: "#c64545", fontSize: 12, textDecoration: "underline" }}>
            Open budgets
          </Link>
        </div>
      ) : null}

      {/* ── Top-left: LIVE badge ────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: data?.budgets?.activeIncidents ? 46 : 20,
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
            background: activeCount > 0 ? "rgba(93,184,114,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${activeCount > 0 ? "rgba(93,184,114,0.3)" : "rgba(255,255,255,0.1)"}`,
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
          <span style={{ color: activeCount > 0 ? "#5db872" : "#6c6a64", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>
            {activeCount > 0 ? "LIVE" : "IDLE"}
          </span>
          <span style={{ color: "#6c6a64", fontSize: 11 }}>
            {activeCount}/{totalAgents} active
          </span>
        </div>
      </div>

      {/* ── Top-right: pending approvals ───────────────────────── */}
      {(pendingApprovals?.length ?? 0) > 0 && (
        <div
          style={{
            position: "absolute",
            top: data?.budgets?.activeIncidents ? 46 : 20,
            right: 20,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxWidth: 280,
          }}
        >
          {pendingApprovals!.slice(0, 2).map((approval) => {
            const agentName = agents?.find((a) => a.id === approval.requestedByAgentId)?.name;
            const isActing =
              (approveMutation.isPending && approveMutation.variables === approval.id) ||
              (rejectMutation.isPending && rejectMutation.variables === approval.id);
            return (
              <div
                key={approval.id}
                style={{
                  background: "rgba(25,22,20,0.85)",
                  border: "1px solid rgba(204,120,92,0.25)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <AlertTriangle style={{ width: 12, height: 12, color: "#e8a55a", flexShrink: 0 }} />
                  <span style={{ color: "#e8a55a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Needs approval
                  </span>
                  {agentName && (
                    <span style={{ color: "#6c6a64", fontSize: 10 }}>· {agentName}</span>
                  )}
                </div>
                <p style={{ color: "#faf9f5", fontSize: 11, margin: "0 0 8px", lineHeight: 1.4 }}>
                  {approval.type === "hire_agent" ? "Hire Agent" :
                    approval.type === "approve_ceo_strategy" ? "CEO Strategy" :
                      approval.type === "budget_override_required" ? "Budget Override" :
                        approval.type}
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => approveMutation.mutate(approval.id)}
                    disabled={isActing}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      borderRadius: 6,
                      background: "rgba(93,184,114,0.15)",
                      border: "1px solid rgba(93,184,114,0.3)",
                      color: "#5db872",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      opacity: isActing ? 0.5 : 1,
                    }}
                  >
                    <CheckCircle2 style={{ width: 11, height: 11 }} />
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(approval.id)}
                    disabled={isActing}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      borderRadius: 6,
                      background: "rgba(198,69,69,0.12)",
                      border: "1px solid rgba(198,69,69,0.25)",
                      color: "#c64545",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      opacity: isActing ? 0.5 : 1,
                    }}
                  >
                    <XCircle style={{ width: 11, height: 11 }} />
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
          {(pendingApprovals?.length ?? 0) > 2 && (
            <Link
              to="/approvals"
              style={{
                display: "block",
                textAlign: "center",
                color: "#a09d96",
                fontSize: 11,
                textDecoration: "underline",
                padding: "4px 0",
              }}
            >
              +{pendingApprovals!.length - 2} more
            </Link>
          )}
        </div>
      )}

      {/* ── Bottom metric bar ───────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: "rgba(15,13,11,0.88)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
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
          icon={<Zap style={{ width: 13, height: 13 }} />}
        />
        <MetricTile
          value={inProgressCount !== null ? String(inProgressCount) : "—"}
          label="In Progress"
          valueColor="#faf9f5"
          to="/issues"
        />
        <MetricTile
          value={data ? formatCents(data.costs.monthSpendCents) : "—"}
          label="Month Spend"
          valueColor="#e8a55a"
          to="/costs"
        />
        <MetricTile
          value={String(data?.tasks?.open ?? "—")}
          label="Open Tasks"
          valueColor="#faf9f5"
          to="/issues"
          last
        />
      </div>
    </div>
  );
}

interface MetricTileProps {
  value: string;
  label: string;
  valueColor?: string;
  to: string;
  icon?: ReactNode;
  last?: boolean;
}

function MetricTile({ value, label, valueColor = "#faf9f5", to, icon, last }: MetricTileProps) {
  return (
    <Link
      to={to}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px 12px",
        borderRight: last ? "none" : "1px solid rgba(255,255,255,0.06)",
        textDecoration: "none",
        gap: 2,
      }}
      className="hover:bg-white/[0.03] transition-colors"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {icon && <span style={{ color: valueColor, opacity: 0.7 }}>{icon}</span>}
        <span
          style={{
            fontSize: 22,
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
          color: "#6c6a64",
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
