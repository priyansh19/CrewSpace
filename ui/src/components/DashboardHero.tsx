import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { AgentAvatar } from "./AgentAvatar";
import { cn, formatCents } from "@/lib/utils";
import {
  Bot,
  Activity,
  DollarSign,
  Clock,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Agent, DashboardSummary } from "@crewspaceai/shared";
import type { HeartbeatRun } from "@crewspaceai/shared";

interface DashboardHeroProps {
  agents: Agent[];
  summary: DashboardSummary | undefined;
  runs: HeartbeatRun[] | undefined;
}

function LiveMetric({
  icon: Icon,
  label,
  value,
  subvalue,
  color = "emerald",
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subvalue?: React.ReactNode;
  color?: "emerald" | "cyan" | "amber" | "rose" | "violet";
  href?: string;
}) {
  const colorClasses = {
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    violet: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  };

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:scale-[1.02]",
        colorClasses[color]
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/60">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {subvalue && <p className="text-[10px] opacity-60">{subvalue}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block no-underline">
        {content}
      </Link>
    );
  }
  return content;
}

export function DashboardHero({ agents, summary, runs }: DashboardHeroProps) {
  const { selectedCompany } = useCompany();

  const activeAgents = useMemo(
    () => agents.filter((a) => a.status === "running" || a.status === "active"),
    [agents]
  );

  const runningRuns = useMemo(
    () => runs?.filter((r) => r.status === "running").length ?? 0,
    [runs]
  );

  const recentRuns = useMemo(
    () => runs?.filter((r) => {
      const runDate = new Date(r.createdAt);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return runDate >= dayAgo;
    }).length ?? 0,
    [runs]
  );

  return (
    <div className="space-y-4">
      {/* Top hero banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/40 p-5 sm:p-6">
        {/* Subtle background pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Company + agent orbit */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-chart-2" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Company Overview
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl mb-4">
              {selectedCompany?.name ?? "Dashboard"}
            </h1>

            {/* Agent avatar orbit */}
            {agents.length > 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {agents.slice(0, 8).map((agent) => (
                    <Link
                      key={agent.id}
                      to={`/agents/${agent.id}`}
                      className="relative inline-block rounded-full ring-2 ring-background transition-transform hover:scale-110 hover:z-10"
                      title={agent.name}
                    >
                      <AgentAvatar
                        agent={agent}
                        size="sm"
                        className={cn(
                          agent.status === "running" && "ring-2 ring-cyan-400 ring-offset-1 ring-offset-background"
                        )}
                      />
                      {agent.status === "running" && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                        </span>
                      )}
                    </Link>
                  ))}
                  {agents.length > 8 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
                      +{agents.length - 8}
                    </div>
                  )}
                </div>
                <div className="hidden sm:block text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{activeAgents.length}</span> active
                  <span className="mx-1">·</span>
                  <span className="font-medium text-foreground">{runningRuns}</span> running
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No agents hired yet.</p>
            )}
          </div>

          {/* Right: Live metric cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:w-[280px] shrink-0">
            <LiveMetric
              icon={Bot}
              label="Agents"
              value={agents.length}
              subvalue={`${activeAgents.length} active`}
              color="emerald"
              href="/agents"
            />
            <LiveMetric
              icon={Activity}
              label="Runs (24h)"
              value={recentRuns}
              subvalue={`${runningRuns} in progress`}
              color="cyan"
              href="/issues"
            />
            <LiveMetric
              icon={DollarSign}
              label="Month Spend"
              value={summary ? formatCents(summary.costs.monthSpendCents) : "—"}
              subvalue={
                summary && summary.costs.monthBudgetCents > 0
                  ? `${summary.costs.monthUtilizationPercent}% of budget`
                  : "Unlimited"
              }
              color="violet"
              href="/costs"
            />
            <LiveMetric
              icon={Clock}
              label="Pending"
              value={
                summary
                  ? summary.pendingApprovals + summary.budgets.pendingApprovals
                  : "—"
              }
              subvalue="awaiting review"
              color="amber"
              href="/approvals"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
