import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TerminalSquare,
  Trash2,
  ChevronRight,
  Copy,
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { terminalApi, type TerminalHistoryEntry } from "../api/terminal";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TerminalBlock {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  executedAt: string;
  pending?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function shortCwd(cwd: string): string {
  const home = "/home";
  if (cwd.startsWith(home)) return `~${cwd.slice(home.length)}`;
  return cwd;
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={copy}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        className,
      )}
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── CommandBlock ──────────────────────────────────────────────────────────────

function CommandBlock({ block }: { block: TerminalBlock }) {
  const hasOutput = block.stdout || block.stderr;
  const failed = block.exitCode !== 0;

  return (
    <div
      className={cn(
        "group rounded-lg border transition-colors animate-in fade-in duration-200",
        failed
          ? "border-destructive/30 bg-card/60"
          : "border-border/70 bg-card/40",
      )}
    >
      {/* Block header — command line */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 font-mono text-sm">
          {/* Prompt indicator */}
          <span className={cn(
            "shrink-0 font-bold",
            failed ? "text-destructive" : "text-primary",
          )}>
            $
          </span>
          {/* CWD */}
          <span
            className="shrink-0 text-primary/80 text-xs truncate max-w-[180px]"
            title={block.cwd}
          >
            {shortCwd(block.cwd)}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />
          {/* Command */}
          <span className="text-foreground truncate flex-1" title={block.command}>
            {block.command}
          </span>
        </div>

        {/* Right side: metadata + actions (revealed on group hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!block.pending && (
            <>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono">
                <Clock className="h-2.5 w-2.5" />
                {formatTime(block.executedAt)}
              </span>
              <CopyButton text={block.command} />
            </>
          )}
        </div>

        {/* Exit code badge */}
        {!block.pending && failed && (
          <span className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-destructive/20 text-destructive border border-destructive/30">
            <AlertCircle className="h-2.5 w-2.5" />
            exit {block.exitCode}
          </span>
        )}
      </div>

      {/* Block body — output */}
      {block.pending ? (
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <span>Running…</span>
          </div>
        </div>
      ) : hasOutput ? (
        <div className="px-4 py-2.5 space-y-1.5">
          {block.stdout && (
            <div className="relative group/output">
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-all leading-relaxed">
                {block.stdout}
              </pre>
              <div className="absolute top-0 right-0 opacity-0 group-hover/output:opacity-100 transition-opacity">
                <CopyButton text={block.stdout} />
              </div>
            </div>
          )}
          {block.stderr && (
            <pre className="font-mono text-xs text-destructive/90 whitespace-pre-wrap break-all leading-relaxed border-l-2 border-destructive/30 pl-2">
              {block.stderr}
            </pre>
          )}
        </div>
      ) : (
        <div className="px-4 py-1.5">
          <span className="text-[11px] text-muted-foreground font-mono italic">no output</span>
        </div>
      )}
    </div>
  );
}

// ── InputBar ─────────────────────────────────────────────────────────────────

interface InputBarProps {
  cwd: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function InputBar({ cwd, value, disabled, onChange, onKeyDown, inputRef }: InputBarProps) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-border bg-card/60 px-4 py-3",
        "backdrop-blur-sm",
      )}
    >
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-primary font-bold shrink-0">$</span>
        <span
          className="text-primary/80 text-xs shrink-0 max-w-[200px] truncate cursor-default"
          title={cwd}
        >
          {shortCwd(cwd)}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-testid="terminal-input"
          className={cn(
            "flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 caret-primary text-sm",
            disabled && "opacity-40 cursor-not-allowed",
          )}
          placeholder={disabled ? "Running…" : "Type a command…"}
        />
      </div>
    </div>
  );
}

// ── CeoTerminal ───────────────────────────────────────────────────────────────

