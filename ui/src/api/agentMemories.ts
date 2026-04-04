import { api } from "./client";

export interface AgentMemory {
  id: string;
  companyId: string;
  title: string;
  content: string | null;
  memoryType: string;
  metadata: Record<string, unknown> | null;
  archivedAt: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  agents: Array<{
    memoryId: string;
    agentId: string;
    isOwner: boolean;
    agentName: string | null;
    agentIcon: string | null;
    agentStatus: string | null;
  }>;
}

export interface AgentMemoryLink {
  id: string;
  companyId: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: string;
  label: string | null;
  weight: string | null;
  createdAt: string;
}

export interface MemoryGraph {
  memories: AgentMemory[];
  links: AgentMemoryLink[];
}

export const agentMemoriesApi = {
  getGraph: (companyId: string) =>
    api.get<MemoryGraph>(`/companies/${companyId}/memories/graph`),

  create: (
    companyId: string,
    data: {
      title: string;
      content?: string;
      memoryType?: string;
      agentIds?: string[];
    },
  ) => api.post<AgentMemory>(`/companies/${companyId}/memories`, data),

  update: (
    id: string,
    data: { title?: string; content?: string; memoryType?: string },
  ) => api.patch<AgentMemory>(`/memories/${id}`, data),

  remove: (id: string) => api.delete<void>(`/memories/${id}`),

  createLink: (
    companyId: string,
    data: {
      sourceMemoryId: string;
      targetMemoryId: string;
      relationshipType?: string;
      label?: string;
    },
  ) => api.post<AgentMemoryLink>(`/companies/${companyId}/memories/links`, data),

  removeLink: (linkId: string) =>
    api.delete<void>(`/memories/links/${linkId}`),

  // Task-specific endpoints
  saveTaskSolution: (
    companyId: string,
    data: {
      agentId: string;
      taskTitle: string;
      approach: string;
      outcome?: string;
    },
  ) => api.post<AgentMemory>(`/companies/${companyId}/task-solutions`, data),

  findSimilarTasks: (companyId: string, agentId: string, query: string) =>
    api.get<AgentMemory[]>(
      `/companies/${companyId}/agents/${agentId}/similar-tasks?query=${encodeURIComponent(query)}`,
    ),
};
