import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Sprint } from "@/api/sprints";
import type { Issue } from "@crewspaceai/shared";

interface CompleteSprintModalProps {
  open: boolean;
  sprint: Sprint | null;
  incompleteIssues: Issue[];
  completedCount: number;
  nextSprints: Sprint[];
  onClose: () => void;
  onComplete: (destination: string) => void;
  isLoading?: boolean;
}

export function CompleteSprintModal({
  open,
  sprint,
  incompleteIssues,
  completedCount,
  nextSprints,
  onClose,
  onComplete,
  isLoading,
}: CompleteSprintModalProps) {
  const [destination, setDestination] = useState("backlog");

  if (!sprint) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Sprint — {sprint.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
              <AlertCircle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{incompleteIssues.length}</p>
              <p className="text-xs text-muted-foreground">Incomplete</p>
            </div>
          </div>

          {/* Destination for incomplete */}
          {incompleteIssues.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Move {incompleteIssues.length} incomplete issue
                {incompleteIssues.length > 1 ? "s" : ""} to:
              </p>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  {nextSprints.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {incompleteIssues.length <= 5 && (
                <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                  {incompleteIssues.map((issue) => (
                    <li key={issue.id} className="text-xs text-muted-foreground flex items-center gap-1.5 py-0.5">
                      <span className="font-mono text-[10px] shrink-0">{issue.identifier}</span>
                      <span className="truncate">{issue.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onComplete(destination)} disabled={isLoading}>
            {isLoading ? "Completing…" : "Complete Sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
