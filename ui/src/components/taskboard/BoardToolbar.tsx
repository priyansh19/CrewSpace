import { LayoutGrid, List, BarChart2, Plus, ChevronDown, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiveConnectionBadge } from "./LiveConnectionBadge";
import type { Sprint } from "@/api/sprints";

interface Agent {
  id: string;
  name: string;
}

interface BoardToolbarProps {
  sprints: Sprint[];
  selectedSprintId: string | null;
  onSelectSprint: (id: string | null) => void;
  onCreateSprint: () => void;
  view: "board" | "backlog";
  onSetView: (view: "board" | "backlog") => void;
  showMetrics: boolean;
  onToggleMetrics: () => void;
  filterPriority: string | null;
  onSetFilterPriority: (p: string | null) => void;
  filterAssignee: string | null;
  onSetFilterAssignee: (a: string | null) => void;
  agents?: Agent[];
  includeRoutines: boolean;
  onToggleRoutines: () => void;
}

const PRIORITIES = ["critical", "high", "medium", "low"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function BoardToolbar({
  sprints,
  selectedSprintId,
  onSelectSprint,
  onCreateSprint,
  view,
  onSetView,
  showMetrics,
  onToggleMetrics,
  filterPriority,
  onSetFilterPriority,
  filterAssignee,
  onSetFilterAssignee,
  agents = [],
  includeRoutines,
  onToggleRoutines,
}: BoardToolbarProps) {
  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);
  const activeSprints = sprints.filter((s) => s.status !== "completed");
  const hasFilters = filterPriority || filterAssignee;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background shrink-0 flex-wrap">
      {/* Sprint selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium max-w-[200px]">
            <span className="truncate">
              {selectedSprint ? selectedSprint.name : "All Issues"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem
            className={cn("text-xs gap-2", !selectedSprintId && "font-semibold")}
            onClick={() => onSelectSprint(null)}
          >
            All Issues
          </DropdownMenuItem>
          {activeSprints.length > 0 && <DropdownMenuSeparator />}
          {activeSprints.map((sprint) => (
            <DropdownMenuItem
              key={sprint.id}
              className={cn("text-xs gap-2", selectedSprintId === sprint.id && "font-semibold")}
              onClick={() => onSelectSprint(sprint.id)}
            >
              <span className="flex-1 truncate">{sprint.name}</span>
              <span
                className={cn(
                  "text-[9px] px-1 py-0.5 rounded font-medium shrink-0",
                  sprint.status === "active"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                )}
              >
                {sprint.status}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs gap-2 text-primary" onClick={onCreateSprint}>
            <Plus className="h-3.5 w-3.5" />
            New Sprint
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View toggle */}
      <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
        <button
          onClick={() => onSetView("board")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors",
            view === "board"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Board
        </button>
        <button
          onClick={() => onSetView("backlog")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors border-l border-border",
            view === "backlog"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <List className="h-3.5 w-3.5" />
          Backlog
        </button>
      </div>

      {/* Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={filterPriority ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
          >
            <Filter className="h-3.5 w-3.5" />
            {filterPriority ? PRIORITY_LABELS[filterPriority] : "Priority"}
            {filterPriority && (
              <X
                className="h-3 w-3 ml-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetFilterPriority(null);
                }}
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRIORITIES.map((p) => (
            <DropdownMenuItem
              key={p}
              className={cn("text-xs", filterPriority === p && "font-semibold")}
              onClick={() => onSetFilterPriority(filterPriority === p ? null : p)}
            >
              {PRIORITY_LABELS[p]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assignee filter */}
      {agents.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={filterAssignee ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs max-w-[140px]"
            >
              <span className="truncate">
                {filterAssignee
                  ? (agents.find((a) => a.id === filterAssignee)?.name ?? "Agent")
                  : "Assignee"}
              </span>
              {filterAssignee ? (
                <X
                  className="h-3 w-3 shrink-0 ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetFilterAssignee(null);
                  }}
                />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {agents.map((agent) => (
              <DropdownMenuItem
                key={agent.id}
                className={cn("text-xs", filterAssignee === agent.id && "font-semibold")}
                onClick={() => onSetFilterAssignee(filterAssignee === agent.id ? null : agent.id)}
              >
                {agent.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Clear filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={() => {
            onSetFilterPriority(null);
            onSetFilterAssignee(null);
          }}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}

      {/* Routines toggle */}
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none ml-1">
        <input
          type="checkbox"
          checked={includeRoutines}
          onChange={onToggleRoutines}
          className="rounded"
        />
        Routines
      </label>

      <div className="flex-1" />

      {/* Live badge */}
      <LiveConnectionBadge />

      {/* Metrics toggle */}
      {selectedSprintId && (
        <Button
          variant={showMetrics ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onToggleMetrics}
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Metrics
        </Button>
      )}
    </div>
  );
}
