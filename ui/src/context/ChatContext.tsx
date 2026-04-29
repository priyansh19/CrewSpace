import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useCompany } from "./CompanyContext";
import { chatSessionsApi } from "../api/chatSessions";

const MAX_SESSIONS = 50;

export interface ChatParticipant {
  id: string;
  name: string;
  icon: string | null;
  status: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agentId?: string;
  content: string;
  ts: Date;
}

export interface ChatSession {
  id: string;
  primaryAgentId: string;
  participants: ChatParticipant[];
  messages: ChatMessage[];
  updatedAt: Date;
  name?: string;
}

interface ChatContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  openChatWithAgent: (agent: ChatParticipant) => void;
  openChatWithAgents: (agents: ChatParticipant[]) => void;
  updateSession: (id: string, messages: ChatMessage[], participants: ChatParticipant[]) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  persistMessage: (sessionId: string, role: string, content: string, agentId?: string | null) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function isServerSession(id: string) {
  return !id.startsWith("session-");
}

function serverToLocal(s: Awaited<ReturnType<typeof chatSessionsApi.list>>[number]): ChatSession {
  return {
    id: s.id,
    primaryAgentId: s.primaryAgentId,
    name: s.name ?? undefined,
    updatedAt: new Date(s.updatedAt),
    participants: s.participants.map((p) => ({
      id: p.agentId,
      name: p.agentName ?? "Agent",
      icon: p.agentIcon,
      status: p.agentStatus ?? "active",
    })),
    messages: [],
  };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { selectedCompanyId } = useCompany();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Load sessions from server when company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setSessions([]);
      return;
    }
    chatSessionsApi.list(selectedCompanyId).then((serverSessions) => {
      setSessions(serverSessions.map(serverToLocal));
    }).catch(() => { /* server may not be available */ });
  }, [selectedCompanyId]);

  // Load messages for active session on demand
  useEffect(() => {
    if (!activeSessionId || !isServerSession(activeSessionId)) return;
    setSessions((prev) => {
      const session = prev.find((s) => s.id === activeSessionId);
      if (!session || session.messages.length > 0) return prev; // already loaded
      return prev; // trigger async fetch below
    });

    // Check if messages already loaded synchronously before fetching
    setSessions((prev) => {
      const session = prev.find((s) => s.id === activeSessionId);
      if (!session || session.messages.length > 0) return prev;
      // Kick off async fetch
      chatSessionsApi.get(activeSessionId).then((full) => {
        if (!full) return;
        setSessions((current) =>
          current.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  participants: full.participants.map((p) => ({
                    id: p.agentId,
                    name: p.agentName ?? "Agent",
                    icon: p.agentIcon,
                    status: p.agentStatus ?? "active",
                  })),
                  messages: full.messages.map((m) => ({
                    id: m.id,
                    role: m.role === "user" ? "user" : "agent",
                    agentId: m.agentId ?? undefined,
                    content: m.content,
                    ts: new Date(m.createdAt),
                  })),
                }
              : s,
          ),
        );
      }).catch(() => {});
      return prev;
    });
  }, [activeSessionId]);

  const openChatWithAgent = useCallback(
    async (agent: ChatParticipant) => {
      setIsChatOpen(true);

      // Check for existing single-agent session with this agent
      let existingId: string | null = null;
      setSessions((prev) => {
        const found = prev.find(
          (s) => s.primaryAgentId === agent.id && s.participants.length === 1,
        );
        if (found) existingId = found.id;
        return prev;
      });
      if (existingId) {
        setActiveSessionId(existingId);
        return;
      }

      let sessionId = `session-${Date.now()}`;
      if (selectedCompanyId) {
        try {
          const created = await chatSessionsApi.create(selectedCompanyId, {
            primaryAgentId: agent.id,
            participantIds: [],
          });
          sessionId = created.id;
        } catch { /* fall back to temp id */ }
      }

      const newSession: ChatSession = {
        id: sessionId,
        primaryAgentId: agent.id,
        participants: [agent],
        messages: [],
        updatedAt: new Date(),
      };
      setActiveSessionId(newSession.id);
      setSessions((prev) => {
        const next = [...prev, newSession];
        return next.length > MAX_SESSIONS
          ? next.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, MAX_SESSIONS)
          : next;
      });
    },
    [selectedCompanyId],
  );

  const openChatWithAgents = useCallback(
    async (agents: ChatParticipant[]) => {
      if (agents.length === 0) return;
      if (agents.length === 1) {
        openChatWithAgent(agents[0]);
        return;
      }
      setIsChatOpen(true);

      let sessionId = `session-${Date.now()}`;
      if (selectedCompanyId) {
        try {
          const created = await chatSessionsApi.create(selectedCompanyId, {
            primaryAgentId: agents[0].id,
            participantIds: agents.slice(1).map((a) => a.id),
          });
          sessionId = created.id;
        } catch { /* fall back to temp id */ }
      }

      const newSession: ChatSession = {
        id: sessionId,
        primaryAgentId: agents[0].id,
        participants: agents,
        messages: [],
        updatedAt: new Date(),
      };
      setActiveSessionId(newSession.id);
      setSessions((prev) => {
        const next = [...prev, newSession];
        return next.length > MAX_SESSIONS
          ? next.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, MAX_SESSIONS)
          : next;
      });
    },
    [selectedCompanyId, openChatWithAgent],
  );

  const updateSession = useCallback(
    (id: string, messages: ChatMessage[], participants: ChatParticipant[]) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, messages, participants, updatedAt: new Date() } : s,
        ),
      );
    },
    [],
  );

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSessionId((prev) => (prev === id ? null : prev));
    if (isServerSession(id)) {
      chatSessionsApi.remove(id).catch(() => {});
    }
  }, []);

  const renameSession = useCallback((id: string, name: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: name.trim() || undefined } : s)),
    );
    if (isServerSession(id)) {
      chatSessionsApi.rename(id, name.trim()).catch(() => {});
    }
  }, []);

  const persistMessage = useCallback(
    (sessionId: string, role: string, content: string, agentId?: string | null) => {
      if (!isServerSession(sessionId) || !content.trim()) return;
      chatSessionsApi.appendMessage(sessionId, { role, content, agentId }).catch(() => {});
    },
    [],
  );

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSessionId,
        setActiveSessionId,
        openChatWithAgent,
        openChatWithAgents,
        updateSession,
        deleteSession,
        renameSession,
        persistMessage,
        isChatOpen,
        setIsChatOpen,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
