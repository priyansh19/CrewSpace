import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/context/CompanyContext";
import { agentsApi } from "@/api/agents";
import { issuesApi } from "@/api/issues";
import { heartbeatsApi } from "@/api/heartbeats";
import { queryKeys } from "@/lib/queryKeys";
import { useOfficeStore } from "@/stores/officeStore";

/** Fetches CrewSpace backend data and feeds it into the office store */
const LiveDataBridge = () => {
  const { selectedCompanyId } = useCompany();
  const setBackendSnapshot = useOfficeStore((s) => s.setBackendSnapshot);
  const lastCompanyId = useRef<string | null>(null);

  const {
    data: agents,
    isError: agentsIsError,
    error: agentsErrorObj,
  } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId ?? ""),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId ?? ""),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
    staleTime: 4_000,
    gcTime: 5 * 60 * 1000,
  });

  // Detect company switches and clear stale data immediately so old
  // agents don't linger while the new company's queries are in flight.
  useEffect(() => {
    if (
      selectedCompanyId &&
      lastCompanyId.current &&
      lastCompanyId.current !== selectedCompanyId
    ) {
      setBackendSnapshot({ agents: [], issues: [], liveRuns: [] });
    }
    lastCompanyId.current = selectedCompanyId ?? null;
  }, [selectedCompanyId, setBackendSnapshot]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    // We need agents data to proceed. issues/liveRuns are optional and
    // default to empty arrays if their queries haven't resolved yet.
    if (agents === undefined) {
      if (agentsIsError) {
        // eslint-disable-next-line no-console
        console.error("[LiveDataBridge] Failed to load agents:", agentsErrorObj);
      }
      return;
    }

    setBackendSnapshot({
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role ?? "engineer",
        title: a.title ?? null,
        status: a.status ?? "idle",
        capabilities: a.capabilities ?? null,
        lastHeartbeatAt: a.lastHeartbeatAt
          ? a.lastHeartbeatAt instanceof Date
            ? a.lastHeartbeatAt.toISOString()
            : String(a.lastHeartbeatAt)
          : null,
        reportsTo: a.reportsTo ?? null,
        urlKey: a.urlKey ?? null,
      })),
      issues: (issues ?? []).map((issue) => ({
        id: issue.id,
        companyId: issue.companyId ?? selectedCompanyId ?? "",
        title: issue.title,
        status: issue.status,
        assigneeAgentId: issue.assigneeAgentId ?? null,
        updatedAt:
          issue.updatedAt instanceof Date
            ? issue.updatedAt.toISOString()
            : String(issue.updatedAt),
      })),
      liveRuns: (liveRuns ?? []).map((r) => ({ id: r.id, agentId: r.agentId })),
    });
  }, [
    agents,
    agentsIsError,
    agentsErrorObj,
    issues,
    liveRuns,
    setBackendSnapshot,
    selectedCompanyId,
  ]);

  return null;
};

export default LiveDataBridge;
