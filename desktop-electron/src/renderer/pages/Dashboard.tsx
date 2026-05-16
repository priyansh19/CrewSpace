import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { dashboardApi } from "../api/dashboard";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { projectsApi } from "../api/projects";
import { githubIntegrationApi } from "../api/githubIntegration";
import { issuesApi } from "../api/issues";
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
import type { Agent, PendingApprovalEntry, RecentActivityEntry, AgentBurnEntry, Issue } from "@crewspaceai/shared";
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
  Circle,
  CircleDot,
  CircleCheck,
  CircleX,
  Layers,
  Upload,
  Download,
  Database,
  GripVertical,
} from "lucide-react";

declare global {
  interface Window {
    electronAPI?: {
      openGithubWindow?: (url: string) => void;
      [key: string]: unknown;
    };
  }
}

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
      {/* Content: donut + compact legend side by side, centered, no stretching */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 16px" }}>
        {/* Donut with total in center */}
        <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Total label inside donut */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: tk.text, letterSpacing: "-0.04em", lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 8, color: tk.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>total</span>
          </div>
        </div>
        {/* Legend — fixed width so numbers align on a vertical column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 130 }}>
          {segments.map(s => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: tk.textMuted, whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.value > 0 ? s.color : tk.textDim, width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
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
  const shown = approvals.slice(0, 5);

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
              const isProposal = ap.type === "proposal";
              const proposalTitle = isProposal ? ((ap.payload?.title as string) ?? null) : null;
              const linkTo = isProposal ? "/proposals" : `/approvals/${ap.id}`;

              return (
                <div key={ap.id} style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${tk.divider}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  {/* Icon */}
                  <div style={{ flexShrink: 0 }}>
                    {ap.type === "pr_merge" ? (
                      <GitMerge style={{ width: 13, height: 13, color: "#818cf8" }} />
                    ) : (
                      <AlertTriangle style={{ width: 13, height: 13, color: "#e8a55a" }} />
                    )}
                  </div>

                  {/* Main content — clickable */}
                  <Link
                    to={linkTo}
                    style={{ flex: 1, minWidth: 0, textDecoration: "none" }}
                  >
                    {/* Title / proposal title */}
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: tk.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      lineHeight: 1.3,
                    }}>
                      {proposalTitle ?? approvalLabel(ap.type)}
                    </div>
                    {/* Subtitle: agent + type tag + time */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                      {ap.requestedByAgentName && (
                        <span style={{ fontSize: 10, color: tk.textMuted }}>
                          by {ap.requestedByAgentName}
                        </span>
                      )}
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        padding: "1px 5px", borderRadius: 6,
                        background: ap.type === "pr_merge" ? "rgba(129,140,248,0.15)" : "rgba(232,165,90,0.15)",
                        color: ap.type === "pr_merge" ? "#818cf8" : "#e8a55a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}>
                        {ap.type === "proposal" ? "Proposal" : approvalLabel(ap.type)}
                      </span>
                      <span style={{ fontSize: 9, color: tk.textDim, marginLeft: "auto" }}>
                        {formatTimeAgo(ap.createdAt)}
                      </span>
                    </div>
                  </Link>

                  {/* Compact action buttons on the right */}
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onApprove(ap.id); }}
                      disabled={isApproving || isRejecting}
                      title="Approve"
                      style={{
                        width: 26, height: 26,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 6, border: "1px solid rgba(93,184,114,0.35)",
                        background: "rgba(93,184,114,0.12)", color: "#5db872",
                        cursor: "pointer", flexShrink: 0,
                        opacity: isApproving || isRejecting ? 0.4 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {isApproving ? (
                        <span style={{ fontSize: 9 }}>…</span>
                      ) : (
                        <CheckCircle2 style={{ width: 13, height: 13 }} />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onReject(ap.id); }}
                      disabled={isApproving || isRejecting}
                      title="Reject"
                      style={{
                        width: 26, height: 26,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 6, border: "1px solid rgba(198,69,69,0.3)",
                        background: "rgba(198,69,69,0.08)", color: "#c64545",
                        cursor: "pointer", flexShrink: 0,
                        opacity: isApproving || isRejecting ? 0.4 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {isRejecting ? (
                        <span style={{ fontSize: 9 }}>…</span>
                      ) : (
                        <XCircle style={{ width: 13, height: 13 }} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            {approvals.length > 5 && (
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

  const stages = [
    { key: "open",       label: "Open",        value: tasks.open,        color: "#8e8b82", bg: "rgba(142,139,130,0.1)" },
    { key: "inProgress", label: "In Progress", value: tasks.inProgress,  color: "#5db8a6", bg: "rgba(93,184,166,0.1)" },
    { key: "blocked",    label: "Blocked",     value: tasks.blocked,     color: "#c64545", bg: "rgba(198,69,69,0.1)" },
    { key: "done",       label: "Done",        value: tasks.done,        color: "#5db872", bg: "rgba(93,184,114,0.1)" },
  ];

  const total = stages.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Task Pipeline" badge={total > 0 ? total : undefined} badgeColor="#5db8a6" tk={tk} />

      {/* Stacked progress bar */}
      {total > 0 && (
        <div style={{ height: 4, display: "flex", flexShrink: 0, gap: 1 }}>
          {stages.filter((s) => s.value > 0).map((s) => (
            <div
              key={s.key}
              style={{ flex: s.value, background: s.color, transition: "flex 0.4s ease" }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
        </div>
      )}

      {/* Stat tiles */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "10px 10px 8px" }}>
        {stages.map(({ key, label, value, color, bg }) => (
          <div key={key} style={{ borderRadius: 8, background: bg, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</span>
            <span style={{ fontSize: 10, color: tk.textMuted }}>{label}</span>
          </div>
        ))}
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

  // Live runs always shown first, then full completed history (no hard cap)
  const feed: FeedItem[] = [
    ...activeRuns.map((r) => ({ kind: "live" as const, run: r })),
    ...recentCompleted.map((e) => ({ kind: "done" as const, entry: e })),
  ];

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

/** PR Review Panel — shows open + merged PRs */
function OpenPRsPanel({
  pulls,
  isLoading,
  noRepo,
  noProject,
  isDark,
  companyId,
  projectId,
}: {
  pulls: PullRequestEntry[];
  isLoading: boolean;
  noRepo: boolean;
  noProject: boolean;
  isDark: boolean;
  companyId: string;
  projectId: string | null;
}) {
  const tk = tokens(isDark);
  const queryClient = useQueryClient();

  const mergeMutation = useMutation({
    mutationFn: ({ prNumber }: { prNumber: number }) =>
      githubIntegrationApi.mergePr(companyId, projectId!, prNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.githubPulls(companyId, projectId ?? "") });
    },
  });

  const stateColor = (state: string) =>
    state === "ready" ? "#5db872" :
    state === "merged" ? "#a855f7" :
    state === "draft" ? "#6c6a64" : "#5b8af0";

  const stateLabel = (state: string) =>
    state === "ready" ? "✓ Ready" :
    state === "merged" ? "⎇ Merged" :
    state === "draft" ? "◌ Draft" : "● Open";

  function prAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  function openInApp(url: string) {
    if (window.electronAPI?.openGithubWindow) {
      window.electronAPI.openGithubWindow(url);
    } else {
      window.open(url, "_blank");
    }
  }

  const ready  = pulls.filter((p) => p.state === "ready");
  const open   = pulls.filter((p) => p.state === "open");
  const draft  = pulls.filter((p) => p.state === "draft");
  const merged = pulls.filter((p) => p.state === "merged");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px 8px",
        borderBottom: `1px solid ${tk.divider}`,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <GitPullRequest style={{ width: 13, height: 13, color: "#cc785c", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: tk.textMuted, flex: 1 }}>
          Pull Requests
        </span>
        {pulls.length > 0 && (
          <div style={{ display: "flex", gap: 4 }}>
            {ready.length > 0  && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "rgba(93,184,114,0.15)", color: "#5db872" }}>{ready.length} ready</span>}
            {open.length > 0   && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "rgba(91,138,240,0.15)", color: "#5b8af0" }}>{open.length} open</span>}
            {draft.length > 0  && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "rgba(108,106,100,0.15)", color: "#8e8b82" }}>{draft.length} draft</span>}
            {merged.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>{merged.length} merged</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {noProject ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 16 }}>
            <GitPullRequest style={{ width: 28, height: 28, color: tk.textDim, opacity: 0.4 }} />
            <p style={{ fontSize: 11, color: tk.textDim, textAlign: "center" }}>Select a project to view pull requests</p>
          </div>
        ) : noRepo ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 16 }}>
            <GitPullRequest style={{ width: 28, height: 28, color: tk.textDim, opacity: 0.4 }} />
            <p style={{ fontSize: 11, color: tk.textDim, textAlign: "center" }}>Connect a GitHub repo in Project Settings</p>
          </div>
        ) : isLoading ? (
          <div style={{ padding: "20px 12px", color: tk.textDim, fontSize: 11, textAlign: "center" }}>Loading PRs…</div>
        ) : pulls.length === 0 ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 16 }}>
            <GitMerge style={{ width: 28, height: 28, color: "#5db872", opacity: 0.5 }} />
            <p style={{ fontSize: 11, color: tk.textDim, textAlign: "center" }}>No pull requests yet</p>
          </div>
        ) : (
          pulls.map((pr) => {
            const canMerge = pr.state === "open" || pr.state === "ready";
            const isMerging = mergeMutation.isPending && (mergeMutation.variables as { prNumber: number })?.prNumber === pr.number;
            return (
              <div
                key={pr.number}
                onClick={() => openInApp(pr.url)}
                style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${tk.divider}`,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Left: avatar */}
                <img
                  src={pr.authorAvatar}
                  alt={pr.author}
                  style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1, objectFit: "cover", border: `1px solid ${tk.divider}` }}
                />
                {/* Middle: content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: tk.textDim, flexShrink: 0, fontFamily: "ui-monospace, monospace" }}>#{pr.number}</span>
                    <span style={{
                      flex: 1, fontSize: 11, fontWeight: 600, color: tk.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{pr.title}</span>
                    {/* State badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, flexShrink: 0,
                      background: `${stateColor(pr.state)}1a`, color: stateColor(pr.state),
                    }}>{stateLabel(pr.state)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: tk.textDim }}>
                    <span style={{ fontWeight: 500 }}>{pr.author}</span>
                    <span>·</span>
                    <span>{prAgo(pr.updatedAt)}</span>
                    <span>·</span>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: tk.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                      {pr.baseRef}←{pr.headRef}
                    </span>
                    <div style={{ flex: 1 }} />
                    {/* Merge button for open/ready PRs */}
                    {canMerge && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          mergeMutation.mutate({ prNumber: pr.number });
                        }}
                        disabled={isMerging || mergeMutation.isPending}
                        style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 6, flexShrink: 0,
                          background: isMerging ? "rgba(168,85,247,0.12)" : "rgba(93,184,114,0.12)",
                          color: isMerging ? "#a855f7" : "#5db872",
                          border: `1px solid ${isMerging ? "rgba(168,85,247,0.3)" : "rgba(93,184,114,0.3)"}`,
                          cursor: isMerging ? "default" : "pointer",
                          display: "flex", alignItems: "center", gap: 3,
                        }}
                      >
                        <GitMerge style={{ width: 9, height: 9 }} />
                        {isMerging ? "Merging…" : "Merge"}
                      </button>
                    )}
                    {/* Open in app link */}
                    <span
                      onClick={(e) => { e.stopPropagation(); openInApp(pr.url); }}
                      style={{ color: "#cc785c", display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}
                    >
                      <ExternalLink style={{ width: 11, height: 11 }} />
                    </span>
                  </div>
                  {pr.labels.length > 0 && (
                    <div style={{ marginTop: 3, display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {pr.labels.slice(0, 3).map((l) => (
                        <span key={l} style={{ fontSize: 9, padding: "0 5px", borderRadius: 6, background: "rgba(204,120,92,0.12)", color: "#cc785c" }}>{l}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function AgentHealthPanel({ agentCounts, isDark }: { agentCounts: { active: number; running: number; paused: number; error: number }; isDark: boolean }) {
  const tk = tokens(isDark);

  const stats = [
    { label: "Active",  value: agentCounts.active,  color: "#5db872",  bg: "rgba(93,184,114,0.1)",   dot: "rgba(93,184,114,0.7)" },
    { label: "Running", value: agentCounts.running,  color: "#e8a55a",  bg: "rgba(232,165,90,0.1)",   dot: "rgba(232,165,90,0.7)" },
    { label: "Paused",  value: agentCounts.paused,   color: "#8e8b82",  bg: "rgba(142,139,130,0.1)",  dot: null },
    { label: "Error",   value: agentCounts.error,    color: "#c64545",  bg: "rgba(198,69,69,0.1)",    dot: "rgba(198,69,69,0.7)" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="Agent Health" tk={tk} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 12px", gap: 6 }}>
        {stats.map(({ label, value, color, bg, dot }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: bg }}>
            {/* Animated dot for active/running/error */}
            <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
              {dot && value > 0 && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%", background: dot,
                  animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
                }} />
              )}
            </div>
            <span style={{ fontSize: 11, color: tk.textMuted, flex: 1 }}>{label}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {value}
            </span>
          </div>
        ))}
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
  tokensCumulative,
  tokensToday,
  todaySpendCents,
  isDark,
}: {
  tokensCumulative: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  tokensToday: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  todaySpendCents: number;
  isDark: boolean;
}) {
  const tk = tokens(isDark);
  const [showCumulative, setShowCumulative] = useState(true);
  const display = showCumulative ? tokensCumulative : tokensToday;
  const totalInput = display.inputTokens + display.cachedInputTokens;
  const cacheRate = totalInput > 0 ? ((display.cachedInputTokens / totalInput) * 100) : 0;
  const todayHasNoActivity = !showCumulative && tokensToday.inputTokens === 0 && tokensToday.outputTokens === 0 && tokensToday.cachedInputTokens === 0;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px 9px",
        borderBottom: `1px solid ${tk.divider}`,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: tk.textMuted, textTransform: "uppercase", flex: 1 }}>
          Token Usage
        </span>
        {/* Toggle: All Time / Today */}
        <div style={{ display: "flex", borderRadius: 7, overflow: "hidden", border: `1px solid ${tk.divider}` }}>
          {[{ label: "All", value: true }, { label: "Today", value: false }].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setShowCumulative(value)}
              style={{
                padding: "3px 10px", fontSize: 10, fontWeight: 600,
                background: showCumulative === value ? "rgba(91,138,240,0.2)" : "transparent",
                color: showCumulative === value ? "#5b8af0" : tk.textDim,
                border: "none", cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Token rows — fill remaining height evenly */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 14px 0", justifyContent: "space-evenly", minHeight: 0 }}>
        {todayHasNoActivity ? (
          /* Empty state for today */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>🌙</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: tk.textMuted }}>No activity today</span>
            <span style={{ fontSize: 11, color: tk.textDim, textAlign: "center", maxWidth: 160 }}>
              Token usage will appear here once agents start running
            </span>
          </div>
        ) : (
          <>
            {[
              { Icon: Upload, label: "Sent", value: formatTokens(display.inputTokens), color: "#5b8af0" },
              { Icon: Download, label: "Received", value: formatTokens(display.outputTokens), color: "#5db8a6" },
              { Icon: Database, label: "Cached", value: formatTokens(display.cachedInputTokens), color: "#5db872" },
            ].map((row) => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0",
                borderBottom: `1px solid ${tk.divider}`,
              }}>
                <row.Icon size={17} style={{ color: row.color, flexShrink: 0 }} strokeWidth={2} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: tk.textMuted }}>{row.label}</span>
                <span style={{
                  fontSize: 22, fontWeight: 700, color: row.color,
                  letterSpacing: "-0.03em", lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}>{row.value}</span>
              </div>
            ))}

            {/* Footer: cache rate + spend */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, color: tk.textDim }}>Cache hit rate</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#5db872", letterSpacing: "-0.02em" }}>
                  {cacheRate.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, color: tk.textDim }}>Today spend</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#e8a55a", letterSpacing: "-0.02em" }}>
                  {formatCents(todaySpendCents)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Issues Panel ───────────────────────────────────────────────────────────

type IssueTab = "open" | "in_progress" | "blocked" | "all";

function statusColor(status: string): string {
  if (status === "in_progress" || status === "in_review") return "#e8a55a";
  if (status === "blocked") return "#c64545";
  if (status === "done") return "#5db872";
  if (status === "cancelled") return "#6c6a64";
  return "#5b8af0"; // todo / backlog
}

function StatusIcon({ status, size = 12 }: { status: string; size?: number }) {
  const color = statusColor(status);
  const s = { width: size, height: size, color, flexShrink: 0 };
  if (status === "in_progress") return <CircleDot style={s} />;
  if (status === "done") return <CircleCheck style={s} />;
  if (status === "cancelled") return <CircleX style={s} />;
  return <Circle style={s} />;
}

function priorityDot(priority: string): string {
  if (priority === "urgent") return "#c64545";
  if (priority === "high") return "#e8a55a";
  if (priority === "medium") return "#5b8af0";
  return "#6c6a64";
}

interface IssuesPanelDashboardProps {
  issues: Issue[];
  isLoading: boolean;
  isDark: boolean;
  selectedProjectId: string | null;
  onIssueClick: (issue: Issue) => void;
}

function IssuesPanelDashboard({ issues, isLoading, isDark, selectedProjectId, onIssueClick }: IssuesPanelDashboardProps) {
  const tk = tokens(isDark);
  const [activeTab, setActiveTab] = useState<IssueTab>("open");
  const [searchQ, setSearchQ] = useState("");

  // Exclude done/cancelled from dashboard view — focus on actionable work
  const activeIssues = useMemo(() =>
    issues.filter((i) => i.status !== "done" && i.status !== "cancelled"),
    [issues]);

  const filtered = useMemo(() => {
    let list = activeIssues;
    if (activeTab === "open") list = list.filter((i) => i.status === "todo" || i.status === "backlog");
    else if (activeTab === "in_progress") list = list.filter((i) => i.status === "in_progress" || i.status === "in_review");
    else if (activeTab === "blocked") list = list.filter((i) => i.status === "blocked");
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q) || (i.identifier ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [activeIssues, activeTab, searchQ]);

  const counts = useMemo(() => ({
    open: activeIssues.filter((i) => i.status === "todo" || i.status === "backlog").length,
    in_progress: activeIssues.filter((i) => i.status === "in_progress" || i.status === "in_review").length,
    blocked: activeIssues.filter((i) => i.status === "blocked").length,
    all: activeIssues.length,
  }), [activeIssues]);

  const tabs: { key: IssueTab; label: string; color?: string }[] = [
    { key: "open", label: "Open", color: "#5b8af0" },
    { key: "in_progress", label: "In Progress", color: "#e8a55a" },
    { key: "blocked", label: "Blocked", color: "#c64545" },
    { key: "all", label: "All" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px 0",
        borderBottom: `1px solid ${tk.divider}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Layers style={{ width: 13, height: 13, color: "#5db8a6", flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: tk.textMuted, flex: 1 }}>
            Issues {selectedProjectId ? "" : "· All Projects"}
          </span>
          {/* Search */}
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search…"
            style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 6,
              border: `1px solid ${tk.divider}`,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              color: tk.text, outline: "none", width: 100,
            }}
          />
        </div>
        {/* Tab strip */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const cnt = counts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "5px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                  border: "none", borderBottom: isActive ? `2px solid ${tab.color ?? "#5db8a6"}` : "2px solid transparent",
                  background: "transparent",
                  color: isActive ? (tab.color ?? "#5db8a6") : tk.textDim,
                  transition: "color 0.15s, border-color 0.15s",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {tab.label}
                {cnt > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "0 4px", borderRadius: 5,
                    background: isActive ? `${tab.color ?? "#5db8a6"}22` : tk.barBg,
                    color: isActive ? (tab.color ?? "#5db8a6") : tk.textDim,
                  }}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {isLoading ? (
          <div style={{ padding: 16, color: tk.textDim, fontSize: 11, textAlign: "center" }}>Loading issues…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16, color: tk.textDim, fontSize: 11, textAlign: "center" }}>
            {issues.length === 0 ? "No issues found" : "No issues match the current filter"}
          </div>
        ) : (
          filtered.slice(0, 30).map((issue) => (
            <Link
              key={issue.id}
              to={`/issues/${issue.id}`}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "7px 12px",
                borderBottom: `1px solid ${tk.divider}`,
                textDecoration: "none",
                transition: "background 0.12s",
              }}
              className="hover:bg-white/[0.03]"
              onClick={() => onIssueClick(issue)}
            >
              {/* Status icon */}
              <div style={{ paddingTop: 1, flexShrink: 0 }}>
                <StatusIcon status={issue.status} size={12} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  {issue.identifier && (
                    <span style={{ fontSize: 9, color: tk.textDim, fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>
                      {issue.identifier}
                    </span>
                  )}
                  <span style={{
                    flex: 1, fontSize: 11, fontWeight: 500, color: tk.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{issue.title}</span>
                  {/* Priority dot */}
                  {issue.priority && issue.priority !== "none" && (
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: priorityDot(issue.priority),
                      flexShrink: 0,
                    }} title={`Priority: ${issue.priority}`} />
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: tk.textDim }}>
                  {/* Status label */}
                  <span style={{
                    padding: "1px 5px", borderRadius: 4,
                    background: `${statusColor(issue.status)}18`,
                    color: statusColor(issue.status),
                    fontWeight: 600,
                    fontSize: 8, letterSpacing: "0.04em",
                  }}>{issue.status === "in_progress" ? "In Progress" : issue.status === "in_review" ? "In Review" : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}</span>
                  {issue.project?.name && (
                    <>
                      <span style={{ color: tk.divider }}>·</span>
                      <span style={{ color: tk.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>
                        {issue.project.name}
                      </span>
                    </>
                  )}
                  <div style={{ flex: 1 }} />
                  {issue.updatedAt && (
                    <span>{formatTimeAgo(new Date(issue.updatedAt).toISOString())}</span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
        {filtered.length > 30 && (
          <div style={{ padding: "8px 12px" }}>
            <Link to="/issues" style={{ fontSize: 11, color: "#5db8a6", textDecoration: "none" }}>
              View all {filtered.length} issues →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard layout engine ─────────────────────────────────────────────────

interface PanelDef {
  id: string;
  label: string;
  colSpan: number; // out of 12
  height: number;  // px
}

const PANEL_DEFS: PanelDef[] = [
  { id: "globe",          label: "Agent Globe",    colSpan: 7,  height: 440 },
  { id: "agent-sessions", label: "Agent Sessions", colSpan: 5,  height: 440 },
  { id: "issue-status",   label: "Issue Status",   colSpan: 3,  height: 260 },
  { id: "approvals",      label: "Approvals",      colSpan: 5,  height: 260 },
  { id: "live-activity",  label: "Live Activity",  colSpan: 4,  height: 260 },
  { id: "open-prs",       label: "Open PRs",       colSpan: 12, height: 240 },
  { id: "token-usage",    label: "Token Usage",    colSpan: 3,  height: 280 },
  { id: "issues",         label: "Issues",         colSpan: 9,  height: 280 },
];

const LAYOUT_STORAGE_KEY = "crewspace:dashboard:panel-order";

function loadPanelOrder(): string[] {
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      const validIds = new Set(PANEL_DEFS.map((p) => p.id));
      const filtered = parsed.filter((id) => validIds.has(id));
      const missing = PANEL_DEFS.map((p) => p.id).filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    }
  } catch { /* ignore */ }
  return PANEL_DEFS.map((p) => p.id);
}

function savePanelOrder(order: string[]) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(order));
}

// ── Panel size overrides ────────────────────────────────────────────────────

interface PanelSizeOverride {
  colSpan?: number;
  height?: number;
}

const LAYOUT_SIZES_KEY = "crewspace:dashboard:panel-sizes";

function loadPanelSizes(): Record<string, PanelSizeOverride> {
  try {
    const saved = localStorage.getItem(LAYOUT_SIZES_KEY);
    if (saved) return JSON.parse(saved) as Record<string, PanelSizeOverride>;
  } catch { /* ignore */ }
  return {};
}

function savePanelSizes(sizes: Record<string, PanelSizeOverride>) {
  localStorage.setItem(LAYOUT_SIZES_KEY, JSON.stringify(sizes));
}

function SortablePanel({
  id,
  colSpan,
  height,
  label,
  isEditMode,
  containerStyle,
  children,
  onColSpanChange,
  onHeightChange,
}: {
  id: string;
  colSpan: number;
  height: number;
  label: string;
  isEditMode: boolean;
  containerStyle: React.CSSProperties;
  children: React.ReactNode;
  onColSpanChange?: (id: string, colSpan: number) => void;
  onHeightChange?: (id: string, height: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  return (
    <div
      ref={setNodeRef}
      data-panel-id={id}
      style={{
        gridColumn: `span ${colSpan}`,
        height,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        position: "relative",
        ...containerStyle,
      }}
      {...(isEditMode ? attributes : {})}
    >
      {isDragging && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
          border: "2px dashed rgba(129,140,248,0.3)",
          background: "rgba(129,140,248,0.04)",
        }} />
      )}
      {isEditMode && (
        <div
          {...listeners}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            cursor: isDragging ? "grabbing" : "grab",
            borderRadius: "inherit",
            border: "2px dashed rgba(129,140,248,0.4)",
            background: "rgba(129,140,248,0.04)",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "10px 10px 20px",
            pointerEvents: "none",
          }}
        >
          {/* Top-right: grip label */}
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(129,140,248,0.18)",
            border: "1px solid rgba(129,140,248,0.3)",
            borderRadius: 6,
            padding: "4px 9px",
            fontSize: 10, fontWeight: 700, color: "#818cf8",
            backdropFilter: "blur(6px)",
            userSelect: "none",
            pointerEvents: "auto",
          }}>
            <GripVertical size={11} />
            {label}
          </span>
          {/* Bottom-left: width presets */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", gap: 4, alignItems: "center", pointerEvents: "auto", marginRight: "auto" }}
          >
            <span style={{ fontSize: 9, color: "rgba(129,140,248,0.6)", marginRight: 2, userSelect: "none" }}>W:</span>
            {[3, 4, 6, 8, 9, 12].map(cols => (
              <button
                key={cols}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onColSpanChange?.(id, cols); }}
                style={{
                  padding: "2px 5px",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 4,
                  background: colSpan === cols ? "rgba(129,140,248,0.35)" : "rgba(129,140,248,0.1)",
                  border: `1px solid ${colSpan === cols ? "rgba(129,140,248,0.6)" : "rgba(129,140,248,0.2)"}`,
                  color: colSpan === cols ? "#a5b4fc" : "rgba(129,140,248,0.6)",
                  cursor: "pointer",
                  lineHeight: 1.4,
                }}
              >
                {cols === 12 ? "full" : `${cols}/12`}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Height resize handle */}
      {isEditMode && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startY = e.clientY;
            const startH = height;
            const onMove = (ev: MouseEvent) => {
              const newH = Math.max(160, Math.round(startH + ev.clientY - startY));
              onHeightChange?.(id, newH);
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 48,
            height: 12,
            cursor: "ns-resize",
            zIndex: 25,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 3,
          }}
        >
          <div style={{ width: 32, height: 3, borderRadius: 2, background: "rgba(129,140,248,0.5)" }} />
        </div>
      )}
      {children}
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
  const [panelOrder, setPanelOrder] = useState<string[]>(loadPanelOrder);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePanelRect, setActivePanelRect] = useState<DOMRect | null>(null);
  const [panelSizes, setPanelSizes] = useState<Record<string, PanelSizeOverride>>(loadPanelSizes);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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
    // Live token counts — poll every 5s so token panel reflects in-flight agent work
    refetchInterval: 5_000,
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

  // Issues for the issues panel — fetch open + in-progress + blocked
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "dashboard", selectedProjectId],
    queryFn: () => issuesApi.list(selectedCompanyId!, {
      ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
    }),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
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

  const orderedPanelDefs = useMemo(
    () => panelOrder.map((id) => PANEL_DEFS.find((p) => p.id === id)!).filter(Boolean),
    [panelOrder],
  );

  const getPanelColSpan = useCallback((def: PanelDef) => panelSizes[def.id]?.colSpan ?? def.colSpan, [panelSizes]);
  const getPanelHeight = useCallback((def: PanelDef) => panelSizes[def.id]?.height ?? def.height, [panelSizes]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const el = document.querySelector(`[data-panel-id="${event.active.id}"]`);
    if (el) setActivePanelRect(el.getBoundingClientRect());
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActivePanelRect(null);
    if (over && active.id !== over.id) {
      setPanelOrder((order) => {
        const oldIndex = order.indexOf(active.id as string);
        const newIndex = order.indexOf(over.id as string);
        return arrayMove(order, oldIndex, newIndex);
      });
    }
  }, []);

  const lockLayout = useCallback(() => {
    savePanelOrder(panelOrder);
    savePanelSizes(panelSizes);
    setIsEditMode(false);
  }, [panelOrder, panelSizes]);

  const resetLayout = useCallback(() => {
    const defaultOrder = PANEL_DEFS.map((p) => p.id);
    setPanelOrder(defaultOrder);
    setPanelSizes({});
    savePanelOrder(defaultOrder);
    savePanelSizes({});
  }, []);

  const handleColSpanChange = useCallback((panelId: string, colSpan: number) => {
    setPanelSizes(prev => ({ ...prev, [panelId]: { ...prev[panelId], colSpan } }));
  }, []);

  const handleHeightChange = useCallback((panelId: string, height: number) => {
    setPanelSizes(prev => ({ ...prev, [panelId]: { ...prev[panelId], height } }));
  }, []);

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

      {/* ── Toolbar: project picker + layout controls ─────────────────── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {projects && projects.length > 0 && (
          <>
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
          </>
        )}

        {/* Edit layout controls — always at far right */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {isEditMode ? (
            <>
              <button
                onClick={resetLayout}
                style={{
                  padding: "5px 11px", fontSize: 10, fontWeight: 600, borderRadius: 7,
                  background: "transparent",
                  border: `1px solid ${tk.cardBorder}`,
                  color: tk.textMuted, cursor: "pointer",
                }}
              >
                Reset
              </button>
              <button
                onClick={lockLayout}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", fontSize: 10, fontWeight: 700, borderRadius: 7,
                  background: "rgba(93,184,114,0.15)",
                  border: "1px solid rgba(93,184,114,0.35)",
                  color: "#5db872", cursor: "pointer",
                }}
              >
                🔒 Lock Layout
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", fontSize: 10, fontWeight: 600, borderRadius: 7,
                background: tk.cardBg,
                border: `1px solid ${tk.cardBorder}`,
                color: tk.textMuted, cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              <GripVertical size={11} />
              Edit Layout
            </button>
          )}
        </div>
      </div>

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

      {/* ── KPI strip (always top, not draggable) ────────────────────── */}
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

      {/* ── Draggable panel grid ──────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={panelOrder} strategy={rectSortingStrategy}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: 10,
            alignItems: "start",
          }}>
            {orderedPanelDefs.map((def) => {
              const isGlobe = def.id === "globe";
              const containerStyle: React.CSSProperties = isGlobe
                ? {
                    overflow: "hidden",
                    borderRadius: 14,
                    border: `1px solid ${tk.cardBorder}`,
                    background: isDark ? "rgba(10,9,8,0.7)" : "rgba(245,244,240,0.85)",
                  }
                : { overflow: "hidden", ...glassmorphismStyle };

              return (
                <SortablePanel
                  key={def.id}
                  id={def.id}
                  colSpan={getPanelColSpan(def)}
                  height={getPanelHeight(def)}
                  label={def.label}
                  isEditMode={isEditMode}
                  containerStyle={containerStyle}
                  onColSpanChange={handleColSpanChange}
                  onHeightChange={handleHeightChange}
                >
                  {def.id === "globe" && (
                    <>
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
                    </>
                  )}
                  {def.id === "agent-sessions" && (
                    <AgentSessionsPanel
                      agents={agents ?? []}
                      agentBurnToday={data?.agentBurnToday ?? []}
                      liveRuns={liveRuns ?? []}
                      workingAgentIds={workingAgentIds}
                      isDark={isDark}
                      onWakeup={(id) => wakeupMutation.mutate(id)}
                      onPause={(id) => pauseMutation.mutate(id)}
                    />
                  )}
                  {def.id === "issue-status" && (
                    <IssueStatusPanel
                      open={data?.tasks.open ?? 0}
                      inProgress={data?.tasks.inProgress ?? 0}
                      done={data?.tasks.done ?? 0}
                      blocked={blockedCount}
                      isDark={isDark}
                    />
                  )}
                  {def.id === "approvals" && (
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
                  )}
                  {def.id === "live-activity" && (
                    <LiveActivityPanel
                      liveRuns={liveRuns ?? []}
                      recentCompleted={recentActivity}
                      isDark={isDark}
                    />
                  )}
                  {def.id === "open-prs" && (
                    <OpenPRsPanel
                      pulls={pullsList}
                      isLoading={pullsLoading}
                      noRepo={!!noRepoPulls}
                      noProject={!selectedProjectId}
                      isDark={isDark}
                      companyId={selectedCompanyId!}
                      projectId={selectedProjectId}
                    />
                  )}
                  {def.id === "token-usage" && (
                    <TokenUsagePanel
                      tokensCumulative={data?.costs.tokensCumulative ?? { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 }}
                      tokensToday={data?.costs.tokensToday ?? { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 }}
                      todaySpendCents={data?.costs.todaySpendCents ?? 0}
                      isDark={isDark}
                    />
                  )}
                  {def.id === "issues" && (
                    <IssuesPanelDashboard
                      issues={issuesData ?? []}
                      isLoading={issuesLoading}
                      isDark={isDark}
                      selectedProjectId={selectedProjectId}
                      onIssueClick={() => {}}
                    />
                  )}
                </SortablePanel>
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
          {activeId && activePanelRect ? (
            <div style={{
              width: activePanelRect.width,
              height: activePanelRect.height,
              borderRadius: 12,
              background: tk.cardBg,
              border: `1px solid rgba(129,140,248,0.5)`,
              backdropFilter: "blur(16px)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(129,140,248,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
              opacity: 0.92,
              cursor: "grabbing",
              overflow: "hidden",
            }}>
              <GripVertical size={20} style={{ color: "#818cf8", opacity: 0.7 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: tk.text, letterSpacing: "-0.01em" }}>
                {PANEL_DEFS.find(p => p.id === activeId)?.label}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

    </div>
  );
}
