import { useRef, useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { activityApi } from "@/api/activity";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { AgentAvatar } from "./AgentAvatar";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";
import type { ActivityEvent, Agent } from "@crewspaceai/shared";

interface LiveActivityPanelProps {
  companyId: string;
  className?: string;
}

const ACTION_VERBS: Record<string, string> = {
  "issue.created": "created issue",
  "issue.updated": "updated issue",
  "issue.checked_out": "checked out issue",
  "issue.released": "released issue",
  "issue.comment_added": "commented on issue",
  "agent.created": "created agent",
  "agent.updated": "updated agent",
  "agent.paused": "paused agent",
  "agent.resumed": "resumed agent",
  "agent.terminated": "terminated agent",
  "heartbeat.invoked": "invoked heartbeat",
  "heartbeat.cancelled": "cancelled heartbeat",
  "approval.created": "requested approval",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
  "project.created": "created project",
  "project.updated": "updated project",
  "project.deleted": "deleted project",
  "goal.created": "created goal",
  "goal.updated": "updated goal",
  "goal.deleted": "deleted goal",
  "cost.reported": "reported cost",
  "company.created": "created company",
  "company.updated": "updated company",
  "company.archived": "archived company",
};

function formatVerb(action: string): string {
  return ACTION_VERBS[action] ?? action.replace(/[._]/g, " ");
}

function ActivityItem({
  event,
  agentMap,
}: {
  event: ActivityEvent;
  agentMap: Map<string, Agent>;
}) {
  const verb = formatVerb(event.action);

  let actorName = "System";
  let actorAgent: Agent | undefined;

  if (event.actorType === "agent") {
    actorAgent = agentMap.get(event.actorId);
    actorName = actorAgent?.name ?? event.actorId.slice(0, 8);
  } else if (event.actorType === "user") {
    actorName = "Board";
  }

  const entityName =
    (event.details?.name as string) ??
    (event.details?.title as string) ??
    event.entityId.slice(0, 8);

  return (
    <div className="flex items-start gap-2.5 py-2.5 px-3 hover:bg-accent/30 transition-colors">
      <AgentAvatar
        agent={actorAgent ?? null}
        size="xs"
        variant="square"
        animate={false}
        className="shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs leading-relaxed">
          <span className="font-medium text-foreground">{actorName}</span>{" "}
          <span className="text-muted-foreground">{verb}</span>
          {entityName && (
            <span className="text-foreground truncate inline-block max-w-[140px] align-bottom ml-1">
              {entityName}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
          {timeAgo(event.createdAt)}
        </div>
      </div>
    </div>
  );
}

export function LiveActivityPanel({ companyId, className }: LiveActivityPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const { data: activity } = useQuery({
    queryKey: [queryKeys.activity(companyId)],
    queryFn: () => activityApi.list(companyId),
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const events = activity?.slice(0, 50) ?? [];

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isPaused]);

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Live Activity</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-chart-2" />
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            Live
          </span>
        </div>
      </div>

      {/* Activity list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map((event) => (
              <ActivityItem key={event.id} event={event} agentMap={agentMap} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/50 shrink-0 text-[10px] text-muted-foreground/60 text-center">
        {isPaused ? "Paused — scroll to resume" : "Auto-scrolling"}
      </div>
    </div>
  );
}
