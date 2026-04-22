import { X, TrendingUp, Clock, Zap, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BurndownChart } from "./BurndownChart";
import { STATUS_CONFIG } from "./constants";
import type { SprintBurndown, SprintSummary } from "@/api/sprints";
import type { Issue } from "@crewspaceai/shared";

interface SprintMetricsPanelProps {
  burndownData?: SprintBurndown;
  summary?: SprintSummary;
  issues: Issue[];
  onClose: () => void;
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function avgCycleTime(issues: Issue[]): string {
  const done = issues.filter(
    (i) => i.status === "done" && i.createdAt,
  );
  if (!done.length) return "—";
  const totalDays =
    done.reduce((sum, i) => {
      const created = new Date(i.createdAt!).getTime();
      const updated = new Date(i.updatedAt!).getTime();
      return sum + (updated - created) / 86_400_000;
    }, 0) / done.length;
  return `${totalDays.toFixed(1)}d`;
}

export function SprintMetricsPanel({ burndownData, summary, issues, onClose }: SprintMetricsPanelProps) {
  const cycletime = avgCycleTime(issues);

  // WIP by status
  const statusCounts = Object.fromEntries(
    ["todo", "in_progress", "in_review", "blocked"].map((s) => [
      s,
      issues.filter((i) => i.status === s).length,
    ]),
  );
  const maxWip = Math.max(1, ...Object.values(statusCounts));

  // Velocity: completed issues / sprint days elapsed
  let velocity = "—";
  if (burndownData && burndownData.points.length > 0) {
    const firstPoint = burndownData.points[0];
    const today = new Date().toISOString().slice(0, 10);
    const elapsed = burndownData.points.filter((p) => p.date <= today).length;
    const completed = burndownData.totalIssues - (firstPoint.remaining ?? burndownData.totalIssues);
    if (elapsed > 0) {
      velocity = `${((burndownData.statusCounts.done ?? 0) / Math.max(1, elapsed)).toFixed(1)}/d`;
    }
  }

  return (
    <div className="w-72 shrink-0 border-l border-border bg-background flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Sprint Metrics</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Velocity"
            value={velocity}
            sub="issues per day"
          />
          <MetricCard
            label="Cycle Time"
            value={cycletime}
            sub="avg to done"
          />
          {summary && (
            <>
              <MetricCard
                label="Completed"
                value={summary.done}
                sub={`of ${summary.totalIssues} total`}
              />
              <MetricCard
                label="In Progress"
                value={summary.inProgress}
                sub="active issues"
              />
            </>
          )}
        </div>

        {/* Burndown chart */}
        {burndownData && burndownData.points.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Burndown</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 border-t-2 border-blue-500" />
                Actual
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-5 border-t-2 border-slate-400"
                  style={{ borderStyle: "dashed" }}
                />
                Ideal
              </span>
            </div>
            <BurndownChart points={burndownData.points} totalIssues={burndownData.totalIssues} height={140} />
          </div>
        )}

        {/* WIP distribution */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">WIP Distribution</span>
          </div>
          <div className="space-y-2">
            {Object.entries(statusCounts).map(([status, count]) => {
              const cfg = STATUS_CONFIG[status];
              if (!cfg) return null;
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">{cfg.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${(count / maxWip) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium tabular-nums w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent breakdown */}
        {burndownData?.agentBreakdown && burndownData.agentBreakdown.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Agent Breakdown</span>
            </div>
            <div className="space-y-1.5">
              {burndownData.agentBreakdown.map((agent) => (
                <div key={agent.agentId} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-foreground truncate flex-1">{agent.agentName}</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <span className="text-green-600 dark:text-green-400 font-medium">{agent.done}</span>
                    <span>/</span>
                    <span>{agent.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
