import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Github, Link2, Unlink, GitBranch, Loader2, ChevronDown, Check } from "lucide-react";
import { githubIntegrationApi } from "@/api/githubIntegration";
import { Button } from "@/components/ui/button";
import { ProjectRepoPermissionPanel } from "./ProjectRepoPermissionPanel";
import type { Agent, GithubRepoSummary } from "@crewspaceai/shared";

interface ProjectGithubIntegrationProps {
  companyId: string;
  projectId: string;
  agents: Agent[];
}

export function ProjectGithubIntegration({ companyId, projectId, agents }: ProjectGithubIntegrationProps) {
  const queryClient = useQueryClient();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [pendingInstallationId, setPendingInstallationId] = useState<string | null>(null);
  const [availableRepos, setAvailableRepos] = useState<GithubRepoSummary[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: connectedRepo, isLoading } = useQuery({
    queryKey: ["github-repo", companyId, projectId],
    queryFn: () => githubIntegrationApi.getRepo(companyId, projectId),
    enabled: !!companyId && !!projectId,
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: (data: { installationId: number; repoFullName: string }) =>
      githubIntegrationApi.connectRepo(companyId, projectId, { ...data, defaultBranch: "main" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-repo", companyId, projectId] });
      setShowRepoPicker(false);
      setPendingInstallationId(null);
      setAvailableRepos([]);
      setSelectedRepo("");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => githubIntegrationApi.disconnectRepo(companyId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-repo", companyId, projectId] });
    },
  });

  // Listen for popup callback messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "github-callback") {
        setIsPopupOpen(false);

        if (e.data.error) {
          console.error("GitHub OAuth error:", e.data.error);
          return;
        }

        if (e.data.installationId) {
          setPendingInstallationId(e.data.installationId);
          if (e.data.repos && Array.isArray(e.data.repos)) {
            setAvailableRepos(e.data.repos);
          }
          setShowRepoPicker(true);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Poll for popup close as fallback
  useEffect(() => {
    if (!isPopupOpen) return;
    const interval = setInterval(() => {
      // Popup communication is handled by postMessage, this is just cleanup
    }, 1000);
    return () => clearInterval(interval);
  }, [isPopupOpen]);

  const initiateGithubInstall = useCallback(() => {
    const width = 800;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // In dev mode, the API runs on a different port than the Vite dev server.
    // window.open() doesn't go through Vite's proxy, so we need the direct API URL.
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const apiBase = isLocalhost ? "http://localhost:3100/api" : "/api";

    const popup = window.open(
      `${apiBase}/github/install?projectId=${encodeURIComponent(projectId)}&companyId=${encodeURIComponent(companyId)}`,
      "github-install",
      `width=${width},height=${height},left=${left},top=${top},popup=true,resizable=yes,scrollbars=yes`
    );

    if (popup) {
      setIsPopupOpen(true);
    }
  }, [companyId, projectId]);

  const handleSaveRepo = () => {
    if (!pendingInstallationId || !selectedRepo) return;
    connectMutation.mutate({
      installationId: parseInt(pendingInstallationId, 10),
      repoFullName: selectedRepo,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Repo Picker (after OAuth callback) ──
  if (showRepoPicker) {
    const selectedRepoData = availableRepos.find((r) => r.fullName === selectedRepo);

    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-xl bg-foreground flex items-center justify-center">
            <Github className="h-7 w-7 text-background" />
          </div>
          <div>
            <h4 className="text-base font-semibold">Select Repository</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which repository to link to this project.
            </p>
          </div>

          <div className="max-w-sm mx-auto space-y-4 text-left">
            {/* Custom dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-background border border-border rounded-lg text-sm hover:border-primary/40 transition-colors"
              >
                <span className={selectedRepo ? "text-foreground" : "text-muted-foreground"}>
                  {selectedRepo || "Choose a repository..."}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {availableRepos.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No repositories found
                      </div>
                    ) : (
                      availableRepos.map((repo) => (
                        <button
                          key={repo.fullName}
                          onClick={() => {
                            setSelectedRepo(repo.fullName);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                        >
                          <Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{repo.fullName}</span>
                          {selectedRepo === repo.fullName && (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {selectedRepoData && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                Default branch: {selectedRepoData.defaultBranch}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShowRepoPicker(false);
                  setPendingInstallationId(null);
                  setSelectedRepo("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!selectedRepo || connectMutation.isPending}
                onClick={handleSaveRepo}
              >
                {connectMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save & Configure
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Disconnected State ──
  if (!connectedRepo) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-xl bg-foreground flex items-center justify-center">
            <Github className="h-7 w-7 text-background" />
          </div>
          <div>
            <h4 className="text-base font-semibold">Connect GitHub Repository</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Authorize CrewSpace to access your repositories for agent code operations.
            </p>
          </div>
          <Button onClick={initiateGithubInstall} disabled={isPopupOpen}>
            <Github className="h-4 w-4 mr-1.5" />
            {isPopupOpen ? "Waiting for GitHub..." : "Connect GitHub Repository"}
          </Button>
          <p className="text-xs text-muted-foreground/60">
            You&apos;ll be redirected to GitHub to install the CrewSpace app.
          </p>
        </div>
      </div>
    );
  }

  // ── Connected State ──
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-foreground flex items-center justify-center shrink-0">
              <Github className="h-6 w-6 text-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold">
                  {connectedRepo.repoOwner}/{connectedRepo.repoName}
                </h4>
                <span className="inline-flex items-center gap-1 text-xs text-chart-2 font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-chart-2" />
                  Connected
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {connectedRepo.defaultBranch}
                </span>
                <span>via GitHub App</span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            <Unlink className="h-3.5 w-3.5 mr-1.5" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Agent Permissions */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Agent Permissions</h4>
        <ProjectRepoPermissionPanel companyId={companyId} projectId={projectId} agents={agents} />
      </div>
    </div>
  );
}
