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
  accentColor: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  backlog: {
    label: "Backlog",
    borderColor: "border-border",
    headerBg: "bg-muted/60 dark:bg-slate-800/70",
    badgeCls: "bg-muted text-muted-foreground",
    accentColor: "#64748b",
  },
  todo: {
    label: "Todo",
    borderColor: "border-blue-300 dark:border-blue-700",
    headerBg: "bg-blue-50 dark:bg-blue-900/50",
    badgeCls: "bg-blue-100 text-blue-700 dark:bg-blue-800/60 dark:text-blue-200",
    accentColor: "#3b82f6",
  },
  in_progress: {
    label: "In Progress",
    borderColor: "border-yellow-300 dark:border-yellow-700",
    headerBg: "bg-yellow-50 dark:bg-yellow-900/50",
    badgeCls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-800/60 dark:text-yellow-200",
    accentColor: "#eab308",
  },
  in_review: {
    label: "In Review",
    borderColor: "border-violet-300 dark:border-violet-700",
    headerBg: "bg-violet-50 dark:bg-violet-900/50",
    badgeCls: "bg-violet-100 text-violet-700 dark:bg-violet-800/60 dark:text-violet-200",
    accentColor: "#8b5cf6",
  },
  blocked: {
    label: "Blocked",
    borderColor: "border-red-300 dark:border-red-700",
    headerBg: "bg-red-50 dark:bg-red-900/50",
    badgeCls: "bg-red-100 text-red-700 dark:bg-red-800/60 dark:text-red-200",
    accentColor: "#ef4444",
  },
  done: {
    label: "Done",
    borderColor: "border-green-300 dark:border-green-700",
    headerBg: "bg-green-50 dark:bg-green-900/50",
    badgeCls: "bg-green-100 text-green-700 dark:bg-green-800/60 dark:text-green-200",
    accentColor: "#22c55e",
  },
  cancelled: {
    label: "Cancelled",
    borderColor: "border-border",
    headerBg: "bg-muted/40 dark:bg-slate-800/50",
    badgeCls: "bg-muted text-muted-foreground",
    accentColor: "#94a3b8",
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
