/**
 * AgentChat — full-page chat experience
 * Two-column: session list on the left, chat area on the right.
 * Reuses all logic from ChatSidebar but in a full-page layout.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Send, X, Search, MessageCircle, AlertCircle,
  Users, CircleDot, Brain, Check, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentIcon } from "@/components/AgentIconPicker";
import { cn } from "@/lib/utils";
import { useChat, type ChatSession, type ChatMessage } from "../context/ChatContext";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { agentsApi } from "../api/agents";
import { agentMemoriesApi } from "../api/agentMemories";
import { agentDotColor, formatChatTime, streamAgentChat } from "../lib/agentChat";
import { queryKeys } from "../lib/queryKeys";
import type { Agent } from "@crewspaceai/shared";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgoShort(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── New Chat Menu ─────────────────────────────────────────────────────────────

function NewChatMenu({ allAgents, onStart }: { allAgents: Agent[]; onStart: (agents: Agent[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setOpen(false); setSelected(new Set()); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = allAgents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleStart = () => {
    const agents = allAgents.filter((a) => selected.has(a.id));
    if (agents.length === 0) return;
    onStart(agents);
    setOpen(false);
    setSearch("");
    setSelected(new Set());
  };

  return (
    <div ref={ref} className="relative">
      <Button size="sm" onClick={() => setOpen((v) => !v)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />New Chat
      </Button>

      {open && (
        <div className="absolute top-9 right-0 z-50 w-60 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0
              ? <p className="text-xs text-muted-foreground px-3 py-2">No agents found</p>
              : filtered.map((agent) => {
                const isSel = selected.has(agent.id);
                return (
                  <button key={agent.id} onClick={() => toggle(agent.id)}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors text-left", isSel && "bg-accent/30")}>
                    <div className={cn("w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors",
                      isSel ? "bg-primary border-primary" : "border-border")}>
                      {isSel && <Check className="h-2 w-2 text-primary-foreground" />}
                    </div>
                    <div className="relative shrink-0">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <AgentIcon icon={(agent as any).icon} className="h-3 w-3 text-foreground/60" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-popover"
                        style={{ backgroundColor: agentDotColor(agent.status) }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-foreground truncate">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{(agent as any).title ?? agent.role}</span>
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="px-3 py-2 border-t border-border">
            <Button size="sm" className="w-full h-8 text-xs" disabled={selected.size === 0} onClick={handleStart}>
              Start Chat {selected.size > 0 && `(${selected.size})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Participant ───────────────────────────────────────────────────────────

function AddParticipantMenu({ allAgents, participants, onAdd }: {
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
  const available = allAgents.filter((a) =>
    !participantIds.has(a.id) && a.name.toLowerCase().includes(search.toLowerCase())
  );

  if (allAgents.length <= participants.length) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-border hover:border-foreground/40 hover:bg-muted/50 transition-colors"
        title="Add agent">
        <Users className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-8 left-0 z-50 w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Add agent…"
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            {available.map((agent) => (
              <button key={agent.id} onClick={() => { onAdd(agent); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 transition-colors text-left">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <AgentIcon icon={(agent as any).icon} className="h-2.5 w-2.5 text-foreground/60" />
                </div>
                <span className="text-xs text-foreground truncate">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session List Item ─────────────────────────────────────────────────────────

function SessionListItem({ session, isActive, onSelect, onDelete, onRename }: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const lastMsg = session.messages[session.messages.length - 1];
  const shown = session.participants.slice(0, 3);
  const extra = session.participants.length - 3;
  const isGroup = session.participants.length > 1;
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isGroup) return;
    setEditVal(session.name ?? session.participants.map((p) => p.name).join(", "));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    onRename(editVal);
    setEditing(false);
  };

  const displayName = session.name ?? session.participants.map((p) => p.name).join(", ");

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border/30 cursor-pointer",
        isActive && "bg-primary/6 border-l-2 border-l-primary",
      )}
      onClick={onSelect}
    >
      {/* Stacked avatars */}
      <div className="relative shrink-0 h-8 w-10 mt-0.5">
        {shown.map((agent, i) => (
          <div key={agent.id}
            className="absolute w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center"
            style={{ left: i * 6, top: i * 2, zIndex: shown.length - i }}>
            <AgentIcon icon={(agent as any).icon} className="h-3 w-3 text-foreground/60" />
          </div>
        ))}
        {extra > 0 && (
          <div className="absolute w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center"
            style={{ left: 3 * 6, top: 3 * 2, zIndex: 0 }}>
            <span className="text-[8px] text-muted-foreground font-medium">+{extra}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <div className="flex items-center justify-between gap-1">
          {editing ? (
            <input
              ref={inputRef}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none text-foreground leading-tight min-w-0"
              autoFocus
            />
          ) : (
            <span className="text-sm font-medium text-foreground truncate leading-tight flex-1 min-w-0">
              {displayName}
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {!editing && (
              <span className="text-[10px] text-muted-foreground/50 tabular-nums group-hover:hidden">
                {timeAgoShort(session.updatedAt)}
              </span>
            )}
            {!editing && isGroup && (
              <button
                onClick={startEdit}
                className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors"
                title="Rename chat"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {!editing && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded hover:bg-destructive/20 text-muted-foreground/50 hover:text-destructive transition-colors"
                title="Delete chat"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {lastMsg ? (
          <span className="text-xs text-muted-foreground truncate leading-snug">
            {lastMsg.role === "user" ? "You: " : ""}{lastMsg.content}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Chat Area ─────────────────────────────────────────────────────────────────

function ChatArea({ session, allAgents, companyId, onUpdate }: {
  session: ChatSession;
  allAgents: Agent[];
  companyId: string | undefined;
  onUpdate: (messages: ChatMessage[], participants: Agent[]) => void;
}) {
  const { openNewIssue } = useDialog();
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const [participants, setParticipants] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setParticipants(session.participants);
    if (session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const [input, setInput] = useState("");
  const [typingAgentId, setTypingAgentId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [savingMemory, setSavingMemory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onUpdate(messages, participants);
  }, [messages, participants]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typingAgentId]);

  useEffect(() => { inputRef.current?.focus(); }, [session.id]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || typingAgentId) return;
    setSendError(null);

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: text, ts: new Date() };
    const fullHistory: ChatMessage[] = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    abortRef.current = new AbortController();
    for (const agent of participants) {
      if (!isMountedRef.current) break;
      setTypingAgentId(agent.id);

      const streamingId = `agent-${agent.id}-${Date.now()}`;
      setMessages((prev) => [...prev, { id: streamingId, role: "agent", agentId: agent.id, content: "", ts: new Date() }]);

      let finalContent = "";
      const streamResult = await streamAgentChat(agent, fullHistory, companyId, abortRef.current.signal, (partial) => {
        if (!isMountedRef.current) return;
        finalContent = partial;
        setMessages((prev) => prev.map((m) => m.id === streamingId ? { ...m, content: partial } : m));
      });

      if (!finalContent && streamResult) {
        finalContent = streamResult;
        setMessages((prev) => prev.map((m) => m.id === streamingId ? { ...m, content: streamResult } : m));
      }

      setTypingAgentId(null);

      if (finalContent.trim() && companyId && isMountedRef.current) {
        setSavingMemory(true);
        (async () => {
          try {
            const sentences = finalContent.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10 && s.length < 200);
            const title = sentences.length > 0 ? sentences[0].slice(0, 120) : finalContent.slice(0, 100);

            await fetch(`/api/companies/${companyId}/memories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, content: finalContent, memoryType: "fact", agentIds: [agent.id] }),
            });

            if (finalContent.length > 200) {
              const lastUserMsg = messages.filter((m) => m.role === "user").pop();
              await agentMemoriesApi.saveTaskSolution(companyId, {
                agentId: agent.id,
                taskTitle: lastUserMsg?.content.slice(0, 80) ?? title,
                approach: finalContent,
                outcome: "Completed",
              });
            }

            queryClient.invalidateQueries({ queryKey: queryKeys.memories.graph(companyId) });
          } catch {
            /* silenced */
          } finally {
            setSavingMemory(false);
          }
        })();
      }
    }
  }, [input, messages, participants, companyId, typingAgentId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const addParticipant = (agent: Agent) => {
    setParticipants((prev) => [...prev, agent]);
    setMessages((prev) => [...prev, {
      id: `join-${agent.id}-${Date.now()}`,
      role: "agent",
      agentId: agent.id,
      content: `Hey everyone! ${agent.name} here. Joining the conversation.`,
      ts: new Date(),
    }]);
  };

  const removeParticipant = (agentId: string) => {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((p) => p.id !== agentId));
  };

  const agentById = (id: string) => participants.find((p) => p.id === id);

  const handleCreateIssue = useCallback(() => {
    const recent = messages.filter((m) => m.content.trim()).slice(-8).map((m) => {
      if (m.role === "user") return `**You:** ${m.content}`;
      const sender = m.agentId ? agentById(m.agentId) : null;
      return `**${sender?.name ?? "Agent"}:** ${m.content}`;
    }).join("\n\n");
    openNewIssue({ description: recent ? `*From chat discussion:*\n\n${recent}` : undefined });
  }, [messages, participants, openNewIssue]);

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0 bg-card/30">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {participants.map((agent) => (
            <div key={agent.id}
              className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-full pl-1.5 pr-2 py-0.5">
              <div className="relative">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                  <AgentIcon icon={(agent as any).icon} className="h-2.5 w-2.5 text-foreground/70" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-card"
                  style={{ backgroundColor: agentDotColor(agent.status) }} />
              </div>
              <span className="text-xs font-medium text-foreground">{agent.name}</span>
              {participants.length > 1 && (
                <button onClick={() => removeParticipant(agent.id)}
                  className="ml-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          <AddParticipantMenu allAgents={allAgents} participants={participants} onAdd={addParticipant} />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0">
        {messages.map((msg) => {
          if (msg.role === "agent" && !msg.content && typingAgentId) return null;

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="flex flex-col items-end gap-1 max-w-[70%]">
                  <div className="px-4 py-2.5 text-sm leading-relaxed bg-primary text-primary-foreground rounded-2xl rounded-br-sm">
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 px-1">{formatChatTime(msg.ts)}</span>
                </div>
              </div>
            );
          }

          const sender = msg.agentId ? agentById(msg.agentId) : null;
          const color = agentDotColor(msg.agentId ? (sender?.status ?? "idle") : "idle");

          return (
            <div key={msg.id} className="flex gap-3 items-end">
              <div className="relative shrink-0 mb-0.5">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <AgentIcon icon={sender ? (sender as any).icon : undefined}
                    className="h-3.5 w-3.5 text-foreground/60" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-background"
                  style={{ backgroundColor: color }} />
              </div>
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                {participants.length > 1 && sender && (
                  <span className="text-[10px] font-medium text-muted-foreground px-1">{sender.name}</span>
                )}
                <div className="px-4 py-2.5 text-sm leading-relaxed bg-accent text-foreground rounded-2xl rounded-bl-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/40 px-1">{formatChatTime(msg.ts)}</span>
              </div>
            </div>
          );
        })}

        {typingAgentId && (() => {
          const agent = agentById(typingAgentId);
          return (
            <div className="flex gap-3 items-end">
              <div className="relative shrink-0 mb-0.5">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <AgentIcon icon={agent ? (agent as any).icon : undefined}
                    className="h-3.5 w-3.5 text-foreground/60" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-background"
                  style={{ backgroundColor: agentDotColor(agent?.status ?? "idle") }} />
              </div>
              <div className="bg-accent px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center h-4">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay}
                      className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {sendError && (
          <div className="flex items-start gap-2 px-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-sm text-destructive">{sendError}</span>
          </div>
        )}
        {savingMemory && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground/60">
            <Brain className="h-3.5 w-3.5 animate-pulse shrink-0" />
            <span>Saving to memory graph…</span>
          </div>
        )}
      </div>

      {/* Create issue */}
      <div className="px-5 pt-2 shrink-0">
        <button onClick={handleCreateIssue}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-accent/30 transition-colors">
          <CircleDot className="h-3.5 w-3.5" />
          Create issue from this chat
        </button>
      </div>

      {/* Input */}
      <div className="border-t border-border px-5 py-4 shrink-0 bg-card/20 mt-2">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={participants.length > 1
              ? `Message ${participants.length} agents…`
              : `Message ${participants[0]?.name ?? "agent"}…`}
            className="min-h-[40px] max-h-32 resize-none text-sm py-2.5 leading-relaxed"
            rows={1}
            disabled={!!typingAgentId}
          />
          <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSend}
            disabled={!input.trim() || !!typingAgentId}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 mt-1.5 select-none">
          {typingAgentId ? "Waiting for response…" : "Enter to send · Shift+Enter for new line"}
        </p>
      </div>
    </div>
  );
}

// ── Empty Chat State ──────────────────────────────────────────────────────────

function EmptyChat({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">No conversation selected</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-64">
          Start a new chat to interact with your agents in real time.
        </p>
      </div>
      <Button onClick={onNewChat}>
        <Plus className="h-4 w-4 mr-2" />Start a Chat
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AgentChat() {
  const { sessions, activeSessionId, setActiveSessionId, openChatWithAgents, updateSession, bulkInitSessions } = useChat();
  const { selectedCompanyId } = useCompany();
  const newChatRef = useRef<(() => void) | null>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const allAgents = useMemo(() => agents ?? [], [agents]);

  // When real agents first load, seed one session per agent so they appear in the list
  useEffect(() => {
    if (allAgents.length > 0) bulkInitSessions(allAgents);
  }, [allAgents, bulkInitSessions]);

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) ?? null, [sessions, activeSessionId]);
  const sorted = useMemo(() => [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()), [sessions]);

  const handleUpdate = useCallback((messages: ChatMessage[], participants: Agent[]) => {
    if (activeSessionId) updateSession(activeSessionId, messages, participants);
  }, [activeSessionId, updateSession]);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const newChatMenuRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Session list sidebar */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-card/30">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-13 shrink-0 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Agent Chat</span>
            {sessions.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                {sessions.length}
              </span>
            )}
          </div>
          <NewChatMenu allAgents={allAgents} onStart={(agents) => {
            openChatWithAgents(agents);
          }} />
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-xs font-medium">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click New Chat to get started</p>
              </div>
            </div>
          ) : (
            sorted.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => setActiveSessionId(session.id === activeSessionId ? null : session.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      {activeSession ? (
        <ChatArea
          key={activeSession.id}
          session={activeSession}
          allAgents={allAgents}
          companyId={selectedCompanyId ?? undefined}
          onUpdate={handleUpdate}
        />
      ) : (
        <EmptyChat onNewChat={() => {
          // trigger new chat — for now just highlight the button
        }} />
      )}
    </div>
  );
}
