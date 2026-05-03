import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Github, Check, X, Save, ShieldAlert } from "lucide-react";
import { githubIntegrationApi } from "@/api/githubIntegration";
import { queryKeys } from "@/lib/queryKeys";
import { AgentAvatar } from "./AgentAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Agent, ProjectRepoPermission } from "@crewspaceai/shared";

interface ProjectRepoPermissionPanelProps {
  companyId: string;
  projectId: string;
  agents: Agent[];
}

export function ProjectRepoPermissionPanel({ companyId, projectId, agents }: ProjectRepoPermissionPanelProps) {
  const queryClient = useQueryClient();
  const [localPerms, setLocalPerms] = useState<Map<string, { canRead: boolean; canPush: boolean; canCreateBranch: boolean }>>(new Map());

  const { data: perms } = useQuery({
    queryKey: ["github-repo-perms", companyId, projectId],
    queryFn: () => githubIntegrationApi.listAgentPermissions(companyId, projectId),
    enabled: !!companyId && !!projectId,
  });

  const setPermMutation = useMutation({
    mutationFn: (data: { agentId: string; canRead: boolean; canPush: boolean; canCreateBranch: boolean }) =>
      githubIntegrationApi.setAgentPermission(companyId, projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-repo-perms", companyId, projectId] });
    },
  });

  const permMap = new Map<string, ProjectRepoPermission>();
  for (const p of perms ?? []) {
    permMap.set(p.agentId, p);
  }

  const hasChanges = localPerms.size > 0;

  const togglePerm = (agentId: string, field: "canRead" | "canPush" | "canCreateBranch") => {
    const existing = permMap.get(agentId);
    const current = localPerms.get(agentId) ?? {
      canRead: existing?.canRead ?? true,
      canPush: existing?.canPush ?? false,
      canCreateBranch: existing?.canCreateBranch ?? false,
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <p className="text-sm text-destructive">
          Agents NOT in this whitelist are REDACTED from making any changes to this repository.
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Agent</span>
          <span className="text-center">Read</span>
          <span className="text-center">Push</span>
          <span className="text-center">Branch</span>
        </div>

        {/* Agent rows */}
        <div className="divide-y divide-border/50">
          {agents.map((agent) => {
            const perm = permMap.get(agent.id);
            const local = localPerms.get(agent.id);
            const canRead = local ? local.canRead : perm?.canRead ?? true;
            const canPush = local ? local.canPush : perm?.canPush ?? false;
            const canCreateBranch = local ? local.canCreateBranch : perm?.canCreateBranch ?? false;
            const isModified = local !== undefined;

            return (
              <div
                key={agent.id}
                className={cn(
                  "grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-2.5 items-center transition-colors",
                  isModified && "bg-primary/5"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AgentAvatar agent={agent} size="xs" variant="square" animate={false} />
                  <span className="text-sm truncate">{agent.name}</span>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => togglePerm(agent.id, "canRead")}
                    className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center transition-colors",
                      canRead
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <Check className={cn("h-3 w-3", !canRead && "opacity-30")} />
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => togglePerm(agent.id, "canPush")}
                    className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center transition-colors",
                      canPush
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {canPush ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-30" />}
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => togglePerm(agent.id, "canCreateBranch")}
                    className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center transition-colors",
                      canCreateBranch
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {canCreateBranch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-30" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasChanges && (
        <Button size="sm" onClick={saveChanges} disabled={setPermMutation.isPending}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save Changes
        </Button>
      )}
    </div>
  );
}
