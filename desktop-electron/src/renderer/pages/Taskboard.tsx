import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CircleDot, Circle, Clock, CheckCircle2, XCircle, Loader2,
  Eye, Ban, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Issue } from "@crewspaceai/shared";

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  border: string;
  header: string;
  cardBg: string;
  badge: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  backlog: {
    label: "Backlog",
    icon: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
    border: "border-border",
    header: "bg-muted/30",
    cardBg: "bg-card hover:bg-accent/30",
    badge: "bg-muted text-muted-foreground",
  },
  todo: {
    label: "Todo",
    icon: <CircleDot className="h-3.5 w-3.5 text-blue-500" />,
    border: "border-blue-200 dark:border-blue-900/50",
    header: "bg-blue-50 dark:bg-blue-950/30",
    cardBg: "bg-card hover:bg-blue-50/50 dark:hover:bg-blue-950/10",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    icon: <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin" />,
    border: "border-yellow-200 dark:border-yellow-900/50",
    header: "bg-yellow-50 dark:bg-yellow-950/30",
    cardBg: "bg-card hover:bg-yellow-50/50 dark:hover:bg-yellow-950/10",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  in_review: {
    label: "In Review",
    icon: <Eye className="h-3.5 w-3.5 text-violet-500" />,
    border: "border-violet-200 dark:border-violet-900/50",
    header: "bg-violet-50 dark:bg-violet-950/30",
    cardBg: "bg-card hover:bg-violet-50/50 dark:hover:bg-violet-950/10",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  blocked: {
    label: "Blocked",
    icon: <Ban className="h-3.5 w-3.5 text-red-500" />,
    border: "border-red-200 dark:border-red-900/50",
    header: "bg-red-50 dark:bg-red-950/30",
    cardBg: "bg-card hover:bg-red-50/50 dark:hover:bg-red-950/10",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  done: {
    label: "Done",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    border: "border-green-200 dark:border-green-900/50",
    header: "bg-green-50 dark:bg-green-950/30",
    cardBg: "bg-card hover:bg-green-50/50 dark:hover:bg-green-950/10",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="h-3.5 w-3.5 text-neutral-400" />,
    border: "border-border",
    header: "bg-muted/20",
    cardBg: "bg-card hover:bg-accent/20 opacity-60",
    badge: "bg-muted text-muted-foreground",
  },
};

const COLUMN_ORDER = ["backlog", "todo", "in_progress", "done"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function priorityColor(priority: string) {
  const map: Record<string, string> = {
    critical: "text-red-500",
    high: "text-orange-500",
    medium: "text-yellow-500",
    low: "text-blue-400",
  };
  return map[priority] ?? "text-muted-foreground";
}

function priorityLabel(priority: string) {
  return { critical: "!", high: "↑", medium: "–", low: "↓" }[priority] ?? "–";
}

function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Issue Card ─────────────────────────────────────────────────────────────────

function IssueCard({ issue, onStatusChange }: {
  issue: Issue;
  onStatusChange: (id: string, status: string) => void;
}) {
  const cfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.backlog;

  return (
    <Link to={`/issues/${issue.identifier}`} className="block">
      <div className={cn(
        "rounded-md border px-3 py-2.5 transition-colors cursor-pointer",
        cfg.border,
        cfg.cardBg,
      )}>
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{issue.identifier}</span>
          <span className={cn("text-[10px] font-bold shrink-0", priorityColor(issue.priority))}>
            {priorityLabel(issue.priority)}
          </span>
        </div>
        <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{issue.title}</p>
        {issue.updatedAt && (
          <p className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo(issue.updatedAt)}
          </p>
        )}
      </div>
    </Link>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({
  status, issues, onStatusChange, collapsed, onToggleCollapse,
}: {
  status: string;
  issues: Issue[];
  onStatusChange: (id: string, status: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog;

  return (
    <div className={cn(
      "flex flex-col rounded-lg border min-w-0 transition-all",
      cfg.border,
      collapsed ? "w-10 shrink-0" : "w-56 shrink-0",
    )}>
      {/* Column header */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 rounded-t-lg border-b shrink-0 w-full text-left",
          cfg.header,
          cfg.border,
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 w-full">
            <span className="text-[10px] font-medium text-foreground writing-mode-vertical rotate-180 [writing-mode:vertical-rl]">
              {cfg.label}
            </span>
            <span className={cn("text-[9px] px-1 py-0.5 rounded font-medium", cfg.badge)}>
              {issues.length}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground mt-1" />
          </div>
        ) : (
          <>
            {cfg.icon}
            <span className="text-xs font-semibold text-foreground flex-1">{cfg.label}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums", cfg.badge)}>
              {issues.length}
            </span>
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          </>
        )}
      </button>

      {/* Cards */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-[60px]">
          {issues.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-[11px] text-muted-foreground/50">No issues</p>
            </div>
          ) : (
            issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} onStatusChange={onStatusChange} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ALL_STATUSES = COLUMN_ORDER.join(",");

export function Taskboard() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [includeRoutines, setIncludeRoutines] = useState(false);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "taskboard", includeRoutines],
    queryFn: async () => {
      // Fetch active statuses (backlog/todo/in_progress/in_review/blocked) + done
      const results = await Promise.all([
        issuesApi.list(selectedCompanyId!, { status: "backlog", includeRoutineExecutions: includeRoutines }),
        issuesApi.list(selectedCompanyId!, { status: "todo", includeRoutineExecutions: includeRoutines }),
        issuesApi.list(selectedCompanyId!, { status: "in_progress", includeRoutineExecutions: includeRoutines }),
        issuesApi.list(selectedCompanyId!, { status: "done", includeRoutineExecutions: includeRoutines }),
      ]);
      return results.flat();
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      issuesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
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

  const totalActive = useMemo(() => {
    return ["todo", "in_progress"].reduce(
      (sum, s) => sum + (grouped.get(s)?.length ?? 0),
      0,
    );
  }, [grouped]);

  const toggleCollapse = (status: string) =>
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <CircleDot className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Board</h1>
          <p className="text-xs text-muted-foreground">
            {totalActive} active · {grouped.get("done")?.length ?? 0} done
          </p>
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeRoutines}
            onChange={(e) => setIncludeRoutines(e.target.checked)}
            className="rounded"
          />
          Include routine tasks
        </label>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
          Loading board…
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full items-stretch min-w-max">
            {COLUMN_ORDER.map((status) => (
              <Column
                key={status}
                status={status}
                issues={grouped.get(status) ?? []}
                onStatusChange={(id, newStatus) => updateMutation.mutate({ id, status: newStatus })}
                collapsed={collapsedCols.has(status)}
                onToggleCollapse={() => toggleCollapse(status)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
