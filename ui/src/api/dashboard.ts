import type { DashboardSummary } from "@crewspaceai/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string, projectId?: string | null) => {
    const url = projectId
      ? `/companies/${companyId}/dashboard?projectId=${encodeURIComponent(projectId)}`
      : `/companies/${companyId}/dashboard`;
    return api.get<DashboardSummary>(url);
  },
};
