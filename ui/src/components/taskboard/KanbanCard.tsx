import { Link } from "@/lib/router";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIcon } from "@/components/StatusIcon";
import { PriorityIcon } from "@/components/PriorityIcon";
import { Identity } from "@/components/Identity";
import { PRIORITY_LEFT_BORDER } from "./constants";
import type { Issue } from "@crewspaceai/shared";

interface Agent {
  id: string;
  name: string;
}

interface KanbanCardProps {
  issue: Issue;
  agents?: Agent[];
  isLive?: boolean;
  isFlashing?: boolean;
  isOverlay?: boolean;
  onStatusChange?: (id: string, status: string) => void;
  onPriorityChange?: (id: string, priority: string) => void;
}

function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function KanbanCard({
  issue,
  agents,
  isLive,
  isFlashing,
  isOverlay,
  onStatusChange,
  onPriorityChange,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { issue },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const agentName = (id: string | null): string | null => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  const priorityBorder = PRIORITY_LEFT_BORDER[issue.priority] ?? "border-l-muted-foreground/20";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-md border border-border border-l-[3px] bg-card transition-all duration-150 cursor-grab active:cursor-grabbing select-none",
        priorityBorder,
        isDragging && !isOverlay ? "opacity-25 scale-95" : "",
        isOverlay
          ? "shadow-2xl ring-2 ring-primary/30 rotate-1 scale-105"
          : "hover:shadow-md hover:border-muted-foreground/25",
        isFlashing ? "ring-2 ring-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20" : "",
      )}
    >
      <div className="px-3 py-2.5">
        {/* Top row: identifier + live dot + status */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {issue.identifier ?? issue.id.slice(0, 8)}
          </span>
          {isLive && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
          <div className="flex-1" />
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <StatusIcon
              status={issue.status}
              onChange={onStatusChange ? (s) => onStatusChange(issue.id, s) : undefined}
            />
          </div>
        </div>

        {/* Title */}
        <Link
          to={`/issues/${issue.identifier ?? issue.id}`}
          className="block no-underline"
          onClick={(e) => isDragging && e.preventDefault()}
        >
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 mb-2.5">
            {issue.title}
          </p>
        </Link>

        {/* Footer: priority + assignee + time */}
        <div className="flex items-center gap-1.5">
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <PriorityIcon
              priority={issue.priority}
              onChange={onPriorityChange ? (p) => onPriorityChange(issue.id, p) : undefined}
            />
          </div>

          {issue.assigneeAgentId && (() => {
            const name = agentName(issue.assigneeAgentId);
            return name ? (
              <Identity name={name} size="xs" className="text-[10px] min-w-0 truncate max-w-[80px]" />
            ) : null;
          })()}

          <div className="flex-1" />

          {issue.updatedAt && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(issue.updatedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function KanbanCardOverlay({ issue, agents }: { issue: Issue; agents?: Agent[] }) {
  return <KanbanCard issue={issue} agents={agents} isOverlay />;
}

