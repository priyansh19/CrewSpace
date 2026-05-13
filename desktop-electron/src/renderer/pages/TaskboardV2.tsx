import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { STATUS_CONFIG } from "@/components/taskboard/constants";
import { issuesApi } from "@/api/issues";
import { sprintsApi, type Sprint } from "@/api/sprints";
import { agentsApi } from "@/api/agents";
import { heartbeatsApi } from "@/api/heartbeats";
import { queryKeys } from "@/lib/queryKeys";
import { KanbanBoard } from "@/components/taskboard/KanbanBoard";
import { SprintHeader } from "@/components/taskboard/SprintHeader";
import { SprintMetricsPanel } from "@/components/taskboard/SprintMetricsPanel";
import { BoardToolbar } from "@/components/taskboard/BoardToolbar";
import { SprintModal } from "@/components/taskboard/SprintModal";
import { CompleteSprintModal } from "@/components/taskboard/CompleteSprintModal";
import { SprintBacklog } from "@/components/taskboard/SprintBacklog";
import type { Issue } from "@crewspaceai/shared";

export function TaskboardV2() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Board" }]);
  }, [setBreadcrumbs]);

  // Board state
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "backlog">("board");
  const [showMetrics, setShowMetrics] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set(["cancelled"]));
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("crewspace.board.hiddenCols");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("crewspace.board.customLabels");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [includeRoutines, setIncludeRoutines] = useState(false);

  // Modal state
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  // Live flash tracking
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: sprints = [] } = useQuery({
    queryKey: queryKeys.sprints.list(selectedCompanyId!),
    queryFn: () => sprintsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const issuesQueryKey = selectedSprintId
    ? queryKeys.sprints.issues(selectedSprintId)
    : [...queryKeys.issues.list(selectedCompanyId!), "taskboard", includeRoutines];

  const { data: issues = [], isLoading: issuesLoading } = useQuery({
    queryKey: issuesQueryKey,
    queryFn: async () => {
      if (selectedSprintId) {
        return sprintsApi.listIssues(selectedSprintId);
      }
      const results = await Promise.all(
        ["backlog", "todo", "in_progress", "in_review", "blocked", "done"].map((status) =>
          issuesApi.list(selectedCompanyId!, {
            status,
            includeRoutineExecutions: includeRoutines,
          }),
        ),
      );
      return results.flat();
    },
    enabled: !!selectedCompanyId,
    refetchInterval: selectedSprintId ? false : 60_000,
  });

  const { data: sprintSummary } = useQuery({
    queryKey: selectedSprintId ? queryKeys.sprints.summary(selectedSprintId) : ["__disabled__"],
    queryFn: () => sprintsApi.summary(selectedSprintId!),
    enabled: !!selectedSprintId,
    refetchInterval: 30_000,
  });

  const { data: burndownData } = useQuery({
    queryKey: selectedSprintId ? queryKeys.sprints.burndown(selectedSprintId) : ["__disabled__"],
    queryFn: () => sprintsApi.burndown(selectedSprintId!),
    enabled: !!selectedSprintId && showMetrics,
  });

  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  // ── Derived state ────────────────────────────────────────────────────────

  const selectedSprint = useMemo(
    () => sprints.find((s) => s.id === selectedSprintId) ?? null,
    [sprints, selectedSprintId],
  );

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filterPriority && issue.priority !== filterPriority) return false;
      if (filterAssignee && issue.assigneeAgentId !== filterAssignee) return false;
      return true;
    });
  }, [issues, filterPriority, filterAssignee]);

  const sprintIssueIds = useMemo(() => new Set(issues.map((i) => i.id)), [issues]);

  // ── Flash animation detection ────────────────────────────────────────────

  useEffect(() => {
    const prevMap = prevStatusRef.current;
    const changed = new Set<string>();
    for (const issue of issues) {
      const prev = prevMap.get(issue.id);
      if (prev !== undefined && prev !== issue.status) {
        changed.add(issue.id);
      }
      prevMap.set(issue.id, issue.status);
    }
    if (changed.size > 0) {
      setFlashingIds((prev) => new Set([...prev, ...changed]));
      const timer = setTimeout(() => {
        setFlashingIds((prev) => {
          const next = new Set(prev);
          changed.forEach((id) => next.delete(id));
          return next;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [issues]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const updateIssueMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      if (selectedSprintId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sprints.issues(selectedSprintId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sprints.summary(selectedSprintId) });
      }
    },
  });

  const createSprintMutation = useMutation({
    mutationFn: (data: Parameters<typeof sprintsApi.create>[1]) =>
      sprintsApi.create(selectedCompanyId!, data),
    onSuccess: (newSprint) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.list(selectedCompanyId!) });
      setSelectedSprintId(newSprint.id);
      setSprintModalOpen(false);
      setEditingSprint(null);
    },
  });

  const updateSprintMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof sprintsApi.update>[1] }) =>
      sprintsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.list(selectedCompanyId!) });
      setSprintModalOpen(false);
      setEditingSprint(null);
    },
  });

  const completeSprintMutation = useMutation({
    mutationFn: async ({
      sprintId,
      destination,
    }: {
      sprintId: string;
      destination: string;
    }) => {
      const incomplete = issues.filter((i) => !["done", "cancelled"].includes(i.status));
      if (destination !== "backlog" && incomplete.length > 0) {
        await Promise.all(
          incomplete.map((issue) =>
            sprintsApi.addIssue(destination, issue.id).catch(() => null),
          ),
        );
        await Promise.all(
          incomplete.map((issue) =>
            sprintsApi.removeIssue(sprintId, issue.id).catch(() => null),
          ),
        );
      }
      return sprintsApi.update(sprintId, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      setCompleteModalOpen(false);
      setSelectedSprintId(null);
    },
  });

  const addToSprintMutation = useMutation({
    mutationFn: (issueId: string) => sprintsApi.addIssue(selectedSprintId!, issueId),
    onSuccess: () => {
      if (selectedSprintId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sprints.issues(selectedSprintId) });
      }
    },
  });

  const removeFromSprintMutation = useMutation({
    mutationFn: (issueId: string) => sprintsApi.removeIssue(selectedSprintId!, issueId),
    onSuccess: () => {
      if (selectedSprintId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sprints.issues(selectedSprintId) });
      }
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleUpdateIssue = (id: string, data: Partial<Issue>) => {
    updateIssueMutation.mutate({ id, data: data as Record<string, unknown> });
  };

  const handleSprintSubmit = (data: {
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    if (editingSprint) {
      updateSprintMutation.mutate({ id: editingSprint.id, data });
    } else {
      createSprintMutation.mutate(data);
    }
  };

  const toggleCollapse = (status: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const handleHideColumn = (status: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.add(status);
      localStorage.setItem("crewspace.board.hiddenCols", JSON.stringify([...next]));
      return next;
    });
  };

  const handleShowColumn = (status: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.delete(status);
      localStorage.setItem("crewspace.board.hiddenCols", JSON.stringify([...next]));
      return next;
    });
  };

  const handleRenameColumn = (status: string, label: string) => {
    setCustomLabels((prev) => {
      const next = { ...prev, [status]: label };
      localStorage.setItem("crewspace.board.customLabels", JSON.stringify(next));
      return next;
    });
  };

  const incompleteIssues = useMemo(
    () => issues.filter((i) => !["done", "cancelled"].includes(i.status)),
    [issues],
  );
  const completedCount = useMemo(
    () => issues.filter((i) => i.status === "done").length,
    [issues],
  );
  const nextSprints = useMemo(
    () => sprints.filter((s) => s.id !== selectedSprintId && s.status !== "completed"),
    [sprints, selectedSprintId],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Toolbar */}
      <BoardToolbar
        sprints={sprints}
        selectedSprintId={selectedSprintId}
        onSelectSprint={setSelectedSprintId}
        onCreateSprint={() => {
          setEditingSprint(null);
          setSprintModalOpen(true);
        }}
        view={view}
        onSetView={setView}
        showMetrics={showMetrics}
        onToggleMetrics={() => setShowMetrics((v) => !v)}
        filterPriority={filterPriority}
        onSetFilterPriority={setFilterPriority}
        filterAssignee={filterAssignee}
        onSetFilterAssignee={setFilterAssignee}
        agents={agents}
        includeRoutines={includeRoutines}
        onToggleRoutines={() => setIncludeRoutines((v) => !v)}
      />

      {/* Sprint header (when sprint is selected) */}
      {selectedSprint && (
        <SprintHeader
          sprint={selectedSprint}
          summary={sprintSummary}
          onEdit={() => {
            setEditingSprint(selectedSprint);
            setSprintModalOpen(true);
          }}
          onStart={() =>
            updateSprintMutation.mutate({
              id: selectedSprint.id,
              data: { status: "active" },
            })
          }
          onComplete={() => setCompleteModalOpen(true)}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Board / Backlog */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          {issuesLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading board…
            </div>
          ) : view === "board" ? (
            <div className="flex flex-col h-full min-h-0">
              {hiddenCols.size > 0 && (
                <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-wrap shrink-0">
                  <span className="text-[11px] text-muted-foreground">Hidden:</span>
                  {[...hiddenCols].map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    const lbl = customLabels[status] ?? cfg?.label ?? status;
                    return (
                      <button
                        key={status}
                        onClick={() => handleShowColumn(status)}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/30 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-3 p-4 flex-1 min-h-0 items-stretch min-w-max overflow-x-auto">
                <KanbanBoard
                  issues={filteredIssues}
                  agents={agents}
                  liveIssueIds={liveIssueIds}
                  flashingIds={flashingIds}
                  collapsedCols={collapsedCols}
                  hiddenCols={hiddenCols}
                  customLabels={customLabels}
                  onToggleCollapse={toggleCollapse}
                  onUpdateIssue={handleUpdateIssue}
                  onRenameColumn={handleRenameColumn}
                  onHideColumn={handleHideColumn}
                />
              </div>
            </div>
          ) : (
            <SprintBacklog
              issues={filteredIssues}
              agents={agents}
              sprint={selectedSprint}
              sprintIssueIds={selectedSprintId ? sprintIssueIds : undefined}
              onAddToSprint={
                selectedSprintId ? (id) => addToSprintMutation.mutate(id) : undefined
              }
              onRemoveFromSprint={
                selectedSprintId ? (id) => removeFromSprintMutation.mutate(id) : undefined
              }
              onUpdateIssue={handleUpdateIssue}
            />
          )}
        </div>

        {/* Metrics panel */}
        {showMetrics && selectedSprintId && (
          <SprintMetricsPanel
            burndownData={burndownData}
            summary={sprintSummary}
            issues={filteredIssues}
            onClose={() => setShowMetrics(false)}
          />
        )}
      </div>

      {/* Modals */}
      <SprintModal
        open={sprintModalOpen}
        sprint={editingSprint}
        onClose={() => {
          setSprintModalOpen(false);
          setEditingSprint(null);
        }}
        onSubmit={handleSprintSubmit}
        isLoading={createSprintMutation.isPending || updateSprintMutation.isPending}
      />

      <CompleteSprintModal
        open={completeModalOpen}
        sprint={selectedSprint}
        incompleteIssues={incompleteIssues}
        completedCount={completedCount}
        nextSprints={nextSprints}
        onClose={() => setCompleteModalOpen(false)}
        onComplete={(destination) =>
          selectedSprint &&
          completeSprintMutation.mutate({
            sprintId: selectedSprint.id,
            destination,
          })
        }
        isLoading={completeSprintMutation.isPending}
      />
    </div>
  );
}
