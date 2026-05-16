import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { tryDicebearDataUri } from "../components/AgentAvatar";
import { Check, X, ArrowUp, RotateCcw, ArrowLeft, ChevronRight } from "lucide-react";
import type { Approval } from "@crewspaceai/shared";
import { cn } from "../lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ProposalPayload {
  title?: string;
  summary?: string;
  scope?: string;
  options?: Array<{ label: string; description?: string }> | string;
  rationale?: string;
  impact?: string;
  effort?: string;
  complexity?: string;
}

function getPayload(a: Approval): ProposalPayload {
  return (a.payload ?? {}) as ProposalPayload;
}

function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ONBOARDING_KEY = "crewspace:proposals-onboarding-seen";

// ── Scope badge ───────────────────────────────────────────────────────────────

const KNOWN_SCOPES: Record<string, string> = {
  frontend: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  backend:  "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
  ux:       "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  infra:    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-400",
  security: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  data:     "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
  devops:   "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  mobile:   "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400",
};

function ScopeBadge({ scope }: { scope?: string }) {
  if (!scope) return null;
  // Only show compact known scopes; skip long free-form text
  const key = scope.toLowerCase().trim();
  const cls = KNOWN_SCOPES[key];
  if (!cls) {
    // Show as generic pill but truncate aggressively
    if (scope.length > 24) return null;
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground max-w-[140px] truncate">
        {scope}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", cls)}>
      {scope}
    </span>
  );
}

// ── Onboarding modal ──────────────────────────────────────────────────────────

