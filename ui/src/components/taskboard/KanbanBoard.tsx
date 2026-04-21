import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCardOverlay } from "./KanbanCard";
import { BOARD_STATUSES } from "./constants";
import type { Issue, IssueStatus, IssuePriority } from "@crewspaceai/shared";

interface Agent {
  id: string;
  name: string;
}

interface KanbanBoardProps {
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  flashingIds?: Set<string>;
  collapsedCols: Set<string>;
  onToggleCollapse: (status: string) => void;
  onUpdateIssue: (id: string, data: Partial<Issue>) => void;
}

export function KanbanBoard({
  issues,
  agents,
  liveIssueIds,
  flashingIds,
  collapsedCols,
  onToggleCollapse,
  onUpdateIssue,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columnIssues = useMemo(() => {
    const grouped: Record<string, Issue[]> = {};
    for (const s of BOARD_STATUSES) grouped[s] = [];
    for (const issue of issues) {
      if (grouped[issue.status]) grouped[issue.status].push(issue);
    }
    return grouped;
  }, [issues]);

  const activeIssue = useMemo(
    () => (activeId ? issues.find((i) => i.id === activeId) : null),
    [activeId, issues],
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    let targetStatus: string | null = null;
    if ((BOARD_STATUSES as readonly string[]).includes(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      const targetIssue = issues.find((i) => i.id === over.id);
      if (targetIssue) targetStatus = targetIssue.status;
    }

    if (targetStatus && targetStatus !== issue.status) {
      onUpdateIssue(issueId, { status: targetStatus as IssueStatus });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 h-full items-stretch">
        {BOARD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={columnIssues[status] ?? []}
            agents={agents}
            liveIssueIds={liveIssueIds}
            flashingIds={flashingIds}
            collapsed={collapsedCols.has(status)}
            onToggleCollapse={() => onToggleCollapse(status)}
            onStatusChange={(id, s) => onUpdateIssue(id, { status: s as IssueStatus })}
            onPriorityChange={(id, p) => onUpdateIssue(id, { priority: p as IssuePriority })}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? <KanbanCardOverlay issue={activeIssue} agents={agents} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
