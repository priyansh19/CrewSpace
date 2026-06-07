import type { CompanyMembershipRole } from "@crewspaceai/shared";

export function isAdminOrOwner(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canCreateAgents(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canEditSettings(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function isReadOnly(role?: CompanyMembershipRole): boolean {
  return role === "viewer";
}

export function canEditIssues(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canCreateProjects(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canCreateGoals(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canManageRoutines(role?: CompanyMembershipRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}
