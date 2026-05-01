import { api } from "./client";
import type { SharedWorkspaceFile, SharedWorkspacePermission } from "@crewspaceai/shared";

export const sharedWorkspaceApi = {
  list: (companyId: string, projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return api.get<SharedWorkspaceFile[]>(`/companies/${companyId}/shared-workspace/files${qs}`);
  },

  upload: (companyId: string, file: File, projectId?: string) => {
    const form = new FormData();
    form.append("file", file);
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return api.postForm<SharedWorkspaceFile>(`/companies/${companyId}/shared-workspace/files${qs}`, form);
  },

  download: (companyId: string, fileId: string) =>
    fetch(`/api/companies/${companyId}/shared-workspace/files/${encodeURIComponent(fileId)}/download`, {
      credentials: "include",
      cache: "no-store",
    }),

  remove: (companyId: string, fileId: string) =>
    api.delete<void>(`/companies/${companyId}/shared-workspace/files/${encodeURIComponent(fileId)}`),

  // Permissions
  listPermissions: (companyId: string, projectId: string) =>
    api.get<SharedWorkspacePermission[]>(`/companies/${companyId}/shared-workspace/permissions?projectId=${encodeURIComponent(projectId)}`),

  setPermission: (companyId: string, data: { projectId: string; agentId: string; canRead: boolean; canWrite: boolean }) =>
    api.post<SharedWorkspacePermission>(`/companies/${companyId}/shared-workspace/permissions`, data),

  removePermission: (companyId: string, permId: string) =>
    api.delete<void>(`/companies/${companyId}/shared-workspace/permissions/${permId}`),
};
