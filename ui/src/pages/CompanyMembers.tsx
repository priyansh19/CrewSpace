import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { membersApi, type Member, type PendingInvite } from "../api/members";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { COMPANY_MEMBERSHIP_ROLE_LABELS, COMPANY_MEMBERSHIP_ROLES } from "@crewspaceai/shared";
import type { CompanyMembershipRole } from "@crewspaceai/shared";
import { Users, Mail, Bot, User, Shield, ShieldCheck, Eye, Trash2, Plus, Copy, Check, UserX, Inbox } from "lucide-react";
import { cn } from "../lib/utils";

const ROLE_OPTIONS: CompanyMembershipRole[] = [...COMPANY_MEMBERSHIP_ROLES];

function roleIcon(role: CompanyMembershipRole) {
  switch (role) {
    case "owner":
      return Shield;
    case "admin":
      return ShieldCheck;
    case "viewer":
      return Eye;
    default:
      return User;
  }
}

function MemberRow({
  member,
  canManage,
  onRoleChange,
  onRemove,
}: {
  member: Member;
  canManage: boolean;
  onRoleChange: (memberId: string, role: CompanyMembershipRole) => void;
  onRemove: (member: Member) => void;
}) {
  const RoleIcon = roleIcon(member.membershipRole);
  const isAgent = member.principalType === "agent";

  return (
    <EntityRow
      leading={
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0">
          {isAgent ? <Bot className="h-3.5 w-3.5 text-muted-foreground" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      }
      title={member.name}
      subtitle={member.email ?? (isAgent ? "Agent" : "No email")}
      trailing={
        <div className="flex items-center gap-3">
          {canManage && member.membershipRole !== "owner" ? (
            <Select
              value={member.membershipRole}
              onValueChange={(v) => onRoleChange(member.id, v as CompanyMembershipRole)}
            >
              <SelectTrigger size="sm" className="w-28 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role} className="text-xs">
                    {COMPANY_MEMBERSHIP_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              <RoleIcon className="h-3 w-3" />
              {COMPANY_MEMBERSHIP_ROLE_LABELS[member.membershipRole]}
            </span>
          )}
          <StatusBadge status={member.status} />
          {canManage && member.membershipRole !== "owner" && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(member)}
              title="Remove member"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      }
    />
  );
}

export function CompanyMembers() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<CompanyMembershipRole>("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Members" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.members.list(selectedCompanyId!),
    queryFn: () => membersApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: queryKeys.members.invites(selectedCompanyId!),
    queryFn: () => membersApi.listInvites(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: CompanyMembershipRole }) =>
      membersApi.updateRole(selectedCompanyId!, memberId, { membershipRole: role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedCompanyId!) });
      pushToast({ title: "Role updated", tone: "success" });
    },
    onError: (err) => {
      pushToast({ title: err instanceof Error ? err.message : "Failed to update role", tone: "error" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => membersApi.remove(selectedCompanyId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list(selectedCompanyId!) });
      setRemoveTarget(null);
      pushToast({ title: "Member removed", tone: "success" });
    },
    onError: (err) => {
      pushToast({ title: err instanceof Error ? err.message : "Failed to remove member", tone: "error" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createCompanyInvite(selectedCompanyId!, {
        allowedJoinTypes: "human",
      }),
    onSuccess: (invite) => {
      const base = window.location.origin.replace(/\/+$/, "");
      const url = invite.inviteUrl ?? `${base}/invite/${invite.token}`;
      setInviteLink(url);
      queryClient.invalidateQueries({ queryKey: queryKeys.members.invites(selectedCompanyId!) });
      pushToast({ title: "Invite created", tone: "success" });
    },
    onError: (err) => {
      pushToast({ title: err instanceof Error ? err.message : "Failed to create invite", tone: "error" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => membersApi.revokeInvite(selectedCompanyId!, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.invites(selectedCompanyId!) });
      pushToast({ title: "Invite revoked", tone: "success" });
    },
    onError: (err) => {
      pushToast({ title: err instanceof Error ? err.message : "Failed to revoke invite", tone: "error" });
    },
  });

  const currentUserRole: CompanyMembershipRole = useMemo(() => {
    // In mock mode we assume current user is owner; real implementation should
    // derive from session + membership lookup.
    return "owner";
  }, []);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  const activeMembers = members?.filter((m) => m.status === "active") ?? [];
  const pendingMembers = members?.filter((m) => m.status === "pending") ?? [];

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Members</h1>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Invite member
          </Button>
        )}
      </div>

      {/* Active Members */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Active Members
          </div>
          <span className="text-xs text-muted-foreground">{activeMembers.length}</span>
        </div>
        {membersLoading ? (
          <PageSkeleton />
        ) : activeMembers.length === 0 ? (
          <EmptyState icon={UserX} message="No active members yet." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {activeMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canManage={canManage}
                onRoleChange={(id, role) => updateRoleMutation.mutate({ memberId: id, role })}
                onRemove={(m) => setRemoveTarget(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pending Members */}
      {pendingMembers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pending
            </div>
            <span className="text-xs text-muted-foreground">{pendingMembers.length}</span>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            {pendingMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canManage={canManage}
                onRoleChange={(id, role) => updateRoleMutation.mutate({ memberId: id, role })}
                onRemove={(m) => setRemoveTarget(m)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending Invites */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Pending Invites
          </div>
          <span className="text-xs text-muted-foreground">{invites?.length ?? 0}</span>
        </div>
        {invitesLoading ? (
          <PageSkeleton />
        ) : !invites || invites.length === 0 ? (
          <EmptyState icon={Inbox} message="No pending invites." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {invites.map((invite) => (
              <EntityRow
                key={invite.id}
                leading={
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                }
                title={invite.inviteUrl}
                subtitle={`Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                trailing={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {invite.allowedJoinTypes}
                    </span>
                    {canManage && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => revokeInviteMutation.mutate(invite.id)}
                        title="Revoke invite"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Remove Confirm */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove member"
        description={
          removeTarget
            ? `Remove ${removeTarget.name} from the company? This cannot be undone.`
            : ""
        }
        variant="destructive"
        confirmLabel="Remove"
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
      />

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              Create an invite link for a new user to join this company.
            </DialogDescription>
          </DialogHeader>

          {!inviteLink ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyMembershipRole)}>
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {COMPANY_MEMBERSHIP_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email (optional)</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground">
                Share this link with the person you want to invite:
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="flex-1 text-xs font-mono truncate">{inviteLink}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      /* noop */
                    }
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!inviteLink ? (
              <>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? "Creating..." : "Create invite"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => { setInviteLink(null); setInviteOpen(false); }}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
