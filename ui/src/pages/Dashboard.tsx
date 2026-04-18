import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";

import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, PauseCircle, CheckCircle2, XCircle, Clock, GitBranch, Zap, User } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import type { Agent, Issue, Approval, HeartbeatRun } from "@crewspaceai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "CEO Strategy",
  budget_override_required: "Budget Override",
};

const RUN_STATUS_COLORS: Record<string, string> = {
  running: "#3b82f6",
  succeeded: "#22c55e",
  failed: "#ef4444",
  cancelled: "#94a3b8",
  timed_out: "#f59e0b",
  queued: "#8b5cf6",
};

/** Build workflow execution timeline data from runs */
function buildWorkflowTimeline(runs: HeartbeatRun[], agents: Agent[]) {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000; // last 24h
  const windowStart = now - windowMs;

  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const agentOrder = [...new Set(runs.map((r) => r.agentId))];

  const filtered = runs.filter((r) => {
    const start = r.startedAt ? new Date(r.startedAt).getTime() : new Date(r.createdAt).getTime();
    return start >= windowStart;
  });

  return { filtered, agentOrder, agentMap, windowStart, windowEnd: now };
}

/** Canvas-drawn workflow execution graph */
function WorkflowGraph({ runs, agents }: { runs: HeartbeatRun[]; agents: Agent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 200 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; run: HeartbeatRun; agentName: string } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = size;
    const { filtered, agentOrder, agentMap, windowStart, windowEnd } = buildWorkflowTimeline(runs, agents);

    ctx.clearRect(0, 0, w, h);

    const PAD_LEFT = 110, PAD_RIGHT = 16, PAD_TOP = 24, PAD_BOTTOM = 28;
    const plotW = w - PAD_LEFT - PAD_RIGHT;
    const plotH = h - PAD_TOP - PAD_BOTTOM;
    const rowH = agentOrder.length > 0 ? Math.min(28, plotH / agentOrder.length) : 28;
    const barH = Math.max(6, rowH * 0.55);

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const labelColor = isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)";

    const timeToX = (ts: number) => PAD_LEFT + ((ts - windowStart) / (windowEnd - windowStart)) * plotW;

    // Time axis labels (6h intervals)
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = textColor;
    for (let i = 0; i <= 4; i++) {
      const ts = windowStart + (i / 4) * (windowEnd - windowStart);
      const x = timeToX(ts);
      const label = i === 4 ? "now" : `-${Math.round((4 - i) * 6)}h`;
      ctx.fillText(label, x - (i === 4 ? 12 : 8), h - 8);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP);
      ctx.lineTo(x, PAD_TOP + plotH);
      ctx.stroke();
    }

    // Draw rows
    agentOrder.forEach((agentId, rowIdx) => {
      const y = PAD_TOP + rowIdx * rowH;
      const agent = agentMap.get(agentId);
      const name = agent?.name ?? agentId.slice(0, 8);

      // Row label
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = labelColor;
      ctx.fillText(name.length > 12 ? name.slice(0, 11) + "…" : name, 4, y + rowH / 2 + 4);

      // Row background
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
      ctx.fillRect(PAD_LEFT, y + 2, plotW, rowH - 4);

      // Run bars
      filtered.filter((r) => r.agentId === agentId).forEach((run) => {
        const start = run.startedAt ? new Date(run.startedAt).getTime() : new Date(run.createdAt).getTime();
        const end = run.finishedAt ? new Date(run.finishedAt).getTime() : windowEnd;
        const x1 = Math.max(timeToX(start), PAD_LEFT);
        const x2 = Math.min(timeToX(end), PAD_LEFT + plotW);
        const bw = Math.max(x2 - x1, 3);
        const by = y + (rowH - barH) / 2;

        const color = RUN_STATUS_COLORS[run.status] ?? "#94a3b8";
        ctx.fillStyle = color;
        ctx.globalAlpha = run.status === "running" ? 0.9 : 0.65;
        ctx.beginPath();
        ctx.roundRect(x1, by, bw, barH, 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    });
  }, [runs, agents, size]);

  // Tooltip hit-test on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { w, h } = size;
    const { filtered, agentOrder, agentMap, windowStart, windowEnd } = buildWorkflowTimeline(runs, agents);
    const PAD_LEFT = 110, PAD_TOP = 24, PAD_BOTTOM = 28;
    const plotW = w - PAD_LEFT - 16;
    const plotH = h - PAD_TOP - PAD_BOTTOM;
    const rowH = agentOrder.length > 0 ? Math.min(28, plotH / agentOrder.length) : 28;
    const barH = Math.max(6, rowH * 0.55);
    const timeToX = (ts: number) => PAD_LEFT + ((ts - windowStart) / (windowEnd - windowStart)) * plotW;

    for (let rowIdx = 0; rowIdx < agentOrder.length; rowIdx++) {
      const agentId = agentOrder[rowIdx];
      const y = PAD_TOP + rowIdx * rowH;
      const by = y + (rowH - barH) / 2;
      if (my < by || my > by + barH) continue;
      for (const run of filtered.filter((r) => r.agentId === agentId)) {
        const start = run.startedAt ? new Date(run.startedAt).getTime() : new Date(run.createdAt).getTime();
        const end = run.finishedAt ? new Date(run.finishedAt).getTime() : windowEnd;
        const x1 = Math.max(timeToX(start), PAD_LEFT);
        const x2 = Math.min(timeToX(end), PAD_LEFT + plotW);
        if (mx >= x1 && mx <= Math.max(x2, x1 + 6)) {
          setTooltip({ x: mx, y: by, run, agentName: agentMap.get(agentId)?.name ?? agentId.slice(0, 8) });
          return;
        }
      }
    }
    setTooltip(null);
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: Math.max(120, Math.min(runs.length > 0 ? buildWorkflowTimeline(runs, agents).agentOrder.length * 32 + 52 : 120, 260)) }}>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="absolute inset-0 w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-popover border border-border text-popover-foreground text-xs rounded shadow-lg px-2.5 py-1.5 max-w-[220px]"
          style={{ left: Math.min(tooltip.x + 8, size.w - 230), top: Math.max(4, tooltip.y - 44) }}
        >
          <div className="font-medium truncate">{tooltip.agentName}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: RUN_STATUS_COLORS[tooltip.run.status] ?? "#94a3b8" }}
            />
            <span className="capitalize">{tooltip.run.status}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{tooltip.run.invocationSource}</span>
          </div>
          {tooltip.run.startedAt && (
            <div className="text-muted-foreground mt-0.5">{timeAgo(tooltip.run.startedAt)}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending"),
    queryFn: () => approvalsApi.list(selectedCompanyId!, "pending"),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const queryClient = useQueryClient();

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

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

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
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      {data && (
        <>
          {data.budgets.activeIncidents > 0 ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div>
                  <p className="text-sm font-medium text-red-50">
                    {data.budgets.activeIncidents} active budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-red-100/70">
                    {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused · {data.budgets.pendingApprovals} pending budget approvals
                  </p>
                </div>
              </div>
              <Link to="/costs" className="text-sm underline underline-offset-2 text-red-100">
                Open budgets
              </Link>
            </div>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
            <MetricCard
              icon={Bot}
              value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
              label="Agents Enabled"
              to="/agents"
              description={
                <span>
                  {data.agents.running} running{", "}
                  {data.agents.paused} paused{", "}
                  {data.agents.error} errors
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              to="/issues"
              description={
                <span>
                  {data.tasks.open} open{", "}
                  {data.tasks.blocked} blocked
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              to="/costs"
              description={
                <span>
                  {data.costs.monthBudgetCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
                    : "Unlimited budget"}
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals + data.budgets.pendingApprovals}
              label="Pending Approvals"
              to="/approvals"
              description={
                <span>
                  {data.budgets.pendingApprovals > 0
                    ? `${data.budgets.pendingApprovals} budget overrides awaiting board review`
                    : "Awaiting board review"}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ChartCard title="Run Activity" subtitle="Last 14 days">
              <RunActivityChart runs={runs ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Priority" subtitle="Last 14 days">
              <PriorityChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Status" subtitle="Last 14 days">
              <IssueStatusChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Success Rate" subtitle="Last 14 days">
              <SuccessRateChart runs={runs ?? []} />
            </ChartCard>
          </div>

          {/* ── Workflow Execution Graph ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                Workflow Executions
                <span className="text-xs font-normal normal-case text-muted-foreground/60">· last 24h</span>
              </h3>
              {(runs ?? []).filter((r) => r.status === "running").length > 0 && (
                <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  {(runs ?? []).filter((r) => r.status === "running").length} live
                </span>
              )}
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              {runs && runs.length > 0 && agents && agents.length > 0 ? (
                <WorkflowGraph runs={runs} agents={agents} />
              ) : (
                <div className="h-[80px] flex items-center justify-center text-sm text-muted-foreground">
                  No executions in the last 24 hours
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 flex-wrap">
                {(["running", "succeeded", "failed", "queued", "cancelled", "timed_out"] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RUN_STATUS_COLORS[s] }} />
                    <span className="capitalize">{s.replace("_", " ")}</span>
                    <span className="text-muted-foreground/50">
                      ({(runs ?? []).filter((r) => r.status === s).length})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Pending Approvals Panel ── */}
          {(pendingApprovals?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Pending Approvals
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold px-1.5 py-px min-w-[18px]">
                    {pendingApprovals!.length}
                  </span>
                </h3>
                <Link to="/approvals" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                  View all
                </Link>
              </div>
              <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {pendingApprovals!.slice(0, 5).map((approval) => {
                  const agentName = agents?.find((a) => a.id === approval.requestedByAgentId)?.name;
                  const isApproving = approveMutation.isPending && approveMutation.variables === approval.id;
                  const isRejecting = rejectMutation.isPending && rejectMutation.variables === approval.id;
                  return (
                    <div key={approval.id} className="flex items-start gap-3 px-4 py-3 bg-card hover:bg-accent/30 transition-colors">
                      <div className="mt-0.5 flex-shrink-0">
                        <Clock className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium px-1.5 py-px rounded bg-muted text-muted-foreground">
                            {APPROVAL_TYPE_LABELS[approval.type] ?? approval.type}
                          </span>
                          {agentName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Zap className="h-3 w-3" />
                              {agentName}
                            </span>
                          )}
                          {approval.requestedByUserId && !agentName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              User
                            </span>
                          )}
                        </div>
                        {approval.payload && Object.keys(approval.payload).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {(approval.payload as Record<string, unknown>).reason as string
                              ?? (approval.payload as Record<string, unknown>).description as string
                              ?? JSON.stringify(approval.payload).slice(0, 80)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo(approval.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <button
                          onClick={() => approveMutation.mutate(approval.id)}
                          disabled={isApproving || isRejecting}
                          className={cn(
                            "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                            "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20",
                            (isApproving || isRejecting) && "opacity-50 pointer-events-none"
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isApproving ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(approval.id)}
                          disabled={isApproving || isRejecting}
                          className={cn(
                            "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                            "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20",
                            (isApproving || isRejecting) && "opacity-50 pointer-events-none"
                          )}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {isRejecting ? "…" : "Reject"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {pendingApprovals!.length > 5 && (
                  <Link
                    to="/approvals"
                    className="block px-4 py-2.5 text-xs text-center text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors no-underline"
                  >
                    + {pendingApprovals!.length - 5} more pending approvals
                  </Link>
                )}
              </div>
            </div>
          )}

          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: selectedCompanyId }}
            className="grid gap-4 md:grid-cols-2"
            itemClassName="rounded-lg border bg-card p-4 shadow-sm"
          />

          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentActivity.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className={animatedActivityIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Tasks */}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Tasks
              </h3>
              {recentIssues.length === 0 ? (
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentIssues.slice(0, 10).map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                    >
                      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                        {/* Status icon - left column on mobile */}
                        <span className="shrink-0 sm:hidden">
                          <StatusIcon status={issue.status} />
                        </span>

                        {/* Right column on mobile: title + metadata stacked */}
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span className="hidden sm:inline-flex"><StatusIcon status={issue.status} /></span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeAgentId && (() => {
                              const name = agentName(issue.assigneeAgentId);
                              return name
                                ? <span className="hidden sm:inline-flex"><Identity name={name} size="sm" /></span>
                                : null;
                            })()}
                            <span className="text-xs text-muted-foreground sm:hidden">&middot;</span>
                            <span className="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {timeAgo(issue.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
