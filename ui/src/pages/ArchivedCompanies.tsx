import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { ArchiveRestore, Archive, Calendar } from "lucide-react";

export function ArchivedCompanies() {
  const { companies, loading, error } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const archivedCompanies = companies.filter((c) => c.status === "archived");

  const restoreMutation = useMutation({
    mutationFn: (companyId: string) =>
      companiesApi.update(companyId, { status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Archived Companies" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Archived Companies</h2>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {archivedCompanies.length}
          </span>
        </div>
      </div>

      <div className="h-6">
        {loading && <p className="text-sm text-muted-foreground">Loading companies...</p>}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </div>

      {archivedCompanies.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Archive className="h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-medium text-muted-foreground">
            No archived companies
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
            When you archive a company, it will appear here. Archived companies retain all data but are hidden from the main company list.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {archivedCompanies.map((company) => (
          <div
            key={company.id}
            className="group bg-card border border-border rounded-lg p-5 transition-colors hover:border-muted-foreground/30"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">{company.name}</h3>
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
                    archived
                  </span>
                </div>
                {company.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {company.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Updated {relativeTime(company.updatedAt)}</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => restoreMutation.mutate(company.id)}
                disabled={restoreMutation.isPending && restoreMutation.variables === company.id}
              >
                <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                {restoreMutation.isPending && restoreMutation.variables === company.id
                  ? "Restoring…"
                  : "Restore"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
