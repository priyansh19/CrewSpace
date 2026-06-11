/**
 * AgentChat — full-page chat experience
 * Two-column: session list on the left, chat area on the right.
 * Optional right detail panel for media/search.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Send, X, Search, MessageCircle, AlertCircle,
  Users, CircleDot, Check, Trash2, Pencil,
  Copy, CheckCheck, Paperclip, ImageIcon, FileText, Images,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentAvatar } from "@/components/AgentAvatar";
import { cn } from "@/lib/utils";
import { useChat, type ChatSession, type ChatMessage, type ChatParticipant, type ChatAttachment } from "../context/ChatContext";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { agentsApi } from "../api/agents";
import { assetsApi } from "../api/assets";
import { agentDotColor, formatChatTime, isEmptyAgentMessage } from "../lib/agentChat";
import { queryKeys } from "../lib/queryKeys";
import { ChatMessageContent } from "../components/ChatMessageContent";
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

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/>\s?.+/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

const GROUP_EMOJIS = ["💬", "🎯", "🚀", "🧠", "⚡", "🔥", "🛠️", "📊", "🌐", "🎪", "🤝", "💡", "🏗️", "📋", "🔬", "🎭"];

// ── New Chat Menu ─────────────────────────────────────────────────────────────

function NewChatMenu({ allAgents, onStart, open, onOpenChange }: { allAgents: Agent[]; onStart: (agents: Agent[]) => void; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setOpen(false); setSelected(new Set()); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, setOpen]);

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
      <Button size="sm" onClick={() => setOpen(!isOpen)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />New Chat
      </Button>

      {isOpen && (
        <div className="absolute top-9 right-0 z-50 w-60 bg-popover border border-border rounded-lg overflow-hidden shadow-lg">
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
                      <AgentAvatar agent={agent as any} size="xs" />
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
        <div className="absolute top-8 left-0 z-50 w-48 bg-popover border border-border rounded-lg overflow-hidden shadow-lg">
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
                <AgentAvatar agent={agent as any} size="xs" className="shrink-0" />
                <span className="text-xs text-foreground truncate">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Emoji Icon Picker ─────────────────────────────────────────────────────────

function EmojiIconPicker({ current, onSelect }: { current?: string; onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center text-base hover:bg-accent/60 transition-colors"
        title="Set group icon"
      >
        {current ?? "💬"}
      </button>
      {open && (
        <div className="absolute top-10 left-0 z-50 bg-popover border border-border rounded-xl p-2 shadow-xl grid grid-cols-4 gap-1 w-32">
          {GROUP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); setOpen(false); }}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg text-base hover:bg-accent transition-colors",
                current === emoji && "bg-accent"
              )}
            >
              {emoji}
            </button>
          ))}
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
  const shown = session.participants.slice(0, 3);
  const extra = session.participants.length - 3;
  const isGroup = session.participants.length > 1;
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve last message — prefer live messages array, fall back to server-cached lastMessage
  const lastMsgContent = useMemo(() => {
    const msgs = session.messages.filter((m) => m.content.trim() && !isEmptyAgentMessage(m));
    const last = msgs[msgs.length - 1];
    if (last) return { role: last.role, text: stripMarkdown(last.content) };
    if (session.lastMessage?.content) return { role: session.lastMessage.role, text: stripMarkdown(session.lastMessage.content) };
    return null;
  }, [session.messages, session.lastMessage]);

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
      {/* Avatar stack */}
      <div className="relative shrink-0 h-10 w-12 mt-0.5">
        {isGroup && session.icon ? (
          <div className="w-10 h-10 rounded-full bg-muted border border-border/40 flex items-center justify-center text-xl">
            {session.icon}
          </div>
        ) : (
          shown.map((agent, i) => (
            <div key={agent.id} className="absolute" style={{ left: i * 8, top: i * 2.5, zIndex: shown.length - i }}>
              <AgentAvatar agent={agent as any} size="sm" className="border-2 border-card" />
            </div>
          ))
        )}
        {!isGroup && shown.length > 0 && (
          <span className="absolute -bottom-0.5 right-1 w-2.5 h-2.5 rounded-full border-2 border-card"
            style={{ backgroundColor: agentDotColor(shown[0]?.status ?? "idle") }} />
        )}
        {extra > 0 && !session.icon && (
          <div className="absolute w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center"
            style={{ left: 3 * 8, top: 3 * 2.5, zIndex: 0 }}>
            <span className="text-[10px] text-muted-foreground font-medium">+{extra}</span>
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
          <div className="flex items-center gap-0.5 shrink-0">
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

        {/* Last message preview */}
        {lastMsgContent && (
          <span className="text-[11px] text-muted-foreground/60 truncate leading-snug">
            {lastMsgContent.role === "user" && <span className="text-muted-foreground/80">You: </span>}
            {lastMsgContent.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Message Bubbles ───────────────────────────────────────────────────────────

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent"
      title="Copy message"
    >
      {copied ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function MessageAttachments({ attachments }: { attachments?: ChatAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className={cn("grid gap-1.5", attachments.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {attachments.map((att) => (
        att.type === "image" ? (
          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
            className="relative rounded-lg overflow-hidden border border-border/40 hover:border-primary/50 transition-colors group/img">
            <img src={att.url} alt={att.name} className="max-h-48 w-full object-cover" />
            <span className="absolute bottom-1.5 left-1.5 text-[10px] text-primary-foreground/90 bg-foreground/40 px-1.5 py-0.5 rounded-md opacity-0 group-hover/img:opacity-100 transition-opacity">
              {att.name}
            </span>
          </a>
        ) : (
          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" download={att.name}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/40 bg-background/60 hover:bg-accent/40 hover:border-primary/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Paperclip className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-foreground truncate">{att.name}</span>
              {att.size && <span className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</span>}
            </div>
          </a>
        )
      ))}
    </div>
  );
}

function UserMessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-end group/message">
      <div className="flex flex-col items-end gap-1.5 max-w-[75%]">
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="w-full max-w-[320px]">
            <MessageAttachments attachments={msg.attachments} />
          </div>
        )}
        <div className="px-3.5 py-2 text-sm leading-relaxed bg-primary text-primary-foreground rounded-2xl rounded-br-md">
          <ChatMessageContent content={msg.content} />
        </div>
        <div className="flex items-center gap-1.5 px-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
          <CopyMessageButton text={msg.content} />
          <span className="text-[10px] text-muted-foreground/50">{formatChatTime(msg.ts)}</span>
        </div>
      </div>
    </div>
  );
}

function AgentMessageBubble({ msg, sender, color, participants }: {
  msg: ChatMessage;
  sender: ChatParticipant | null | undefined;
  color: string;
  participants: ChatParticipant[];
}) {
  return (
    <div className="flex gap-3 items-end group/message">
      <div className="relative shrink-0 mb-0.5">
        <AgentAvatar agent={sender as any} size="sm" />
        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-background"
          style={{ backgroundColor: color }} />
      </div>
      <div className="flex flex-col gap-1 max-w-[75%]">
        {participants.length > 1 && sender && (
          <span className="text-[10px] font-medium text-muted-foreground px-1">{sender.name}</span>
        )}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="w-full max-w-[320px]">
            <MessageAttachments attachments={msg.attachments} />
          </div>
        )}
        <div className="px-3.5 py-2 text-sm leading-relaxed bg-muted/50 text-foreground rounded-2xl rounded-bl-md">
          <ChatMessageContent content={msg.content} />
        </div>
        <div className="flex items-center gap-1.5 px-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
          <CopyMessageButton text={msg.content} />
          <span className="text-[10px] text-muted-foreground/50">{formatChatTime(msg.ts)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Media Panel ───────────────────────────────────────────────────────────────

function MediaPanel({ messages }: { messages: ChatMessage[] }) {
  const images = useMemo(
    () => messages.flatMap((m) => (m.attachments ?? []).filter((a) => a.type === "image")),
    [messages],
  );
  const files = useMemo(
    () => messages.flatMap((m) => (m.attachments ?? []).filter((a) => a.type === "file")),
    [messages],
  );

  if (images.length === 0 && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center px-4">
        <Images className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground">No media shared yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {images.length > 0 && (
        <div className="px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Images ({images.length})
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {images.map((att) => (
              <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                className="rounded-lg overflow-hidden border border-border/30 hover:border-primary/40 transition-colors block aspect-square">
                <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
      {files.length > 0 && (
        <div className="px-3 py-3 border-t border-border/20">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Files ({files.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {files.map((att) => (
              <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" download={att.name}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/30 bg-muted/20 hover:bg-accent/30 transition-colors">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate">{att.name}</span>
                  {att.size && <span className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Search Panel ──────────────────────────────────────────────────────────────

function SearchPanel({ messages, participants }: { messages: ChatMessage[]; participants: ChatParticipant[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q) && m.content.trim());
  }, [messages, query]);

  const highlight = (text: string, q: string): string => {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text.slice(0, 100) + (text.length > 100 ? "…" : "");
    const start = Math.max(0, idx - 25);
    const end = Math.min(text.length, idx + q.length + 50);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/40 focus-within:border-primary/40 transition-colors">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in this chat…"
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {!query.trim() ? (
          <p className="text-[11px] text-muted-foreground/40 text-center pt-8">Type to search messages</p>
        ) : results.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/40 text-center pt-8">No results for "{query}"</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-muted-foreground/50 mb-0.5">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            {results.map((msg) => {
              const sender = msg.role === "user" ? null : participants.find((p) => p.id === msg.agentId);
              return (
                <div key={msg.id} className="px-2.5 py-2 rounded-lg bg-muted/30 border border-border/30 hover:border-border/50 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold text-foreground/70">
                      {msg.role === "user" ? "You" : (sender?.name ?? "Agent")}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">{formatChatTime(msg.ts)}</span>
                  </div>
                  <p className="text-[11px] text-foreground/70 leading-relaxed">
                    {highlight(msg.content, query)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat Composer ─────────────────────────────────────────────────────────────

function ChatComposer({
  input,
  setInput,
  onSend,
  onKeyDown,
  participants,
  typingAgentId,
  inputRef,
  companyId,
  draftAttachments,
  setDraftAttachments,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: (attachments?: ChatAttachment[]) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  participants: ChatParticipant[];
  typingAgentId: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  companyId: string | undefined;
  draftAttachments: ChatAttachment[];
  setDraftAttachments: (v: ChatAttachment[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !companyId) return;
    setUploading(true);
    const newAttachments: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const result = await assetsApi.uploadImage(companyId, file, "chat");
        newAttachments.push({
          id: (result as any).id ?? `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: result.contentPath ?? (result as any).url ?? "",
          name: file.name,
          type: file.type.startsWith("image/") ? "image" : "file",
          size: file.size,
          mimeType: file.type,
        });
      } catch { /* skip failed uploads */ }
    }
    setDraftAttachments([...draftAttachments, ...newAttachments]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [companyId, draftAttachments, setDraftAttachments]);

  const removeAttachment = useCallback((id: string) => {
    setDraftAttachments(draftAttachments.filter((a) => a.id !== id));
  }, [draftAttachments, setDraftAttachments]);

  const handleSendWithAttachments = useCallback(() => {
    onSend(draftAttachments.length > 0 ? draftAttachments : undefined);
    setDraftAttachments([]);
  }, [onSend, draftAttachments, setDraftAttachments]);

  const handleComposerKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendWithAttachments();
    } else {
      onKeyDown(e);
    }
  }, [handleSendWithAttachments, onKeyDown]);

  return (
    <div className="px-4 pb-3 pt-1.5 shrink-0">
      {/* Draft attachment chips */}
      {draftAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {draftAttachments.map((att) => (
            <div key={att.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/50 bg-muted/40 text-xs">
              {att.type === "image" ? <ImageIcon className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
              <span className="max-w-[100px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(att.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer row */}
      <div className="flex items-end gap-2 bg-muted/40 border border-border/30 rounded-2xl px-2.5 py-1.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !!typingAgentId}
          className="shrink-0 p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 self-end mb-0.5"
          title="Attach file"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.json,.csv,.doc,.docx"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={participants.length > 1
            ? `Message ${participants.length} agents…`
            : `Message ${participants[0]?.name ?? "agent"}…`}
          className="min-h-[28px] max-h-24 resize-none text-sm py-1 leading-relaxed bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
          rows={1}
          disabled={!!typingAgentId}
        />
        <button
          onClick={handleSendWithAttachments}
          disabled={(!input.trim() && draftAttachments.length === 0) || !!typingAgentId}
          className="shrink-0 p-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary transition-colors self-end mb-0.5"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/25 mt-1 select-none px-1">
        {typingAgentId ? "Waiting for response…" : "Enter to send · Shift+Enter for new line"}
      </p>
    </div>
  );
}

// ── Chat Area ─────────────────────────────────────────────────────────────────

type RightPanelTab = "media" | "search";

function ChatArea({ session, allAgents, companyId }: {
  session: ChatSession;
  allAgents: Agent[];
  companyId: string | undefined;
}) {
  const { openNewIssue } = useDialog();
  const { sendMessage, streams, updateSession, setSessionIcon } = useChat();

  const [participants, setParticipants] = useState<ChatParticipant[]>(session.participants);
  const [rightPanel, setRightPanel] = useState<RightPanelTab | null>(null);

  useEffect(() => { setParticipants(session.participants); }, [session.id]);

  const activeStreams = streams.filter((s) => s.sessionId === session.id && s.status === "streaming");
  const typingAgentId = activeStreams[0]?.agentId ?? null;

  const streamMessages: ChatMessage[] = activeStreams.map((s) => ({
    id: s.streamId,
    role: "agent",
    agentId: s.agentId,
    content: s.content,
    ts: new Date(),
  }));

  const displayMessages = [...session.messages, ...streamMessages];

  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayMessages, typingAgentId]);

  useEffect(() => { inputRef.current?.focus(); }, [session.id]);

  const handleSend = useCallback(async (attachs?: ChatAttachment[]) => {
    const text = input.trim();
    if ((!text && !attachs?.length) || typingAgentId) return;
    setSendError(null);
    setInput("");
    await sendMessage(session.id, text, attachs);
  }, [input, typingAgentId, session.id, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const [draftAttachments, setDraftAttachments] = useState<ChatAttachment[]>([]);

  const addParticipant = (agent: Agent) => {
    const next = [...participants, agent as unknown as ChatParticipant];
    setParticipants(next);
    updateSession(session.id, session.messages, next);
  };

  const removeParticipant = (agentId: string) => {
    if (participants.length <= 1) return;
    const next = participants.filter((p) => p.id !== agentId);
    setParticipants(next);
    updateSession(session.id, session.messages, next);
  };

  const agentById = (id: string) => participants.find((p) => p.id === id);
  const isGroup = participants.length > 1;

  const handleCreateIssue = useCallback(() => {
    const recent = displayMessages.filter((m) => m.content.trim()).slice(-8).map((m) => {
      if (m.role === "user") return `**You:** ${m.content}`;
      const sender = m.agentId ? agentById(m.agentId) : null;
      return `**${sender?.name ?? "Agent"}:** ${m.content}`;
    }).join("\n\n");
    openNewIssue({ description: recent ? `*From chat discussion:*\n\n${recent}` : undefined });
  }, [displayMessages, participants, openNewIssue]);

  const toggleRightPanel = (tab: RightPanelTab) => {
    setRightPanel((prev) => (prev === tab ? null : tab));
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-border/20">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {isGroup ? (
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <EmojiIconPicker
                  current={session.icon}
                  onSelect={(emoji) => setSessionIcon(session.id, emoji)}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {session.name ?? participants.map((p) => p.name).join(", ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{participants.length} agents</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 ml-1">
                  {participants.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-1 bg-muted/60 border border-border rounded-full pl-0.5 pr-1.5 py-0.5">
                      <div className="relative">
                        <AgentAvatar agent={agent as any} size="xs" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-card"
                          style={{ backgroundColor: agentDotColor(agent.status) }} />
                      </div>
                      <span className="text-[10px] font-medium">{agent.name}</span>
                      <button onClick={() => removeParticipant(agent.id)} className="ml-0.5 text-muted-foreground/40 hover:text-foreground">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <AgentAvatar agent={participants[0] as any} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background"
                    style={{ backgroundColor: agentDotColor(participants[0]?.status ?? "idle") }} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate">{participants[0]?.name}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{participants[0]?.status}</span>
                </div>
              </div>
            )}
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1 shrink-0">
            <AddParticipantMenu allAgents={allAgents} participants={participants as unknown as Agent[]} onAdd={addParticipant} />
            <button
              onClick={() => toggleRightPanel("search")}
              className={cn("p-1.5 rounded-lg transition-colors", rightPanel === "search" ? "bg-accent text-foreground" : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/50")}
              title="Search in chat"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => toggleRightPanel("media")}
              className={cn("p-1.5 rounded-lg transition-colors", rightPanel === "media" ? "bg-accent text-foreground" : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/50")}
              title="Media & files"
            >
              <Images className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {displayMessages.map((msg) => {
            if (isEmptyAgentMessage(msg)) return null;
            if (msg.role === "user") return <UserMessageBubble key={msg.id} msg={msg} />;
            const sender = msg.agentId ? agentById(msg.agentId) : null;
            const color = agentDotColor(msg.agentId ? (sender?.status ?? "idle") : "idle");
            return <AgentMessageBubble key={msg.id} msg={msg} sender={sender} color={color} participants={participants} />;
          })}

          {typingAgentId && (() => {
            const agent = agentById(typingAgentId);
            return (
              <div className="flex gap-3 items-end">
                <div className="relative shrink-0 mb-0.5">
                  <AgentAvatar agent={agent as any} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-background"
                    style={{ backgroundColor: agentDotColor(agent?.status ?? "idle") }} />
                </div>
                <div className="bg-accent px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"
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
        </div>

        {/* Create issue */}
        <div className="px-4 pt-1 shrink-0">
          <button onClick={handleCreateIssue}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/20 transition-colors">
            <CircleDot className="h-3 w-3" />
            Create issue from this chat
          </button>
        </div>

        {/* Composer */}
        <ChatComposer
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          participants={participants}
          typingAgentId={typingAgentId}
          inputRef={inputRef}
          companyId={companyId}
          draftAttachments={draftAttachments}
          setDraftAttachments={setDraftAttachments}
        />
      </div>

      {/* Right detail panel */}
      {rightPanel && (
        <div className="w-60 shrink-0 border-l border-border/40 flex flex-col bg-card/20 min-h-0">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 h-9 border-b border-border/30 shrink-0">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setRightPanel("media")}
                className={cn("px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors", rightPanel === "media" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Media
              </button>
              <button
                onClick={() => setRightPanel("search")}
                className={cn("px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors", rightPanel === "search" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Search
              </button>
            </div>
            <button onClick={() => setRightPanel(null)} className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden min-h-0">
            {rightPanel === "media"
              ? <MediaPanel messages={displayMessages} />
              : <SearchPanel messages={session.messages} participants={participants} />
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty Chat State ──────────────────────────────────────────────────────────

function EmptyChat({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
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
  const { sessions, activeSessionId, setActiveSessionId, openChatWithAgents, deleteSession, renameSession } = useChat();
  const { selectedCompanyId } = useCompany();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const allAgents = useMemo(() => agents ?? [], [agents]);

  const [sessionSearch, setSessionSearch] = useState("");

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) ?? null, [sessions, activeSessionId]);
  const sorted = useMemo(() => {
    const list = [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    if (!sessionSearch.trim()) return list;
    const q = sessionSearch.toLowerCase();
    return list.filter((s) => {
      const name = (s.name ?? s.participants.map((p) => p.name).join(", ")).toLowerCase();
      if (name.includes(q)) return true;
      return s.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [sessions, sessionSearch]);

  const [newChatOpen, setNewChatOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Session list sidebar */}
      <div className="w-72 shrink-0 flex flex-col bg-card/30 border-r border-border/30">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-border/20">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Agent Chat</span>
            {sessions.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                {sessions.length}
              </span>
            )}
          </div>
          <NewChatMenu allAgents={allAgents} open={newChatOpen} onOpenChange={setNewChatOpen} onStart={(agents) => {
            openChatWithAgents(agents);
            setNewChatOpen(false);
          }} />
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/10">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/30 focus-within:border-primary/30 transition-colors">
            <Search className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <input
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              placeholder="Search chats..."
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
            />
            {sessionSearch && (
              <button onClick={() => setSessionSearch("")} className="text-muted-foreground/50 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-xs font-medium">{sessionSearch ? "No matching chats" : "No conversations yet"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sessionSearch ? "Try a different search" : "Click New Chat to get started"}
                </p>
              </div>
            </div>
          ) : (
            sorted.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => setActiveSessionId(session.id === activeSessionId ? null : session.id)}
                onDelete={() => deleteSession(session.id)}
                onRename={(name) => renameSession(session.id, name)}
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
        />
      ) : (
        <EmptyChat onNewChat={() => setNewChatOpen(true)} />
      )}
    </div>
  );
}
