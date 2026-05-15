import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { dashboardApi } from "../api/dashboard";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { projectsApi } from "../api/projects";
import { githubIntegrationApi } from "../api/githubIntegration";
import type { LiveRunForIssue } from "../api/heartbeats";
import type { PullRequestEntry } from "../api/githubIntegration";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useChat } from "../context/ChatContext";
import { useTheme } from "../context/ThemeContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentGlobe } from "../components/AgentGlobe";
import { AgentAvatar } from "../components/AgentAvatar";
import { formatCents } from "../lib/utils";
import type { Agent, PendingApprovalEntry, RecentActivityEntry, AgentBurnEntry } from "@crewspaceai/shared";
import {
  LayoutDashboard,
  PauseCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CheckSquare,
  Clock,
  GitMerge,
  GitPullRequest,
  ExternalLink,
  ChevronDown,
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

// ── Panel anatomy helpers ───────────────────────────────────────────────────

function PanelHeader({
  title,
  badge,
  badgeColor,
  dot,
  tk,
}: {
  title: string;
  badge?: number | string;
  badgeColor?: string;
  dot?: boolean;
  tk: ReturnType<typeof tokens>;
}) {
  return (
    <div style={{
      padding: "10px 12px 8px",
      borderBottom: `1px solid ${tk.divider}`,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#5db872",
          boxShadow: "0 0 6px rgba(93,184,114,0.7)",
          display: "inline-block", flexShrink: 0,
        }} />
      )}
      <span style={{
        fontSize: 10, fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: tk.textMuted,
        flex: 1,
      }}>{title}</span>
      {badge !== undefined && (badge as number) > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: "1px 6px", borderRadius: 8,
          background: `${badgeColor ?? "#e8a55a"}22`,
          color: badgeColor ?? "#e8a55a",
        }}>{badge}</span>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface KpiStripProps {
  activeRuns: number;
  activeAgents: number;
  doneToday: number;
  pendingApprovals: number;
  todaySpendCents: number;
  blocked: number;
  isDark: boolean;
}

