import type { HeartbeatRun, Issue, Agent } from "@crewspaceai/shared";
import {
  PieChart,
  Pie,
  Cell,
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

/* ── Design-aligned palette (from DESIGN.md) ──────────────────────────────── */
const CHART_COLORS = {
  coral:   "#cc785c",   // primary
  teal:    "#5db8a6",   // accent-teal
  amber:   "#e8a55a",   // accent-amber
  success: "#5db872",   // success green
  error:   "#c64545",   // error red
  warning: "#d4a017",   // warning
  muted:   "#6c6a64",   // muted
  violet:  "#a78bfa",   // in-review
};

/* ── Shared tooltip style ─────────────────────────────────────────────────── */
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 11,
  color: "hsl(var(--foreground))",
  padding: "6px 10px",
};

/* ── Shared axis/grid props ───────────────────────────────────────────────── */
const AXIS_STYLE = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
const GRID_PROPS = { strokeDasharray: "3 3", stroke: "hsl(var(--border))", vertical: false } as const;

/* ── ChartCard wrapper ────────────────────────────────────────────────────── */

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
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h3>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground/60">{subtitle}</span>
        )}
      </div>
      <div className={heightClass}>{children}</div>
    </div>
  );
}

/* ── 1. Agent Status Donut (unchanged) ────────────────────────────────────── */

interface AgentStatusDonutProps {
  agents: { active: number; running: number; paused: number; error: number };
}

