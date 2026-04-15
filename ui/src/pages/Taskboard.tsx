import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CircleDot, Circle, Clock, CheckCircle2, XCircle, Loader2,
  Eye, Ban, RefreshCw, ChevronDown, ChevronUp, Plus, ArrowRight,
  Zap, Calendar, Flag, ChevronRight, Trash2, X,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { sprintsApi } from "../api/sprints";
import type { Sprint } from "../api/sprints";
import { queryKeys } from "../lib/queryKeys";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Issue, Agent } from "@crewspaceai/shared";
import { CreateTaskDialog } from "../components/CreateTaskDialog";
import { SprintBurndownChart, AgentBurndownChart, SprintProgressRing } from "../components/SprintCharts";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; border: string; header: string; cardBg: string; badge: string }> = {
  backlog: { label: "Backlog", icon: <Circle className="h-3.5 w-3.5 text-muted-foreground" />, border: "border-border", header: "bg-muted/30", cardBg: "bg-card hover:bg-accent/30", badge: "bg-muted text-muted-foreground" },
  todo: { label: "Todo", icon: <CircleDot className="h-3.5 w-3.5 text-blue-500" />, border: "border-blue-200 dark:border-blue-900/50", header: "bg-blue-50 dark:bg-blue-950/30", cardBg: "bg-card hover:bg-blue-50/50 dark:hover:bg-blue-950/10", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  in_progress: { label: "In Progress", icon: <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin" />, border: "border-yellow-200 dark:border-yellow-900/50", header: "bg-yellow-50 dark:bg-yellow-950/30", cardBg: "bg-card hover:bg-yellow-50/50 dark:hover:bg-yellow-950/10", badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  in_review: { label: "In Review", icon: <Eye className="h-3.5 w-3.5 text-violet-500" />, border: "border-violet-200 dark:border-violet-900/50", header: "bg-violet-50 dark:bg-violet-950/30", cardBg: "bg-card hover:bg-violet-50/50 dark:hover:bg-violet-950/10", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  blocked: { label: "Blocked", icon: <Ban className="h-3.5 w-3.5 text-red-500" />, border: "border-red-200 dark:border-red-900/50", header: "bg-red-50 dark:bg-red-950/30", cardBg: "bg-card hover:bg-red-50/50 dark:hover:bg-red-950/10", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  done: { label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />, border: "border-green-200 dark:border-green-900/50", header: "bg-green-50 dark:bg-green-950/30", cardBg: "bg-card hover:bg-green-50/50 dark:hover:bg-green-950/10", badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-3.5 w-3.5 text-neutral-400" />, border: "border-border", header: "bg-muted/20", cardBg: "bg-card hover:bg-accent/20 opacity-60", badge: "bg-muted text-muted-foreground" },
};

const COLUMN_ORDER = ["backlog", "todo", "in_progress", "done"];

const SPRINT_STATUS_CONFIG = {
  upcoming: { label: "Upcoming", dot: "bg-muted-foreground" },
  active: { label: "Active", dot: "bg-emerald-500" },
  completed: { label: "Completed", dot: "bg-blue-500" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function priorityColor(p: string) {
  return ({ critical: "text-red-500", high: "text-orange-500", medium: "text-yellow-500", low: "text-blue-400" } as Record<string, string>)[p] ?? "text-muted-foreground";
}
function priorityLabel(p: string) {
  return ({ critical: "!", high: "↑", medium: "–", low: "↓" } as Record<string, string>)[p] ?? "–";
}
function timeAgo(d: string | Date | null | undefined) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
function agentInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function formatDate(s: string | null | undefined) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Delegation Badge ───────────────────────────────────────────────────────────

function DelegationBadge({ issue, agentMap }: { issue: Issue; agentMap: Map<string, Agent> }) {
  const isDelegated = issue.createdByAgentId !== null && issue.assigneeAgentId !== null && issue.createdByAgentId !== issue.assigneeAgentId;
  const assigneeAgent = issue.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : null;
  const creatorAgent = issue.createdByAgentId ? agentMap.get(issue.createdByAgentId) : null;

  if (isDelegated && creatorAgent && assigneeAgent) {
    return (
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 leading-tight">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-violet-300 dark:bg-violet-700 text-[7px] font-bold shrink-0" title={creatorAgent.name}>{agentInitials(creatorAgent.name)}</span>
          <ArrowRight className="h-2 w-2 shrink-0" />
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-violet-300 dark:bg-violet-700 text-[7px] font-bold shrink-0" title={assigneeAgent.name}>{agentInitials(assigneeAgent.name)}</span>
          <span className="ml-0.5 truncate max-w-[80px]">{creatorAgent.name} → {assigneeAgent.name}</span>
        </span>
        {(issue.requestDepth ?? 0) > 0 && <span className="text-[9px] px-1 py-0.5 rounded-full bg-muted text-muted-foreground">depth {issue.requestDepth}</span>}
      </div>
    );
  }
  if (assigneeAgent) {
    return (
      <div className="mt-1.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground leading-tight">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-border text-[7px] font-bold shrink-0">{agentInitials(assigneeAgent.name)}</span>
          <span className="truncate max-w-[100px]">{assigneeAgent.name}</span>
        </span>
      </div>
    );
  }
  if (issue.createdByAgentId && creatorAgent) {
    return (
      <div className="mt-1.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 leading-tight">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-300 dark:bg-amber-700 text-[7px] font-bold shrink-0">{agentInitials(creatorAgent.name)}</span>
          <span className="truncate max-w-[100px]">by {creatorAgent.name}</span>
        </span>
      </div>
    );
  }
  return null;
}

// ── Inline Create Form ─────────────────────────────────────────────────────────

function CreateTaskInline({ status, companyId, onCreated, onCancel }: { status: string; companyId: string; onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  useEffect(() => { inputRef.current?.focus(); }, []);

  const createMutation = useMutation({
    mutationFn: (t: string) => issuesApi.create(companyId, { title: t, status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) }); onCreated(); },
  });

  return (
    <div className="p-2 border-t border-border">
      <input ref={inputRef} value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) createMutation.mutate(title.trim()); if (e.key === "Escape") onCancel(); }}
        placeholder="Task title…" disabled={createMutation.isPending}
        className="w-full text-xs rounded border border-border bg-background px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60" />
      <div className="flex items-center gap-1 mt-1.5">
        <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => title.trim() && createMutation.mutate(title.trim())} disabled={!title.trim() || createMutation.isPending}>
          {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 text-muted-foreground" onClick={onCancel} disabled={createMutation.isPending}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Issue Card ─────────────────────────────────────────────────────────────────

function IssueCard({ issue, agentMap }: { issue: Issue; agentMap: Map<string, Agent> }) {
  const cfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.backlog;
  return (
    <Link to={`/issues/${issue.identifier}`} className="block">
      <div className={cn("rounded-md border px-3 py-2.5 transition-colors cursor-pointer", cfg.border, cfg.cardBg)}>
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{issue.identifier}</span>
          <span className={cn("text-[10px] font-bold shrink-0", priorityColor(issue.priority))}>{priorityLabel(issue.priority)}</span>
        </div>
        <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{issue.title}</p>
        <DelegationBadge issue={issue} agentMap={agentMap} />
        {issue.updatedAt && (
          <p className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />{timeAgo(issue.updatedAt)}
          </p>
        )}
      </div>
    </Link>
  );
}

// ── Column ─────────────────────────────────────────────────────────────────────

function Column({ status, issues, agentMap, companyId, collapsed, onToggleCollapse }: {
  status: string; issues: Issue[]; agentMap: Map<string, Agent>; companyId: string;
  collapsed: boolean; onToggleCollapse: () => void;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog;
  const [creating, setCreating] = useState(false);

  return (
    <div className={cn("flex flex-col rounded-lg border min-w-0 transition-all", cfg.border, collapsed ? "w-10 shrink-0" : "w-56 shrink-0")}>
      <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-t-lg border-b shrink-0", cfg.header, cfg.border)}>
        {collapsed ? (
          <button onClick={onToggleCollapse} className="flex flex-col items-center gap-1.5 w-full">
            <span className="text-[10px] font-medium text-foreground [writing-mode:vertical-rl] rotate-180">{cfg.label}</span>
            <span className={cn("text-[9px] px-1 py-0.5 rounded font-medium", cfg.badge)}>{issues.length}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground mt-1" />
          </button>
        ) : (
          <>
            <button onClick={onToggleCollapse} className="flex items-center gap-2 flex-1 text-left min-w-0">
              {cfg.icon}
              <span className="text-xs font-semibold text-foreground flex-1 truncate">{cfg.label}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums", cfg.badge)}>{issues.length}</span>
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setCreating(true); }} className="ml-1 shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title={`Add to ${cfg.label}`}>
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto flex flex-col min-h-[60px]">
          <div className="flex-1 p-2 flex flex-col gap-1.5">
            {issues.length === 0 && !creating ? (
              <div className="flex items-center justify-center py-6">
                <p className="text-[11px] text-muted-foreground/50">No issues</p>
              </div>
            ) : (
              issues.map((issue) => <IssueCard key={issue.id} issue={issue} agentMap={agentMap} />)
            )}
          </div>
          {creating && <CreateTaskInline status={status} companyId={companyId} onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />}
          {!creating && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30 transition-colors rounded-b-lg">
              <Plus className="h-3 w-3" /> Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sprint Panel ───────────────────────────────────────────────────────────────

function SprintPanel({ companyId, selectedSprintId, onSelectSprint, onClose }: {
  companyId: string; selectedSprintId: string | null;
  onSelectSprint: (id: string | null) => void; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ["sprints", companyId],
    queryFn: () => sprintsApi.list(companyId),
    staleTime: 15_000,
  });

  const { data: burndown } = useQuery({
    queryKey: ["sprint-burndown", expandedId],
    queryFn: () => sprintsApi.burndown(expandedId!),
    enabled: !!expandedId,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; goal?: string; startDate?: string; endDate?: string }) =>
      sprintsApi.create(companyId, { ...data, status: "upcoming" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", companyId] });
      setCreating(false); setNewName(""); setNewGoal(""); setNewStart(""); setNewEnd("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string }) =>
      sprintsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", companyId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sprintsApi.delete(id),
    onSuccess: (_: unknown, id: string) => {
      queryClient.invalidateQueries({ queryKey: ["sprints", companyId] });
      if (selectedSprintId === id) onSelectSprint(null);
    },
  });

  const statusOrder = ["active", "upcoming", "completed"] as const;
  const grouped = useMemo(() => {
    const m = new Map<string, Sprint[]>();
    for (const s of statusOrder) m.set(s, []);
    for (const s of sprints) { const b = m.get(s.status); if (b) b.push(s); }
    return m;
  }, [sprints]);

  return (
    <div className="w-72 shrink-0 flex flex-col border-l border-border bg-muted/10 h-full overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background shrink-0">
        <Zap className="h-4 w-4 text-violet-500" />
        <span className="text-sm font-semibold text-foreground flex-1">Sprints</span>
        <button onClick={() => setCreating(true)} className="p-1 rounded hover:bg-accent transition-colors" title="New sprint">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Create form */}
        {creating && (
          <div className="bg-background border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">New Sprint</p>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sprint name…" autoFocus
              className="w-full text-xs rounded border border-border bg-muted/30 px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
            <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Goal… (optional)"
              className="w-full text-xs rounded border border-border bg-muted/30 px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-0.5">Start</label>
                <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                  className="w-full text-xs rounded border border-border bg-muted/30 px-2 py-1 outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-0.5">End</label>
                <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                  className="w-full text-xs rounded border border-border bg-muted/30 px-2 py-1 outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs flex-1" disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: newName.trim(), goal: newGoal.trim() || undefined, startDate: newStart || undefined, endDate: newEnd || undefined })}>
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create Sprint"}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>}

        {statusOrder.map((status) => {
          const list = grouped.get(status) ?? [];
          if (list.length === 0) return null;
          const cfg = SPRINT_STATUS_CONFIG[status];
          return (
            <div key={status}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <span className={cn("inline-block w-1.5 h-1.5 rounded-full", cfg.dot)} />
                {cfg.label}
              </p>
              <div className="space-y-1.5">
                {list.map((sprint) => {
                  const isSelected = selectedSprintId === sprint.id;
                  const isExpanded = expandedId === sprint.id;
                  const isBurndownReady = isExpanded && burndown && burndown.sprintId === sprint.id;

                  return (
                    <div key={sprint.id} className={cn("rounded-lg border transition-all overflow-hidden",
                      isSelected ? "border-violet-400 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-950/20" : "border-border bg-background hover:border-border/80")}>
                      <div className="flex items-start gap-1.5 px-2.5 py-2">
                        {/* Sprint info — click to filter board */}
                        <button onClick={() => onSelectSprint(isSelected ? null : sprint.id)} className="flex-1 text-left min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{sprint.name}</p>
                          {sprint.goal && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sprint.goal}</p>}
                          {(sprint.startDate || sprint.endDate) && (
                            <p className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="h-2.5 w-2.5" />
                              {formatDate(sprint.startDate) ?? "?"} – {formatDate(sprint.endDate) ?? "?"}
                            </p>
                          )}
                        </button>

                        {/* Status select */}
                        <select value={sprint.status}
                          onChange={(e) => updateMutation.mutate({ id: sprint.id, status: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] bg-transparent border-0 outline-none text-muted-foreground cursor-pointer shrink-0 mt-0.5">
                          <option value="upcoming">Upcoming</option>
                          <option value="active">Active</option>
                          <option value="completed">Done</option>
                        </select>

                        {/* Expand charts */}
                        <button onClick={() => setExpandedId(isExpanded ? null : sprint.id)} className="p-0.5 rounded hover:bg-accent shrink-0">
                          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                        </button>

                        {/* Delete */}
                        <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(sprint.id); }} className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500 transition-colors" />
                        </button>
                      </div>

                      {/* Expanded section */}
                      {isExpanded && (
                        <div className="border-t border-border px-3 py-2.5 space-y-3 bg-muted/5">
                          {!isBurndownReady ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                            </div>
                          ) : (
                            <>
                              {/* Summary row */}
                              <div className="flex items-center gap-3">
                                <SprintProgressRing
                                  pct={burndown.totalIssues > 0
                                    ? Math.round(((burndown.statusCounts["done"] ?? 0) / burndown.totalIssues) * 100)
                                    : 0}
                                  size={40}
                                />
                                <div>
                                  <p className="text-xs font-semibold text-foreground">
                                    {burndown.statusCounts["done"] ?? 0} / {burndown.totalIssues} done
                                  </p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    {burndown.totalIssues > 0
                                      ? `${Math.round(((burndown.statusCounts["done"] ?? 0) / burndown.totalIssues) * 100)}% complete`
                                      : "No issues in sprint"}
                                  </p>
                                </div>
                              </div>

                              {/* Burndown chart */}
                              {burndown.points.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <Flag className="h-2.5 w-2.5" /> Burndown
                                  </p>
                                  <SprintBurndownChart data={burndown} />
                                </div>
                              )}

                              {/* Per-agent breakdown */}
                              {burndown.agentBreakdown.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <Zap className="h-2.5 w-2.5" /> Per Agent
                                  </p>
                                  <AgentBurndownChart agents={burndown.agentBreakdown} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {sprints.length === 0 && !isLoading && !creating && (
          <div className="text-center py-10">
            <Zap className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No sprints yet</p>
            <button onClick={() => setCreating(true)} className="text-xs text-primary underline underline-offset-2 mt-1">
              Create your first sprint
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Taskboard ─────────────────────────────────────────────────────────────

export function Taskboard() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [includeRoutines, setIncludeRoutines] = useState(false);
  const [showSprintPanel, setShowSprintPanel] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // All issues (when no sprint selected)
  const { data: allIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "taskboard", includeRoutines],
    queryFn: async () => {
      const results = await Promise.all([
        issuesApi.list(selectedCompanyId!, { status: "backlog", includeRoutineExecutions: includeRoutines }),
        issuesApi.list(selectedCompanyId!, { status: "todo", includeRoutineExecutions: includeRoutines }),
        issuesApi.list(selectedCompanyId!, { status: "in_progress", includeRoutineExecutions: includeRoutines }),
        issuesApi.list(selectedCompanyId!, { status: "done", includeRoutineExecutions: includeRoutines }),
      ]);
      return results.flat();
    },
    enabled: !!selectedCompanyId && !selectedSprintId,
    refetchInterval: 30_000,
  });

  // Sprint-scoped issues
  const { data: sprintIssuesList = [], isLoading: sprintIssuesLoading } = useQuery({
    queryKey: ["sprint-issues", selectedSprintId],
    queryFn: () => sprintsApi.listIssues(selectedSprintId!),
    enabled: !!selectedSprintId,
    refetchInterval: 30_000,
  });

  const issues = selectedSprintId ? sprintIssuesList : allIssues;
  const isLoading = selectedSprintId ? sprintIssuesLoading : issuesLoading;

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agents) map.set(agent.id, agent);
    return map;
  }, [agents]);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => issuesApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) }),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const s of COLUMN_ORDER) map.set(s, []);
    for (const issue of issues) {
      const bucket = map.get(issue.status);
      if (bucket) bucket.push(issue);
    }
    return map;
  }, [issues]);

  const totalActive = useMemo(() =>
    ["todo", "in_progress"].reduce((sum, s) => sum + (grouped.get(s)?.length ?? 0), 0),
    [grouped]);

  const toggleCollapse = (status: string) =>
    setCollapsedCols((prev) => { const next = new Set(prev); next.has(status) ? next.delete(status) : next.add(status); return next; });

  // Active sprint for header
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints", selectedCompanyId!],
    queryFn: () => sprintsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });
  const activeSprint = sprints.find((s) => s.status === "active");
  const selectedSprint = selectedSprintId ? sprints.find((s) => s.id === selectedSprintId) : null;

  return (
    <div className="flex h-full min-h-0">
      {/* Board */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0 flex-wrap gap-y-2">
          <CircleDot className="h-5 w-5 text-primary shrink-0" />
          <div>
            <h1 className="text-base font-semibold text-foreground">{selectedSprint ? selectedSprint.name : "Board"}</h1>
            <p className="text-xs text-muted-foreground">
              {selectedSprint ? `Sprint · ` : ""}{totalActive} active · {grouped.get("done")?.length ?? 0} done
            </p>
          </div>

          {/* Active sprint pill */}
          {activeSprint && !selectedSprintId && (
            <button onClick={() => { setSelectedSprintId(activeSprint.id); setShowSprintPanel(true); }}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:opacity-80 transition-opacity">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeSprint.name}
            </button>
          )}

          {/* Clear sprint filter */}
          {selectedSprint && (
            <button onClick={() => setSelectedSprintId(null)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full hover:bg-accent transition-colors">
              <X className="h-3 w-3" /> Clear filter
            </button>
          )}

          <div className="flex-1" />

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={includeRoutines} onChange={(e) => setIncludeRoutines(e.target.checked)} className="rounded" />
            Routines
          </label>

          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> New Task
          </Button>

          <Button variant={showSprintPanel ? "secondary" : "outline"} size="sm" className="gap-1.5 text-xs"
            onClick={() => setShowSprintPanel(!showSprintPanel)}>
            <Zap className="h-3.5 w-3.5" /> Sprints
            {activeSprint && !showSprintPanel && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5 text-xs"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) })}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Columns */}
        {isLoading ? (
          <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading board…
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-4 h-full items-stretch min-w-max">
              {COLUMN_ORDER.map((status) => (
                <Column key={status} status={status} issues={grouped.get(status) ?? []} agentMap={agentMap}
                  companyId={selectedCompanyId!}
                  collapsed={collapsedCols.has(status)} onToggleCollapse={() => toggleCollapse(status)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sprint sidebar */}
      {showSprintPanel && selectedCompanyId && (
        <SprintPanel companyId={selectedCompanyId} selectedSprintId={selectedSprintId}
          onSelectSprint={setSelectedSprintId} onClose={() => setShowSprintPanel(false)} />
      )}

      {/* Create task modal */}
      {showCreateDialog && selectedCompanyId && (
        <CreateTaskDialog companyId={selectedCompanyId} defaultSprintId={selectedSprintId ?? undefined}
          onClose={() => setShowCreateDialog(false)} />
      )}
    </div>
  );
}
