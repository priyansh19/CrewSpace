export interface AgentBurnEntry {
  agentId: string;
  agentName: string;
  costCents: number;
  runsToday: number;
}

export interface RecentActivityEntry {
  id: string;
  title: string;
  completedAt: string;
  assigneeAgentName: string | null;
  assigneeAgentId: string | null;
}

export interface PendingApprovalEntry {
  id: string;
  type: string;
  requestedByAgentId: string | null;
  requestedByAgentName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
    todayCompleted: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
    todaySpendCents: number;
  };
  pendingApprovals: number;
  pendingApprovalsList: PendingApprovalEntry[];
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  agentBurnToday: AgentBurnEntry[];
  recentCompleted: RecentActivityEntry[];
}
