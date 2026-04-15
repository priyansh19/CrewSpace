import type { SprintBurndown, SprintBurndownPoint, SprintAgentBreakdown } from "../api/sprints";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function agentInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Burndown Chart ─────────────────────────────────────────────────────────────
// SVG-based line chart showing remaining vs ideal burndown

export function SprintBurndownChart({ data }: { data: SprintBurndown }) {
  const { points, totalIssues } = data;

  if (!points || points.length === 0 || totalIssues === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No data yet</p>;
  }

  const W = 280;
  const H = 100;
  const PAD_L = 24;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 20;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const n = points.length;
  const maxY = totalIssues;

  const xScale = (i: number) => PAD_L + (i / Math.max(n - 1, 1)) * plotW;
  const yScale = (v: number) => PAD_T + plotH - (v / maxY) * plotH;

  // Build polyline paths
  const remainingPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(p.remaining).toFixed(1)}`)
    .join(" ");

  const idealPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(p.ideal).toFixed(1)}`)
    .join(" ");

  // Area fill under remaining line
  const areaPath =
    remainingPath +
    ` L${xScale(n - 1).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${PAD_L.toFixed(1)},${(PAD_T + plotH).toFixed(1)} Z`;

  // Y-axis labels (0, half, total)
  const yLabels = [
    { v: 0, label: "0" },
    { v: Math.round(maxY / 2), label: String(Math.round(maxY / 2)) },
    { v: maxY, label: String(maxY) },
  ];

  // X-axis: show first, middle, last date
  const xLabels = [
    { i: 0, label: formatDate(points[0]!.date) },
    { i: Math.floor((n - 1) / 2), label: formatDate(points[Math.floor((n - 1) / 2)]!.date) },
    { i: n - 1, label: formatDate(points[n - 1]!.date) },
  ];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 120 }}>
        {/* Grid lines */}
        {yLabels.map(({ v }) => (
          <line
            key={v}
            x1={PAD_L}
            y1={yScale(v)}
            x2={W - PAD_R}
            y2={yScale(v)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="#8b5cf6" fillOpacity={0.08} />

        {/* Ideal line (dashed) */}
        <path
          d={idealPath}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeOpacity={0.6}
        />

        {/* Remaining line */}
        <path d={remainingPath} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Y-axis labels */}
        {yLabels.map(({ v, label }) => (
          <text
            key={v}
            x={PAD_L - 3}
            y={yScale(v) + 3}
            textAnchor="end"
            fontSize={7}
            fill="currentColor"
            fillOpacity={0.45}
          >
            {label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xScale(i)}
            y={H - 3}
            textAnchor="middle"
            fontSize={7}
            fill="currentColor"
            fillOpacity={0.45}
          >
            {label}
          </text>
        ))}

        {/* Current day dot */}
        {points.length > 0 && (
          <circle
            cx={xScale(n - 1)}
            cy={yScale(points[n - 1]!.remaining)}
            r={3}
            fill="#8b5cf6"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1">
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="inline-block w-4 h-0.5 bg-violet-500 rounded" />
          Remaining
        </span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="inline-block w-4 border-t border-dashed border-slate-400" />
          Ideal
        </span>
      </div>
    </div>
  );
}

// ── Per-Agent Burndown Bars ────────────────────────────────────────────────────

export function AgentBurndownChart({ agents }: { agents: SprintAgentBreakdown[] }) {
  if (!agents || agents.length === 0) {
    return <p className="text-xs text-muted-foreground py-2 text-center">No agents assigned</p>;
  }

  return (
    <div className="space-y-2">
      {agents.map((a) => {
        const donePct = a.total > 0 ? (a.done / a.total) * 100 : 0;
        const inProgressPct = a.total > 0 ? (a.inProgress / a.total) * 100 : 0;
        const todoPct = a.total > 0 ? (a.todo / a.total) * 100 : 0;

        return (
          <div key={a.agentId} className="flex items-center gap-2">
            {/* Avatar */}
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <span className="text-[7px] font-bold text-violet-700 dark:text-violet-300">
                {agentInitials(a.agentName)}
              </span>
            </div>

            {/* Name */}
            <span className="text-[10px] text-muted-foreground w-20 truncate shrink-0" title={a.agentName}>
              {a.agentName}
            </span>

            {/* Stacked bar */}
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-muted/40 flex">
              {donePct > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${donePct}%` }}
                  title={`Done: ${a.done}`}
                />
              )}
              {inProgressPct > 0 && (
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${inProgressPct}%` }}
                  title={`In Progress: ${a.inProgress}`}
                />
              )}
              {todoPct > 0 && (
                <div
                  className="h-full bg-muted/60 transition-all"
                  style={{ width: `${todoPct}%` }}
                  title={`Todo: ${a.todo}`}
                />
              )}
            </div>

            {/* Count */}
            <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
              {a.done}/{a.total}
            </span>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-3 pt-1">
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
          Done
        </span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-sm bg-violet-500" />
          In Progress
        </span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-sm bg-muted/60 border border-border" />
          Todo
        </span>
      </div>
    </div>
  );
}

// ── Sprint Progress Ring ───────────────────────────────────────────────────────

export function SprintProgressRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#8b5cf6"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}
