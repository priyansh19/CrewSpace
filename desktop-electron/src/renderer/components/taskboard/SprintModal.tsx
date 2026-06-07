import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Sprint } from "@/api/sprints";

interface SprintModalProps {
  open: boolean;
  sprint?: Sprint | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
  }) => void;
  isLoading?: boolean;
}

export function SprintModal({ open, sprint, onClose, onSubmit, isLoading }: SprintModalProps) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? "");
      setStartDate(sprint.startDate ? sprint.startDate.slice(0, 10) : "");
      setEndDate(sprint.endDate ? sprint.endDate.slice(0, 10) : "");
    } else {
      setName("");
      setGoal("");
      const today = new Date();
      const end = new Date(today);
      end.setDate(today.getDate() + 14);
      setStartDate(today.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    }
  }, [sprint, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      goal: goal.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sprint ? "Edit Sprint" : "New Sprint"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">Name</Label>
            <Input
              id="sprint-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sprint-goal">
              Goal{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Textarea
              id="sprint-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What should be accomplished this sprint?"
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start">Start date</Label>
              <Input
                id="sprint-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-end">End date</Label>
              <Input
                id="sprint-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Saving…" : sprint ? "Save changes" : "Create sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
