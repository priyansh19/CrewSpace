export const BOARD_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export interface StatusConfig {
  label: string;
  borderColor: string;
  headerBg: string;
  badgeCls: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  backlog: {
    label: "Backlog",
    borderColor: "border-border",
    headerBg: "bg-muted/40",
    badgeCls: "bg-muted text-muted-foreground",
  },
  todo: {
    label: "Todo",
    borderColor: "border-blue-200 dark:border-blue-900/50",
    headerBg: "bg-blue-50 dark:bg-blue-950/30",
    badgeCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    borderColor: "border-yellow-200 dark:border-yellow-900/50",
    headerBg: "bg-yellow-50 dark:bg-yellow-950/30",
    badgeCls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  in_review: {
    label: "In Review",
    borderColor: "border-violet-200 dark:border-violet-900/50",
    headerBg: "bg-violet-50 dark:bg-violet-950/30",
    badgeCls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  blocked: {
    label: "Blocked",
    borderColor: "border-red-200 dark:border-red-900/50",
    headerBg: "bg-red-50 dark:bg-red-950/30",
    badgeCls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  done: {
    label: "Done",
    borderColor: "border-green-200 dark:border-green-900/50",
    headerBg: "bg-green-50 dark:bg-green-950/30",
    badgeCls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    borderColor: "border-border",
    headerBg: "bg-muted/20",
    badgeCls: "bg-muted text-muted-foreground",
  },
};

export const PRIORITY_LEFT_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-400",
  low: "border-l-blue-400",
};

export const DEFAULT_WIP_LIMITS: Record<string, number> = {
  todo: 10,
  in_progress: 5,
  in_review: 3,
  blocked: 2,
};