export function AgentStatusDonut({ agents }: AgentStatusDonutProps) {
  const data = [
    { name: "Active",  value: agents.active,  color: CHART_COLORS.success },
    { name: "Running", value: agents.running,  color: CHART_COLORS.teal },
    { name: "Paused",  value: agents.paused,   color: CHART_COLORS.amber },
    { name: "Error",   value: agents.error,    color: CHART_COLORS.error },
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">No agents</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── 2. Task Velocity — AreaChart (created vs completed) ─────────────────── */

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
      (i) => i.status === "done" && new Date(i.updatedAt).toISOString().slice(0, 10) === day
    ).length;
    return { day: formatDayLabel(day), created, completed };
  });

  const hasData = data.some((d) => d.created > 0 || d.completed > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No task data</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.coral} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.coral} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.teal} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" tick={AXIS_STYLE} stroke="none" />
        <YAxis tick={AXIS_STYLE} stroke="none" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="created" name="Created" stroke={CHART_COLORS.coral} fill="url(#gradCreated)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="completed" name="Completed" stroke={CHART_COLORS.teal} fill="url(#gradCompleted)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── 3. Agent Utilization — AreaChart (runs per agent) ───────────────────── */

interface AgentUtilizationChartProps {
  runs: HeartbeatRun[];
  agents: Agent[];
}

export function AgentUtilizationChart({ runs, agents }: AgentUtilizationChartProps) {
  const days = getLast14Days();
  const cutoff = new Date(days[0] + "T00:00:00");

  const recentRuns = runs.filter((r) => new Date(r.createdAt) >= cutoff);
  const byAgent = new Map<string, { count: number; durationMs: number }>();
  for (const run of recentRuns) {
    const entry = byAgent.get(run.agentId) ?? { count: 0, durationMs: 0 };
    entry.count++;
    if (run.startedAt && run.finishedAt) {
      entry.durationMs += new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
    }
    byAgent.set(run.agentId, entry);
  }

  const top5 = agents
    .map((a) => ({ name: a.name.slice(0, 12), runs: byAgent.get(a.id)?.count ?? 0 }))
    .filter((d) => d.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5);

  if (top5.length === 0) return <p className="text-xs text-muted-foreground">No recent runs</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={top5} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradUtil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" tick={AXIS_STYLE} stroke="none" />
        <YAxis tick={AXIS_STYLE} stroke="none" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="runs" name="Runs" stroke={CHART_COLORS.amber} fill="url(#gradUtil)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── 4. Run Activity — stacked AreaChart (succeeded / failed / other) ─────── */

interface RunActivityChartProps {
  runs: HeartbeatRun[];
}

export function RunActivityChart({ runs }: RunActivityChartProps) {
  const days = getLast14Days();

  const data = days.map((day) => {
    const dayRuns = runs.filter((r) => new Date(r.createdAt).toISOString().slice(0, 10) === day);
    return {
      day: formatDayLabel(day),
      succeeded: dayRuns.filter((r) => r.status === "succeeded").length,
      failed:    dayRuns.filter((r) => r.status === "failed" || r.status === "timed_out").length,
      other:     dayRuns.filter((r) => r.status !== "succeeded" && r.status !== "failed" && r.status !== "timed_out").length,
    };
  });

  const hasData = data.some((d) => d.succeeded + d.failed + d.other > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No runs yet</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSucceeded" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.teal} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.error} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.error} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.muted} stopOpacity={0.2} />
            <stop offset="95%" stopColor={CHART_COLORS.muted} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" tick={AXIS_STYLE} stroke="none" />
        <YAxis tick={AXIS_STYLE} stroke="none" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="succeeded" name="Succeeded" stackId="a" stroke={CHART_COLORS.teal}    fill="url(#gradSucceeded)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="failed"    name="Failed"    stackId="a" stroke={CHART_COLORS.error}   fill="url(#gradFailed)"    strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="other"     name="Other"     stackId="a" stroke={CHART_COLORS.muted}   fill="url(#gradOther)"     strokeWidth={1} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── 5. Success Rate — smooth LineChart ───────────────────────────────────── */

interface SuccessRateChartProps {
  runs: HeartbeatRun[];
}

export function SuccessRateChart({ runs }: SuccessRateChartProps) {
  const days = getLast14Days();

  const data = days.map((day) => {
    const dayRuns = runs.filter((r) => new Date(r.createdAt).toISOString().slice(0, 10) === day);
    const total     = dayRuns.length;
    const succeeded = dayRuns.filter((r) => r.status === "succeeded").length;
    return { day: formatDayLabel(day), rate: total > 0 ? Math.round((succeeded / total) * 100) : null, total };
  });

  const hasData = data.some((d) => d.total > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No runs yet</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.teal} stopOpacity={0.18} />
            <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" tick={AXIS_STYLE} stroke="none" />
        <YAxis tick={AXIS_STYLE} stroke="none" domain={[0, 100]} unit="%" />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Success Rate"]} />
        <Line
          type="monotone"
          dataKey="rate"
          name="Success Rate"
          stroke={CHART_COLORS.teal}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, fill: CHART_COLORS.teal, strokeWidth: 0 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── 6. Priority Chart — Recharts AreaChart (replaces custom CSS bars) ────── */

const priorityColors: Record<string, string> = {
  critical: CHART_COLORS.error,
  high:     CHART_COLORS.coral,
  medium:   CHART_COLORS.warning,
  low:      CHART_COLORS.muted,
};

export function PriorityChart({ issues }: { issues: { priority: string; createdAt: Date }[] }) {
  const days = getLast14Days();

  const data = days.map((day) => {
    const dayIssues = issues.filter((i) => new Date(i.createdAt).toISOString().slice(0, 10) === day);
    return {
      day: formatDayLabel(day),
      critical: dayIssues.filter((i) => i.priority === "critical").length,
      high:     dayIssues.filter((i) => i.priority === "high").length,
      medium:   dayIssues.filter((i) => i.priority === "medium").length,
      low:      dayIssues.filter((i) => i.priority === "low").length,
    };
  });

  const hasData = data.some((d) => d.critical + d.high + d.medium + d.low > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No issues</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          {(["critical", "high", "medium", "low"] as const).map((p) => (
            <linearGradient key={p} id={`gradPri-${p}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={priorityColors[p]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={priorityColors[p]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" tick={AXIS_STYLE} stroke="none" />
        <YAxis tick={AXIS_STYLE} stroke="none" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="critical" name="Critical" stackId="a" stroke={priorityColors.critical} fill={`url(#gradPri-critical)`} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="high"     name="High"     stackId="a" stroke={priorityColors.high}     fill={`url(#gradPri-high)`}     strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="medium"   name="Medium"   stackId="a" stroke={priorityColors.medium}   fill={`url(#gradPri-medium)`}   strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="low"      name="Low"      stackId="a" stroke={priorityColors.low}      fill={`url(#gradPri-low)`}      strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── 7. Issue Status Chart — Recharts AreaChart (replaces custom CSS bars) ── */

const statusColors: Record<string, string> = {
  todo:        CHART_COLORS.teal,
  in_progress: CHART_COLORS.coral,
  in_review:   CHART_COLORS.violet,
  done:        CHART_COLORS.success,
  blocked:     CHART_COLORS.error,
  cancelled:   CHART_COLORS.muted,
  backlog:     "#8e8b82",
};

const statusLabels: Record<string, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  in_review:   "In Review",
  done:        "Done",
  blocked:     "Blocked",
  cancelled:   "Cancelled",
  backlog:     "Backlog",
};

const STATUS_ORDER = ["todo", "in_progress", "in_review", "done", "blocked", "cancelled", "backlog"] as const;

export function IssueStatusChart({ issues }: { issues: { status: string; createdAt: Date }[] }) {
  const days = getLast14Days();
  const allStatuses = new Set(issues.map((i) => i.status));
  const activeStatuses = STATUS_ORDER.filter((s) => allStatuses.has(s));

  const data = days.map((day) => {
    const dayIssues = issues.filter((i) => new Date(i.createdAt).toISOString().slice(0, 10) === day);
    const row: Record<string, string | number> = { day: formatDayLabel(day) };
    for (const s of activeStatuses) {
      row[s] = dayIssues.filter((i) => i.status === s).length;
    }
    return row;
  });

  if (activeStatuses.length === 0) return <p className="text-xs text-muted-foreground">No issues</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          {activeStatuses.map((s) => (
            <linearGradient key={s} id={`gradSt-${s}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={statusColors[s] ?? "#6b7280"} stopOpacity={0.3} />
              <stop offset="95%" stopColor={statusColors[s] ?? "#6b7280"} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" tick={AXIS_STYLE} stroke="none" />
        <YAxis tick={AXIS_STYLE} stroke="none" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {activeStatuses.map((s) => (
          <Area
            key={s}
            type="monotone"
            dataKey={s}
            name={statusLabels[s] ?? s}
            stackId="a"
            stroke={statusColors[s] ?? "#6b7280"}
            fill={`url(#gradSt-${s})`}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
