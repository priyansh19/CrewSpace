import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useCompany } from "./CompanyContext";
import { chatSessionsApi } from "../api/chatSessions";
import { streamAgentChat } from "../lib/agentChat";
import type { Agent } from "@crewspaceai/shared";

const MAX_SESSIONS = 50;

export interface ChatParticipant {
  id: string;
  name: string;
  icon: string | null;
  status: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  type: "image" | "file";
  size?: number;
  mimeType?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agentId?: string;
  content: string;
  attachments?: ChatAttachment[];
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

export interface ChatStream {
  streamId: string;
  sessionId: string;
  agentId: string;
  content: string;
  status: "streaming" | "error";
  error?: string;
}

interface ChatContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  streams: ChatStream[];
  setActiveSessionId: (id: string | null) => void;
  openChatWithAgent: (agent: ChatParticipant) => void;
  openChatWithAgents: (agents: ChatParticipant[]) => void;
  updateSession: (id: string, messages: ChatMessage[], participants: ChatParticipant[]) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  persistMessage: (sessionId: string, role: string, content: string, agentId?: string | null, attachments?: ChatAttachment[]) => void;
  sendMessage: (sessionId: string, text: string, attachments?: ChatAttachment[]) => Promise<void>;
  abortStream: (sessionId: string) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function isServerSession(id: string) {
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
  const [streams, setStreams] = useState<ChatStream[]>([]);

  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  const streamsRef = useRef(streams);
  useEffect(() => { streamsRef.current = streams; }, [streams]);

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
    (sessionId: string, role: string, content: string, agentId?: string | null, _attachments?: ChatAttachment[]) => {
      if (!isServerSession(sessionId) || !content.trim()) return;
      chatSessionsApi.appendMessage(sessionId, { role, content, agentId }).catch(() => {});
    },
    [],
  );

  const sendMessage = useCallback(
    async (sessionId: string, text: string, attachments?: ChatAttachment[]) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;

      // Gate: don't start a new message while this session is already streaming
      const isStreaming = streamsRef.current.some(
        (s) => s.sessionId === sessionId && s.status === "streaming",
      );
      if (isStreaming) return;

      // 1. Add user message to session
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        attachments,
        ts: new Date(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...s.messages, userMsg], updatedAt: new Date() }
            : s,
        ),
      );
      if (isServerSession(sessionId)) {
        persistMessage(sessionId, "user", text, undefined, attachments);
      }

      const history = [...session.messages, userMsg];

      // 2. Stream for each participant sequentially
      for (const agent of session.participants) {
        const streamId = `stream-${agent.id}-${Date.now()}`;
        setStreams((prev) => [
          ...prev,
          { streamId, sessionId, agentId: agent.id, content: "", status: "streaming" },
        ]);

        let finalContent = "";
        try {
          const result = await streamAgentChat(
            agent as unknown as Agent,
            history,
            selectedCompanyId ?? undefined,
            undefined,
            (partial) => {
              setStreams((prev) =>
                prev.map((s) =>
                  s.streamId === streamId ? { ...s, content: partial } : s,
                ),
              );
            },
          );
          finalContent = result;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          setStreams((prev) =>
            prev.map((s) =>
              s.streamId === streamId ? { ...s, status: "error", error: errMsg } : s,
            ),
          );
          // Remove error stream after a short delay
          setTimeout(() => {
            setStreams((prev) => prev.filter((s) => s.streamId !== streamId));
          }, 3000);
          continue;
        }

        // 3. Add final agent message to session
        const agentMsg: ChatMessage = {
          id: `agent-${agent.id}-${Date.now()}`,
          role: "agent",
          agentId: agent.id,
          content: finalContent,
          ts: new Date(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, agentMsg], updatedAt: new Date() }
              : s,
          ),
        );
        if (isServerSession(sessionId) && finalContent.trim()) {
          persistMessage(sessionId, "agent", finalContent, agent.id);
        }

        // 4. Remove completed stream
        setStreams((prev) => prev.filter((s) => s.streamId !== streamId));
      }
    },
    [selectedCompanyId, persistMessage],
  );

  const abortStream = useCallback((sessionId: string) => {
    setStreams((prev) => prev.filter((s) => s.sessionId !== sessionId));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSessionId,
        streams,
        setActiveSessionId,
        openChatWithAgent,
        openChatWithAgents,
        updateSession,
        deleteSession,
        renameSession,
        persistMessage,
        sendMessage,
        abortStream,
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
