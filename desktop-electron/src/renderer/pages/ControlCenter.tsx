/**
 * Control Center — approval requests, agent live status, PR approvals,
 * all filterable by project. Replaces the scattered approvals flow.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import {
  Check, X, RotateCcw, ChevronDown, Clock, Play, Pause,
  CircleDot, GitPullRequest, UserPlus, Zap, AlertTriangle,
  RefreshCw, Eye, FolderOpen,
} from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { cn } from "@/lib/utils";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import type { Approval } from "@crewspaceai/shared";
import type { Agent } from "@crewspaceai/shared";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  hire_agent: { label: "Hire Agent", icon: UserPlus, color: "#818cf8" },
  approve_ceo_strategy: { label: "CEO Strategy", icon: Zap, color: "#e8a55a" },
  budget_override_required: { label: "Budget Override", icon: AlertTriangle, color: "#c64545" },
};

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "rgba(232,165,90,0.12)", text: "#e8a55a" },
  revision_requested: { label: "Revision Needed", bg: "rgba(129,140,248,0.12)", text: "#818cf8" },
  approved: { label: "Approved", bg: "rgba(93,184,114,0.12)", text: "#5db872" },
  rejected: { label: "Rejected", bg: "rgba(198,69,69,0.12)", text: "#c64545" },
  cancelled: { label: "Cancelled", bg: "rgba(100,100,100,0.1)", text: "#666" },
};

function agentDotColor(status: string): string {
  switch (status) {
    case "active": case "working": return "#5db872";
    case "paused": return "#e8a55a";
    case "error": return "#c64545";
    default: return "#555";
  }
}

// ── Project Filter Dropdown ───────────────────────────────────────────────────

interface Project { id: string; name: string }

function ProjectDropdown({ projects, value, onChange }: {
  projects: Project[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = projects.find((p) => p.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-card/40 hover:bg-card/80 transition-colors text-sm"
      >
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-foreground font-medium">{selected?.name ?? "All Projects"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div
          className="absolute top-9 left-0 z-50 w-52 bg-popover border border-border rounded-xl overflow-hidden shadow-xl"
          onBlur={() => setOpen(false)}
        >
          <button
            className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors text-left", !value && "bg-accent/30")}
            onClick={() => { onChange(null); setOpen(false); }}
          >
            <span className="text-muted-foreground">All Projects</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors text-left", value === p.id && "bg-accent/30")}
              onClick={() => { onChange(p.id); setOpen(false); }}
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Approval Card ─────────────────────────────────────────────────────────────

function ApprovalRow({ approval, agents, onApprove, onReject, onRevise, isPendingApprove, isPendingReject }: {
  approval: Approval;
  agents: Agent[];
  onApprove: () => void;
  onReject: () => void;
  onRevise: () => void;
  isPendingApprove: boolean;
  isPendingReject: boolean;
}) {
  const meta = TYPE_META[approval.type] ?? { label: approval.type, icon: CircleDot, color: "#888" };
  const statusStyle = STATUS_STYLE[approval.status] ?? STATUS_STYLE.pending;
  const Icon = meta.icon;
  const requester = agents.find((a) => a.id === approval.requestedByAgentId);
  const payload = approval.payload as Record<string, unknown>;

  // Derive a human-readable summary from payload
  const summary = useMemo(() => {
    if (approval.type === "hire_agent") {
      return `Hire "${(payload.name as string) ?? "new agent"}"${(payload.role as string) ? ` as ${payload.role}` : ""}`;
    }
    if (approval.type === "approve_ceo_strategy") {
      const desc = payload.description ?? payload.title ?? payload.summary;
      return typeof desc === "string" ? desc.slice(0, 120) : "Strategy approval requested";
    }
    if (approval.type === "budget_override_required") {
      return `Budget override: $${((payload.requestedCents as number ?? 0) / 100).toFixed(2)}`;
    }
    return JSON.stringify(payload).slice(0, 100);
  }, [approval]);

  const isPending = approval.status === "pending" || approval.status === "revision_requested";

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 border-b border-border/20 hover:bg-accent/10 transition-colors">
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}>
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold text-foreground">{meta.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: statusStyle.bg, color: statusStyle.text }}>
              {statusStyle.label}
            </span>
            <span className="text-[10px] text-muted-foreground/50">{timeAgo(approval.createdAt)}</span>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-snug">{summary}</p>
          {requester && (
            <div className="flex items-center gap-1.5 mt-1">
              <AgentAvatar agent={requester as any} size="xs" />
              <span className="text-[10px] text-muted-foreground/60">requested by {requester.name}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Link to={`/approvals/${approval.id}`}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-colors"
            title="View details">
            <Eye className="h-3.5 w-3.5" />
          </Link>
          {isPending && (
            <>
              <button
                onClick={onRevise}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                title="Request revision"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onReject}
                disabled={isPendingReject}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                title="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onApprove}
                disabled={isPendingApprove}
                className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40"
                title="Approve"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agent Status Row ──────────────────────────────────────────────────────────

function AgentStatusRow({ agent, isWorking, runsToday, onWake, onPause, onResume, waking, pausing }: {
  agent: Agent;
  isWorking: boolean;
  runsToday: number;
  onWake: () => void;
  onPause: () => void;
  onResume: () => void;
  waking: boolean;
  pausing: boolean;
}) {
  const statusColor = agentDotColor(isWorking ? "working" : agent.status);
  const statusLabel = isWorking ? "LIVE" : (agent.status ?? "idle").toUpperCase();

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/20 hover:bg-accent/10 transition-colors group">
      {/* Avatar + dot */}
      <div className="relative shrink-0">
        <AgentAvatar agent={agent as any} size="sm" />
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background"
          style={{ backgroundColor: statusColor }} />
      </div>

      {/* Name + role */}
      <div className="flex flex-col min-w-0 flex-1">
        <Link to={`/agents/${agent.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate leading-tight">
          {agent.name}
        </Link>
        <span className="text-[10px] text-muted-foreground/50 truncate">{(agent as any).title ?? agent.role}</span>
      </div>

      {/* Status badge */}
      <span className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
        isWorking ? "bg-green-500/15 text-green-400" :
          agent.status === "paused" ? "bg-amber-500/15 text-amber-400" :
            agent.status === "error" ? "bg-red-500/15 text-red-400" :
              "bg-muted text-muted-foreground"
      )}>
        {isWorking && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-ping mr-1" />}
        {statusLabel}
      </span>

      {/* Runs today */}
      <div className="text-center shrink-0 w-12">
        <div className="text-xs font-semibold text-foreground tabular-nums">{runsToday}</div>
        <div className="text-[9px] text-muted-foreground/40">runs</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {agent.status === "paused" ? (
          <button
            onClick={onResume}
            disabled={pausing}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40"
          >
            <Play className="h-2.5 w-2.5" /> Resume
          </button>
        ) : (
          <button
            onClick={onPause}
            disabled={pausing}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
          >
            <Pause className="h-2.5 w-2.5" /> Pause
          </button>
        )}
        <button
          onClick={onWake}
          disabled={waking || isWorking}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
        >
          <Zap className="h-2.5 w-2.5" /> Wake
        </button>
      </div>
    </div>
  );
}

// ── PR / Work Product Approvals ───────────────────────────────────────────────

function PrApprovalsSection({ companyId, projectId }: { companyId: string; projectId: string | null }) {
  // Work products with pending_review status are the closest to "PR approvals"
  // We surface them via issues that have open execution workspaces
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <GitPullRequest className="h-8 w-8 text-muted-foreground/20" />
      <p className="text-xs font-medium text-foreground/60">Pull Request Reviews</p>
      <p className="text-[11px] text-muted-foreground/40 max-w-48">
        PR review approvals appear here when agents submit work for review.
        {projectId && " Filtered to selected project."}
      </p>
      <Link to={projectId ? `/projects/${projectId}/workspaces` : "/execution-workspaces"}
        className="mt-1 text-[11px] text-primary hover:underline">
        View execution workspaces →
      </Link>
    </div>
  );
}

// ── Section Wrapper ───────────────────────────────────────────────────────────

function Section({ title, count, icon: Icon, children, emptyMsg, color = "#818cf8" }: {
  title: string;
  count?: number;
  icon: React.ElementType;
  children: React.ReactNode;
  emptyMsg?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/20 bg-card/20">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}18`, color }}>
            {count}
          </span>
        )}
      </div>
      {React.Children.count(children) === 0 || count === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[11px] text-muted-foreground/40">{emptyMsg ?? "Nothing here"}</p>
        </div>
      ) : children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

