import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { QueueItem } from "../components/QueueItem";
import { EmptyState } from "../components/EmptyState";
import { ListOrdered, Zap } from "lucide-react";
import { useToast } from "../context/ToastContext";
import type { Issue, Agent } from "@crewspaceai/shared";

const OPEN_STATUSES = "backlog,todo,in_progress,in_review,blocked";

export function Queues() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();

  useEffect(() => {
    setBreadcrumbs([{ label: "Queues" }]);
  }, [setBreadcrumbs]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const {
    data: priorityIssues,
    isLoading: priorityLoading,
  } = useQuery({
    queryKey: queryKeys.issues.queue(selectedCompanyId!, "priority"),
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        priorityTier: "priority",
        status: OPEN_STATUSES,
        sort: "queueRank",
      }),
    enabled: !!selectedCompanyId,
  });

  const {
    data: normalIssues,
    isLoading: normalLoading,
  } = useQuery({
    queryKey: queryKeys.issues.queue(selectedCompanyId!, "normal"),
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        priorityTier: "normal",
        status: OPEN_STATUSES,
        sort: "queueRank",
      }),
    enabled: !!selectedCompanyId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", selectedCompanyId!] });
    },
    onError: (err) => {
      pushToast({
        title: "Update failed",
        body: err instanceof Error ? err.message : "Failed to update queue position",
        tone: "error",
      });
    },
  });

  function handlePromote(issue: Issue) {
    updateMutation.mutate({
      id: issue.id,
      data: { priorityTier: "priority" },
    });
  }

  function handleDemote(issue: Issue) {
    updateMutation.mutate({
      id: issue.id,
      data: { priorityTier: "normal" },
    });
  }

  function computeNewRank(items: Issue[], index: number, direction: "up" | "down"): number {
    const current = items[index];
    if (!current) return 0;

    if (direction === "up") {
      const prev = items[index - 1];
      if (!prev) return current.queueRank ?? 0;
      const prevRank = prev.queueRank ?? 0;
      return prevRank - 1000;
    } else {
      const next = items[index + 1];
      if (!next) return current.queueRank ?? 0;
      const nextRank = next.queueRank ?? 0;
      return nextRank + 1000;
    }
  }

  function handleMoveUp(issue: Issue, items: Issue[]) {
    const idx = items.findIndex((i) => i.id === issue.id);
    if (idx <= 0) return;
    const newRank = computeNewRank(items, idx, "up");
    updateMutation.mutate({ id: issue.id, data: { queueRank: newRank } });
  }

  function handleMoveDown(issue: Issue, items: Issue[]) {
    const idx = items.findIndex((i) => i.id === issue.id);
    if (idx < 0 || idx >= items.length - 1) return;
    const newRank = computeNewRank(items, idx, "down");
    updateMutation.mutate({ id: issue.id, data: { queueRank: newRank } });
  }

  const priorityList = priorityIssues ?? [];
  const normalList = normalIssues ?? [];
  const isLoading = priorityLoading || normalLoading;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Queues</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Priority tasks are worked first. New tasks land in the Normal Queue by default.
        </p>
      </div>

      {/* Queues */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority Queue */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-foreground">Priority Queue</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {priorityList.length}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {isLoading ? (
                <QueueSkeleton />
              ) : priorityList.length === 0 ? (
                <EmptyState
                  icon={Zap}
                  message="Everything is under control. Promote tasks from the Normal Queue when they become urgent."
                />
              ) : (
                priorityList.map((issue, idx) => (
                  <QueueItem
                    key={issue.id}
                    issue={issue}
                    index={idx}
                    total={priorityList.length}
                    queueType="priority"
                    agents={agents}
                    isUpdating={updateMutation.isPending}
                    onDemote={handleDemote}
                    onMoveUp={(i) => handleMoveUp(i, priorityList)}
                    onMoveDown={(i) => handleMoveDown(i, priorityList)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Normal Queue */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-foreground">Normal Queue</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {normalList.length}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {isLoading ? (
                <QueueSkeleton />
              ) : normalList.length === 0 ? (
                <EmptyState
                  icon={ListOrdered}
                  message="The Normal Queue is empty. Create a new task to get started."
                />
              ) : (
                normalList.map((issue, idx) => (
                  <QueueItem
                    key={issue.id}
                    issue={issue}
                    index={idx}
                    total={normalList.length}
                    queueType="normal"
                    agents={agents}
                    isUpdating={updateMutation.isPending}
                    onPromote={handlePromote}
                    onMoveUp={(i) => handleMoveUp(i, normalList)}
                    onMoveDown={(i) => handleMoveDown(i, normalList)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
      ))}
    </>
  );
}
