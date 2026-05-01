import { api } from "./client";
import type { ProjectGithubRepo, ProjectRepoPermission, GithubConnectRequest, GithubRepoSummary } from "@crewspaceai/shared";

export const githubIntegrationApi = {
  getRepo: (companyId: string, projectId: string) =>
    api.get<ProjectGithubRepo>(`/companies/${companyId}/projects/${projectId}/github/repo`),

  connectRepo: (companyId: string, projectId: string, data: GithubConnectRequest) =>
    api.post<ProjectGithubRepo>(`/companies/${companyId}/projects/${projectId}/github/repo`, data),

  disconnectRepo: (companyId: string, projectId: string) =>
    api.delete<void>(`/companies/${companyId}/projects/${projectId}/github/repo`),

  getRepos: (companyId: string, projectId: string) =>
    api.get<GithubRepoSummary[]>(`/companies/${companyId}/projects/${projectId}/github/repos`),

  getBranches: (companyId: string, projectId: string) =>
    api.get<string[]>(`/companies/${companyId}/projects/${projectId}/github/branches`),

  listAgentPermissions: (companyId: string, projectId: string) =>
    api.get<ProjectRepoPermission[]>(`/companies/${companyId}/projects/${projectId}/github/agents`),

  setAgentPermission: (companyId: string, projectId: string, data: { agentId: string; canRead: boolean; canPush: boolean; canCreateBranch: boolean }) =>
    api.post<ProjectRepoPermission>(`/companies/${companyId}/projects/${projectId}/github/agents`, data),

  removeAgentPermission: (companyId: string, projectId: string, agentId: string) =>
    api.delete<void>(`/companies/${companyId}/projects/${projectId}/github/agents/${agentId}`),
};
