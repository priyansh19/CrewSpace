import type { SprintBurndownPoint } from "@/api/sprints";

interface BurndownChartProps {
  points: SprintBurndownPoint[];
  totalIssues: number;
  height?: number;
}

export function BurndownChart({ points, totalIssues, height = 160 }: BurndownChartProps) {
  if (!points.length || totalIssues === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height }}>
        No burndown data yet
      </div>
    );
  }

  const W = 280;
  const H = height;
  const pad = { top: 12, right: 16, bottom: 28, left: 32 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const n = points.length;
  const maxVal = totalIssues;

  const toX = (i: number) => pad.left + (i / Math.max(n - 1, 1)) * chartW;
  const toY = (v: number) => pad.top + chartH - (Math.min(v, maxVal) / maxVal) * chartH;

  const actualPts = points.map((p, i) => `${toX(i)},${toY(p.remaining)}`).join(" ");
  const idealPts = points.map((p, i) => `${toX(i)},${toY(p.ideal)}`).join(" ");

  const today = new Date().toISOString().slice(0, 10);
  const todayIdx = points.findIndex((p) => p.date >= today);
  const todayX = todayIdx >= 0 ? toX(todayIdx) : null;

  const yLabels = [maxVal, Math.round(maxVal / 2), 0];

  const lastActual = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((frac, i) => (
        <line
          key={i}
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + chartH * (1 - frac)}
          y2={pad.top + chartH * (1 - frac)}
          stroke="currentColor"
          strokeOpacity={0.07}
          strokeWidth={1}
        />
      ))}

      {/* Y axis labels */}
      {yLabels.map((val, i) => (
        <text
          key={i}
          x={pad.left - 4}
          y={toY(val) + 4}
          textAnchor="end"
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.45}
        >
          {val}
        </text>
      ))}

      {/* X axis labels */}
      {n > 0 && (
        <>
          <text x={toX(0)} y={H - 4} textAnchor="start" fontSize={9} fill="currentColor" fillOpacity={0.45}>
            {fmtDate(points[0].date)}
          </text>
          <text x={toX(n - 1)} y={H - 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.45}>
            {fmtDate(points[n - 1].date)}
          </text>
        </>
      )}

      {/* Today marker */}
      {todayX !== null && (
        <line
          x1={todayX}
          x2={todayX}
          y1={pad.top}
          y2={pad.top + chartH}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {/* Ideal line (dashed) */}
      <polyline
        points={idealPts}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />

      {/* Actual line */}
      <polyline
        points={actualPts}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dot on last actual */}
      {lastActual && (
        <circle cx={toX(n - 1)} cy={toY(lastActual.remaining)} r={3} fill="#3b82f6" />
      )}
    </svg>
  );
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
