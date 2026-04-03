import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Send,
  X,
  Search,
  MessageCircle,
  AlertCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentIcon } from "./AgentIconPicker";
import { cn } from "@/lib/utils";
import { useChat, type ChatSession } from "../context/ChatContext";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { agentDotColor, formatChatTime, streamAgentChat } from "../lib/agentChat";
import type { ChatMessage } from "../context/ChatContext";
import type { Agent } from "@paperclipai/shared";

function timeAgoShort(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── New Chat Agent Picker ─────────────────────────────────────────────────────

function NewChatMenu({
  allAgents,
  onStart,
}: {
  allAgents: Agent[];
  onStart: (agent: Agent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = allAgents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
        title="New chat"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div className="absolute top-7 right-0 z-50 w-52 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No agents found</p>
            ) : (
              filtered.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    onStart(agent);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="relative shrink-0">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                      <AgentIcon icon={(agent as any).icon} className="h-3 w-3 text-foreground/60" />
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-popover"
                      style={{ backgroundColor: agentDotColor(agent.status) }}
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{agent.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {(agent as any).title ?? agent.role}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Participant Menu ───────────────────────────────────────────────────────

function AddParticipantMenu({
  allAgents,
  participants,
  onAdd,
}: {
  allAgents: Agent[];
  participants: Agent[];
  onAdd: (agent: Agent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const participantIds = new Set(participants.map((p) => p.id));
  const available = allAgents.filter(
    (a) => !participantIds.has(a.id) && a.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (allAgents.length <= participants.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-border hover:border-foreground/40 hover:bg-muted/50 transition-colors"
        title="Add agent"
      >
        <Users className="h-2.5 w-2.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-7 left-0 z-50 w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add agent…"
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No agents to add</p>
            ) : (
              available.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    onAdd(agent);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <AgentIcon icon={(agent as any).icon} className="h-2.5 w-2.5 text-foreground/60" />
                  </div>
                  <span className="text-xs text-foreground truncate">{agent.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session List Item ─────────────────────────────────────────────────────────

function SessionListItem({
  session,
  isActive,
  onSelect,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
}) {
  const lastMsg = session.messages[session.messages.length - 1];
  const shown = session.participants.slice(0, 3);
  const extra = session.participants.length - 3;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left",
        isActive && "bg-primary/8 border-l-2 border-primary",
      )}
    >
      {/* Stacked avatars */}
      <div className="relative shrink-0 h-7 w-9 mt-0.5">
        {shown.map((agent, i) => (
          <div
            key={agent.id}
            className="absolute w-5 h-5 rounded-full bg-muted border-[1.5px] border-card flex items-center justify-center"
            style={{ left: i * 5, top: i === 0 ? 0 : i * 1.5, zIndex: shown.length - i }}
          >
            <AgentIcon icon={(agent as any).icon} className="h-2.5 w-2.5 text-foreground/60" />
          </div>
        ))}
        {extra > 0 && (
          <div
            className="absolute w-5 h-5 rounded-full bg-muted border-[1.5px] border-card flex items-center justify-center"
            style={{ left: 3 * 5, top: 3 * 1.5, zIndex: 0 }}
          >
            <span className="text-[8px] text-muted-foreground font-medium">+{extra}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium text-foreground truncate leading-tight">
            {session.participants.map((p) => p.name).join(", ")}
          </span>
          <span className="text-[10px] text-muted-foreground/50 shrink-0 leading-tight tabular-nums">
            {timeAgoShort(session.updatedAt)}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/70 truncate leading-snug">
          {lastMsg
            ? `${lastMsg.role === "user" ? "You: " : ""}${lastMsg.content}`
            : "No messages yet"}
        </span>
      </div>
    </button>
  );
}

// ── Chat Area ─────────────────────────────────────────────────────────────────

function ChatArea({
  session,
  allAgents,
  companyId,
  onUpdate,
  onClose,
}: {
  session: ChatSession;
  allAgents: Agent[];
  companyId: string | undefined;
  onUpdate: (messages: ChatMessage[], participants: Agent[]) => void;
  onClose: () => void;
}) {
  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const [participants, setParticipants] = useState<Agent[]>(session.participants);
  const [messages, setMessages] = useState<ChatMessage[]>(
    session.messages.length > 0
      ? session.messages
      : [
          {
            id: "welcome",
            role: "agent",
            agentId: session.primaryAgentId,
            content: `Hi! I'm ${session.participants[0]?.name ?? "here"}. How can I help?`,
            ts: new Date(),
          },
        ],
  );
  const [input, setInput] = useState("");
  const [typingAgentId, setTypingAgentId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync back to context on change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onUpdate(messages, participants);
  }, [messages, participants]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingAgentId]);

  // Focus input when session opens
  useEffect(() => {
    inputRef.current?.focus();
  }, [session.id]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || typingAgentId) return;
    setSendError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      ts: new Date(),
    };

    const fullHistory: ChatMessage[] = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    abortRef.current = new AbortController();
    for (const agent of participants) {
      if (!isMountedRef.current) break;
      setTypingAgentId(agent.id);

      const streamingId = `agent-${agent.id}-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: streamingId, role: "agent", agentId: agent.id, content: "", ts: new Date() },
      ]);

      await streamAgentChat(
        agent,
        fullHistory,
        companyId,
        abortRef.current.signal,
        (partial) => {
          if (!isMountedRef.current) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === streamingId ? { ...m, content: partial } : m)),
          );
        },
      );

      if (!isMountedRef.current) break;
      setTypingAgentId(null);
    }
  }, [input, messages, participants, companyId, typingAgentId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addParticipant = (agent: Agent) => {
    setParticipants((prev) => [...prev, agent]);
    setMessages((prev) => [
      ...prev,
      {
        id: `join-${agent.id}-${Date.now()}`,
        role: "agent",
        agentId: agent.id,
        content: `Hey everyone! ${agent.name} here. Joining the conversation.`,
        ts: new Date(),
      },
    ]);
  };

  const removeParticipant = (agentId: string) => {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((p) => p.id !== agentId));
  };

  const agentById = (id: string) => participants.find((p) => p.id === id);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0 bg-card/50">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          {participants.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-1 bg-muted/60 border border-border rounded-full pl-1 pr-1.5 py-0.5"
            >
              <div className="relative">
                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                  <AgentIcon icon={(agent as any).icon} className="h-2 w-2 text-foreground/70" />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-card"
                  style={{ backgroundColor: agentDotColor(agent.status) }}
                />
              </div>
              <span className="text-[11px] font-medium text-foreground leading-none">{agent.name}</span>
              {participants.length > 1 && (
                <button
                  onClick={() => removeParticipant(agent.id)}
                  className="ml-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  <X className="h-2 w-2" />
                </button>
              )}
            </div>
          ))}
          <AddParticipantMenu
            allAgents={allAgents}
            participants={participants}
            onAdd={addParticipant}
          />
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
          title="Close chat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="flex flex-col items-end gap-0.5 max-w-[82%]">
                  <div className="px-3 py-2 text-xs leading-relaxed bg-primary text-primary-foreground rounded-2xl rounded-br-sm">
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 px-1">
                    {formatChatTime(msg.ts)}
                  </span>
                </div>
              </div>
            );
          }

          const sender = msg.agentId ? agentById(msg.agentId) : null;
          const color = agentDotColor(msg.agentId ? (sender?.status ?? "idle") : "idle");
          const showName = participants.length > 1;

          return (
            <div key={msg.id} className="flex gap-2 items-end">
              <div className="relative shrink-0 mb-0.5">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                  <AgentIcon
                    icon={sender ? (sender as any).icon : undefined}
                    className="h-2.5 w-2.5 text-foreground/60"
                  />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-card"
                  style={{ backgroundColor: color }}
                />
              </div>

              <div className="flex flex-col gap-0.5 max-w-[82%]">
                {showName && sender && (
                  <span className="text-[10px] font-medium text-muted-foreground px-1 leading-none">
                    {sender.name}
                  </span>
                )}
                <div className="px-3 py-2 text-xs leading-relaxed bg-accent text-foreground rounded-2xl rounded-bl-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/40 px-1">
                  {formatChatTime(msg.ts)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingAgentId &&
          (() => {
            const agent = agentById(typingAgentId);
            const color = agentDotColor(agent?.status ?? "idle");
            return (
              <div className="flex gap-2 items-end">
                <div className="relative shrink-0 mb-0.5">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <AgentIcon
                      icon={agent ? (agent as any).icon : undefined}
                      className="h-2.5 w-2.5 text-foreground/60"
                    />
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-card"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div className="bg-accent px-3 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1 items-center h-3">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

        {sendError && (
          <div className="flex items-start gap-2 px-1">
            <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
            <span className="text-[11px] text-destructive leading-snug">{sendError}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border px-2.5 py-2 shrink-0 bg-card/50">
        <div className="flex gap-1.5 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              participants.length > 1
                ? `Message ${participants.length} agents…`
                : `Message ${participants[0]?.name ?? "agent"}…`
            }
            className="min-h-[32px] max-h-20 resize-none text-xs py-2 leading-relaxed"
            rows={1}
            disabled={!!typingAgentId}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || !!typingAgentId}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 mt-1 select-none">
          {typingAgentId ? "Waiting for response…" : "Enter to send · Shift+Enter new line"}
        </p>
      </div>
    </div>
  );
}

// ── Main ChatSidebar ──────────────────────────────────────────────────────────

export function ChatSidebar() {
  const { sessions, activeSessionId, setActiveSessionId, openChatWithAgent, updateSession } =
    useChat();
  const { selectedCompanyId } = useCompany();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const allAgents = useMemo(() => agents ?? [], [agents]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [sessions],
  );

  const handleUpdate = useCallback(
    (messages: ChatMessage[], participants: Agent[]) => {
      if (activeSessionId) updateSession(activeSessionId, messages, participants);
    },
    [activeSessionId, updateSession],
  );

  const handleCloseChat = useCallback(() => setActiveSessionId(null), [setActiveSessionId]);

  return (
    <aside className="w-[280px] shrink-0 h-full border-l border-border bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-12 shrink-0 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Chats</span>
          {sessions.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none tabular-nums">
              {sessions.length}
            </span>
          )}
        </div>
        <NewChatMenu allAgents={allAgents} onStart={openChatWithAgent} />
      </div>

      {/* Session list */}
      <div
        className={cn(
          "overflow-y-auto divide-y divide-border/30 shrink-0",
          activeSession ? "max-h-[200px]" : "flex-1",
        )}
      >
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-8 gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click <span className="font-semibold">+</span> to start chatting with an agent
              </p>
            </div>
          </div>
        ) : (
          sorted.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={() =>
                setActiveSessionId(session.id === activeSessionId ? null : session.id)
              }
            />
          ))
        )}
      </div>

      {/* Active chat area */}
      {activeSession ? (
        <ChatArea
          key={activeSession.id}
          session={activeSession}
          allAgents={allAgents}
          companyId={selectedCompanyId ?? undefined}
          onUpdate={handleUpdate}
          onClose={handleCloseChat}
        />
      ) : (
        sessions.length > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-2 text-center border-t border-border">
            <MessageCircle className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">Select a conversation to continue</p>
          </div>
        )
      )}
    </aside>
  );
}
