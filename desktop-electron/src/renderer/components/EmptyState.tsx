import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, message, action, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {action && onAction && (
        <Button onClick={onAction} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          {action}
        </Button>
      )}
    </div>
  );
}