function KpiStrip({ activeRuns, activeAgents, doneToday, pendingApprovals, todaySpendCents, blocked, isDark }: KpiStripProps) {
  const tk = tokens(isDark);

  const tiles: {
    value: string | number;
    label: string;
    color: string;
    to: string;
    tint?: string;
    pulse?: boolean;
  }[] = [
    {
      value: activeRuns,
      label: "Running Now",
      color: activeRuns > 0 ? "#5db872" : tk.textMuted,
      to: "/agents",
      tint: activeRuns > 0 ? "rgba(93,184,114,0.08)" : undefined,
      pulse: activeRuns > 0,
    },
    {
      value: activeAgents,
      label: "Active Agents",
      color: "#5db8a6",
      to: "/agents",
    },
    {
      value: doneToday,
      label: "Done Today",
      color: doneToday > 0 ? "#5db872" : tk.textMuted,
      to: "/issues",
    },
    {
      value: pendingApprovals,
      label: "Approvals",
      color: pendingApprovals > 0 ? "#e8a55a" : tk.textMuted,
      to: "/approvals",
      tint: pendingApprovals > 0 ? "rgba(232,165,90,0.08)" : undefined,
    },
    {
      value: formatCents(todaySpendCents),
      label: "Today Spend",
      color: "#e8a55a",
      to: "/costs",
    },
    {
      value: blocked,
      label: "Blocked",
      color: blocked > 0 ? "#c64545" : tk.textMuted,
      to: "/issues",
      tint: blocked > 0 ? "rgba(198,69,69,0.08)" : undefined,
    },
  ];

  return (
    <div style={{ display: "flex", gap: 10, height: "100%" }}>
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          to={tile.to}
          style={{
            flex: 1,
            height: "100%",
            borderRadius: 12,
            padding: "14px 12px",
            background: tile.tint ? tile.tint : tk.cardBg,
            border: `1px solid ${tile.tint ? tile.color + "40" : tk.cardBorderStrong}`,
            backdropFilter: "blur(16px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            textDecoration: "none",
            boxSizing: "border-box",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          className="hover:scale-[1.02]"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {tile.pulse && (
              <span
                className="animate-ping"
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#5db872", display: "inline-block", flexShrink: 0,
                }}
              />
            )}
            <span style={{
              fontSize: 28, fontWeight: 700,
              color: tile.color,
              fontFamily: "StyreneB, Inter, sans-serif",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}>{tile.value}</span>
          </div>
          <span style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: tk.textMuted,
            fontWeight: 600,
          }}>{tile.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface AgentSessionsPanelProps {
  agents: Agent[];
  agentBurnToday: AgentBurnEntry[];
  liveRuns: LiveRunForIssue[];
  workingAgentIds: Set<string>;
  isDark: boolean;
  onWakeup?: (agentId: string) => void;
  onPause?: (agentId: string) => void;
}

function AgentSessionsPanel({ agents, agentBurnToday, liveRuns, workingAgentIds, isDark, onWakeup, onPause }: AgentSessionsPanelProps) {
  const tk = tokens(isDark);

  const burnMap = new Map(agentBurnToday.map((b) => [b.agentId, b]));

  // Active run count per agent (for live indicator)
  const activeRunCountMap = new Map<string, number>();
  for (const run of liveRuns) {
    if (run.status === "running" || run.status === "in_progress") {
      activeRunCountMap.set(run.agentId, (activeRunCountMap.get(run.agentId) ?? 0) + 1);
    }
  }

  // Active run detail per agent (for subtitle)
  const activeRunMap = new Map<string, LiveRunForIssue>();
  for (const run of liveRuns) {
    if ((run.status === "running" || run.status === "in_progress") && !activeRunMap.has(run.agentId)) {
      activeRunMap.set(run.agentId, run);
    }
  }

  const liveCount = agents.filter((a) => workingAgentIds.has(a.id)).length;
  const totalRunsToday = agentBurnToday.reduce((s, b) => s + b.runsToday, 0);
  const totalCostToday = agentBurnToday.reduce((s, b) => s + b.costCents, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Agent Sessions" badge={liveCount > 0 ? liveCount : undefined} badgeColor="#5db872" dot={liveCount > 0} tk={tk} />

      {/* Summary strip */}
      <div style={{
        display: "flex", gap: 0, borderBottom: `1px solid ${tk.divider}`, flexShrink: 0,
      }}>
        {[
          { label: "Live", value: liveCount, color: liveCount > 0 ? "#5db872" : tk.textDim },
          { label: "Runs Today", value: totalRunsToday, color: tk.textMuted },
          { label: "Cost Today", value: formatCents(totalCostToday), color: "#e8a55a" },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: 1, textAlign: "center", padding: "5px 4px",
            borderRight: `1px solid ${tk.divider}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: stat.color, letterSpacing: "-0.03em" }}>{stat.value}</div>
            <div style={{ fontSize: 9, color: tk.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {agents.length === 0 ? (
          <div style={{ padding: 12, color: tk.textDim, fontSize: 11 }}>No agents configured</div>
        ) : (
          agents.map((agent) => {
            const burn = burnMap.get(agent.id);
            const isLive = workingAgentIds.has(agent.id);
            const isPaused = agent.status === "paused";
            const isError = agent.status === "error";
            const activeRun = activeRunMap.get(agent.id);
            const runsToday = burn?.runsToday ?? 0;
            // Use historical succeeded/failed from burn data (covers completed runs too)
            const success = burn?.succeededToday ?? 0;
            const fail = burn?.failedToday ?? 0;
            const active = activeRunCountMap.get(agent.id) ?? 0;
            // Stacked bar segments
            const total = Math.max(1, success + fail + active);
            const pctSuccess = Math.round((success / total) * 100);
            const pctFail = Math.round((fail / total) * 100);
            const pctActive = Math.round((active / total) * 100);
            const hasRuns = runsToday > 0;

            return (
              <Link
                key={agent.id}
                to={`/agents/${agent.id}`}
                style={{
                  display: "block",
                  padding: "8px 12px",
                  borderBottom: `1px solid ${tk.divider}`,
                  textDecoration: "none",
                  transition: "background 0.12s",
                }}
                className="group hover:bg-white/[0.03]"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  {/* Dicebear avatar with live ring */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      outline: isLive ? "2px solid #5db872" : isError ? "2px solid #c64545" : "none",
                      outlineOffset: 2,
                      borderRadius: "50%",
                      lineHeight: 0,
                    }}>
                      <AgentAvatar agent={agent} size="xs" variant="circle" />
                    </div>
                    {isLive && (
                      <span className="animate-ping" style={{
                        position: "absolute", bottom: -1, right: -1,
                        width: 7, height: 7, borderRadius: "50%",
                        background: "#5db872",
                        border: `1.5px solid ${isDark ? "#0a0908" : "#faf9f5"}`,
                      }} />
                    )}
                  </div>

                  {/* Name + bars */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: tk.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        flex: 1, minWidth: 0,
                      }}>{agent.name}</span>
                      {isLive ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 5px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: "rgba(93,184,114,0.18)", color: "#5db872", flexShrink: 0 }}>LIVE</span>
                      ) : isPaused ? (
                        <span style={{ padding: "0 5px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: "rgba(232,165,90,0.15)", color: "#e8a55a", flexShrink: 0 }}>PAUSED</span>
                      ) : isError ? (
                        <span style={{ padding: "0 5px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: "rgba(198,69,69,0.15)", color: "#c64545", flexShrink: 0 }}>ERROR</span>
                      ) : (
                        <span style={{ padding: "0 5px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: tk.barBg, color: tk.textDim, flexShrink: 0 }}>IDLE</span>
                      )}
                    </div>

                    {/* Active task subtitle OR stacked outcome bar */}
                    {isLive && activeRun?.triggerDetail ? (
                      <p style={{ margin: 0, fontSize: 10, color: "#5db872", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {activeRun.triggerDetail}
                      </p>
                    ) : (
                      <div>
                        {/* Stacked bar: success / fail / active */}
                        <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: tk.barBg, marginBottom: 2 }}>
                          {hasRuns ? (
                            <>
                              {pctSuccess > 0 && <div style={{ width: `${pctSuccess}%`, background: "#5db872", transition: "width 0.4s" }} />}
                              {pctFail > 0 && <div style={{ width: `${pctFail}%`, background: "#c64545", transition: "width 0.4s" }} />}
                              {pctActive > 0 && <div style={{ width: `${pctActive}%`, background: "#e8a55a", transition: "width 0.4s" }} />}
                            </>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 9, color: tk.textDim }}>{runsToday} run{runsToday !== 1 ? "s" : ""}</span>
                          {hasRuns && (
                            <>
                              <span style={{ fontSize: 9, color: "#5db872" }}>✓{success}</span>
                              <span style={{ fontSize: 9, color: "#c64545" }}>✗{fail}</span>
                              {active > 0 && <span style={{ fontSize: 9, color: "#e8a55a" }}>~{active}</span>}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cost + hover actions */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: "#e8a55a", fontWeight: 600 }}>
                      {burn ? formatCents(burn.costCents) : "—"}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100" style={{ display: "flex", gap: 3, transition: "opacity 0.15s" }}>
                      {(isPaused || (!isLive && !isError)) ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWakeup?.(agent.id); }}
                          title="Wake up"
                          style={{
                            width: 18, height: 18, borderRadius: 4,
                            border: "1px solid rgba(93,184,114,0.35)",
                            background: "rgba(93,184,114,0.1)", color: "#5db872",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", fontSize: 9,
                          }}
                        >▶</button>
                      ) : isLive ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPause?.(agent.id); }}
                          title="Pause"
                          style={{
                            width: 18, height: 18, borderRadius: 4,
                            border: "1px solid rgba(232,165,90,0.35)",
                            background: "rgba(232,165,90,0.1)", color: "#e8a55a",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", fontSize: 9,
                          }}
                        >⏸</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface IssueStatusPanelProps {
  open: number;
  inProgress: number;
  done: number;
  blocked: number;
  isDark: boolean;
}

function IssueStatusPanel({ open, inProgress, done, blocked, isDark }: IssueStatusPanelProps) {
  const tk = tokens(isDark);
  const total = open + inProgress + done + blocked;

  const segments = [
    { name: "Open", value: open, color: "#5b8af0" },
    { name: "In Progress", value: inProgress, color: "#e8a55a" },
    { name: "Done", value: done, color: "#5db872" },
    { name: "Blocked", value: blocked, color: "#c64545" },
  ];
  const pieData = total === 0
    ? [{ name: "Empty", value: 1, color: tk.barBg }]
    : segments.filter(s => s.value > 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Issue Status" tk={tk} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
        {/* Donut */}
        <div style={{ flex: "0 0 110px", height: 110 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend + values */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: tk.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 10, color: tk.textMuted }}>total</span>
          </div>
          {segments.map(s => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: tk.textMuted }}>{s.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.value > 0 ? s.color : tk.textDim }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface ApprovalsPanelProps {
  approvals: PendingApprovalEntry[];
  isDark: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
  approveVar: string | undefined;
  rejectVar: string | undefined;
}

function ApprovalsPanel({ approvals, isDark, onApprove, onReject, approvePending, rejectPending, approveVar, rejectVar }: ApprovalsPanelProps) {
  const tk = tokens(isDark);
  const shown = approvals.slice(0, 3);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader
        title="Approvals"
        badge={approvals.length}
        badgeColor="#e8a55a"
        tk={tk}
      />
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {approvals.length === 0 ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, color: tk.textDim, fontSize: 11,
          }}>
            No pending approvals
          </div>
        ) : (
          <>
            {shown.map((ap) => {
              const isApproving = approvePending && approveVar === ap.id;
              const isRejecting = rejectPending && rejectVar === ap.id;
              return (
                <div key={ap.id} style={{
                  padding: "10px 12px",
                  borderBottom: `1px solid ${tk.divider}`,
                }}>
                  {/* Type + time row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {ap.type === "pr_merge" ? (
                      <GitMerge style={{ width: 12, height: 12, color: "#818cf8", flexShrink: 0 }} />
                    ) : ap.type === "hire_agent" ? (
                      <AlertTriangle style={{ width: 12, height: 12, color: "#e8a55a", flexShrink: 0 }} />
                    ) : (
                      <AlertTriangle style={{ width: 12, height: 12, color: "#e8a55a", flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      padding: "1px 6px", borderRadius: 8,
                      background: ap.type === "pr_merge" ? "rgba(129,140,248,0.15)" : "rgba(232,165,90,0.15)",
                      color: ap.type === "pr_merge" ? "#818cf8" : "#e8a55a",
                    }}>{approvalLabel(ap.type)}</span>
                    <span style={{ fontSize: 10, color: tk.textDim, marginLeft: "auto" }}>
                      {formatTimeAgo(ap.createdAt)}
                    </span>
                  </div>

                  {/* Agent row */}
                  {ap.requestedByAgentName && (
                    <div style={{ fontSize: 11, color: tk.textMuted, marginBottom: 8 }}>
                      by <span style={{ color: tk.text }}>{ap.requestedByAgentName}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => onApprove(ap.id)}
                      disabled={isApproving || isRejecting}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        padding: "4px 0", borderRadius: 6, border: "1px solid rgba(93,184,114,0.3)",
                        background: "rgba(93,184,114,0.1)", color: "#5db872",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        opacity: isApproving || isRejecting ? 0.5 : 1,
                      }}
                    >
                      <CheckCircle2 style={{ width: 11, height: 11 }} />
                      {isApproving ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => onReject(ap.id)}
                      disabled={isApproving || isRejecting}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        padding: "4px 0", borderRadius: 6, border: "1px solid rgba(198,69,69,0.3)",
                        background: "rgba(198,69,69,0.1)", color: "#c64545",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        opacity: isApproving || isRejecting ? 0.5 : 1,
                      }}
                    >
                      <XCircle style={{ width: 11, height: 11 }} />
                      {isRejecting ? "…" : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
            {approvals.length > 3 && (
              <div style={{ padding: "8px 12px" }}>
                <Link to="/approvals" style={{ fontSize: 11, color: "#e8a55a", textDecoration: "none" }}>
                  View all {approvals.length} approvals →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function TaskPipelinePanel({ tasks, isDark }: { tasks: { open: number; inProgress: number; blocked: number; done: number }; isDark: boolean }) {
  const tk = tokens(isDark);

  const data = [
    { name: "Open",        value: tasks.open,       fill: "#a09d96" },
    { name: "In Progress", value: tasks.inProgress,  fill: "#5da8d8" },
    { name: "Blocked",     value: tasks.blocked,     fill: "#c64545" },
    { name: "Done",        value: tasks.done,        fill: "#5db872" },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Task Pipeline" tk={tk} />
      <div style={{ flex: 1, minHeight: 0, padding: "10px 8px 6px 0" }}>
        {total === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: tk.textDim, fontSize: 11 }}>
            No tasks yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={tk.divider} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: tk.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: tk.textMuted }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ background: isDark ? "#1c1a18" : "#fff", border: `1px solid ${tk.cardBorder}`, borderRadius: 8, fontSize: 11 }}
                cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="value" name="Tasks" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface LiveActivityPanelProps {
  liveRuns: LiveRunForIssue[];
  recentCompleted: RecentActivityEntry[];
  isDark: boolean;
}

function LiveActivityPanel({ liveRuns, recentCompleted, isDark }: LiveActivityPanelProps) {
  const tk = tokens(isDark);
  const activeRuns = liveRuns.filter((r) => r.status === "running" || r.status === "in_progress");

  type FeedItem =
    | { kind: "live"; run: LiveRunForIssue }
    | { kind: "done"; entry: RecentActivityEntry };

  const feed: FeedItem[] = [
    ...activeRuns.map((r) => ({ kind: "live" as const, run: r })),
    ...recentCompleted.map((e) => ({ kind: "done" as const, entry: e })),
  ].slice(0, 8);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader
        title="Live Activity"
        dot={activeRuns.length > 0}
        tk={tk}
      />
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {feed.length === 0 ? (
          <div style={{ padding: 12, color: tk.textDim, fontSize: 11, textAlign: "center" }}>
            No recent activity
          </div>
        ) : (
          feed.map((item, i) => {
            if (item.kind === "live") {
              const run = item.run;
              return (
                <div key={`live-${run.id}`} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "7px 12px",
                  borderBottom: `1px solid ${tk.divider}`,
                }}>
                  <span className="animate-ping" style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#5db872", display: "inline-block",
                    flexShrink: 0, marginTop: 3,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 11, color: tk.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      <span style={{ fontWeight: 600 }}>{run.agentName}</span>
                      {run.triggerDetail ? `: ${run.triggerDetail}` : ""}
                    </p>
                    <span style={{ fontSize: 10, color: "#5db872", fontWeight: 600 }}>● LIVE</span>
                  </div>
                </div>
              );
            } else {
              const entry = item.entry;
              return (
                <div key={`done-${entry.id ?? i}`} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "7px 12px",
                  borderBottom: `1px solid ${tk.divider}`,
                }}>
                  <CheckSquare style={{ width: 12, height: 12, color: "#5db872", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 11, color: tk.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{entry.title}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Clock style={{ width: 9, height: 9, color: tk.textDim }} />
                      <span style={{ fontSize: 10, color: tk.textDim }}>
                        {formatTimeAgo(entry.completedAt)}
                        {entry.assigneeAgentName && (
                          <> · <span style={{ color: tk.textMuted }}>{entry.assigneeAgentName}</span></>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function VelocityPanel({ recentCompleted, isDark }: { recentCompleted: RecentActivityEntry[]; isDark: boolean }) {
  const tk = tokens(isDark);
  const now = new Date();

  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = (now.getHours() - 11 + i + 24) % 24;
    const label = h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
    return { hour: h, label, completed: 0 };
  });

  for (const entry of recentCompleted) {
    const h = new Date(entry.completedAt).getHours();
    const slot = hours.find(x => x.hour === h);
    if (slot) slot.completed++;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Task Velocity — Completions by Hour" badge={recentCompleted.length} badgeColor="#5db872" tk={tk} />
      <div style={{ flex: 1, minHeight: 0, padding: "10px 8px 6px 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hours} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={tk.divider} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: tk.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: tk.textMuted }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip
              contentStyle={{ background: isDark ? "#1c1a18" : "#fff", border: `1px solid ${tk.cardBorder}`, borderRadius: 8, fontSize: 11 }}
              cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
              itemStyle={{ color: "#5db872" }}
            />
            <Bar dataKey="completed" name="Completed" fill="#5db872" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function AgentHealthPanel({ agentCounts, isDark }: { agentCounts: { active: number; running: number; paused: number; error: number }; isDark: boolean }) {
  const tk = tokens(isDark);

  const data = [
    { name: "Active",  value: agentCounts.active,  fill: "#5db872" },
    { name: "Running", value: agentCounts.running,  fill: "#e8a55a" },
    { name: "Paused",  value: agentCounts.paused,   fill: "#a09d96" },
    { name: "Error",   value: agentCounts.error,    fill: "#c64545" },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Agent Health" tk={tk} />
      <div style={{ flex: 1, minHeight: 0, padding: "10px 8px 6px 0" }}>
        {total === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: tk.textDim, fontSize: 11 }}>
            No agents configured
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={tk.divider} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: tk.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: tk.textMuted }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
              <Tooltip
                contentStyle={{ background: isDark ? "#1c1a18" : "#fff", border: `1px solid ${tk.cardBorder}`, borderRadius: 8, fontSize: 11 }}
                cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="value" name="Agents" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

// ── Feature 3: Token Usage Panel ───────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function TokenUsagePanel({
  tokensToday,
  todaySpendCents,
  isDark,
}: {
  tokensToday: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  todaySpendCents: number;
  isDark: boolean;
}) {
  const tk = tokens(isDark);
  const total = tokensToday.inputTokens + tokensToday.outputTokens;
  const cacheRate = total > 0 ? ((tokensToday.cachedInputTokens / tokensToday.inputTokens) * 100) : 0;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Token Usage Today" tk={tk} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, padding: "10px 14px", justifyContent: "center" }}>
        {[
          { icon: "↑", label: "Sent", value: formatTokens(tokensToday.inputTokens), color: "#5b8af0" },
          { icon: "↓", label: "Received", value: formatTokens(tokensToday.outputTokens), color: "#5db8a6" },
          { icon: "💾", label: "Cached", value: formatTokens(tokensToday.cachedInputTokens), color: "#5db872" },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${tk.divider}` }}>
            <span style={{ fontSize: 13, width: 20, textAlign: "center" }}>{row.icon}</span>
            <span style={{ flex: 1, fontSize: 11, color: tk.textMuted }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: row.color, letterSpacing: "-0.02em" }}>{row.value}</span>
            <span style={{ fontSize: 10, color: tk.textDim }}>tokens</span>
          </div>
        ))}
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: tk.textDim }}>
            Cache hit {cacheRate.toFixed(1)}%
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#e8a55a" }}>{formatCents(todaySpendCents)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Feature 4: Pull Requests Panel ─────────────────────────────────────────

