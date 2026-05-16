import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Github, Link2, Unlink, GitBranch, Loader2, ChevronDown,
  Check, Search, Key, RefreshCw, GitPullRequest, Shield, Zap, Eye,
} from "lucide-react";
import { githubIntegrationApi } from "@/api/githubIntegration";
import { Button } from "@/components/ui/button";
import { ProjectRepoPermissionPanel } from "./ProjectRepoPermissionPanel";
import type { Agent, GithubRepoSummary } from "@crewspaceai/shared";

declare global {
  interface Window {
    electronAPI?: {
      saveAuthConfig: (auth: { github?: { pat?: string } }) => Promise<void>;
      restartServerWithAuth: () => Promise<{ success: boolean; error?: string }>;
      getGitHubAuthConfig: () => Promise<{ pat?: string } | null>;
    };
  }
}

interface ProjectGithubIntegrationProps {
  companyId: string;
  projectId: string;
  agents: Agent[];
}

async function waitForGithubReady(maxMs = 15_000, intervalMs = 600): Promise<"pat" | "app" | "none"> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const status = await githubIntegrationApi.getStatus();
      if (status.mode !== "none") return status.mode;
    } catch { /* Server still starting */ }
  }
  return "none";
}

// ── Feature bullets used in info panel ──────────────────────────────────────

const GITHUB_FEATURES = [
  { icon: GitPullRequest, label: "PR management", desc: "Agents can open, review and merge pull requests" },
  { icon: GitBranch,     label: "Branch workflows", desc: "Create feature branches and push code automatically" },
  { icon: Eye,           label: "Code review",   desc: "Agents read your codebase and suggest improvements" },
  { icon: Shield,        label: "Permission control", desc: "Fine-grained read/write access per agent" },
  { icon: Zap,           label: "Automation",    desc: "Trigger runs on PR events and commits" },
];

// ── Two-column shell ─────────────────────────────────────────────────────────

