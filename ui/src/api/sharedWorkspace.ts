import { api } from "./client";

export interface WorkspaceFile {
  name: string;
  sizeBytes: number;
}

export const sharedWorkspaceApi = {
  list: (companyId: string) =>
    api.get<WorkspaceFile[]>(`/companies/${companyId}/shared-workspace/files`),

  upload: (companyId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.postForm<WorkspaceFile>(`/companies/${companyId}/shared-workspace/files`, form);
  },

  download: (companyId: string, filename: string) =>
    fetch(`/api/companies/${companyId}/shared-workspace/files/${encodeURIComponent(filename)}`, {
      credentials: "include",
      cache: "no-store",
    }),

  remove: (companyId: string, filename: string) =>
    api.delete<void>(`/companies/${companyId}/shared-workspace/files/${encodeURIComponent(filename)}`),
};
