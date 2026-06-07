export interface SharedWorkspaceFile {
  id: string;
  companyId: string;
  projectId: string | null;
  filename: string;
  storedPath: string;
  sizeBytes: number;
  uploadedByAgentId: string | null;
  createdAt: Date;
}

export interface SharedWorkspacePermission {
  id: string;
  projectId: string;
  agentId: string;
  canRead: boolean;
  canWrite: boolean;
  createdAt: Date;
}

export interface WorkspaceFileListItem {
  id: string;
  name: string;
  sizeBytes: number;
  projectId: string | null;
  createdAt: Date;
}
