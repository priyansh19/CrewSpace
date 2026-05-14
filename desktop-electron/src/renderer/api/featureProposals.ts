import { api } from "./client";

export interface FeatureProposal {
  id: string;
  companyId: string;
  proposedByAgentId: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: "pending" | "accepted" | "rejected";
  createdIssueId: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const featureProposalsApi = {
  list: (companyId: string, status?: string) =>
    api.get<FeatureProposal[]>(
      `/companies/${companyId}/feature-proposals${status ? `?status=${status}` : ""}`,
    ),

  create: (companyId: string, data: {
    title: string;
    description: string;
    category?: string;
    priority?: string;
    proposedByAgentId?: string;
  }) =>
    api.post<FeatureProposal>(`/companies/${companyId}/feature-proposals`, data),

  accept: (companyId: string, proposalId: string) =>
    api.patch<{ proposal: FeatureProposal; issue: { id: string; title: string } }>(
      `/companies/${companyId}/feature-proposals/${proposalId}`,
      { status: "accepted" },
    ),

  reject: (companyId: string, proposalId: string) =>
    api.patch<FeatureProposal>(
      `/companies/${companyId}/feature-proposals/${proposalId}`,
      { status: "rejected" },
    ),
};
