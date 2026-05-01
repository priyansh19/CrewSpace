import type {
  Agent,
  AgentDetail,
  AgentInstructionsBundle,
  AgentInstructionsFileDetail,
  AgentSkillSnapshot,
  AdapterEnvironmentTestResult,
  AgentKeyCreated,
  AgentRuntimeState,
  AgentTaskSession,
  HeartbeatRun,
  HeartbeatRunEvent,
  Approval,
  AgentConfigRevision,
} from "@crewspaceai/shared";
import { isUuidLike, normalizeAgentUrlKey } from "@crewspaceai/shared";
import { ApiError, api } from "./client";

export interface AgentKey {
  id: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface AdapterModel {
  id: string;
  label: string;
}

export interface DetectedAdapterModel {
  model: string;
  provider: string;
  source: string;
}

export interface ClaudeLoginResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  loginUrl: string | null;
  stdout: string;
  stderr: string;
}

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

export interface AgentHireResponse {
  agent: Agent;
  approval: Approval | null;
}

export interface AgentPermissionUpdate {
  canCreateAgents: boolean;
  canAssignTasks: boolean;
}

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

function agentPath(id: string, companyId?: string, suffix = "") {
  return withCompanyScope(`/agents/${encodeURIComponent(id)}${suffix}`, companyId);
}

