import { api } from "./client";
import type { CompanyMembershipRole } from "@crewspaceai/shared";

export interface Member {
  id: string;
  companyId: string;
  principalType: "user" | "agent";
  principalId: string;
  name: string;
  email: string | null;
  status: "pending" | "active" | "suspended";
  membershipRole: CompanyMembershipRole;
  createdAt: string;
  updatedAt: string;
}

export interface PendingInvite {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  allowedJoinTypes: "human" | "agent" | "both";
  companyName?: string | null;
  inviteMessage?: string | null;
}

type UpdateRoleInput = {
  membershipRole: CompanyMembershipRole;
};

// Placeholder: wire to real backend as CRE-38/39 land.
// Set to false to attempt real API calls.
const USE_MOCK = true;

const MOCK_MEMBERS: Member[] = [
  {
    id: "m1",
    companyId: "mock",
    principalType: "user",
    principalId: "u1",
    name: "Alice Johnson",
    email: "alice@example.com",
    status: "active",
    membershipRole: "owner",
    createdAt: "2026-04-01T10:00:00Z",
    updatedAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "m2",
    companyId: "mock",
    principalType: "user",
    principalId: "u2",
    name: "Bob Smith",
    email: "bob@example.com",
    status: "active",
    membershipRole: "admin",
    createdAt: "2026-04-05T14:30:00Z",
    updatedAt: "2026-04-10T09:15:00Z",
  },
  {
    id: "m3",
    companyId: "mock",
    principalType: "user",
    principalId: "u3",
    name: "Carol White",
    email: "carol@example.com",
    status: "active",
    membershipRole: "member",
    createdAt: "2026-04-12T08:45:00Z",
    updatedAt: "2026-04-12T08:45:00Z",
  },
  {
    id: "m4",
    companyId: "mock",
    principalType: "agent",
    principalId: "a1",
    name: "FrontendDev",
    email: null,
    status: "active",
    membershipRole: "member",
    createdAt: "2026-04-15T11:20:00Z",
    updatedAt: "2026-04-15T11:20:00Z",
  },
  {
    id: "m5",
    companyId: "mock",
    principalType: "user",
    principalId: "u4",
    name: "Dan Lee",
    email: "dan@example.com",
    status: "pending",
    membershipRole: "viewer",
    createdAt: "2026-05-10T16:00:00Z",
    updatedAt: "2026-05-10T16:00:00Z",
  },
];

const MOCK_INVITES: PendingInvite[] = [
  {
    id: "inv1",
    token: "tok-abc",
    inviteUrl: "http://localhost:3100/invite/tok-abc",
    expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    allowedJoinTypes: "both",
    companyName: "Mock Co",
    inviteMessage: null,
  },
];

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export const membersApi = {
  list: async (companyId: string): Promise<Member[]> => {
    if (USE_MOCK) {
      await delay(300);
      return MOCK_MEMBERS.map((m) => ({ ...m, companyId }));
    }
    const rows = await api.get<
      Array<{
        id: string;
        companyId: string;
        principalType: "user" | "agent";
        principalId: string;
        status: "pending" | "active" | "suspended";
        membershipRole: CompanyMembershipRole;
        createdAt: string;
        updatedAt: string;
      }>
    >(`/companies/${companyId}/members`);
    // TODO: enrich principalId with name/email from users/agents endpoints
    return rows as Member[];
  },

  updateRole: async (
    companyId: string,
    memberId: string,
    input: UpdateRoleInput,
  ): Promise<Member> => {
    if (USE_MOCK) {
      await delay(200);
      const member = MOCK_MEMBERS.find((m) => m.id === memberId);
      if (!member) throw new Error("Member not found");
      member.membershipRole = input.membershipRole;
      member.updatedAt = new Date().toISOString();
      return { ...member, companyId };
    }
    return api.patch<Member>(
      `/companies/${companyId}/members/${memberId}/permissions`,
      { grants: [] }, // placeholder; real update may use a dedicated role endpoint
    );
  },

  remove: async (companyId: string, memberId: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(200);
      return;
    }
    // TODO: wire to real remove endpoint when available
    throw new Error("Remove member not yet implemented on backend");
  },

  listInvites: async (companyId: string): Promise<PendingInvite[]> => {
    if (USE_MOCK) {
      await delay(200);
      return MOCK_INVITES;
    }
    // TODO: wire to real invites list endpoint
    return [];
  },

  revokeInvite: async (companyId: string, inviteId: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(200);
      return;
    }
    // TODO: wire to real revoke endpoint
    throw new Error("Revoke invite not yet implemented on backend");
  },
};
