import { useMemo } from "react";
import { Link } from "@/lib/router";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIcon } from "@/components/StatusIcon";
import { PriorityIcon } from "@/components/PriorityIcon";
import { Identity } from "@/components/Identity";
import { STATUS_CONFIG, BOARD_STATUSES } from "./constants";
import type { Sprint } from "@/api/sprints";
import type { Issue, IssueStatus, IssuePriority } from "@crewspaceai/shared";

interface Agent {
  id: string;
  name: string;
}

interface SprintBacklogProps {
  issues: Issue[];
  agents?: Agent[];
  sprint: Sprint | null;
  sprintIssueIds?: Set<string>;
  onAddToSprint?: (issueId: string) => void;
  onRemoveFromSprint?: (issueId: string) => void;
  onUpdateIssue: (id: string, data: Partial<Issue>) => void;
}

export function SprintBacklog({
  issues,
  agents,
  sprint,
  sprintIssueIds,
  onAddToSprint,
  onRemoveFromSprint,
  onUpdateIssue,
}: SprintBacklogProps) {
  const agentName = (id: string | null): string | null => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const s of BOARD_STATUSES) map.set(s, []);
    for (const issue of issues) {
      const bucket = map.get(issue.status);
      if (bucket) bucket.push(issue);
    }
    return map;
  }, [issues]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {BOARD_STATUSES.map((status) => {
          const items = grouped.get(status) ?? [];
          if (items.length === 0) return null;
          const cfg = STATUS_CONFIG[status];
          if (!cfg) return null;

          return (
            <div key={status}>
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1", cfg.headerBg)}>
                <StatusIcon status={status} />
                <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", cfg.badgeCls)}>
                  {items.length}
                </span>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {items.map((issue) => {
                  const inSprint = sprintIssueIds?.has(issue.id);
                  const name = agentName(issue.assigneeAgentId);

                  return (
                    <div
                      key={issue.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-card hover:bg-accent/20 transition-colors"
                    >
                      <div onClick={(e) => e.stopPropagation()}>
                        <StatusIcon
                          status={issue.status}
                          onChange={(s) => onUpdateIssue(issue.id, { status: s as IssueStatus })}
                        />
                      </div>

                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-14">
                        {issue.identifier ?? issue.id.slice(0, 8)}
                      </span>

                      <Link
                        to={`/issues/${issue.identifier ?? issue.id}`}
                        className="flex-1 text-xs font-medium text-foreground hover:text-primary truncate transition-colors"
                      >
                        {issue.title}
                      </Link>

                      <div className="flex items-center gap-2 shrink-0">
                        <div onClick={(e) => e.stopPropagation()}>
                          <PriorityIcon
                            priority={issue.priority}
                            onChange={(p) => onUpdateIssue(issue.id, { priority: p as IssuePriority })}
                          />
                        </div>

                        {name && (
                          <Identity name={name} size="xs" className="text-[10px] max-w-[72px]" />
                        )}

                        {sprint && (onAddToSprint || onRemoveFromSprint) && (
                          <button
                            onClick={() =>
                              inSprint
                                ? onRemoveFromSprint?.(issue.id)
                                : onAddToSprint?.(issue.id)
                            }
                            className={cn(
                              "flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded border transition-colors",
                              inSprint
                                ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                : "border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30",
                            )}
                            title={inSprint ? "Remove from sprint" : "Add to sprint"}
                          >
                            {inSprint ? (
                              <>
                                <Minus className="h-2.5 w-2.5" />
                                Remove
                              </>
                            ) : (
                              <>
                                <Plus className="h-2.5 w-2.5" />
                                Add
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {issues.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No issues in backlog
          </div>
        )}
      </div>
    </div>
  );
}
