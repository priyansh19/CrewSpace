import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TerminalSquare, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { terminalApi, type TerminalHistoryEntry } from "../api/terminal";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

interface TerminalEntry {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  executedAt: string;
  pending?: boolean;
}

function PromptLine({ cwd, command }: { cwd: string; command: string }) {
  return (
    <div className="flex items-start gap-1.5 font-mono text-sm">
      <span className="text-emerald-400 shrink-0">$</span>
      <span className="text-blue-400 shrink-0 truncate max-w-[200px]" title={cwd}>{cwd}</span>
      <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
      <span className="text-zinc-100 break-all">{command}</span>
    </div>
  );
}

function OutputBlock({ entry }: { entry: TerminalEntry }) {
  return (
    <div className="space-y-1 py-2 border-b border-zinc-800/60 last:border-0">
      <PromptLine cwd={entry.cwd} command={entry.command} />
      {entry.pending && (
        <div className="font-mono text-xs text-zinc-500 pl-4 animate-pulse">Running…</div>
      )}
      {!entry.pending && entry.stdout && (
        <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap break-all pl-4">
          {entry.stdout}
        </pre>
      )}
      {!entry.pending && entry.stderr && (
        <pre className="font-mono text-sm text-red-400 whitespace-pre-wrap break-all pl-4">
          {entry.stderr}
        </pre>
      )}
      {!entry.pending && entry.exitCode !== 0 && (
        <div className="pl-4">
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-red-900/40 text-red-400 border border-red-800/50">
            exit {entry.exitCode}
          </span>
        </div>
      )}
    </div>
  );
}

export function CeoTerminal() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("");
  const [localEntries, setLocalEntries] = useState<TerminalEntry[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState(-1);
  const [savedInput, setSavedInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "CEO Terminal" }]);
  }, [setBreadcrumbs]);

  const { data: cwdData } = useQuery({
    queryKey: ["terminal", "cwd"],
    queryFn: () => terminalApi.getCwd(),
    staleTime: Infinity,
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["terminal", "history"],
    queryFn: () => terminalApi.getHistory(),
    staleTime: 0,
  });

  useEffect(() => {
    if (cwdData?.cwd && !cwd) setCwd(cwdData.cwd);
  }, [cwdData, cwd]);

  useEffect(() => {
    if (historyData) {
      const entries: TerminalEntry[] = historyData.map((h: TerminalHistoryEntry) => ({
        id: h.id,
        command: h.command,
        stdout: h.stdout,
        stderr: h.stderr,
        exitCode: h.exitCode,
        cwd: h.cwd,
        executedAt: h.executedAt,
      }));
      setLocalEntries(entries);
      if (historyData.length > 0) {
        const last = historyData[historyData.length - 1];
        setCwd(last.cwd);
      }
    }
  }, [historyData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localEntries]);

  const commandHistory = localEntries.map((e) => e.command).filter(Boolean);

  const execMutation = useMutation({
    mutationFn: ({ command, cwd: dir }: { command: string; cwd: string }) =>
      terminalApi.exec(command, dir),
    onSuccess: (result, variables) => {
      setCwd(result.cwd);
      setLocalEntries((prev) =>
        prev.map((e) =>
          e.pending && e.command === variables.command
            ? { ...e, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, cwd: result.cwd, pending: false }
            : e,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["terminal", "history"] });
    },
    onError: (_err, variables) => {
      setLocalEntries((prev) =>
        prev.map((e) =>
          e.pending && e.command === variables.command
            ? { ...e, stderr: "Request failed", exitCode: 1, pending: false }
            : e,
        ),
      );
    },
  });

  const submit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd || execMutation.isPending) return;

    const pending: TerminalEntry = {
      id: `pending-${Date.now()}`,
      command: cmd,
      stdout: "",
      stderr: "",
      exitCode: 0,
      cwd,
      executedAt: new Date().toISOString(),
      pending: true,
    };
    setLocalEntries((prev) => [...prev, pending]);
    setInput("");
    setCmdHistoryIdx(-1);
    setSavedInput("");
    execMutation.mutate({ command: cmd, cwd });
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
        const nextIdx = cmdHistoryIdx === -1 ? commandHistory.length - 1 : Math.max(0, cmdHistoryIdx - 1);
        if (cmdHistoryIdx === -1) setSavedInput(input);
        setCmdHistoryIdx(nextIdx);
        setInput(commandHistory[nextIdx] ?? "");
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (cmdHistoryIdx === -1) return;
        const nextIdx = cmdHistoryIdx + 1;
        if (nextIdx >= commandHistory.length) {
          setCmdHistoryIdx(-1);
          setInput(savedInput);
        } else {
          setCmdHistoryIdx(nextIdx);
          setInput(commandHistory[nextIdx] ?? "");
        }
        return;
      }

      if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        setLocalEntries([]);
        return;
      }
    },
    [submit, commandHistory, cmdHistoryIdx, input, savedInput],
  );

  const clearHistory = useCallback(() => {
    setLocalEntries([]);
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-emerald-900/60 flex items-center justify-center">
            <TerminalSquare className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-zinc-100">CEO Terminal</span>
          <span className="text-xs text-zinc-500 font-mono">{cwd}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 font-mono">
            Ctrl+L to clear · ↑↓ history
          </span>
          <button
            onClick={clearHistory}
            className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Clear display"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Output area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-0"
        onClick={() => inputRef.current?.focus()}
      >
        {isLoading && (
          <div className="font-mono text-xs text-zinc-600 animate-pulse">Loading history…</div>
        )}
        {!isLoading && localEntries.length === 0 && (
          <div className="font-mono text-xs text-zinc-600 pt-2">
            <span className="text-emerald-500">CEO Terminal</span> — type a command to get started.
          </div>
        )}
        {localEntries.map((entry) => (
          <OutputBlock key={entry.id} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-emerald-400 shrink-0">$</span>
          <span
            className={cn(
              "text-blue-400 shrink-0 max-w-[180px] truncate",
            )}
            title={cwd}
          >
            {cwd}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={execMutation.isPending}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className={cn(
              "flex-1 bg-transparent outline-none text-zinc-100 placeholder-zinc-700 caret-emerald-400",
              execMutation.isPending && "opacity-50 cursor-not-allowed",
            )}
            placeholder={execMutation.isPending ? "Running…" : "Enter command…"}
          />
        </div>
      </div>
    </div>
  );
}
