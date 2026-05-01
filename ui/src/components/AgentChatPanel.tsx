import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Plus, GripHorizontal, Search, MessageCircle, AlertCircle, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentIcon } from "./AgentIconPicker";
import { AgentAvatar } from "./AgentAvatar";
import { cn } from "@/lib/utils";
import { agentDotColor, formatChatTime, streamAgentChat, AGENT_STATUS_COLOR } from "../lib/agentChat";
import type { Agent } from "@crewspaceai/shared";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agentId?: string;
  content: string;
  ts: Date;
}

export interface ChatSession {
  id: string;
  /** The agent whose dot was clicked to start the session. */
  primaryAgentId: string;
  participants: Agent[];
  messages: ChatMessage[];
  updatedAt: Date;
}

export interface AgentChatPanelProps {
  sessionId: string;
  initialAgent: Agent;
  initialStatus: string;
  initialMessages?: ChatMessage[];
  initialParticipants?: Agent[];
  allAgents: Agent[];
  statusMap: Record<string, string>;
  companyId?: string;
  spawnX: number;
  spawnY: number;
  onClose: () => void;
  onSessionUpdate: (sessionId: string, messages: ChatMessage[], participants: Agent[]) => void;
}


// ── Participant pill ──────────────────────────────────────────────────────────