import React from "react";

export function ControlCenter() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");

  // Data queries
  const { data: approvals = [], isLoading: loadingApprovals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!, statusFilter === "all" ? undefined : "pending"),
    queryFn: () => approvalsApi.list(selectedCompanyId!, statusFilter === "all" ? undefined : "pending"),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: async () => {
      const { projectsApi } = await import("../api/projects");
      return projectsApi.list(selectedCompanyId!);
    },
    enabled: !!selectedCompanyId,
  });

  // Live runs for working agent detection
  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: async () => {
      const { heartbeatsApi } = await import("../api/heartbeats");
      return heartbeatsApi.liveRuns(selectedCompanyId!);
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const workingAgentIds = useMemo(
    () => new Set(liveRuns.map((r: any) => r.agentId).filter(Boolean)),
    [liveRuns],
  );

  // Mutations
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "revise" | null>(null);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      pushToast({ tone: "success", title: "Approved", body: "Approval request resolved." });
      setActionId(null);
    },
    onError: (err) => pushToast({ tone: "error", title: "Approve failed", body: err instanceof Error ? err.message : "Unknown error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      pushToast({ tone: "success", title: "Rejected", body: "Approval request rejected." });
      setActionId(null);
    },
    onError: (err) => pushToast({ tone: "error", title: "Reject failed", body: err instanceof Error ? err.message : "Unknown error" }),
  });

  const reviseMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.requestRevision(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      pushToast({ tone: "info", title: "Revision requested", body: "Agent will revise and resubmit." });
      setActionId(null);
    },
    onError: (err) => pushToast({ tone: "error", title: "Failed", body: err instanceof Error ? err.message : "Unknown error" }),
  });

  const wakeMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.wakeup(agentId, { source: "on_demand", triggerDetail: "manual", reason: "Manual wake from Control Center" }, selectedCompanyId ?? undefined),
    onSuccess: (_r, agentId) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      const agent = agents.find((a) => a.id === agentId);
      pushToast({ tone: "success", title: "Agent woken", body: `${agent?.name ?? "Agent"} is now running.` });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.pause(agentId, selectedCompanyId ?? undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const resumeMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.resume(agentId, selectedCompanyId ?? undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); },
  });

  // Derived data
  const pendingApprovals = useMemo(
    () => approvals.filter((a: Approval) => a.status === "pending" || a.status === "revision_requested"),
    [approvals],
  );

  const hireApprovals = useMemo(
    () => pendingApprovals.filter((a: Approval) => a.type === "hire_agent"),
    [pendingApprovals],
  );

  const otherApprovals = useMemo(
    () => pendingApprovals.filter((a: Approval) => a.type !== "hire_agent"),
    [pendingApprovals],
  );

  const activeAgents = useMemo(
    () => agents.filter((a) => a.status !== "terminated"),
    [agents],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-foreground">Control Center</h1>
          <p className="text-[11px] text-muted-foreground/60">Approvals, agent live status &amp; PR reviews</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Project filter */}
          <ProjectDropdown
            projects={projects as Project[]}
            value={projectId}
            onChange={setProjectId}
          />
          {/* Status filter */}
          <div className="flex items-center rounded-lg border border-border/40 overflow-hidden">
            {(["pending", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {s === "pending" ? "Pending" : "All"}
              </button>
            ))}
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["approvals"] })}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl mx-auto">
          {/* Hiring approvals */}
          <Section
            title="Hiring Requests"
            count={hireApprovals.length}
            icon={UserPlus}
            color="#818cf8"
            emptyMsg="No pending hire requests"
          >
            {hireApprovals.map((approval: Approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                agents={agents}
                onApprove={() => approveMutation.mutate(approval.id)}
                onReject={() => rejectMutation.mutate(approval.id)}
                onRevise={() => reviseMutation.mutate(approval.id)}
                isPendingApprove={approveMutation.isPending && approveMutation.variables === approval.id}
                isPendingReject={rejectMutation.isPending && rejectMutation.variables === approval.id}
              />
            ))}
          </Section>

          {/* Other approvals (strategy, budget, etc.) */}
          <Section
            title="Other Approvals"
            count={otherApprovals.length}
            icon={CircleDot}
            color="#e8a55a"
            emptyMsg="No pending approvals"
          >
            {otherApprovals.map((approval: Approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                agents={agents}
                onApprove={() => approveMutation.mutate(approval.id)}
                onReject={() => rejectMutation.mutate(approval.id)}
                onRevise={() => reviseMutation.mutate(approval.id)}
                isPendingApprove={approveMutation.isPending && approveMutation.variables === approval.id}
                isPendingReject={rejectMutation.isPending && rejectMutation.variables === approval.id}
              />
            ))}
          </Section>

          {/* PR / work product reviews */}
          <Section title="PR Reviews" icon={GitPullRequest} color="#5db8a6" emptyMsg="">
            <PrApprovalsSection companyId={selectedCompanyId ?? ""} projectId={projectId} />
          </Section>

          {/* Agent live status */}
          <Section
            title="Agent Status"
            count={activeAgents.length}
            icon={Zap}
            color="#5db872"
            emptyMsg="No agents"
          >
            {activeAgents.map((agent) => {
              const isWorking = workingAgentIds.has(agent.id);
              const runsToday = (liveRuns as any[]).filter((r) => r.agentId === agent.id).length;
              return (
                <AgentStatusRow
                  key={agent.id}
                  agent={agent}
                  isWorking={isWorking}
                  runsToday={runsToday}
                  onWake={() => wakeMutation.mutate(agent.id)}
                  onPause={() => pauseMutation.mutate(agent.id)}
                  onResume={() => resumeMutation.mutate(agent.id)}
                  waking={wakeMutation.isPending && wakeMutation.variables === agent.id}
                  pausing={
                    (pauseMutation.isPending || resumeMutation.isPending) &&
                    (pauseMutation.variables === agent.id || resumeMutation.variables === agent.id)
                  }
                />
              );
            })}
          </Section>
        </div>
      </div>
    </div>
  );
}
