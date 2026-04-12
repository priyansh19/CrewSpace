import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const MAX_SESSIONS = 50;
import type { Agent } from "@crewspaceai/shared";

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
  participants: Agent[];
  messages: ChatMessage[];
  updatedAt: Date;
}

interface ChatContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  openChatWithAgent: (agent: Agent) => void;
  openChatWithAgents: (agents: Agent[]) => void;
  updateSession: (id: string, messages: ChatMessage[], participants: Agent[]) => void;
  bulkInitSessions: (agents: Agent[]) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const openChatWithAgent = useCallback((agent: Agent) => {
    setIsChatOpen(true);
    setSessions((prev) => {
      const existing = prev.find(
        (s) => s.primaryAgentId === agent.id && s.participants.length === 1,
      );
      if (existing) {
        setActiveSessionId(existing.id);
        return prev;
      }
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        primaryAgentId: agent.id,
        participants: [agent],
        messages: [],
        updatedAt: new Date(),
      };
      setActiveSessionId(newSession.id);
      const next = [...prev, newSession];
      return next.length > MAX_SESSIONS
        ? next.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, MAX_SESSIONS)
        : next;
    });
  }, []);

  const openChatWithAgents = useCallback((agents: Agent[]) => {
    if (agents.length === 0) return;
    if (agents.length === 1) { openChatWithAgent(agents[0]); return; }
    setIsChatOpen(true);
    setSessions((prev) => {
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        primaryAgentId: agents[0].id,
        participants: agents,
        messages: [],
        updatedAt: new Date(),
      };
      setActiveSessionId(newSession.id);
      const next = [...prev, newSession];
      return next.length > MAX_SESSIONS
        ? next.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, MAX_SESSIONS)
        : next;
    });
  }, [openChatWithAgent]);

  const updateSession = useCallback(
    (id: string, messages: ChatMessage[], participants: Agent[]) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, messages, participants, updatedAt: new Date() } : s,
        ),
      );
    },
    [],
  );

  // Creates one session per agent — only runs when sessions list is empty (first load)
  const bulkInitSessions = useCallback((agents: Agent[]) => {
    setSessions((prev) => {
      if (prev.length > 0) return prev;
      return agents.map((agent, i) => ({
        id: `session-init-${agent.id}`,
        primaryAgentId: agent.id,
        participants: [agent],
        messages: [],
        updatedAt: new Date(Date.now() - i * 1000),
      }));
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{ sessions, activeSessionId, setActiveSessionId, openChatWithAgent, openChatWithAgents, updateSession, bulkInitSessions, isChatOpen, setIsChatOpen }}
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