function PullRequestsPanel({
  pulls,
  isLoading,
  noRepo,
  noProject,
  isDark,
}: {
  pulls: PullRequestEntry[];
  isLoading: boolean;
  noRepo: boolean;
  noProject: boolean;
  isDark: boolean;
}) {
  const tk = tokens(isDark);

  const prMap = new Map(pulls.map((p) => [p.number, p]));

  const stateColor = (state: string) =>
    state === "ready" ? "#5db872" : state === "draft" ? "#6c6a64" : "#5b8af0";
  const stateLabel = (state: string) =>
    state === "ready" ? "✓ Ready" : state === "draft" ? "◌ Draft" : "● Open";

  function formatPrTimeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Pull Requests" badge={pulls.length} badgeColor="#818cf8" tk={tk} />
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {noProject ? (
          <div style={{ padding: 16, color: tk.textDim, fontSize: 11, textAlign: "center" }}>
            Select a project to view pull requests
          </div>
        ) : noRepo ? (
          <div style={{ padding: 16, color: tk.textDim, fontSize: 11, textAlign: "center" }}>
            Connect a GitHub repo in Project Settings
          </div>
        ) : isLoading ? (
          <div style={{ padding: 16, color: tk.textDim, fontSize: 11, textAlign: "center" }}>Loading…</div>
        ) : pulls.length === 0 ? (
          <div style={{ padding: 16, color: tk.textDim, fontSize: 11, textAlign: "center" }}>
            No open pull requests
          </div>
        ) : (
          pulls.map((pr) => {
            const deps = pr.referencedPrNumbers.filter((n) => prMap.has(n));
            return (
              <div key={pr.number} style={{ padding: "9px 12px", borderBottom: `1px solid ${tk.divider}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <img
                    src={pr.authorAvatar}
                    alt={pr.author}
                    style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
                  />
                  <span style={{ fontSize: 10, color: tk.textDim, flexShrink: 0 }}>#{pr.number}</span>
                  <span style={{
                    flex: 1, fontSize: 11, fontWeight: 600, color: tk.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{pr.title}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, flexShrink: 0,
                    background: `${stateColor(pr.state)}22`, color: stateColor(pr.state),
                  }}>{stateLabel(pr.state)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: tk.textDim }}>
                  <span>{pr.author}</span>
                  <span>·</span>
                  <span>{formatPrTimeAgo(pr.updatedAt)}</span>
                  <span>·</span>
                  <span style={{ color: tk.textMuted }}>{pr.baseRef}←{pr.headRef}</span>
                  <div style={{ flex: 1 }} />
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{ color: "#818cf8", display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}
                  >
                    <ExternalLink style={{ width: 10, height: 10 }} />
                  </a>
                </div>
                {deps.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, color: tk.textDim }}>depends on:</span>
                    {deps.map((n) => (
                      <span key={n} style={{
                        fontSize: 9, padding: "0 5px", borderRadius: 6,
                        background: "rgba(129,140,248,0.12)", color: "#818cf8",
                      }}>#{n}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (!projectPickerOpen) return;
    const close = () => setProjectPickerOpen(false);
    document.addEventListener("click", close, { capture: true });
    return () => document.removeEventListener("click", close, { capture: true });
  }, [projectPickerOpen]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!, selectedProjectId),
    queryFn: () => dashboardApi.summary(selectedCompanyId!, selectedProjectId),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: pulls, isLoading: pullsLoading, error: pullsErrorRaw } = useQuery({
    queryKey: queryKeys.githubPulls(selectedCompanyId!, selectedProjectId ?? ""),
    queryFn: () => githubIntegrationApi.listPullRequests(selectedCompanyId!, selectedProjectId!),
    enabled: !!selectedCompanyId && !!selectedProjectId,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
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

  const wakeupMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.wakeup(agentId, { source: "on_demand", triggerDetail: "manual" }, selectedCompanyId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) }),
  });

  const pauseMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.pause(agentId, selectedCompanyId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) }),
  });

  const workingAgentIds = useMemo(() => {
    if (!liveRuns) return new Set<string>();
    return new Set(
      liveRuns
        .filter((r) => r.status === "running" || r.status === "in_progress")
        .map((r) => r.agentId),
    );
  }, [liveRuns]);

  // Build run stats map for AgentGlobe tooltip
  const agentRunStats = useMemo(() => {
    const map = new Map<string, { succeeded: number; failed: number; total: number; status: string }>();
    for (const burn of data?.agentBurnToday ?? []) {
      map.set(burn.agentId, {
        succeeded: burn.succeededToday,
        failed: burn.failedToday,
        total: burn.runsToday,
        status: burn.status,
      });
    }
    return map;
  }, [data?.agentBurnToday]);

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
  const approvalsList = data?.pendingApprovalsList ?? [];
  const recentActivity = data?.recentCompleted ?? [];
  const blockedCount = data?.tasks?.blocked ?? 0;
  const selectedProject = projects?.find((p) => p.id === selectedProjectId) ?? null;
  // 404 = no repo connected; any other error = API/auth failure
  const pullsIsNoRepo = pullsErrorRaw != null && (pullsErrorRaw as { status?: number }).status === 404;
  const noRepoPulls = pullsIsNoRepo || (!pullsLoading && pulls === undefined && !!selectedProjectId && !pullsErrorRaw);
  const pullsList = pulls ?? [];

  const tk = tokens(isDark);
  const hasBudgetIncident = (data?.budgets?.activeIncidents ?? 0) > 0;

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

  const glassmorphismStyle: React.CSSProperties = {
    background: tk.cardBg,
    border: `1px solid ${tk.cardBorder}`,
    backdropFilter: "blur(16px)",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
  };

  return (
    <div style={{
      height: "100%",
      overflowY: "auto",
      background: isDark ? "#0a0908" : "#faf9f5",
      padding: 12,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>

      {/* ── Project picker ───────────────────────────────────────────── */}
      {projects && projects.length > 0 && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: tk.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Project</span>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setProjectPickerOpen(!projectPickerOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 8,
                background: selectedProject ? "rgba(129,140,248,0.12)" : tk.cardBg,
                border: `1px solid ${selectedProject ? "rgba(129,140,248,0.3)" : tk.cardBorder}`,
                color: selectedProject ? "#818cf8" : tk.textMuted,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              {selectedProject ? selectedProject.name : "All Projects"}
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>
            {projectPickerOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                background: isDark ? "#1c1a18" : "#fff",
                border: `1px solid ${tk.cardBorder}`,
                borderRadius: 8, overflow: "hidden", minWidth: 160,
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); setSelectedProjectId(null); setProjectPickerOpen(false); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 12px", fontSize: 11, cursor: "pointer", border: "none",
                    background: !selectedProjectId ? "rgba(255,255,255,0.05)" : "transparent",
                    color: !selectedProjectId ? "#818cf8" : tk.text,
                  }}
                >All Projects</button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedProjectId(p.id); setProjectPickerOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 12px", fontSize: 11, cursor: "pointer", border: "none",
                      background: selectedProjectId === p.id ? "rgba(129,140,248,0.1)" : "transparent",
                      color: selectedProjectId === p.id ? "#818cf8" : tk.text,
                    }}
                  >{p.name}</button>
                ))}
              </div>
            )}
          </div>
          {selectedProject && (
            <span style={{ fontSize: 10, color: tk.textDim }}>showing stats scoped to project</span>
          )}
        </div>
      )}

      {/* ── Budget incident banner ────────────────────────────────────── */}
      {hasBudgetIncident && (
        <div style={{
          flexShrink: 0,
          background: "rgba(198,69,69,0.12)",
          border: "1px solid rgba(198,69,69,0.3)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PauseCircle style={{ color: "#c64545", width: 14, height: 14, flexShrink: 0 }} />
            <span style={{ color: "#c64545", fontSize: 12 }}>
              {data!.budgets.activeIncidents} budget incident
              {data!.budgets.activeIncidents === 1 ? "" : "s"} — {data!.budgets.pausedAgents} agents paused
            </span>
          </div>
          <Link to="/costs" style={{ color: "#c64545", fontSize: 12, textDecoration: "underline" }}>
            Open budgets
          </Link>
        </div>
      )}

      {/* ── Row 1: KPI tiles ─────────────────────────────────────────── */}
      <div style={{ height: 92, flexShrink: 0 }}>
        <KpiStrip
          activeRuns={activeCount}
          activeAgents={data?.agents.active ?? 0}
          doneToday={data?.tasks.todayCompleted ?? 0}
          pendingApprovals={approvalsList.length}
          todaySpendCents={data?.costs.todaySpendCents ?? 0}
          blocked={blockedCount}
          isDark={isDark}
        />
      </div>

      {/* ── Row 2: Globe (big) + Agent Sessions ──────────────────────── */}
      <div style={{ display: "flex", gap: 10, height: 440, flexShrink: 0 }}>

        {/* Globe — large square panel */}
        <div style={{
          flex: "0 0 58%",
          position: "relative",
          overflow: "hidden",
          borderRadius: 14,
          border: `1px solid ${tk.cardBorder}`,
          background: isDark ? "rgba(10,9,8,0.7)" : "rgba(245,244,240,0.85)",
        }}>
          <AgentGlobe
            agents={agents ?? []}
            workingAgentIds={workingAgentIds}
            blockedAgentIds={blockedAgentIds}
            agentTaskMap={agentTaskMap}
            agentRunStats={agentRunStats}
            onSelectAgent={handleSelectAgent}
            isDark={isDark}
          />
          <div style={{
            position: "absolute", bottom: 14, left: "50%",
            transform: "translateX(-50%)", zIndex: 10,
          }}>
            <div style={{
              padding: "4px 14px", borderRadius: 20,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${tk.cardBorder}`,
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
            }}>
              <span style={{ color: tk.textDim, fontSize: 10 }}>Click an agent to chat</span>
            </div>
          </div>
        </div>

        {/* Agent Sessions */}
        <div style={{ flex: 1, overflow: "hidden", ...glassmorphismStyle }}>
          <AgentSessionsPanel
            agents={agents ?? []}
            agentBurnToday={data?.agentBurnToday ?? []}
            liveRuns={liveRuns ?? []}
            workingAgentIds={workingAgentIds}
            isDark={isDark}
            onWakeup={(id) => wakeupMutation.mutate(id)}
            onPause={(id) => pauseMutation.mutate(id)}
          />
        </div>
      </div>

      {/* ── Row 3: Issue Status + Approvals + Live Activity ──────────── */}
      <div style={{ display: "flex", gap: 10, height: 260, flexShrink: 0 }}>
        <div style={{ flex: 1, overflow: "hidden", ...glassmorphismStyle }}>
          <IssueStatusPanel
            open={data?.tasks.open ?? 0}
            inProgress={data?.tasks.inProgress ?? 0}
            done={data?.tasks.done ?? 0}
            blocked={blockedCount}
            isDark={isDark}
          />
        </div>
        <div style={{ flex: 1, overflow: "hidden", ...glassmorphismStyle }}>
          <ApprovalsPanel
            approvals={approvalsList}
            isDark={isDark}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            approvePending={approveMutation.isPending}
            rejectPending={rejectMutation.isPending}
            approveVar={approveMutation.variables as string | undefined}
            rejectVar={rejectMutation.variables as string | undefined}
          />
        </div>
        <div style={{ flex: 1, overflow: "hidden", ...glassmorphismStyle }}>
          <LiveActivityPanel
            liveRuns={liveRuns ?? []}
            recentCompleted={recentActivity}
            isDark={isDark}
          />
        </div>
      </div>

      {/* ── Row 4: Task Velocity + Session Success ────────────────────── */}
      <div style={{ display: "flex", gap: 10, height: 230, flexShrink: 0 }}>
        <div style={{ flex: "0 0 58%", overflow: "hidden", ...glassmorphismStyle }}>
          <VelocityPanel recentCompleted={recentActivity} isDark={isDark} />
        </div>
        <div style={{ flex: 1, overflow: "hidden", ...glassmorphismStyle }}>
          <AgentHealthPanel agentCounts={data?.agents ?? { active: 0, running: 0, paused: 0, error: 0 }} isDark={isDark} />
        </div>
      </div>

      {/* ── Row 5: Task Pipeline + Token Usage + PR Panel ───────────── */}
      <div style={{ display: "flex", gap: 10, height: 240, flexShrink: 0 }}>
        <div style={{ flex: 1, overflow: "hidden", ...glassmorphismStyle }}>
          <TaskPipelinePanel tasks={data?.tasks ?? { open: 0, inProgress: 0, blocked: 0, done: 0 }} isDark={isDark} />
        </div>
        <div style={{ flex: "0 0 220px", overflow: "hidden", ...glassmorphismStyle }}>
          <TokenUsagePanel
            tokensToday={data?.costs.tokensToday ?? { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 }}
            todaySpendCents={data?.costs.todaySpendCents ?? 0}
            isDark={isDark}
          />
        </div>
        <div style={{ flex: "0 0 300px", overflow: "hidden", ...glassmorphismStyle }}>
          <PullRequestsPanel
            pulls={pullsList}
            isLoading={pullsLoading}
            noRepo={!!noRepoPulls}
            noProject={!selectedProjectId}
            isDark={isDark}
          />
        </div>
      </div>

    </div>
  );
}