function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [dontShow, setDontShow] = useState(false);

  const handleGotIt = () => {
    if (dontShow) localStorage.setItem(ONBOARDING_KEY, "1");
    onClose();
  };

  const shortcuts = [
    { key: "→", label: "Approve", desc: "Creates a linked issue in the project" },
    { key: "←", label: "Reject",  desc: "Dismissed and logged in history" },
    { key: "↑", label: "Skip",    desc: "Revisit from the queue later" },
    { key: "?", label: "Help",    desc: "Reopens this guide anytime" },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl border border-border p-7 flex flex-col gap-5 shadow-lg">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">How to review proposals</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your agents surface feature ideas here. Use keyboard shortcuts or the action buttons to triage them.
          </p>
        </div>

        <div className="h-px bg-border" />

        <div className="grid grid-cols-2 gap-2.5">
          {shortcuts.map((s) => (
            <div key={s.key} className="bg-muted/50 rounded-xl p-4 flex flex-col gap-2.5 border border-border/60">
              <kbd className="w-8 h-8 bg-background border border-border rounded-lg text-sm font-mono font-medium text-foreground flex items-center justify-center shadow-sm">
                {s.key}
              </kbd>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-foreground">{s.label}</span>
                <span className="text-[12px] text-muted-foreground leading-relaxed">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="rounded border-border accent-primary w-3.5 h-3.5"
            />
            Don't show again
          </label>
          <button
            onClick={handleGotIt}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-5 py-2 text-[13px] font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
          >
            Got it <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Impact chip ───────────────────────────────────────────────────────────────

function ImpactChip({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border",
      highlight
        ? "bg-primary/8 border-primary/25 text-primary"
        : "bg-muted/40 border-border text-muted-foreground",
    )}>
      <span className="text-muted-foreground/60 font-normal">{label}</span>
      {value}
    </span>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1.5">
      {children}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function IntelligenceProposals() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Intelligence" }, { label: "Proposals" }]);
  }, [setBreadcrumbs]);

  const { data: allApprovals = [] as Approval[], isLoading } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const pending = useMemo(
    () => allApprovals.filter((a) => a.type === "proposal" && a.status === "pending"),
    [allApprovals],
  );
  const approved = useMemo(
    () => allApprovals.filter((a) => a.type === "proposal" && a.status === "approved"),
    [allApprovals],
  );
  const rejected = useMemo(
    () => allApprovals.filter((a) => a.type === "proposal" && (a.status === "rejected" || a.status === "revision_requested")),
    [allApprovals],
  );

  const [activeIndex,    setActiveIndex]    = useState(0);
  const [pendingAction,  setPendingAction]  = useState<"approve" | "reject" | null>(null);
  const [decisionNote,   setDecisionNote]   = useState("");
  const [reReviewItem,   setReReviewItem]   = useState<Approval | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const [exitDir,        setExitDir]        = useState<"left" | "right" | "up" | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const activeCard = reReviewItem ?? pending[activeIndex] ?? null;

  useEffect(() => {
    if (pendingAction) setTimeout(() => noteRef.current?.focus(), 60);
  }, [pendingAction]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, pending.length - 1)));
  }, [pending.length]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
  }, [queryClient, selectedCompanyId]);

  const afterDecision = (dir: "left" | "right") => {
    setExitDir(dir);
    setTimeout(() => {
      setExitDir(null);
      setPendingAction(null);
      setDecisionNote("");
      if (reReviewItem) setReReviewItem(null);
      invalidate();
    }, 320);
  };

  const approveMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      approvalsApi.approve(id, note || undefined),
    onSuccess: () => {
      pushToast({ title: "Proposal approved — issue created", tone: "success" });
      afterDecision("right");
    },
    onError: (e: Error) => pushToast({ title: "Failed to approve", body: e.message, tone: "error" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      approvalsApi.reject(id, note || undefined),
    onSuccess: () => {
      pushToast({ title: "Proposal rejected", tone: "info" });
      afterDecision("left");
    },
    onError: (e: Error) => pushToast({ title: "Failed to reject", body: e.message, tone: "error" }),
  });

  const isMutating = approveMut.isPending || rejectMut.isPending;

  const handleConfirm = () => {
    if (!activeCard || isMutating) return;
    if (pendingAction === "approve") approveMut.mutate({ id: activeCard.id, note: decisionNote });
    else if (pendingAction === "reject") rejectMut.mutate({ id: activeCard.id, note: decisionNote });
  };

  const handleSkip = useCallback(() => {
    if (pendingAction || reReviewItem) return;
    setExitDir("up");
    setTimeout(() => {
      setExitDir(null);
      setActiveIndex((i) => (i + 1 < pending.length ? i + 1 : 0));
    }, 260);
  }, [pendingAction, reReviewItem, pending.length]);

  const handleApproveClick = useCallback(() => {
    if (pendingAction) return;
    setPendingAction("approve");
  }, [pendingAction]);

  const handleRejectClick = useCallback(() => {
    if (pendingAction) return;
    setPendingAction("reject");
  }, [pendingAction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "?") { setShowOnboarding(true); return; }
      if (e.key === "Escape") {
        if (pendingAction) { setPendingAction(null); setDecisionNote(""); }
        else if (reReviewItem) setReReviewItem(null);
        return;
      }
      if (pendingAction || reReviewItem) return;
      if (e.key === "ArrowRight") { e.preventDefault(); handleApproveClick(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); handleRejectClick(); }
      if (e.key === "ArrowUp")    { e.preventDefault(); handleSkip(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingAction, reReviewItem, handleApproveClick, handleRejectClick, handleSkip]);

  const cardTransform = exitDir === "right"
    ? "translate-x-[120%] rotate-12 opacity-0"
    : exitDir === "left"
    ? "-translate-x-[120%] -rotate-12 opacity-0"
    : exitDir === "up"
    ? "-translate-y-full opacity-0"
    : "translate-x-0 rotate-0 opacity-100";

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading proposals…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0 bg-background">
        <span className="text-[13px] font-semibold text-foreground tracking-tight">
          Intelligence Proposals
        </span>
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-4 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-[11px] font-mono">←</kbd>
              Reject
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-[11px] font-mono">↑</kbd>
              Skip
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-[11px] font-mono">→</kbd>
              Approve
            </span>
          </div>
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-7 h-7 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center text-[12px] font-medium transition-colors"
          >
            ?
          </button>
        </div>
      </div>

      {/* ── Three columns ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Queue */}
        <div className="w-56 shrink-0 border-r border-border bg-muted/20 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Pending
            </span>
            {pending.length > 0 && (
              <span className="text-[11px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {pending.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {pending.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-muted-foreground/50 italic">No pending proposals</p>
            ) : (
              <div className="space-y-0.5">
                {pending.map((p, i) => {
                  const pl = getPayload(p);
                  const isActive = !reReviewItem && i === activeIndex;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setReReviewItem(null); setPendingAction(null); setDecisionNote(""); setActiveIndex(i); }}
                      className={cn(
                        "flex flex-col gap-1.5 px-3 py-2.5 rounded-lg text-left w-full transition-all",
                        isActive
                          ? "bg-primary/8 border border-primary/20 shadow-sm"
                          : "hover:bg-accent/40 border border-transparent",
                      )}
                    >
                      <span className={cn(
                        "text-[13px] leading-snug line-clamp-2",
                        isActive ? "text-foreground font-medium" : "text-muted-foreground",
                      )}>
                        {pl.title ?? "Untitled proposal"}
                      </span>
                      <ScopeBadge scope={pl.scope} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 overflow-y-auto min-w-0 bg-muted/10">

          {reReviewItem && (
            <div className="w-full max-w-xl flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                <RotateCcw className="h-3 w-3" />
                Re-reviewing
              </span>
              <button
                onClick={() => { setReReviewItem(null); setPendingAction(null); setDecisionNote(""); }}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to queue
              </button>
            </div>
          )}

          {/* Empty state */}
          {!reReviewItem && pending.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center max-w-xs py-8">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center text-3xl">🎉</div>
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-semibold text-foreground">All caught up!</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  No pending proposals right now. Your agents will surface new ideas here.
                </p>
              </div>
              {(approved.length + rejected.length) > 0 && (
                <p className="text-[12px] text-muted-foreground/60">
                  {approved.length + rejected.length} decisions in history →
                </p>
              )}
            </div>
          ) : activeCard ? (
            <>
              {/* Card stack */}
              <div className="relative w-full max-w-xl">
                {!reReviewItem && (
                  <>
                    <div className="absolute top-3 left-5 right-5 bottom-0 bg-card/50 rounded-2xl border border-border/30 -z-10" />
                    <div className="absolute top-1.5 left-2.5 right-2.5 bottom-0 bg-card/70 rounded-2xl border border-border/50 -z-10" />
                  </>
                )}

                {/* Active card */}
                <div className={cn(
                  "relative z-0 bg-card rounded-2xl border border-border p-6 flex flex-col gap-5 shadow-sm transition-all duration-300 ease-out",
                  cardTransform,
                )}>
                  {/* Card top row */}
                  <div className="flex items-start justify-between gap-3">
                    <ScopeBadge scope={getPayload(activeCard).scope} />
                    {!reReviewItem && pending.length > 0 && (
                      <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
                        {activeIndex + 1} / {pending.length}
                      </span>
                    )}
                    {reReviewItem && (
                      <span className={cn(
                        "text-[11px] font-semibold px-2.5 py-0.5 rounded-full",
                        activeCard.status === "approved"
                          ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900"
                          : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900",
                      )}>
                        Previously {activeCard.status === "approved" ? "approved" : "rejected"}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-[17px] font-semibold text-foreground leading-snug tracking-tight">
                      {getPayload(activeCard).title ?? "Untitled proposal"}
                    </h2>
                  </div>

                  {/* Summary */}
                  {getPayload(activeCard).summary && (
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {getPayload(activeCard).summary}
                    </p>
                  )}

                  {/* Options */}
                  {getPayload(activeCard).options && (
                    <div>
                      <SectionLabel>Options considered</SectionLabel>
                      {Array.isArray(getPayload(activeCard).options) ? (
                        <ul className="space-y-2">
                          {(getPayload(activeCard).options as Array<{ label: string; description?: string }>).map((o, i) => (
                            <li key={i} className="text-[13px] text-foreground flex gap-2">
                              <span className="text-muted-foreground/40 shrink-0 mt-px">–</span>
                              <span>
                                <span className="font-medium">{o.label}</span>
                                {o.description && (
                                  <span className="text-muted-foreground"> — {o.description}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-foreground">{getPayload(activeCard).options as string}</p>
                      )}
                    </div>
                  )}

                  {/* Rationale */}
                  {getPayload(activeCard).rationale && (
                    <div>
                      <SectionLabel>Rationale</SectionLabel>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        {getPayload(activeCard).rationale}
                      </p>
                    </div>
                  )}

                  {/* Impact chips */}
                  {(getPayload(activeCard).impact || getPayload(activeCard).effort || getPayload(activeCard).complexity) && (
                    <div className="flex flex-wrap gap-1.5">
                      <ImpactChip label="Impact" value={getPayload(activeCard).impact} highlight />
                      <ImpactChip label="Effort" value={getPayload(activeCard).effort} />
                      <ImpactChip label="Complexity" value={getPayload(activeCard).complexity} />
                    </div>
                  )}

                  {/* Agent footer */}
                  {activeCard.requestedById && (() => {
                    const agent = agentMap.get(activeCard.requestedById);
                    const avatar = agent ? tryDicebearDataUri(agent) : null;
                    return (
                      <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                        {avatar ? (
                          <img src={avatar} className="w-5 h-5 rounded-full ring-1 ring-border" alt="" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground ring-1 ring-border">
                            {agent?.name?.[0] ?? "?"}
                          </div>
                        )}
                        <span className="text-[12px] text-muted-foreground">
                          Proposed by <span className="text-foreground/70 font-medium">{agent?.name ?? "Unknown"}</span>
                          {" · "}{timeAgo(activeCard.createdAt)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Note panel */}
              {pendingAction && (
                <div className={cn(
                  "w-full max-w-xl bg-card rounded-xl border p-5 flex flex-col gap-3.5 shadow-sm",
                  pendingAction === "approve"
                    ? "border-emerald-200 dark:border-emerald-900/60"
                    : "border-red-200 dark:border-red-900/60",
                )}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center",
                      pendingAction === "approve"
                        ? "bg-emerald-100 dark:bg-emerald-950/50"
                        : "bg-red-100 dark:bg-red-950/50",
                    )}>
                      {pendingAction === "approve"
                        ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        : <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      }
                    </div>
                    <span className={cn(
                      "text-[13px] font-semibold",
                      pendingAction === "approve"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400",
                    )}>
                      {pendingAction === "approve" ? "Approving" : "Rejecting"}
                    </span>
                  </div>

                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {pendingAction === "approve"
                      ? "Add a note (optional). A linked issue will be created when you confirm."
                      : reReviewItem
                      ? "Describe what should be removed or why this remains not viable."
                      : "Add a note (optional). This decision will be logged in history."}
                  </p>

                  <textarea
                    ref={noteRef}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleConfirm(); }}
                    placeholder="Add a note…"
                    rows={3}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-ring transition-shadow"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConfirm}
                      disabled={isMutating}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-[13px] font-semibold transition-opacity disabled:opacity-50",
                        pendingAction === "approve"
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-destructive text-destructive-foreground hover:opacity-90",
                      )}
                    >
                      {isMutating ? "Saving…" : pendingAction === "approve"
                        ? "Confirm + Create Issue"
                        : reReviewItem ? "Confirm + Create Removal Ticket" : "Confirm + Log Rejection"}
                    </button>
                    <button
                      onClick={() => { setPendingAction(null); setDecisionNote(""); }}
                      className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!pendingAction && (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="flex items-center justify-center gap-5">
                    {/* Reject */}
                    <button
                      onClick={handleRejectClick}
                      disabled={isMutating}
                      title="Reject (←)"
                      className="w-14 h-14 rounded-full border-2 border-destructive/60 text-destructive bg-destructive/8 hover:bg-destructive/15 hover:border-destructive hover:scale-105 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center shadow-sm"
                    >
                      <X className="h-5 w-5" strokeWidth={2.5} />
                    </button>

                    {/* Skip */}
                    {!reReviewItem && (
                      <button
                        onClick={handleSkip}
                        disabled={isMutating}
                        title="Skip (↑)"
                        className="w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    )}

                    {/* Approve */}
                    <button
                      onClick={handleApproveClick}
                      disabled={isMutating}
                      title="Approve (→)"
                      className="w-14 h-14 rounded-full border-2 border-emerald-500/60 text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 hover:bg-emerald-500/15 hover:border-emerald-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center shadow-sm"
                    >
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </div>
                  {!reReviewItem && (
                    <p className="text-[11px] text-muted-foreground/50 tracking-wide">
                      ← Reject · ↑ Skip · → Approve
                    </p>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* History */}
        <div className="w-64 shrink-0 border-l border-border bg-muted/20 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              History
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            {/* Approved */}
            {approved.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 px-1 py-1.5 mb-1">
                  <Check className="h-3 w-3 text-emerald-500" strokeWidth={2.5} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-600/80 dark:text-emerald-400/80">
                    Approved · {approved.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {approved.map((a) => (
                    <HistoryItem
                      key={a.id}
                      approval={a}
                      type="approved"
                      onClick={() => { setPendingAction(null); setDecisionNote(""); setReReviewItem(a); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Rejected */}
            {rejected.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-1 py-1.5 mb-1">
                  <X className="h-3 w-3 text-destructive/80" strokeWidth={2.5} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-destructive/70">
                    Rejected · {rejected.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {rejected.map((a) => (
                    <HistoryItem
                      key={a.id}
                      approval={a}
                      type="rejected"
                      onClick={() => { setPendingAction(null); setDecisionNote(""); setReReviewItem(a); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {approved.length === 0 && rejected.length === 0 && (
              <p className="px-3 py-3 text-[12px] text-muted-foreground/50 italic leading-relaxed">
                No decisions yet. Reviewed proposals appear here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HistoryItem ────────────────────────────────────────────────────────────────

function HistoryItem({
  approval,
  type,
  onClick,
}: {
  approval: Approval;
  type: "approved" | "rejected";
  onClick: () => void;
}) {
  const pl = getPayload(approval);
  const isApproved = type === "approved";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex flex-col gap-2.5 px-3.5 py-3.5 rounded-xl border transition-all group",
        isApproved
          ? "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/35"
          : "border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/35",
      )}
    >
      {/* Status pill + timestamp */}
      <div className="flex items-center justify-between gap-1">
        <span className={cn(
          "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
          isApproved
            ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400"
            : "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-400",
        )}>
          {isApproved
            ? <Check className="h-2.5 w-2.5" strokeWidth={3} />
            : <X className="h-2.5 w-2.5" strokeWidth={3} />}
          {isApproved ? "Approved" : "Rejected"}
        </span>
        <span className="text-[10px] text-muted-foreground/45 shrink-0 tabular-nums">
          {timeAgo(approval.decidedAt ?? approval.updatedAt ?? approval.createdAt)}
        </span>
      </div>

      {/* Title */}
      <span className="text-[12.5px] font-medium text-foreground/80 group-hover:text-foreground line-clamp-2 leading-snug transition-colors">
        {pl.title ?? "Untitled proposal"}
      </span>

      {/* Decision note */}
      {approval.decisionNote && (
        <span className="text-[11px] text-muted-foreground/55 italic truncate">
          "{approval.decisionNote}"
        </span>
      )}
    </button>
  );
}
