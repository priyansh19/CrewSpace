import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/context/CompanyContext";
import { agentsApi } from "@/api/agents";
import { issuesApi } from "@/api/issues";
import { heartbeatsApi } from "@/api/heartbeats";
import { queryKeys } from "@/lib/queryKeys";
import { useOfficeStore } from "@/stores/officeStore";

/** Fetches Nexus backend data and feeds it into the office store */
const LiveDataBridge = () => {
  const { selectedCompanyId } = useCompany();
  const setBackendSnapshot = useOfficeStore((s) => s.setBackendSnapshot);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId ?? ""),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId ?? ""),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!agents) return;

    setBackendSnapshot({
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role ?? "engineer",
        title: a.title ?? null,
        status: a.status ?? "idle",
        capabilities: a.capabilities ?? null,
        lastHeartbeatAt: a.lastHeartbeatAt ? (a.lastHeartbeatAt instanceof Date ? a.lastHeartbeatAt.toISOString() : String(a.lastHeartbeatAt)) : null,
        reportsTo: a.reportsTo ?? null,
        urlKey: a.urlKey ?? null,
      })),
      issues: (issues ?? []).map((issue) => ({
        id: issue.id,
        companyId: issue.companyId ?? selectedCompanyId ?? "",
        title: issue.title,
        status: issue.status,
        assigneeAgentId: issue.assigneeAgentId ?? null,
        updatedAt: issue.updatedAt instanceof Date ? issue.updatedAt.toISOString() : String(issue.updatedAt),
      })),
      liveRuns: (liveRuns ?? []).map((r) => ({ id: r.id, agentId: r.agentId })),
    });
  }, [agents, issues, liveRuns, setBackendSnapshot, selectedCompanyId]);

  return null;
};

export default LiveDataBridge;
