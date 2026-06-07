import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Check, X, Save, Users } from "lucide-react";
import { sharedWorkspaceApi } from "@/api/sharedWorkspace";
import { queryKeys } from "@/lib/queryKeys";
import { AgentAvatar } from "./AgentAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Agent, SharedWorkspacePermission } from "@crewspaceai/shared";

interface WorkspaceAccessPanelProps {
  companyId: string;
  projectId: string;
  agents: Agent[];
}

export function WorkspaceAccessPanel({ companyId, projectId, agents }: WorkspaceAccessPanelProps) {
  const queryClient = useQueryClient();
  const [localPerms, setLocalPerms] = useState<Map<string, { canRead: boolean; canWrite: boolean }>>(new Map());

  const { data: perms } = useQuery({
    queryKey: queryKeys.sharedWorkspace?.permissions(companyId, projectId) ?? ["shared-workspace-perms", companyId, projectId],
    queryFn: () => sharedWorkspaceApi.listPermissions(companyId, projectId),
    enabled: !!companyId && !!projectId,
  });

  const setPermMutation = useMutation({
    mutationFn: (data: { agentId: string; canRead: boolean; canWrite: boolean }) =>
      sharedWorkspaceApi.setPermission(companyId, { projectId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-workspace-perms", companyId, projectId] });
    },
  });

  const permMap = new Map<string, SharedWorkspacePermission>();
  for (const p of perms ?? []) {
    permMap.set(p.agentId, p);
  }

  const hasChanges = localPerms.size > 0;

  const togglePerm = (agentId: string, field: "canRead" | "canWrite") => {
    const existing = permMap.get(agentId);
    const current = localPerms.get(agentId) ?? {
      canRead: existing?.canRead ?? true,
      canWrite: existing?.canWrite ?? false,
    };
    const updated = { ...current, [field]: !current[field] };
    setLocalPerms(new Map(localPerms.set(agentId, updated)));
  };

  const saveChanges = () => {
    for (const [agentId, perm] of localPerms) {
      setPermMutation.mutate({ agentId, ...perm });
    }
    setLocalPerms(new Map());
  };

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 shrink-0">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Access Control</h3>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {agents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            No agents in this company
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {agents.map((agent) => {
              const perm = permMap.get(agent.id);
              const local = localPerms.get(agent.id);
              const canRead = local ? local.canRead : perm?.canRead ?? true;
              const canWrite = local ? local.canWrite : perm?.canWrite ?? false;
              const isModified = local !== undefined;

              return (
                <div
                  key={agent.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors",
                    isModified && "bg-primary/5"
                  )}
                >
                  <AgentAvatar agent={agent} size="sm" variant="square" animate={false} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.role}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => togglePerm(agent.id, "canRead")}
                      className={cn(
                        "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                        canRead
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                      title="Read access"
                    >
                      <Check className={cn("h-3.5 w-3.5", !canRead && "opacity-30")} />
                    </button>
                    <button
                      onClick={() => togglePerm(agent.id, "canWrite")}
                      className={cn(
                        "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                        canWrite
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                      title="Write access"
                    >
                      {canWrite ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-30" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasChanges && (
        <div className="px-4 py-3 border-t border-border/50 shrink-0">
          <Button size="sm" className="w-full" onClick={saveChanges} disabled={setPermMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
