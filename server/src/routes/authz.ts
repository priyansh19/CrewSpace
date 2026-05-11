import type { Request } from "express";
import type { CompanyMembershipRole, PermissionKey } from "@crewspaceai/shared";
import { COMPANY_MEMBERSHIP_ROLES, PERMISSION_KEYS } from "@crewspaceai/shared";
import { forbidden, unauthorized } from "../errors.js";

export const ROLE_PERMISSIONS: Record<CompanyMembershipRole, Set<PermissionKey>> = {
  owner: new Set(PERMISSION_KEYS),
  admin: new Set(PERMISSION_KEYS),
  member: new Set<PermissionKey>(["tasks:assign"]),
  viewer: new Set<PermissionKey>(),
};

export function getActorCompanyRole(req: Request, companyId: string): CompanyMembershipRole | null {
  if (req.actor.type === "board" && req.actor.source === "local_implicit") return "owner";
  if (req.actor.type === "board" && req.actor.isInstanceAdmin) return "owner";
  if (req.actor.type === "board" && req.actor.companyRoles) {
    const role = req.actor.companyRoles[companyId];
    if (role && COMPANY_MEMBERSHIP_ROLES.includes(role as CompanyMembershipRole)) {
      return role as CompanyMembershipRole;
    }
  }
  return null;
}

export function assertCompanyRole(req: Request, companyId: string, ...allowedRoles: CompanyMembershipRole[]) {
  assertCompanyAccess(req, companyId);
  if (req.actor.type !== "board") return;
  const role = getActorCompanyRole(req, companyId);
  if (!role || !allowedRoles.includes(role)) {
    throw forbidden(`Requires one of roles: ${allowedRoles.join(", ")}`);
  }
}

export function assertCompanyPermission(req: Request, companyId: string, permissionKey: PermissionKey) {
  assertCompanyAccess(req, companyId);
  if (req.actor.type !== "board") return;
  const role = getActorCompanyRole(req, companyId);
  if (role && ROLE_PERMISSIONS[role].has(permissionKey)) return;
  throw forbidden(`Permission denied: ${permissionKey}`);
}

export function assertBoard(req: Request) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
  if (req.actor.type !== "board") {
    throw forbidden("Board access required");
  }
}

export function assertInstanceAdmin(req: Request) {
  assertBoard(req);
  if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
    return;
  }
  throw forbidden("Instance admin access required");
}

export function assertCompanyAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) {
    throw forbidden("Agent key cannot access another company");
  }
  if (req.actor.type === "board" && req.actor.source !== "local_implicit" && !req.actor.isInstanceAdmin) {
    const allowedCompanies = req.actor.companyIds ?? [];
    if (!allowedCompanies.includes(companyId)) {
      throw forbidden("User does not have access to this company");
    }
  }
}

export function getActorInfo(req: Request) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
  if (req.actor.type === "agent") {
    return {
      actorType: "agent" as const,
      actorId: req.actor.agentId ?? "unknown-agent",
      agentId: req.actor.agentId ?? null,
      runId: req.actor.runId ?? null,
    };
  }

  return {
    actorType: "user" as const,
    actorId: req.actor.userId ?? "board",
    agentId: null,
    runId: req.actor.runId ?? null,
  };
}
