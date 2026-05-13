import { useState, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  Pencil,
  EyeOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  customLabel?: string;
  onRenameColumn?: (status: string, label: string) => void;
  onHideColumn?: (status: string) => void;
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
  customLabel,
  onRenameColumn,
  onHideColumn,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog!;
  const label = customLabel ?? cfg.label;
  const limit = wipLimit ?? DEFAULT_WIP_LIMITS[status];
  const isOverWip = limit !== undefined && issues.length > limit;
  const isNearWip = limit !== undefined && !isOverWip && issues.length >= Math.floor(limit * 0.8);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditValue(label);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitEdit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) onRenameColumn?.(status, trimmed);
  }

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-2 w-10 shrink-0 rounded-lg py-3 cursor-pointer select-none transition-opacity hover:opacity-80 border"
        style={{ borderColor: `${cfg.accentColor}40`, backgroundColor: `${cfg.accentColor}12` }}
        onClick={onToggleCollapse}
        title={label}
      >
        <ChevronRight className="h-3.5 w-3.5" style={{ color: cfg.accentColor }} />
        <span className="text-[10px] font-semibold [writing-mode:vertical-rl] rotate-180" style={{ color: cfg.accentColor }}>
          {label}
        </span>
        <span className="text-[9px] px-1 py-0.5 rounded font-bold tabular-nums" style={{ color: cfg.accentColor, backgroundColor: `${cfg.accentColor}20` }}>
          {issues.length}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[240px] min-w-[240px] shrink-0 max-h-full">
      {/* Colored accent bar */}
      <div
        className="h-[3px] rounded-t-lg"
        style={{ backgroundColor: cfg.accentColor }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-2 py-2 border border-b-0 border-t-0"
        style={{ borderColor: `${cfg.accentColor}40`, backgroundColor: `${cfg.accentColor}14` }}
      >
        <button
          onClick={onToggleCollapse}
          className="shrink-0 transition-opacity hover:opacity-70"
          style={{ color: cfg.accentColor }}
          title="Collapse column"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <StatusIcon status={status} />

        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 text-sm font-semibold bg-transparent outline-none min-w-0 border-b"
            style={{ color: cfg.accentColor, borderColor: cfg.accentColor }}
          />
        ) : (
          <span
            className="text-sm font-semibold flex-1 truncate"
            style={{ color: cfg.accentColor }}
            onDoubleClick={startEdit}
            title={label}
          >
            {label}
          </span>
        )}

        {limit !== undefined ? (
          <span
            className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
            style={isOverWip
              ? { color: "var(--destructive)", backgroundColor: "rgba(239,68,68,0.2)" }
              : isNearWip
                ? { color: "var(--warning)", backgroundColor: "rgba(245,158,11,0.2)" }
                : { color: cfg.accentColor, backgroundColor: `${cfg.accentColor}20` }}
            title={isOverWip ? "WIP limit exceeded" : `WIP limit: ${limit}`}
          >
            {isOverWip && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
            {issues.length}/{limit}
          </span>
        ) : (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums shrink-0"
            style={{ color: cfg.accentColor, backgroundColor: `${cfg.accentColor}20` }}
          >
            {issues.length}
          </span>
        )}

        {(onRenameColumn || onHideColumn) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-accent/50"
                title="Column options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onRenameColumn && (
                <DropdownMenuItem onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Rename
                </DropdownMenuItem>
              )}
              {onHideColumn && (
                <DropdownMenuItem onClick={() => onHideColumn(status)}>
                  <EyeOff className="h-3.5 w-3.5 mr-2" />
                  Hide column
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 rounded-b-lg border min-h-[100px] transition-colors",
          isOver ? "bg-accent/40" : "bg-muted/10",
        )}
        style={{ borderColor: `${cfg.accentColor}35`, maxHeight: "calc(100vh - 280px)" }}
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