function ParticipantPill({
  agent,
  status,
  onRemove,
  isOnly,
}: {
  agent: Agent;
  status: string;
  onRemove?: () => void;
  isOnly: boolean;
}) {
  const color = agentDotColor(status);
  return (
    <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-full pl-1 pr-1.5 py-0.5">
      <div className="relative">
        <AgentAvatar agent={agent as any} size="xs" />
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium text-foreground leading-none">{agent.name}</span>
      {!isOnly && onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ── Add participant dropdown ──────────────────────────────────────────────────

function AddParticipantMenu({
  allAgents,
  participants,
  statusMap,
  onAdd,
}: {
  allAgents: Agent[];
  participants: Agent[];
  statusMap: Record<string, string>;
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

  const grouped = available.reduce<Record<string, Agent[]>>((acc, a) => {
    const key = a.role ?? "Other";
    (acc[key] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-border hover:border-foreground/40 hover:bg-muted/50 transition-colors"
        title="Add agent to chat"
      >
        <Plus className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-8 left-0 z-50 w-56 bg-popover border border-border rounded-lg overflow-hidden">
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
          <div className="max-h-52 overflow-y-auto py-1">
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No agents available</p>
            ) : (
              Object.entries(grouped).map(([role, agents]) => (
                <div key={role}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {role}
                  </div>
                  {agents.map((agent) => {
                    const color = agentDotColor(statusMap[agent.id] ?? "idle");
                    return (
                      <button
                        key={agent.id}
                        onClick={() => {
                          onAdd(agent);
                          setOpen(false);
                          setSearch("");
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent/50 transition-colors"
                      >
                        <div className="relative shrink-0">
                          <AgentAvatar agent={agent as any} size="xs" />
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-popover"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-xs font-medium text-foreground truncate leading-tight">
                            {agent.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground leading-tight">
                            {agent.title ?? role}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chat history panel ────────────────────────────────────────────────────────

const HISTORY_W = 264;

export function ChatHistoryPanel({
  sessions,
  activeSessionId,
  onSelectSession,
}: {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="fixed top-16 right-3 z-40 flex flex-col items-end">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5 hover:bg-accent transition-colors"
          title="View past conversations"
        >
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{sessions.length}</span>
          {activeSessionId && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
        </button>
      ) : (
        <div
          className="bg-card border border-border rounded-xl overflow-hidden"
          style={{ width: HISTORY_W }}
      data-chat-panel-mount=""
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border select-none">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Conversations</span>
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none">
                {sessions.length}
              </span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Session list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {sorted.map((session) => {
              const isActive = session.id === activeSessionId;
              const lastMsg = session.messages[session.messages.length - 1];
              const shownParticipants = session.participants.slice(0, 3);
              const extraCount = session.participants.length - 3;

              return (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    setExpanded(false);
                  }}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left",
                    isActive && "bg-primary/5 border-l-2 border-primary",
                  )}
                >
                  {/* Stacked participant avatars */}
                  <div className="relative shrink-0 h-10 w-12 mt-0.5">
                    {shownParticipants.map((agent, i) => (
                      <div
                        key={agent.id}
                        className="absolute"
                        style={{ left: i * 6, top: i === 0 ? 0 : i * 2, zIndex: shownParticipants.length - i }}
                      >
                        <AgentAvatar agent={agent as any} size="sm" className="border-[1.5px] border-card" />
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div
                        className="absolute w-6 h-6 rounded-full bg-muted border-[1.5px] border-card flex items-center justify-center"
                        style={{ left: 3 * 6, top: 3 * 2, zIndex: 0 }}
                      >
                        <span className="text-[9px] text-muted-foreground font-medium">+{extraCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium text-foreground truncate leading-tight">
                        {session.participants.map((p) => p.name).join(", ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0 leading-tight">
                        {formatChatTime(session.updatedAt)}
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
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main chat panel ───────────────────────────────────────────────────────────

const PANEL_W = 360;
const PANEL_H = 500;

export function AgentChatPanel({
  sessionId,
  initialAgent,
  initialStatus,
  initialMessages,
  initialParticipants,
  allAgents,
  statusMap,
  companyId,
  spawnX,
  spawnY,
  onClose,
  onSessionUpdate,
}: AgentChatPanelProps) {
  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Restore from saved session or start fresh
  const [participants, setParticipants] = useState<Agent[]>(
    initialParticipants?.length ? initialParticipants : [initialAgent],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages?.length ? initialMessages : [],
  );
  const [input, setInput] = useState("");
  const [typingAgentId, setTypingAgentId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist session to parent on every change (skip initial mount)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onSessionUpdate(sessionId, messages, participants);
  }, [messages, participants]);

  // Spawn adjacent to the clicked dot, clamped to viewport
  const [pos, setPos] = useState(() => {
    const x = Math.min(spawnX, window.innerWidth - PANEL_W - 12);
    const y = Math.min(spawnY, window.innerHeight - PANEL_H - 12);
    return { x: Math.max(x, 8), y: Math.max(y, 8) };
  });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ── Drag ──────────────────────────────────────────────────────────────────

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    },
    [pos],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - PANEL_W)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 100)),
      });
    };
    const onUp = () => {
      isDragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingAgentId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Send (real LLM invocation) ─────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || typingAgentId) return;
    setSendError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      ts: new Date(),
    };

    // Build full history including the new user message for LLM context
    const fullHistory: ChatMessage[] = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Each participant streams tokens progressively
    abortRef.current = new AbortController();
    for (const agent of participants) {
      if (!isMountedRef.current) break;
      setTypingAgentId(agent.id);

      // Insert a placeholder message that gets updated as tokens arrive
      const streamingId = `agent-${agent.id}-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: streamingId, role: "agent", agentId: agent.id, content: "", ts: new Date() },
      ]);

      let finalContent = "";
      try {
        const streamResult = await streamAgentChat(
          agent,
          fullHistory,
          companyId,
          abortRef.current.signal,
          (partial) => {
            if (!isMountedRef.current) return;
            finalContent = partial;
            setMessages((prev) =>
              prev.map((m) => m.id === streamingId ? { ...m, content: partial } : m),
            );
          },
        );
        if (!finalContent && streamResult) {
          finalContent = streamResult;
          setMessages((prev) =>
            prev.map((m) => m.id === streamingId ? { ...m, content: streamResult } : m),
          );
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        setSendError(errMsg);
        setMessages((prev) => prev.filter((m) => m.id !== streamingId));
      }

      if (!isMountedRef.current) break;
      setTypingAgentId(null);
    }
  };

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
    setParticipants((prev) => prev.filter((p) => p.id !== agentId));
  };

  const agentById = (id: string) => participants.find((p) => p.id === id);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed z-50 flex flex-col bg-card border border-border rounded-xl overflow-hidden"
      style={{
        left: pos.x,
        top: pos.y,
        width: PANEL_W,
        height: PANEL_H,
      }}
      data-chat-panel-mount=""
    >
      {/* ── Drag handle / header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card cursor-grab active:cursor-grabbing shrink-0 select-none"
        onMouseDown={onDragStart}
      >
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />

        <div className="flex flex-1 items-center gap-1.5 min-w-0 flex-wrap">
          {participants.map((agent) => (
            <ParticipantPill
              key={agent.id}
              agent={agent}
              status={statusMap[agent.id] ?? "idle"}
              onRemove={() => removeParticipant(agent.id)}
              isOnly={participants.length === 1}
            />
          ))}
          <AddParticipantMenu
            allAgents={allAgents}
            participants={participants}
            statusMap={statusMap}
            onAdd={addParticipant}
          />
        </div>

        <button
          onClick={onClose}
          className="ml-1 shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="flex flex-col items-end gap-0.5 max-w-[78%]">
                  <div className="px-3 py-2 text-sm leading-relaxed bg-primary text-primary-foreground rounded-2xl rounded-br-sm">
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 px-1">{formatChatTime(msg.ts)}</span>
                </div>
              </div>
            );
          }

          const sender = msg.agentId ? agentById(msg.agentId) : null;
          const color = agentDotColor(msg.agentId ? (statusMap[msg.agentId] ?? "idle") : "idle");
          const showName = participants.length > 1;

          return (
            <div key={msg.id} className="flex gap-2 items-end">
              <div className="relative shrink-0 mb-0.5">
                <AgentAvatar agent={sender as any} size="sm" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
                  style={{ backgroundColor: color }}
                />
              </div>

              <div className="flex flex-col gap-0.5 max-w-[78%]">
                {showName && sender && (
                  <span className="text-[10px] font-medium text-muted-foreground px-1 leading-none">
                    {sender.name}
                  </span>
                )}
                <div className="px-3 py-2 text-sm leading-relaxed bg-muted/50 text-foreground rounded-2xl rounded-bl-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/50 px-1">{formatChatTime(msg.ts)}</span>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingAgentId &&
          (() => {
            const agent = agentById(typingAgentId);
            const color = agentDotColor(statusMap[typingAgentId] ?? "idle");
            return (
              <div className="flex gap-2 items-end">
                <div className="relative shrink-0 mb-0.5">
                  <AgentAvatar agent={agent as any} size="sm" />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="bg-accent px-3 py-3 rounded-2xl rounded-bl-sm">
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
                  <span className="text-[10px] text-muted-foreground/50 px-1">
                    {agent?.name ?? "Agent"} is thinking…
                  </span>
                </div>
              </div>
            );
          })()}

        {/* Send error */}
        {sendError && (
          <div className="flex items-start gap-2 px-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-[11px] text-destructive leading-snug">{sendError}</span>
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="px-3 py-2.5 shrink-0">
        <div className="flex items-end gap-2 bg-muted/50 border border-border/30 rounded-2xl px-3 py-2 transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 focus-within:bg-muted/70">
          <button
            className="shrink-0 text-muted-foreground/50 hover:text-primary transition-colors mb-0.5"
            title="Attach file"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              participants.length > 1
                ? `Message all ${participants.length} agents…`
                : `Message ${participants[0]?.name ?? "agent"}…`
            }
            className="min-h-0 max-h-24 resize-none text-sm py-0 leading-relaxed bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            rows={1}
            disabled={!!typingAgentId}
          />
          <button
            className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={!input.trim() || !!typingAgentId}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-1.5 select-none text-center">
          {typingAgentId ? "Waiting for response…" : "Enter to send · Shift+Enter for new line"}
        </p>
      </div>
    </div>
  );
}
