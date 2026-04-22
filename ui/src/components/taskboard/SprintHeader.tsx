import { CalendarDays, Target, CheckCircle2, Play, Flag, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Sprint, SprintSummary } from "@/api/sprints";

interface SprintHeaderProps {
  sprint: Sprint;
  summary?: SprintSummary;
  onEdit?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
}

function daysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SprintHeader({ sprint, summary, onEdit, onStart, onComplete }: SprintHeaderProps) {
  const pct = summary?.completionPct ?? 0;
  const days = daysRemaining(sprint.endDate);
  const isActive = sprint.status === "active";
  const isUpcoming = sprint.status === "upcoming";

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
      {/* Top row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Flag className="h-4 w-4 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground truncate">{sprint.name}</h2>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
              sprint.status === "active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : sprint.status === "upcoming"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {sprint.status}
          </span>
        </div>

        {sprint.startDate && sprint.endDate && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <CalendarDays className="h-3.5 w-3.5" />
            {fmtDate(sprint.startDate)} – {fmtDate(sprint.endDate)}
          </span>
        )}

        {isActive && days !== null && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
              days <= 2
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                : days <= 5
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {days === 0 ? "Last day" : `${days}d left`}
          </span>
        )}

        <div className="flex-1" />

        {onEdit && (
          <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
        {isUpcoming && onStart && (
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={onStart}>
            <Play className="h-3.5 w-3.5" />
            Start Sprint
          </Button>
        )}
        {isActive && onComplete && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={onComplete}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete Sprint
          </Button>
        )}
      </div>

      {/* Goal */}
      {sprint.goal && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Target className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{sprint.goal}</span>
        </div>
      )}

      {/* Progress bar */}
      {summary && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
            {summary.done}/{summary.totalIssues} done ({Math.round(pct)}%)
          </span>
        </div>
      )}
    </div>
  );
}
