import { useNavigate } from "@/lib/router";
import { cn, formatDate } from "@/lib/utils";
import { PriorityIcon } from "./PriorityIcon";
import { StatusBadge } from "./StatusBadge";
import { ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, UserCircle } from "lucide-react";
import type { Issue, Agent } from "@crewspaceai/shared";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QueueItemProps {
  issue: Issue;
  index: number;
  total: number;
  queueType: "priority" | "normal";
  agents?: Agent[];
  isUpdating?: boolean;
  onPromote?: (issue: Issue) => void;
  onDemote?: (issue: Issue) => void;
  onMoveUp?: (issue: Issue) => void;
  onMoveDown?: (issue: Issue) => void;
}

export function QueueItem({
  issue,
  index,
  total,
  queueType,
  agents,
  isUpdating,
  onPromote,
  onDemote,
  onMoveUp,
  onMoveDown,
}: QueueItemProps) {
  const navigate = useNavigate();

  const agent = agents?.find((a) => a.id === issue.assigneeAgentId);
  const assigneeLabel = agent?.name ?? (issue.assigneeUserId ? "User" : "Unassigned");

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:shadow-sm cursor-pointer",
        issue.status === "blocked" && "opacity-60"
      )}
      onClick={() => navigate(`/issues/${issue.id}`)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            {issue.identifier ?? `#${issue.issueNumber}`}
          </span>
          <PriorityIcon priority={issue.priority} className="h-3 w-3" />
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp?.(issue);
                }}
                disabled={index === 0 || isUpdating}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move up</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown?.(issue);
                }}
                disabled={index === total - 1 || isUpdating}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move down</TooltipContent>
          </Tooltip>
          {queueType === "normal" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 text-orange-600"
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPromote?.(issue);
                  }}
                >
                  <ChevronsUp className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Promote to Priority</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 text-blue-600"
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDemote?.(issue);
                  }}
                >
                  <ChevronsDown className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Demote to Normal</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-foreground leading-snug truncate">
        {issue.title}
      </h4>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusBadge status={issue.status} />
          <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
            <UserCircle className="h-3 w-3 shrink-0" />
            {assigneeLabel}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDate(issue.createdAt)}
        </span>
      </div>
    </div>
  );
}