export function CeoTerminal() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("");
  const [blocks, setBlocks] = useState<TerminalBlock[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [savedInput, setSavedInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Console" }]);
  }, [setBreadcrumbs]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: cwdData } = useQuery({
    queryKey: ["terminal", "cwd"],
    queryFn: () => terminalApi.getCwd(),
    staleTime: Infinity,
  });

  const { isLoading } = useQuery({
    queryKey: ["terminal", "history"],
    queryFn: () => terminalApi.getHistory(),
    staleTime: 0,
    select: (data) => data,
    // Hydrate blocks from DB history on initial load
  });

  // Hydrate from history on load
  useQuery({
    queryKey: ["terminal", "history"],
    queryFn: () => terminalApi.getHistory(),
    staleTime: 0,
    select: (data: TerminalHistoryEntry[]) => data,
  });

  const { data: historyData } = useQuery({
    queryKey: ["terminal", "history"],
    queryFn: () => terminalApi.getHistory(),
    staleTime: 0,
  });

  useEffect(() => {
    if (cwdData?.cwd && !cwd) setCwd(cwdData.cwd);
  }, [cwdData, cwd]);

  useEffect(() => {
    if (!historyData) return;
    const loaded: TerminalBlock[] = historyData.map((h) => ({
      id: h.id,
      command: h.command,
      stdout: h.stdout,
      stderr: h.stderr,
      exitCode: h.exitCode,
      cwd: h.cwd,
      executedAt: h.executedAt,
    }));
    setBlocks(loaded);
    if (historyData.length > 0) {
      const last = historyData[historyData.length - 1];
      if (last) setCwd(last.cwd);
    }
  }, [historyData]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [blocks]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const commandHistory = blocks.filter((b) => !b.pending).map((b) => b.command);

  const execMutation = useMutation({
    mutationFn: ({ command, dir }: { command: string; dir: string }) =>
      terminalApi.exec(command, dir),
    onSuccess: (result, variables) => {
      setCwd(result.cwd);
      setBlocks((prev) =>
        prev.map((b) =>
          b.pending && b.command === variables.command
            ? {
                ...b,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                cwd: result.cwd,
                pending: false,
              }
            : b,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["terminal", "history"] });
    },
    onError: (_err, variables) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.pending && b.command === variables.command
            ? { ...b, stderr: "Request failed", exitCode: 1, pending: false }
            : b,
        ),
      );
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const submit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd || execMutation.isPending) return;

    const pending: TerminalBlock = {
      id: `pending-${Date.now()}`,
      command: cmd,
      stdout: "",
      stderr: "",
      exitCode: 0,
      cwd,
      executedAt: new Date().toISOString(),
      pending: true,
    };

    setBlocks((prev) => [...prev, pending]);
    setInput("");
    setHistoryIdx(-1);
    setSavedInput("");
    execMutation.mutate({ command: cmd, dir: cwd });
  }, [input, cwd, execMutation]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const nextIdx =
          historyIdx === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIdx - 1);
        if (historyIdx === -1) setSavedInput(input);
        setHistoryIdx(nextIdx);
        setInput(commandHistory[nextIdx] ?? "");
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx === -1) return;
        const nextIdx = historyIdx + 1;
        if (nextIdx >= commandHistory.length) {
          setHistoryIdx(-1);
          setInput(savedInput);
        } else {
          setHistoryIdx(nextIdx);
          setInput(commandHistory[nextIdx] ?? "");
        }
        return;
      }

      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        setBlocks([]);
      }
    },
    [submit, commandHistory, historyIdx, input, savedInput],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/80 bg-card/40 shrink-0">
        <div className="flex items-center gap-3">
          {/* Traffic-light dots */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
          </div>
          {/* Title */}
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground tracking-wide">
              Console
            </span>
          </div>
          {/* CWD pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/80 border border-border/50">
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]" title={cwd}>
              {shortCwd(cwd)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70 font-mono hidden sm:block">
            ↑↓ history · Ctrl+L clear
          </span>
          <button
            onClick={() => setBlocks([])}
            className="p-1.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
            title="Clear display (history preserved in DB)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Output area ──────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2"
        onClick={() => inputRef.current?.focus()}
        data-testid="terminal-output"
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 font-mono pt-2 animate-pulse">
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            Restoring session…
          </div>
        ) : blocks.length === 0 ? (
          <div className="pt-6 pb-2 space-y-3">
            <div className="flex items-center gap-2">
              <TerminalSquare className="h-5 w-5 text-primary/50" />
              <span className="text-sm font-semibold text-muted-foreground">Console</span>
            </div>
            <p className="text-xs text-muted-foreground/70 font-mono leading-relaxed max-w-sm">
              You are operating as CEO. Commands run directly on the server.<br />
              Type a command below to get started.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["ls -la", "pwd", "df -h", "ps aux | head -20"].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => setInput(cmd)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono text-muted-foreground bg-card border border-border hover:border-border hover:text-foreground transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        ) : (
          blocks.map((block) => <CommandBlock key={block.id} block={block} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <InputBar
        cwd={cwd}
        value={input}
        disabled={execMutation.isPending}
        onChange={setInput}
        onKeyDown={onKeyDown}
        inputRef={inputRef}
      />
    </div>
  );
}
