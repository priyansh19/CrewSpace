import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import type { CompanyMembershipRole } from "@crewspaceai/shared";

export function useCompanyRole(): {
  role: CompanyMembershipRole | undefined;
  isLoading: boolean;
} {
  const { selectedCompanyId } = useCompany();
  const { data: session, isLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const role = useMemo<CompanyMembershipRole | undefined>(() => {
    if (!selectedCompanyId || !session) return undefined;
    return session.companyRoles[selectedCompanyId];
  }, [session, selectedCompanyId]);

  return { role, isLoading };
}