function TwoColumnShell({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 h-full" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

// ── Info panel (shown when not yet connected) ────────────────────────────────

function GithubInfoPanel() {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h4 className="text-sm font-semibold mb-1">What GitHub unlocks</h4>
        <p className="text-xs text-muted-foreground mb-5">
          Once connected, agents in this project can interact directly with your repository.
        </p>
        <div className="space-y-4">
          {GITHUB_FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h4 className="text-sm font-semibold mb-1">PAT permissions needed</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Generate a token at <span className="text-foreground font-mono text-xs">github.com → Settings → Developer settings → Personal access tokens</span>
        </p>
        <div className="space-y-1.5">
          {["repo (full control of private repos)", "read:org (read org membership)"].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <Check className="h-3 w-3 text-chart-2 shrink-0" />
              <code className="text-xs text-muted-foreground">{s}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProjectGithubIntegration({ companyId, projectId, agents }: ProjectGithubIntegrationProps) {
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // GitHub App popup
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [pendingInstallationId, setPendingInstallationId] = useState<string | null>(null);
  const [availableRepos, setAvailableRepos] = useState<GithubRepoSummary[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // PAT setup
  const [patInput, setPatInput] = useState<string>("");
  const [isSavingPat, setIsSavingPat] = useState(false);
  const [patSavePhase, setPatSavePhase] = useState<"idle" | "saving" | "restarting" | "waiting" | "done">("idle");
  const [patError, setPatError] = useState<string | null>(null);

  // Repo search (PAT mode)
  const [repoSearchText, setRepoSearchText] = useState<string>("");

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: githubStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["github-status"],
    queryFn: () => githubIntegrationApi.getStatus(),
    staleTime: 60_000,
  });

  const {
    data: companyRepos,
    isLoading: isLoadingCompanyRepos,
    refetch: refetchRepos,
  } = useQuery({
    queryKey: ["github-company-repos", companyId],
    queryFn: () => githubIntegrationApi.listCompanyRepos(companyId),
    enabled: githubStatus?.mode === "pat" && !!companyId,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: connectedRepo, isLoading } = useQuery({
    queryKey: ["github-repo", companyId, projectId],
    queryFn: () => githubIntegrationApi.getRepo(companyId, projectId),
    enabled: !!companyId && !!projectId,
    retry: false,
    staleTime: 0,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const [connectError, setConnectError] = useState<string | null>(null);

  const connectMutation = useMutation({
    mutationFn: (data: { installationId?: number; repoFullName: string; defaultBranch?: string }) =>
      githubIntegrationApi.connectRepo(companyId, projectId, { ...data, defaultBranch: data.defaultBranch ?? "main" }),
    onSuccess: async () => {
      setConnectError(null);
      await queryClient.invalidateQueries({ queryKey: ["github-repo", companyId, projectId] });
      await queryClient.refetchQueries({ queryKey: ["github-repo", companyId, projectId] });
      setShowRepoPicker(false);
      setPendingInstallationId(null);
      setAvailableRepos([]);
      setSelectedRepo("");
      setRepoSearchText("");
    },
    onError: (err) => {
      setConnectError(err instanceof Error ? err.message : "Failed to connect repository");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => githubIntegrationApi.disconnectRepo(companyId, projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["github-repo", companyId, projectId] }),
  });

  // ── GitHub App popup listener ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "github-callback") return;
      setIsPopupOpen(false);
      if (e.data.error) { console.error("GitHub OAuth error:", e.data.error); return; }
      if (e.data.installationId) {
        setPendingInstallationId(e.data.installationId);
        if (Array.isArray(e.data.repos)) setAvailableRepos(e.data.repos);
        setShowRepoPicker(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── PAT save flow ─────────────────────────────────────────────────────────

  const handleSavePat = async () => {
    const pat = patInput.trim();
    if (!pat) return;
    setIsSavingPat(true);
    setPatError(null);
    try {
      setPatSavePhase("saving");
      await window.electronAPI?.saveAuthConfig({ github: { pat } });
      setPatSavePhase("restarting");
      const result = await window.electronAPI?.restartServerWithAuth();
      if (result && !result.success) { setPatError(result.error ?? "Server restart failed"); return; }
      setPatSavePhase("waiting");
      const mode = await waitForGithubReady(15_000, 600);
      if (mode === "none") { setPatError("Server restarted but GitHub auth is still not configured. Check your token and try again."); return; }
      setPatSavePhase("done");
      setPatInput("");
      await queryClient.invalidateQueries({ queryKey: ["github-status"] });
      await queryClient.invalidateQueries({ queryKey: ["github-company-repos", companyId] });
      await refetchStatus();
    } catch (err) {
      setPatError(err instanceof Error ? err.message : "Failed to save PAT");
    } finally {
      setIsSavingPat(false);
      setPatSavePhase("idle");
    }
  };

  const initiateGithubInstall = useCallback(() => {
    const width = 800, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top  = window.screenY + (window.outerHeight - height) / 2;
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const apiBase = isLocalhost ? "http://localhost:3100/api" : "/api";
    const popup = window.open(
      `${apiBase}/github/install?projectId=${encodeURIComponent(projectId)}&companyId=${encodeURIComponent(companyId)}`,
      "github-install",
      `width=${width},height=${height},left=${left},top=${top},popup=true,resizable=yes,scrollbars=yes`,
    );
    if (popup) setIsPopupOpen(true);
  }, [companyId, projectId]);

  const handlePatConnect = () => {
    const repo = repoSearchText.trim();
    if (!repo) return;
    const repoData = (companyRepos ?? []).find((r) => r.fullName === repo);
    connectMutation.mutate({ repoFullName: repo, defaultBranch: repoData?.defaultBranch ?? "main" });
  };

  const handleSaveRepo = () => {
    if (!pendingInstallationId || !selectedRepo) return;
    connectMutation.mutate({ installationId: parseInt(pendingInstallationId, 10), repoFullName: selectedRepo });
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const allRepos = companyRepos ?? [];
  const filteredRepos = repoSearchText
    ? allRepos.filter((r) => r.fullName.toLowerCase().includes(repoSearchText.toLowerCase()))
    : allRepos;
  const selectedRepoData = allRepos.find((r) => r.fullName === repoSearchText);

  const phaseLabel = {
    idle: null, saving: "Saving token…", restarting: "Restarting server…",
    waiting: "Waiting for GitHub auth…", done: "Connected!",
  }[patSavePhase];

  // ────────────────────────────────────────────────────────────────────────────
  // STATE: No GitHub configured — PAT setup
  // ────────────────────────────────────────────────────────────────────────────

  if (githubStatus?.mode === "none") {
    return (
      <TwoColumnShell
        left={
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                <Github className="h-5 w-5 text-background" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Connect GitHub</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter a Personal Access Token with <code className="text-xs bg-muted px-1 rounded">repo</code> scope.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSavePat(); }}
                  disabled={isSavingPat}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors font-mono disabled:opacity-50"
                />
              </div>

              {isSavingPat && phaseLabel && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>{phaseLabel}</span>
                </div>
              )}

              {patError && <p className="text-xs text-destructive">{patError}</p>}

              <Button className="w-full" disabled={!patInput.trim() || isSavingPat} onClick={handleSavePat}>
                {isSavingPat
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Connecting…</>
                  : <><Key className="h-4 w-4 mr-1.5" />Save & Connect</>
                }
              </Button>

              <p className="text-xs text-muted-foreground/60 text-center">
                Token stored encrypted on this machine only.
              </p>
            </div>
          </div>
        }
        right={<GithubInfoPanel />}
      />
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STATE: PAT mode — pick a repository
  // ────────────────────────────────────────────────────────────────────────────

  if (githubStatus?.mode === "pat" && !connectedRepo) {
    return (
      <TwoColumnShell
        left={
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                <Github className="h-5 w-5 text-background" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Select a Repository</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Link a repository to this project.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Dropdown trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen((o) => !o);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-background border border-border rounded-lg text-sm hover:border-primary/40 transition-colors"
                >
                  {isLoadingCompanyRepos ? (
                    <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground flex-1 text-left">Loading…</span></>
                  ) : repoSearchText ? (
                    <><Github className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-left truncate font-medium">{repoSearchText}</span></>
                  ) : (
                    <><Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground flex-1 text-left">
                      {allRepos.length > 0 ? `${allRepos.length} repos available — click to select` : "Search or enter owner/repo…"}
                    </span></>
                  )}
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                      {/* Search inside dropdown */}
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Filter repositories…"
                            value={repoSearchText}
                            onChange={(e) => setRepoSearchText(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto">
                        {isLoadingCompanyRepos ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading repositories…
                          </div>
                        ) : filteredRepos.length === 0 && !repoSearchText ? (
                          <div className="px-3 py-4 text-center">
                            <p className="text-sm text-muted-foreground">No repositories found.</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Check that your PAT has <code>repo</code> scope.</p>
                          </div>
                        ) : filteredRepos.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-muted-foreground">
                            No match — <strong className="text-foreground">"{repoSearchText}"</strong> will be used as-is.
                          </div>
                        ) : (
                          filteredRepos.map((repo) => (
                            <button
                              key={repo.fullName}
                              type="button"
                              onClick={() => { setRepoSearchText(repo.fullName); setIsDropdownOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                            >
                              <Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1 truncate">{repo.fullName}</span>
                              {repo.defaultBranch && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground/60 shrink-0">
                                  <GitBranch className="h-3 w-3" />
                                  {repo.defaultBranch}
                                </span>
                              )}
                              {repoSearchText === repo.fullName && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>

                      {!isLoadingCompanyRepos && (
                        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground/50">
                          Type <code>owner/repo</code> to enter manually
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {selectedRepoData && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  Default branch: <span className="font-medium">{selectedRepoData.defaultBranch}</span>
                </div>
              )}

              {!isLoadingCompanyRepos && allRepos.length === 0 && (
                <button
                  type="button"
                  onClick={() => refetchRepos()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reload repositories
                </button>
              )}

              <Button
                className="w-full"
                disabled={!repoSearchText.trim() || connectMutation.isPending}
                onClick={handlePatConnect}
              >
                {connectMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Connecting…</>
                  : <><Link2 className="h-4 w-4 mr-1.5" />Connect Repository</>
                }
              </Button>
              {connectError && <p className="text-xs text-destructive">{connectError}</p>}
            </div>
          </div>
        }
        right={
          /* Repo list as quick reference on the right */
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                {allRepos.length > 0 ? `${allRepos.length} repositories accessible` : "Your repositories"}
              </h4>
              <button
                onClick={() => refetchRepos()}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Reload"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {isLoadingCompanyRepos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : allRepos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No repositories found. Make sure your PAT has <code className="text-xs bg-muted px-1 rounded">repo</code> scope.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {allRepos.map((repo) => (
                  <button
                    key={repo.fullName}
                    onClick={() => { setRepoSearchText(repo.fullName); setIsDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs hover:bg-accent transition-colors ${repoSearchText === repo.fullName ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                  >
                    <Github className="h-3 w-3 shrink-0" />
                    <span className="flex-1 truncate">{repo.fullName}</span>
                    {repoSearchText === repo.fullName && <Check className="h-3 w-3 shrink-0 text-primary" />}
                    <span className="flex items-center gap-0.5 shrink-0 opacity-50">
                      <GitBranch className="h-2.5 w-2.5" />
                      {repo.defaultBranch}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STATE: PAT mode — repository connected
  // ────────────────────────────────────────────────────────────────────────────

  if (githubStatus?.mode === "pat" && connectedRepo) {
    return (
      <TwoColumnShell
        left={
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            {/* Connected status banner */}
            <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5"
              style={{ background: "rgba(93,184,114,0.1)", border: "1px solid rgba(93,184,114,0.3)" }}>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#5db872" }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#5db872" }} />
              </span>
              <span className="text-xs font-semibold flex-1" style={{ color: "#5db872" }}>Repository Connected</span>
              <span className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 font-mono truncate max-w-[120px]">
                {connectedRepo.repoOwner}/{connectedRepo.repoName}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                  <Github className="h-5 w-5 text-background" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">
                    {connectedRepo.repoOwner}/{connectedRepo.repoName}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {connectedRepo.defaultBranch}
                    </span>
                    <span>via PAT</span>
                  </div>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                {disconnectMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Disconnecting…</>
                  : <><Unlink className="h-3.5 w-3.5 mr-1.5" />Disconnect Repository</>
                }
              </Button>
            </div>
          </div>
        }
        right={
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Agent Permissions</h4>
            <ProjectRepoPermissionPanel companyId={companyId} projectId={projectId} agents={agents} />
          </div>
        }
      />
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STATE: GitHub App — Repo Picker (after OAuth callback)
  // ────────────────────────────────────────────────────────────────────────────

  if (showRepoPicker) {
    const selectedRepoData2 = availableRepos.find((r) => r.fullName === selectedRepo);
    return (
      <TwoColumnShell
        left={
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                <Github className="h-5 w-5 text-background" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Select Repository</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Choose which repository to link.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-background border border-border rounded-lg text-sm hover:border-primary/40 transition-colors"
                >
                  <span className={selectedRepo ? "text-foreground" : "text-muted-foreground"}>
                    {selectedRepo || "Choose a repository…"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {availableRepos.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No repositories found</div>
                      ) : (
                        availableRepos.map((repo) => (
                          <button
                            key={repo.fullName}
                            onClick={() => { setSelectedRepo(repo.fullName); setIsDropdownOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                          >
                            <Github className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{repo.fullName}</span>
                            {selectedRepo === repo.fullName && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {selectedRepoData2 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  Default branch: {selectedRepoData2.defaultBranch}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1"
                  onClick={() => { setShowRepoPicker(false); setPendingInstallationId(null); setSelectedRepo(""); }}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1"
                  disabled={!selectedRepo || connectMutation.isPending} onClick={handleSaveRepo}>
                  {connectMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Save & Configure
                </Button>
              </div>
            </div>
          </div>
        }
        right={
          <div className="bg-card border border-border rounded-xl p-5">
            <h4 className="text-sm font-semibold mb-3">Available via this installation</h4>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {availableRepos.map((repo) => (
                <button
                  key={repo.fullName}
                  onClick={() => setSelectedRepo(repo.fullName)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-accent transition-colors text-left ${selectedRepo === repo.fullName ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  <Github className="h-3 w-3 shrink-0" />
                  <span className="flex-1 truncate">{repo.fullName}</span>
                  {selectedRepo === repo.fullName && <Check className="h-3 w-3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        }
      />
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STATE: GitHub App — Disconnected
  // ────────────────────────────────────────────────────────────────────────────

  if (!connectedRepo) {
    return (
      <TwoColumnShell
        left={
          <div className="bg-card border border-border rounded-xl p-6 space-y-5 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-foreground flex items-center justify-center">
              <Github className="h-6 w-6 text-background" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Connect GitHub Repository</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Authorize CrewSpace to access your repositories for agent code operations.
              </p>
            </div>
            <Button onClick={initiateGithubInstall} disabled={isPopupOpen}>
              <Github className="h-4 w-4 mr-1.5" />
              {isPopupOpen ? "Waiting for GitHub…" : "Connect GitHub Repository"}
            </Button>
            <p className="text-xs text-muted-foreground/60">
              You&apos;ll be redirected to GitHub to install the CrewSpace app.
            </p>
          </div>
        }
        right={<GithubInfoPanel />}
      />
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STATE: GitHub App — Connected
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <TwoColumnShell
      left={
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          {/* Connected status banner */}
          <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5"
            style={{ background: "rgba(93,184,114,0.1)", border: "1px solid rgba(93,184,114,0.3)" }}>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#5db872" }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#5db872" }} />
            </span>
            <span className="text-xs font-semibold flex-1" style={{ color: "#5db872" }}>Repository Connected</span>
            <span className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 font-mono truncate max-w-[120px]">
              {connectedRepo.repoOwner}/{connectedRepo.repoName}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                <Github className="h-5 w-5 text-background" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">
                  {connectedRepo.repoOwner}/{connectedRepo.repoName}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {connectedRepo.defaultBranch}
                  </span>
                  <span>via GitHub App</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              <Unlink className="h-3.5 w-3.5 mr-1.5" />
              Disconnect
            </Button>
          </div>
        </div>
      }
      right={
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Agent Permissions</h4>
          <ProjectRepoPermissionPanel companyId={companyId} projectId={projectId} agents={agents} />
        </div>
      }
    />
  );
}
