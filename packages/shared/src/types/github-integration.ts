export interface ProjectGithubRepo {
  id: string;
  projectId: string;
  companyId: string;
  installationId: number;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  connectedAt: Date;
  updatedAt: Date;
}

export interface ProjectRepoPermission {
  id: string;
  projectId: string;
  agentId: string;
  canRead: boolean;
  canPush: boolean;
  canCreateBranch: boolean;
  createdAt: Date;
}

export interface GithubConnectRequest {
  installationId: number;
  repoFullName: string;
  defaultBranch?: string;
}

export interface GithubAgentPermissionUpdate {
  agentId: string;
  canRead: boolean;
  canPush: boolean;
  canCreateBranch: boolean;
}

export interface GithubRepoSummary {
  fullName: string;
  defaultBranch: string;
}
