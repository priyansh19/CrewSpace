import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, CheckCircle2, Clock, ExternalLink, RefreshCw, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { issuesApi } from "../api/issues";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Issue } from "@paperclipai/shared";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function priorityDot(priority: string) {
  const map: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-400",
  };
  return map[priority] ?? "bg-muted-foreground";
}

// ── Blocked Issue Card ────────────────────────────────────────────────────────

function BlockedIssueCard({
  issue,
  onUnblock,
  selected,
  onToggleSelect,
}: {
  issue: Issue;
  onUnblock: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-lg border p-3.5 transition-colors cursor-pointer",
        selected
          ? "border-red-400 dark:border-red-700 bg-red-100 dark:bg-red-950/40"
          : "border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 hover:border-red-300 dark:hover:border-red-800",
      )}
      onClick={onToggleSelect}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 shrink-0 accent-red-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-mono text-muted-foreground">{issue.identifier}</span>
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityDot(issue.priority))} title={issue.priority} />
          </div>
          <Link
            to={`/issues/${issue.identifier}`}
            className="text-sm font-medium text-foreground hover:text-primary line-clamp-2 leading-snug"
            onClick={(e) => e.stopPropagation()}
          >
            {issue.title}
          </Link>
          {issue.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{issue.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 ml-6">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(issue.updatedAt)}
          </span>
          {issue.assigneeAgentId && (
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Agent assigned
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1 border-red-200 dark:border-red-900" onClick={onUnblock}>
            <RotateCcw className="h-3 w-3" />
            Set to Todo
          </Button>
          <Link to={`/issues/${issue.identifier}`} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Failed Run Card ───────────────────────────────────────────────────────────

interface FailedRun {
  id: string;
  agentName?: string;
  agentId: string;
  status: string;
  error?: string | null;
  stderrExcerpt?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  triggerDetail?: string | null;
  invocationSource: string;
}

function FailedRunCard({
  run,
  selected,
  onToggleSelect,
}: {
  run: FailedRun;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const statusLabel: Record<string, string> = {
    failed: "Failed",
    error: "Error",
    terminated: "Killed",
    timed_out: "Timed out",
  };

  const errorText = run.error ?? run.stderrExcerpt;

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-lg border p-3.5 transition-colors cursor-pointer",
        selected
          ? "border-orange-400 dark:border-orange-700 bg-orange-100 dark:bg-orange-950/40"
          : "border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 hover:border-orange-300 dark:hover:border-orange-800",
      )}
      onClick={onToggleSelect}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 shrink-0 accent-orange-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-foreground">{run.agentName ?? "Agent"}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
              {statusLabel[run.status] ?? run.status}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {run.triggerDetail ?? run.invocationSource}
          </p>
          {errorText && (
            <p className="mt-1.5 text-[11px] font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1 line-clamp-2 leading-relaxed">
              {errorText.slice(0, 200)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between ml-6">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(run.finishedAt ?? run.createdAt)}
        </span>
        <Link to={`/agents/${run.agentId}`} className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 gap-1">
            <ExternalLink className="h-3 w-3" />
            Agent
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Selection Action Bar ──────────────────────────────────────────────────────

function SelectionBar({
  selectedIssueIds,
  selectedRunIds,
  selectedRuns,
  onMarkDone,
  onCreateIssues,
  onClear,
  isLoading,
}: {
  selectedIssueIds: string[];
  selectedRunIds: string[];
  selectedRuns: FailedRun[];
  onMarkDone: () => void;
  onCreateIssues: () => void;
  onClear: () => void;
  isLoading: boolean;
}) {
  const total = selectedIssueIds.length + selectedRunIds.length;
  if (total === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-background shadow-xl px-4 py-2.5">
      <span className="text-sm font-medium text-foreground tabular-nums">{total} selected</span>
      <div className="w-px h-4 bg-border" />
      {selectedIssueIds.length > 0 && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
          onClick={onMarkDone}
          disabled={isLoading}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark as Done ({selectedIssueIds.length})
        </Button>
      )}
      {selectedRunIds.length > 0 && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs"
          onClick={onCreateIssues}
          disabled={isLoading}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Create Issue ({selectedRunIds.length})
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Blockers() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());

  const { data: blockedIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "blocked"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "blocked" }),
    enabled: !!selectedCompanyId,
    refetchInterval: 20_000,
  });

  const { data: recentRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!, undefined, 100),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const failedRuns = useMemo(() => {
    const FAILED = new Set(["failed", "error", "terminated", "timed_out"]);
    return recentRuns
      .filter((r) => FAILED.has(r.status))
      .slice(0, 30) as unknown as FailedRun[];
  }, [recentRuns]);

  const unblockMutation = useMutation({
    mutationFn: (issueId: string) => issuesApi.update(issueId, { status: "todo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => issuesApi.update(id, { status: "done" }))),
    onSuccess: () => {
      setSelectedIssueIds(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  const createIssuesMutation = useMutation({
    mutationFn: (runs: FailedRun[]) =>
      Promise.all(
        runs.map((run) =>
          issuesApi.create(selectedCompanyId!, {
            title: `Fix: ${run.agentName ?? "Agent"} run ${run.status}`,
            description: [
              run.triggerDetail ?? run.invocationSource,
              run.error ?? run.stderrExcerpt ?? "",
            ]
              .filter(Boolean)
              .join("\n\n"),
            priority: "high",
            status: "todo",
          }),
        ),
      ),
    onSuccess: () => {
      setSelectedRunIds(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  function toggleIssue(id: string) {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleRun(id: string) {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedRunObjects = failedRuns.filter((r) => selectedRunIds.has(r.id));
  const isLoading = issuesLoading || runsLoading;
  const isEmpty = blockedIssues.length === 0 && failedRuns.length === 0;
  const isMutating = markDoneMutation.isPending || createIssuesMutation.isPending;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <ShieldAlert className="h-5 w-5 text-red-500" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Alerts</h1>
          <p className="text-xs text-muted-foreground">Blocked issues and failed agent runs needing attention</p>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
            queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(selectedCompanyId!) });
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Loading blockers…
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-20">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No blockers right now</p>
              <p className="text-xs text-muted-foreground mt-1">All agents are running smoothly.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 pb-20">
            {/* Blocked Issues */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Blocked Issues</h2>
                <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5 tabular-nums font-medium">
                  {blockedIssues.length}
                </span>
                {blockedIssues.length > 0 && (
                  <button
                    className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (selectedIssueIds.size === blockedIssues.length) {
                        setSelectedIssueIds(new Set());
                      } else {
                        setSelectedIssueIds(new Set(blockedIssues.map((i) => i.id)));
                      }
                    }}
                  >
                    {selectedIssueIds.size === blockedIssues.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              {blockedIssues.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                  No blocked issues
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {blockedIssues.map((issue) => (
                    <BlockedIssueCard
                      key={issue.id}
                      issue={issue}
                      onUnblock={() => unblockMutation.mutate(issue.id)}
                      selected={selectedIssueIds.has(issue.id)}
                      onToggleSelect={() => toggleIssue(issue.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Failed Runs */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Failed Agent Runs</h2>
                <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-full px-2 py-0.5 tabular-nums font-medium">
                  {failedRuns.length}
                </span>
                {failedRuns.length > 0 && (
                  <button
                    className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (selectedRunIds.size === failedRuns.length) {
                        setSelectedRunIds(new Set());
                      } else {
                        setSelectedRunIds(new Set(failedRuns.map((r) => r.id)));
                      }
                    }}
                  >
                    {selectedRunIds.size === failedRuns.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              {failedRuns.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                  No recent failures
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {failedRuns.map((run) => (
                    <FailedRunCard
                      key={run.id}
                      run={run}
                      selected={selectedRunIds.has(run.id)}
                      onToggleSelect={() => toggleRun(run.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Floating action bar */}
      <SelectionBar
        selectedIssueIds={[...selectedIssueIds]}
        selectedRunIds={[...selectedRunIds]}
        selectedRuns={selectedRunObjects}
        onMarkDone={() => markDoneMutation.mutate([...selectedIssueIds])}
        onCreateIssues={() => createIssuesMutation.mutate(selectedRunObjects)}
        onClear={() => { setSelectedIssueIds(new Set()); setSelectedRunIds(new Set()); }}
        isLoading={isMutating}
      />
    </div>
  );
}
