import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIcon } from "@/components/StatusIcon";
import { KanbanCard } from "./KanbanCard";
import { STATUS_CONFIG, DEFAULT_WIP_LIMITS } from "./constants";
import type { Issue } from "@crewspaceai/shared";

interface Agent {
  id: string;
  name: string;
}

interface KanbanColumnProps {
  status: string;
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  flashingIds?: Set<string>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onStatusChange?: (id: string, status: string) => void;
  onPriorityChange?: (id: string, priority: string) => void;
  onAddIssue?: (status: string) => void;
  wipLimit?: number;
}

export function KanbanColumn({
  status,
  issues,
  agents,
  liveIssueIds,
  flashingIds,
  collapsed,
  onToggleCollapse,
  onStatusChange,
  onPriorityChange,
  onAddIssue,
  wipLimit,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog!;
  const limit = wipLimit ?? DEFAULT_WIP_LIMITS[status];
  const isOverWip = limit !== undefined && issues.length > limit;
  const isNearWip = limit !== undefined && !isOverWip && issues.length >= Math.floor(limit * 0.8);

  if (collapsed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 w-10 shrink-0 rounded-lg border py-3 cursor-pointer select-none transition-colors hover:bg-accent/30",
          cfg.borderColor,
          cfg.headerBg,
        )}
        onClick={onToggleCollapse}
        title={cfg.label}
      >
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          {cfg.label}
        </span>
        <span className={cn("text-[9px] px-1 py-0.5 rounded font-bold tabular-nums", cfg.badgeCls)}>
          {issues.length}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[240px] min-w-[240px] shrink-0 max-h-full">
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-2 rounded-t-lg border border-b-0",
          cfg.borderColor,
          cfg.headerBg,
        )}
      >
        <button
          onClick={onToggleCollapse}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Collapse column"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <StatusIcon status={status} />
        <span className="text-xs font-semibold text-foreground flex-1 truncate">{cfg.label}</span>

        {limit !== undefined ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              isOverWip
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                : isNearWip
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : cfg.badgeCls,
            )}
            title={isOverWip ? "WIP limit exceeded" : `WIP limit: ${limit}`}
          >
            {isOverWip && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
            {issues.length}/{limit}
          </span>
        ) : (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums", cfg.badgeCls)}>
            {issues.length}
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 rounded-b-lg border min-h-[100px] transition-colors",
          cfg.borderColor,
          isOver ? "bg-accent/40 border-primary/30" : "bg-muted/10",
        )}
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              agents={agents}
              isLive={liveIssueIds?.has(issue.id)}
              isFlashing={flashingIds?.has(issue.id)}
              onStatusChange={onStatusChange}
              onPriorityChange={onPriorityChange}
            />
          ))}
        </SortableContext>

        {issues.length === 0 && (
          <div className="flex items-center justify-center flex-1 py-8">
            <p className="text-[11px] text-muted-foreground/35">Drop issues here</p>
          </div>
        )}
      </div>

      {onAddIssue && (
        <button
          onClick={() => onAddIssue(status)}
          className="flex items-center gap-1 mt-1 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add issue
        </button>
      )}
    </div>
  );
}
