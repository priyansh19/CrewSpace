import type { HeartbeatRun, Issue, Agent } from "@crewspaceai/shared";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

/* ---- Utilities ---- */

export function getLast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ---- Shared styles ---- */
const CHART_COLORS = {
  emerald: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  slate: "#64748b",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  rose: "#f43f5e",
  sky: "#0ea5e9",
};

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

/* ---- ChartCard wrapper ---- */

export function ChartCard({
  title,
  subtitle,
  children,
  heightClass = "h-48",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  heightClass?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
      <div>
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground/60">{subtitle}</span>
        )}
      </div>
      <div className={heightClass}>{children}</div>
    </div>
  );
}

/* ---- 1. Agent Status Donut ---- */

interface AgentStatusDonutProps {
  agents: { active: number; running: number; paused: number; error: number };
}

export function AgentStatusDonut({ agents }: AgentStatusDonutProps) {
  const data = [
    { name: "Active", value: agents.active, color: CHART_COLORS.emerald },
    { name: "Running", value: agents.running, color: CHART_COLORS.cyan },
    { name: "Paused", value: agents.paused, color: CHART_COLORS.amber },
    { name: "Error", value: agents.error, color: CHART_COLORS.red },
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <p className="text-xs text-muted-foreground">No agents</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={3}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ---- 2. Task Velocity (created vs completed) ---- */

interface TaskVelocityChartProps {
  issues: Issue[];
}

export function TaskVelocityChart({ issues }: TaskVelocityChartProps) {
  const days = getLast14Days();

  const data = days.map((day) => {
    const created = issues.filter(
      (i) => new Date(i.createdAt).toISOString().slice(0, 10) === day
    ).length;
    const completed = issues.filter(
      (i) =>
        i.status === "done" &&
        new Date(i.updatedAt).toISOString().slice(0, 10) === day
    ).length;
    return {
      day: formatDayLabel(day),
      created,
      completed,
    };
  });

  const hasData = data.some((d) => d.created > 0 || d.completed > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No task data</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.violet} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.violet} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="created"
          stroke={CHART_COLORS.violet}
          fillOpacity={1}
          fill="url(#colorCreated)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="completed"
          stroke={CHART_COLORS.emerald}
          fillOpacity={1}
          fill="url(#colorCompleted)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---- 3. Agent Utilization (horizontal bar) ---- */

interface AgentUtilizationChartProps {
  runs: HeartbeatRun[];
  agents: Agent[];
}

export function AgentUtilizationChart({ runs, agents }: AgentUtilizationChartProps) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const recentRuns = runs.filter((r) => new Date(r.createdAt) >= cutoff);

  const byAgent = new Map<string, { count: number; durationMs: number }>();
  for (const run of recentRuns) {
    const entry = byAgent.get(run.agentId) ?? { count: 0, durationMs: 0 };
    entry.count++;
    if (run.startedAt && run.finishedAt) {
      entry.durationMs +=
        new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
    }
    byAgent.set(run.agentId, entry);
  }

  const data = agents
    .map((agent) => {
      const stats = byAgent.get(agent.id) ?? { count: 0, durationMs: 0 };
      return {
        name: agent.name.slice(0, 12),
        runs: stats.count,
        minutes: Math.round(stats.durationMs / 60000),
      };
    })
    .filter((d) => d.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 8);

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground">No recent runs</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
          width={70}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="runs" fill={CHART_COLORS.sky} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- 4. Run Activity (stacked bar) ---- */

interface RunActivityChartProps {
  runs: HeartbeatRun[];
}

export function RunActivityChart({ runs }: RunActivityChartProps) {
  const days = getLast14Days();

  const data = days.map((day) => {
    const dayRuns = runs.filter(
      (r) => new Date(r.createdAt).toISOString().slice(0, 10) === day
    );
    return {
      day: formatDayLabel(day),
      succeeded: dayRuns.filter((r) => r.status === "succeeded").length,
      failed: dayRuns.filter((r) => r.status === "failed" || r.status === "timed_out").length,
      other: dayRuns.filter(
        (r) => r.status !== "succeeded" && r.status !== "failed" && r.status !== "timed_out"
      ).length,
    };
  });

  const hasData = data.some((d) => d.succeeded + d.failed + d.other > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No runs yet</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="succeeded" stackId="a" fill={CHART_COLORS.emerald} radius={[0, 0, 0, 0]} />
        <Bar dataKey="failed" stackId="a" fill={CHART_COLORS.red} radius={[0, 0, 0, 0]} />
        <Bar dataKey="other" stackId="a" fill={CHART_COLORS.slate} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- 5. Success Rate (line) ---- */

interface SuccessRateChartProps {
  runs: HeartbeatRun[];
}

export function SuccessRateChart({ runs }: SuccessRateChartProps) {
  const days = getLast14Days();

  const data = days.map((day) => {
    const dayRuns = runs.filter(
      (r) => new Date(r.createdAt).toISOString().slice(0, 10) === day
    );
    const total = dayRuns.length;
    const succeeded = dayRuns.filter((r) => r.status === "succeeded").length;
    return {
      day: formatDayLabel(day),
      rate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
      total,
    };
  });

  const hasData = data.some((d) => d.total > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No runs yet</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.2} />
            <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
          domain={[0, 100]}
          unit="%"
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value}%`, "Success Rate"]}
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke={CHART_COLORS.emerald}
          fillOpacity={1}
          fill="url(#colorRate)"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---- Legacy CSS charts (kept for AgentDetail usage) ---- */

const priorityColors: Record<string, string> = {
  critical: "#c64545",
  high: "#cc785c",
  medium: "#d4a017",
  low: "#8e8b82",
};

const priorityOrder = ["critical", "high", "medium", "low"] as const;

export function PriorityChart({ issues }: { issues: { priority: string; createdAt: Date }[] }) {
  const days = getLast14Days();
  const grouped = new Map<string, Record<string, number>>();
  for (const day of days) grouped.set(day, { critical: 0, high: 0, medium: 0, low: 0 });
  for (const issue of issues) {
    const day = new Date(issue.createdAt).toISOString().slice(0, 10);
    const entry = grouped.get(day);
    if (!entry) continue;
    if (issue.priority in entry) entry[issue.priority]++;
  }

  const maxValue = Math.max(...Array.from(grouped.values()).map(v => Object.values(v).reduce((a, b) => a + b, 0)), 1);
  const hasData = Array.from(grouped.values()).some(v => Object.values(v).reduce((a, b) => a + b, 0) > 0);

  if (!hasData) return <p className="text-xs text-muted-foreground">No issues</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map(day => {
          const entry = grouped.get(day)!;
          const total = Object.values(entry).reduce((a, b) => a + b, 0);
          const heightPct = (total / maxValue) * 100;
          return (
            <div key={day} className="flex-1 h-full flex flex-col justify-end" title={`${day}: ${total} issues`}>
              {total > 0 ? (
                <div className="flex flex-col-reverse gap-px overflow-hidden" style={{ height: `${heightPct}%`, minHeight: 2 }}>
                  {priorityOrder.map(p => entry[p] > 0 ? (
                    <div key={p} style={{ flex: entry[p], backgroundColor: priorityColors[p] }} />
                  ) : null)}
                </div>
              ) : (
                <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {days.map((day, i) => (
          <div key={day} className="flex-1 text-center">
            {(i === 0 || i === 6 || i === 13) ? (
              <span className="text-[9px] text-muted-foreground tabular-nums">{formatDayLabel(day)}</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-2">
        {priorityOrder.map(p => (
          <span key={p} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: priorityColors[p] }} />
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  todo: "#5db8a6",
  in_progress: "#cc785c",
  in_review: "#a78bfa",
  done: "#5db872",
  blocked: "#c64545",
  cancelled: "#8e8b82",
  backlog: "#6c6a64",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
  backlog: "Backlog",
};

export function IssueStatusChart({ issues }: { issues: { status: string; createdAt: Date }[] }) {
  const days = getLast14Days();
  const allStatuses = new Set<string>();
  const grouped = new Map<string, Record<string, number>>();
  for (const day of days) grouped.set(day, {});
  for (const issue of issues) {
    const day = new Date(issue.createdAt).toISOString().slice(0, 10);
    const entry = grouped.get(day);
    if (!entry) continue;
    entry[issue.status] = (entry[issue.status] ?? 0) + 1;
    allStatuses.add(issue.status);
  }

  const statusOrder = ["todo", "in_progress", "in_review", "done", "blocked", "cancelled", "backlog"].filter(s => allStatuses.has(s));
  const maxValue = Math.max(...Array.from(grouped.values()).map(v => Object.values(v).reduce((a, b) => a + b, 0)), 1);
  const hasData = allStatuses.size > 0;

  if (!hasData) return <p className="text-xs text-muted-foreground">No issues</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map(day => {
          const entry = grouped.get(day)!;
          const total = Object.values(entry).reduce((a, b) => a + b, 0);
          const heightPct = (total / maxValue) * 100;
          return (
            <div key={day} className="flex-1 h-full flex flex-col justify-end" title={`${day}: ${total} issues`}>
              {total > 0 ? (
                <div className="flex flex-col-reverse gap-px overflow-hidden" style={{ height: `${heightPct}%`, minHeight: 2 }}>
                  {statusOrder.map(s => (entry[s] ?? 0) > 0 ? (
                    <div key={s} style={{ flex: entry[s], backgroundColor: statusColors[s] ?? "#6b7280" }} />
                  ) : null)}
                </div>
              ) : (
                <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {days.map((day, i) => (
          <div key={day} className="flex-1 text-center">
            {(i === 0 || i === 6 || i === 13) ? (
              <span className="text-[9px] text-muted-foreground tabular-nums">{formatDayLabel(day)}</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-2">
        {statusOrder.map(s => (
          <span key={s} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColors[s] ?? "#6b7280" }} />
            {statusLabels[s] ?? s}
          </span>
        ))}
      </div>
    </div>
  );
}
