import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { sprintsApi } from "../api/sprints";
import { queryKeys } from "../lib/queryKeys";

const STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "blocked", label: "Blocked" },
];

const PRIORITIES = [
  { value: "critical", label: "! Critical", color: "text-destructive" },
  { value: "high", label: "↑ High", color: "text-primary" },
  { value: "medium", label: "– Medium", color: "text-warning" },
  { value: "low", label: "↓ Low", color: "text-blue-400" },
];

interface CreateTaskDialogProps {
  companyId: string;
  defaultStatus?: string;
  defaultSprintId?: string;
  onClose: () => void;
}

export function CreateTaskDialog({ companyId, defaultStatus = "backlog", defaultSprintId, onClose }: CreateTaskDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(defaultStatus);
  const [priority, setPriority] = useState("medium");
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  const [sprintId, setSprintId] = useState(defaultSprintId ?? "");

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    staleTime: 60_000,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints", companyId],
    queryFn: () => sprintsApi.list(companyId),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const issue = await issuesApi.create(companyId, data);
      // If a sprint is selected, add the issue to it
      if (sprintId && issue.id) {
        await sprintsApi.addIssue(sprintId, issue.id);
      }
      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
      if (sprintId) {
        queryClient.invalidateQueries({ queryKey: ["sprints", companyId] });
        queryClient.invalidateQueries({ queryKey: ["sprint-burndown", sprintId] });
      }
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      assigneeAgentId: assigneeAgentId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-background border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <CircleDot className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground flex-1">New Task</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
          {/* Title */}
          <div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              className="w-full text-sm font-medium bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 text-foreground"
              required
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description… (optional)"
              rows={2}
              className="w-full text-xs bg-muted/30 border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground resize-none"
            />
          </div>

          {/* Row: Status + Priority */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Assign to Agent</label>
            <select
              value={assigneeAgentId}
              onChange={(e) => setAssigneeAgentId(e.target.value)}
              className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
            >
              <option value="">Unassigned</option>
              {agents
                .filter((a) => a.status !== "terminated")
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
          </div>

          {/* Sprint */}
          {sprints.length > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Sprint</label>
              <select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                <option value="">No sprint</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.status === "active" ? "🟢" : s.status === "upcoming" ? "⏳" : "✅"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {createMutation.isError && (
            <p className="text-xs text-destructive">Failed to create task. Please try again.</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