export const agentsApi = {
  list: (companyId: string) => api.get<Agent[]>(`/companies/${companyId}/agents`),
  org: (companyId: string) => api.get<OrgNode[]>(`/companies/${companyId}/org`),
  listConfigurations: (companyId: string) =>
    api.get<Record<string, unknown>[]>(`/companies/${companyId}/agent-configurations`),
  get: async (id: string, companyId?: string) => {
    try {
      return await api.get<AgentDetail>(agentPath(id, companyId));
    } catch (error) {
      // Backward-compat fallback: if backend shortname lookup reports ambiguity,
      // resolve using company agent list while ignoring terminated agents.
      if (
        !(error instanceof ApiError) ||
        error.status !== 409 ||
        !companyId ||
        isUuidLike(id)
      ) {
        throw error;
      }

      const urlKey = normalizeAgentUrlKey(id);
      if (!urlKey) throw error;

      const agents = await api.get<Agent[]>(`/companies/${companyId}/agents`);
      const matches = agents.filter(
        (agent) => agent.status !== "terminated" && normalizeAgentUrlKey(agent.urlKey) === urlKey,
      );
      if (matches.length !== 1) throw error;
      return api.get<AgentDetail>(agentPath(matches[0]!.id, companyId));
    }
  },
  getConfiguration: (id: string, companyId?: string) =>
    api.get<Record<string, unknown>>(agentPath(id, companyId, "/configuration")),
  listConfigRevisions: (id: string, companyId?: string) =>
    api.get<AgentConfigRevision[]>(agentPath(id, companyId, "/config-revisions")),
  getConfigRevision: (id: string, revisionId: string, companyId?: string) =>
    api.get<AgentConfigRevision>(agentPath(id, companyId, `/config-revisions/${revisionId}`)),
  rollbackConfigRevision: (id: string, revisionId: string, companyId?: string) =>
    api.post<Agent>(agentPath(id, companyId, `/config-revisions/${revisionId}/rollback`), {}),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Agent>(`/companies/${companyId}/agents`, data),
  hire: (companyId: string, data: Record<string, unknown>) =>
    api.post<AgentHireResponse>(`/companies/${companyId}/agent-hires`, data),
  update: (id: string, data: Record<string, unknown>, companyId?: string) =>
    api.patch<Agent>(agentPath(id, companyId), data),
  updatePermissions: (id: string, data: AgentPermissionUpdate, companyId?: string) =>
    api.patch<AgentDetail>(agentPath(id, companyId, "/permissions"), data),
  instructionsBundle: (id: string, companyId?: string) =>
    api.get<AgentInstructionsBundle>(agentPath(id, companyId, "/instructions-bundle")),
  updateInstructionsBundle: (
    id: string,
    data: {
      mode?: "managed" | "external";
      rootPath?: string | null;
      entryFile?: string;
      clearLegacyPromptTemplate?: boolean;
    },
    companyId?: string,
  ) => api.patch<AgentInstructionsBundle>(agentPath(id, companyId, "/instructions-bundle"), data),
  instructionsFile: (id: string, relativePath: string, companyId?: string) =>
    api.get<AgentInstructionsFileDetail>(
      agentPath(id, companyId, `/instructions-bundle/file?path=${encodeURIComponent(relativePath)}`),
    ),
  saveInstructionsFile: (
    id: string,
    data: { path: string; content: string; clearLegacyPromptTemplate?: boolean },
    companyId?: string,
  ) => api.put<AgentInstructionsFileDetail>(agentPath(id, companyId, "/instructions-bundle/file"), data),
  deleteInstructionsFile: (id: string, relativePath: string, companyId?: string) =>
    api.delete<AgentInstructionsBundle>(
      agentPath(id, companyId, `/instructions-bundle/file?path=${encodeURIComponent(relativePath)}`),
    ),
  pause: (id: string, companyId?: string) => api.post<Agent>(agentPath(id, companyId, "/pause"), {}),
  resume: (id: string, companyId?: string) => api.post<Agent>(agentPath(id, companyId, "/resume"), {}),
  terminate: (id: string, companyId?: string) => api.post<Agent>(agentPath(id, companyId, "/terminate"), {}),
  remove: (id: string, companyId?: string) => api.delete<{ ok: true }>(agentPath(id, companyId)),
  listKeys: (id: string, companyId?: string) => api.get<AgentKey[]>(agentPath(id, companyId, "/keys")),
  skills: (id: string, companyId?: string) =>
    api.get<AgentSkillSnapshot>(agentPath(id, companyId, "/skills")),
  syncSkills: (id: string, desiredSkills: string[], companyId?: string) =>
    api.post<AgentSkillSnapshot>(agentPath(id, companyId, "/skills/sync"), { desiredSkills }),
  createKey: (id: string, name: string, companyId?: string) =>
    api.post<AgentKeyCreated>(agentPath(id, companyId, "/keys"), { name }),
  revokeKey: (agentId: string, keyId: string, companyId?: string) =>
    api.delete<{ ok: true }>(agentPath(agentId, companyId, `/keys/${encodeURIComponent(keyId)}`)),
  runtimeState: (id: string, companyId?: string) =>
    api.get<AgentRuntimeState>(agentPath(id, companyId, "/runtime-state")),
  taskSessions: (id: string, companyId?: string) =>
    api.get<AgentTaskSession[]>(agentPath(id, companyId, "/task-sessions")),
  resetSession: (id: string, taskKey?: string | null, companyId?: string) =>
    api.post<void>(agentPath(id, companyId, "/runtime-state/reset-session"), { taskKey: taskKey ?? null }),
  adapterModels: (companyId: string, type: string) =>
    api.get<AdapterModel[]>(
      `/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/models`,
    ),
  detectModel: (companyId: string, type: string) =>
    api.get<DetectedAdapterModel | null>(
      `/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/detect-model`,
    ),
  testEnvironment: (
    companyId: string,
    type: string,
    data: { adapterConfig: Record<string, unknown> },
  ) =>
    api.post<AdapterEnvironmentTestResult>(
      `/companies/${companyId}/adapters/${type}/test-environment`,
      data,
    ),
  invoke: (id: string, companyId?: string) => api.post<HeartbeatRun>(agentPath(id, companyId, "/heartbeat/invoke"), {}),
  wakeup: (
    id: string,
    data: {
      source?: "timer" | "assignment" | "on_demand" | "automation";
      triggerDetail?: "manual" | "ping" | "callback" | "system";
      reason?: string | null;
      payload?: Record<string, unknown> | null;
      idempotencyKey?: string | null;
    },
    companyId?: string,
  ) => api.post<HeartbeatRun | { status: "skipped" }>(agentPath(id, companyId, "/wakeup"), data),
  loginWithClaude: (id: string, companyId?: string) =>
    api.post<ClaudeLoginResult>(agentPath(id, companyId, "/claude-login"), {}),
  availableSkills: () =>
    api.get<{ skills: AvailableSkill[] }>("/skills/available"),
  heartbeatRun: (runId: string) =>
    api.get<HeartbeatRun>(`/heartbeat-runs/${runId}`),
  heartbeatRunEvents: (runId: string, afterSeq = 0) =>
    api.get<HeartbeatRunEvent[]>(`/heartbeat-runs/${runId}/events?afterSeq=${afterSeq}`),
  /**
   * Streaming chat — returns an async generator that yields text chunks.
   * The server responds with SSE: data: {"t":"..."} ... data: [DONE]
   */
  chatStream: async function* (
    id: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    companyId?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const res = await fetch(`/api${agentPath(id, companyId, "/chat")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messages }),
      signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") return;
        let msg: { t?: string; err?: string };
        try {
          msg = JSON.parse(raw);
        } catch {
          /* ignore malformed SSE lines */
          continue;
        }
        if (msg.err) throw new Error(msg.err);
        if (msg.t) yield msg.t;
      }
    }
  },
};

export interface AvailableSkill {
  name: string;
  description: string;
  isCrewSpaceManaged: boolean;
}
