import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { approvalsApi } from "../api/approvals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import {
  Bot,
  CircleDot,
  DollarSign,
  ShieldCheck,
  LayoutDashboard,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  User,
} from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import {
  ChartCard,
  RunActivityChart,
  SuccessRateChart,
  AgentStatusDonut,
  TaskVelocityChart,
  AgentUtilizationChart,
} from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import { LiveActivityPanel } from "../components/LiveActivityPanel";
import type { Agent, Issue, Approval } from "@crewspaceai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "CEO Strategy",
  budget_override_required: "Budget Override",
};

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending"),
    queryFn: () => approvalsApi.list(selectedCompanyId!, "pending"),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending") });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId!) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending") });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId!) });
    },
  });

  const recentIssues = useMemo(() => {
    if (!issues) return [];
    return [...issues]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to CrewSpace. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-chart-5/20 bg-chart-5/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-chart-5 shrink-0" />
            <p className="text-sm text-foreground">You have no agents.</p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-chart-5 hover:text-chart-5/80 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      {data && (
        <div className="grid xl:grid-cols-[1fr_320px] gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Budget incidents alert */}
            {data.budgets.activeIncidents > 0 ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {data.budgets.activeIncidents} active budget incident
                      {data.budgets.activeIncidents === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-destructive/70">
                      {data.budgets.pausedAgents} agents paused &middot;{" "}
                      {data.budgets.pausedProjects} projects paused &middot;{" "}
                      {data.budgets.pendingApprovals} pending budget approvals
                    </p>
                  </div>
                </div>
                <Link to="/costs" className="text-sm underline underline-offset-2 text-destructive">
                  Open budgets
                </Link>
              </div>
            ) : null}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
              <MetricCard
                icon={Bot}
                value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
                label="Agents Enabled"
                to="/agents"
                description={
                  <span>
                    {data.agents.running} running{", "}
                    {data.agents.paused} paused{", "}
                    {data.agents.error} errors
                  </span>
                }
              />
              <MetricCard
                icon={CircleDot}
                value={data.tasks.inProgress}
                label="Tasks In Progress"
                to="/issues"
                description={
                  <span>
                    {data.tasks.open} open{", "}
                    {data.tasks.blocked} blocked
                  </span>
                }
              />
              <MetricCard
                icon={DollarSign}
                value={formatCents(data.costs.monthSpendCents)}
                label="Month Spend"
                to="/costs"
                description={
                  <span>
                    {data.costs.monthBudgetCents > 0
                      ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
                      : "Unlimited budget"}
                  </span>
                }
              />
              <MetricCard
                icon={ShieldCheck}
                value={data.pendingApprovals + data.budgets.pendingApprovals}
                label="Pending Approvals"
                to="/approvals"
                description={
                  <span>
                    {data.budgets.pendingApprovals > 0
                      ? `${data.budgets.pendingApprovals} budget overrides awaiting board review`
                      : "Awaiting board review"}
                  </span>
                }
              />
            </div>

            {/* Primary Insight Charts — Run Activity + Success Rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Run Activity" subtitle="Execution volume & outcomes (14d)" heightClass="h-56">
                <RunActivityChart runs={runs ?? []} />
              </ChartCard>
              <ChartCard title="Success Rate" subtitle="Daily run quality trend (14d)" heightClass="h-56">
                <SuccessRateChart runs={runs ?? []} />
              </ChartCard>
            </div>

            {/* Secondary Insight Charts — Agent Status + Task Velocity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Agent Status" subtitle="Fleet availability" heightClass="h-52">
                <AgentStatusDonut agents={data.agents} />
              </ChartCard>
              <ChartCard title="Task Velocity" subtitle="Created vs completed (14d)" heightClass="h-52">
                <TaskVelocityChart issues={issues ?? []} />
              </ChartCard>
            </div>

            {/* Operational Detail — Agent Utilization full width */}
            <ChartCard title="Agent Utilization" subtitle="Top performers by run count (14d)" heightClass="h-52">
              <AgentUtilizationChart runs={runs ?? []} agents={agents ?? []} />
            </ChartCard>

            {/* Pending Approvals */}
            {(pendingApprovals?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Pending Approvals
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-chart-5/15 text-chart-5 text-xs font-semibold px-1.5 py-px min-w-[18px]">
                      {pendingApprovals!.length}
                    </span>
                  </h3>
                  <Link
                    to="/approvals"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    View all
                  </Link>
                </div>
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                  {pendingApprovals!.slice(0, 5).map((approval) => {
                    const agentName = agents?.find((a) => a.id === approval.requestedByAgentId)?.name;
                    const isApproving = approveMutation.isPending && approveMutation.variables === approval.id;
                    const isRejecting = rejectMutation.isPending && rejectMutation.variables === approval.id;
                    return (
                      <div
                        key={approval.id}
                        className="flex items-start gap-3 px-4 py-3 bg-card hover:bg-accent/30 transition-colors"
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          <Clock className="h-4 w-4 text-chart-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium px-1.5 py-px rounded bg-muted text-muted-foreground">
                              {APPROVAL_TYPE_LABELS[approval.type] ?? approval.type}
                            </span>
                            {agentName && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Zap className="h-3 w-3" />
                                {agentName}
                              </span>
                            )}
                            {approval.requestedByUserId && !agentName && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                User
                              </span>
                            )}
                          </div>
                          {approval.payload && Object.keys(approval.payload).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {((approval.payload as Record<string, unknown>).reason as string) ??
                                ((approval.payload as Record<string, unknown>).description as string) ??
                                JSON.stringify(approval.payload).slice(0, 80)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {timeAgo(approval.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <button
                            onClick={() => approveMutation.mutate(approval.id)}
                            disabled={isApproving || isRejecting}
                            className={cn(
                              "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                              "bg-chart-3/10 text-chart-3 hover:bg-chart-3/20",
                              (isApproving || isRejecting) && "opacity-50 pointer-events-none"
                            )}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isApproving ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(approval.id)}
                            disabled={isApproving || isRejecting}
                            className={cn(
                              "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                              "bg-destructive/10 text-destructive hover:bg-destructive/20",
                              (isApproving || isRejecting) && "opacity-50 pointer-events-none"
                            )}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {isRejecting ? "…" : "Reject"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {pendingApprovals!.length > 5 && (
                    <Link
                      to="/approvals"
                      className="block px-4 py-2.5 text-xs text-center text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors no-underline"
                    >
                      + {pendingApprovals!.length - 5} more pending approvals
                    </Link>
                  )}
                </div>
              </div>
            )}

            <PluginSlotOutlet
              slotTypes={["dashboardWidget"]}
              context={{ companyId: selectedCompanyId }}
              className="grid gap-4 md:grid-cols-2"
              itemClassName="rounded-lg border bg-card p-4 shadow-sm"
            />

            {/* Recent Tasks — compact */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Tasks
              </h3>
              {recentIssues.length === 0 ? (
                <div className="border border-border p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border overflow-hidden rounded-lg">
                  {recentIssues.map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                    >
                      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                        <span className="shrink-0 sm:hidden">
                          <StatusIcon status={issue.status} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span className="hidden sm:inline-flex">
                              <StatusIcon status={issue.status} />
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeAgentId && (() => {
                              const name = agentName(issue.assigneeAgentId);
                              return name ? (
                                <span className="hidden sm:inline-flex text-xs text-muted-foreground bg-muted px-1.5 py-px rounded">
                                  {name}
                                </span>
                              ) : null;
                            })()}
                            <span className="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {timeAgo(issue.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — Live Activity Panel */}
          <div className="hidden xl:block">
            <LiveActivityPanel
              companyId={selectedCompanyId!}
              className="sticky top-4 h-[calc(100vh-140px)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
