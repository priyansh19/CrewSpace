import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { featureProposalsApi } from "../api/featureProposals";
import { agentsApi } from "../api/agents";
import { tryDicebearDataUri } from "../components/AgentAvatar";
import { Sparkles, CheckCircle2, XCircle, Clock } from "lucide-react";
import { timeAgo } from "../lib/timeAgo";
import type { FeatureProposal } from "../api/featureProposals";

const CATEGORY_COLORS: Record<string, string> = {
  ui: "#cc785c",
  backend: "#3b82f6",
  infra: "#8b5cf6",
  ux: "#5db872",
  other: "#6c6a64",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#c64545",
  normal: "#e8a55a",
  low: "#6c6a64",
};

export function IntelligenceProposals() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Intelligence" }, { label: "Proposals" }]);
  }, [setBreadcrumbs]);

  const { data: proposals = [] as FeatureProposal[], isLoading } = useQuery({
    queryKey: queryKeys.featureProposals.list(selectedCompanyId!, "pending"),
    queryFn: () => featureProposalsApi.list(selectedCompanyId!, "pending"),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.featureProposals.list(selectedCompanyId!, "pending"),
    });
  };

  const acceptMutation = useMutation({
    mutationFn: (id: string) => featureProposalsApi.accept(selectedCompanyId!, id),
    onSuccess: () => {
      pushToast({ title: "Issue created", tone: "success" });
      invalidate();
    },
    onError: (e: Error) => pushToast({ title: "Failed", body: e.message, tone: "error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => featureProposalsApi.reject(selectedCompanyId!, id),
    onSuccess: () => {
      pushToast({ title: "Proposal archived", tone: "info" });
      invalidate();
    },
    onError: (e: Error) => pushToast({ title: "Failed", body: e.message, tone: "error" }),
  });

  const isPending = acceptMutation.isPending || rejectMutation.isPending;

  if (!selectedCompanyId) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#181715",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          <Sparkles style={{ width: 20, height: 20, color: "#cc785c" }} />
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#faf9f5",
              fontFamily: "StyreneB, Georgia, serif",
              margin: 0,
            }}
          >
            Feature Proposals
          </h1>
        </div>
        <p style={{ color: "#a09d96", fontSize: 14, margin: 0 }}>
          Swipe right to accept and create an issue, or swipe left to archive
        </p>
      </div>

      {/* Card stack */}
      {isLoading ? (
        <div style={{ color: "#6c6a64", fontSize: 14 }}>Loading proposals…</div>
      ) : proposals.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 480,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Peek card behind */}
          {proposals.length > 1 && (
            <div
              style={{
                position: "absolute",
                top: 8,
                left: "50%",
                transform: "translateX(-50%) scale(0.96)",
                width: "100%",
                height: 200,
                background: "#252320",
                borderRadius: 16,
                opacity: 0.5,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Active card */}
          <SwipeCard
            key={proposals[0].id}
            proposal={proposals[0]}
            agents={agents ?? []}
            onAccept={() => acceptMutation.mutate(proposals[0].id)}
            onReject={() => rejectMutation.mutate(proposals[0].id)}
            isPending={isPending}
          />

          {/* Count */}
          {proposals.length > 1 && (
            <p style={{ color: "#6c6a64", fontSize: 12, marginTop: 16 }}>
              {proposals.length - 1} more pending
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface SwipeCardProps {
  proposal: FeatureProposal;
  agents: Array<{ id: string; name: string; icon?: string | null }>;
  onAccept: () => void;
  onReject: () => void;
  isPending: boolean;
}

function SwipeCard({ proposal, agents, onAccept, onReject, isPending }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, isDragging: false, deltaX: 0 });
  const [offset, setOffset] = useState(0);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);

  const agent = agents.find((a) => a.id === proposal.proposedByAgentId);
  const avatarUri = agent ? tryDicebearDataUri(agent.icon || agent.id, 64) : null;

  const triggerAccept = () => {
    if (isPending || exiting) return;
    setExiting("right");
    setTimeout(onAccept, 300);
  };

  const triggerReject = () => {
    if (isPending || exiting) return;
    setExiting("left");
    setTimeout(onReject, 300);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") triggerAccept();
      if (e.key === "ArrowLeft") triggerReject();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if (isPending) return;
    dragRef.current = { startX: e.clientX, isDragging: true, deltaX: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.deltaX = dx;
    setOffset(dx);
  };

  const onPointerUp = () => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    const dx = dragRef.current.deltaX;
    if (dx > 80) triggerAccept();
    else if (dx < -80) triggerReject();
    else setOffset(0);
  };

  const exitTransform =
    exiting === "right"
      ? "translateX(140%) rotate(20deg)"
      : exiting === "left"
        ? "translateX(-140%) rotate(-20deg)"
        : `translateX(${offset}px) rotate(${offset * 0.05}deg)`;

  const showAcceptHint = offset > 30;
  const showRejectHint = offset < -30;

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        background: "#252320",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        padding: "24px",
        cursor: isPending ? "not-allowed" : "grab",
        userSelect: "none",
        transform: exitTransform,
        transition: exiting || dragRef.current.isDragging ? (exiting ? "transform 0.3s ease-out, opacity 0.3s" : "none") : "transform 0.25s ease-out",
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Accept / Reject overlay hints */}
      {showAcceptHint && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            padding: "4px 12px",
            borderRadius: 8,
            border: "2px solid #5db872",
            color: "#5db872",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.05em",
            transform: "rotate(-12deg)",
          }}
        >
          ACCEPT
        </div>
      )}
      {showRejectHint && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            padding: "4px 12px",
            borderRadius: 8,
            border: "2px solid #c64545",
            color: "#c64545",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.05em",
            transform: "rotate(12deg)",
          }}
        >
          REJECT
        </div>
      )}

      {/* Agent header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {avatarUri ? (
          <img
            src={avatarUri}
            alt={agent?.name}
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(204,120,92,0.4)" }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#3a3632",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "#a09d96",
              border: "2px solid rgba(255,255,255,0.08)",
            }}
          >
            {agent ? (agent.name[0] || "?").toUpperCase() : "?"}
          </div>
        )}
        <div>
          <div style={{ color: "#faf9f5", fontSize: 13, fontWeight: 600 }}>
            {agent?.name ?? "Unknown Agent"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#6c6a64", fontSize: 11 }}>
            <Clock style={{ width: 10, height: 10 }} />
            proposed {timeAgo(proposal.createdAt)}
          </div>
        </div>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#faf9f5",
          fontFamily: "StyreneB, Georgia, serif",
          margin: "0 0 10px",
          lineHeight: 1.3,
        }}
      >
        {proposal.title}
      </h2>

      {/* Description */}
      <p
        style={{
          color: "#a09d96",
          fontSize: 13,
          lineHeight: 1.6,
          margin: "0 0 16px",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {proposal.description}
      </p>

      {/* Chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        <Chip color={CATEGORY_COLORS[proposal.category] ?? "#6c6a64"} label={proposal.category} />
        <Chip color={PRIORITY_COLORS[proposal.priority] ?? "#6c6a64"} label={proposal.priority + " priority"} />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={triggerReject}
          disabled={isPending || !!exiting}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 10,
            background: "rgba(198,69,69,0.1)",
            border: "1px solid rgba(198,69,69,0.25)",
            color: "#c64545",
            fontSize: 13,
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: isPending ? 0.5 : 1,
          }}
        >
          <XCircle style={{ width: 14, height: 14 }} />
          Reject
        </button>
        <button
          onClick={triggerAccept}
          disabled={isPending || !!exiting}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 10,
            background: "rgba(204,120,92,0.15)",
            border: "1px solid rgba(204,120,92,0.35)",
            color: "#cc785c",
            fontSize: 13,
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: isPending ? 0.5 : 1,
          }}
        >
          <CheckCircle2 style={{ width: 14, height: 14 }} />
          Accept & Create Issue
        </button>
      </div>

      {/* Keyboard hint */}
      <p style={{ color: "#4a4a48", fontSize: 11, textAlign: "center", marginTop: 12, marginBottom: 0 }}>
        ← Reject · Accept →
      </p>
    </div>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}20`,
        border: `1px solid ${color}40`,
        textTransform: "capitalize",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", maxWidth: 360 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(204,120,92,0.1)",
          border: "1px solid rgba(204,120,92,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}
      >
        <Sparkles style={{ width: 24, height: 24, color: "#cc785c" }} />
      </div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#faf9f5",
          fontFamily: "StyreneB, Georgia, serif",
          margin: "0 0 8px",
        }}
      >
        No proposals yet
      </h2>
      <p style={{ color: "#6c6a64", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
        Agents can submit feature ideas via the API. They'll appear here for your review.
      </p>
    </div>
  );
}
