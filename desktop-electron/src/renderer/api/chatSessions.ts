import { api } from "./client";

export interface ChatSessionParticipant {
  agentId: string;
  agentName: string | null;
  agentIcon: string | null;
  agentStatus: string | null;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  agentId: string | null;
  createdAt: string;
}

export interface ChatSessionSummary {
  id: string;
  companyId: string;
  primaryAgentId: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ChatSessionParticipant[];
  lastMessage: { content: string; role: string; createdAt: string } | null;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatMessageRecord[];
}

export const chatSessionsApi = {
  list: (companyId: string) =>
    api.get<ChatSessionSummary[]>(`/companies/${companyId}/chat-sessions`),

  get: (id: string) =>
    api.get<ChatSessionDetail>(`/chat-sessions/${id}`),

  create: (companyId: string, input: { primaryAgentId: string; participantIds?: string[]; name?: string }) =>
    api.post<ChatSessionSummary>(`/companies/${companyId}/chat-sessions`, input),

  rename: (id: string, name: string) =>
    api.patch<ChatSessionSummary>(`/chat-sessions/${id}`, { name }),

  remove: (id: string) =>
    api.delete<void>(`/chat-sessions/${id}`),

  appendMessage: (id: string, input: { role: string; content: string; agentId?: string | null }) =>
    api.post<ChatMessageRecord>(`/chat-sessions/${id}/messages`, input),
};
