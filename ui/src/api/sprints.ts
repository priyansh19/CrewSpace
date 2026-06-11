import { api } from "./client";

export interface Sprint {
  id: string;
  companyId: string;
  name: string;
  goal: string | null;
  status: "upcoming" | "active" | "completed";
  startDate: string | null;
  endDate: string | null;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SprintBurndownPoint {
  date: string;
  remaining: number;
  completed: number;
  ideal: number;
}

export interface SprintAgentBreakdown {
  agentId: string;
  agentName: string;
  total: number;
  done: number;
  inProgress: number;
  todo: number;
}

export interface SprintBurndown {
  sprintId: string;
  totalIssues: number;
  statusCounts: Record<string, number>;
  points: SprintBurndownPoint[];
  agentBreakdown: SprintAgentBreakdown[];
}

export interface SprintSummary {
  sprint: Sprint;
  totalIssues: number;
  done: number;
  inProgress: number;
  todo: number;
  completionPct: number;
  agentBreakdown: { agentId: string; agentName: string; total: number; done: number }[];
}

export const sprintsApi = {
  list: (companyId: string) =>
    api.get<Sprint[]>(`/companies/${companyId}/sprints`),

  create: (
    companyId: string,
    data: { name: string; goal?: string; status?: string; startDate?: string; endDate?: string },
  ) => api.post<Sprint>(`/companies/${companyId}/sprints`, data),

  get: (id: string) => api.get<Sprint>(`/sprints/${id}`),

  update: (
    id: string,
    data: { name?: string; goal?: string | null; status?: string; startDate?: string | null; endDate?: string | null },
  ) => api.patch<Sprint>(`/sprints/${id}`, data),

  delete: (id: string) => api.delete<{ ok: true }>(`/sprints/${id}`),

  listIssues: (sprintId: string) =>
    api.get<import("@crewspaceai/shared").Issue[]>(`/sprints/${sprintId}/issues`),

  addIssue: (sprintId: string, issueId: string) =>
    api.post<{ ok: true }>(`/sprints/${sprintId}/issues`, { issueId }),

  removeIssue: (sprintId: string, issueId: string) =>
    api.delete<{ ok: true }>(`/sprints/${sprintId}/issues/${issueId}`),

  burndown: (sprintId: string) =>
    api.get<SprintBurndown>(`/sprints/${sprintId}/burndown`),

  summary: (sprintId: string) =>
    api.get<SprintSummary>(`/sprints/${sprintId}/summary`),
};
