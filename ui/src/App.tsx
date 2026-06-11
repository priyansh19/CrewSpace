import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "@/lib/router";
import { Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Layout } from "./components/Layout";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { authApi } from "./api/auth";
import { healthApi } from "./api/health";
import { Dashboard } from "./pages/Dashboard";
import { Companies } from "./pages/Companies";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ProjectWorkspaceDetail } from "./pages/ProjectWorkspaceDetail";
import { Issues } from "./pages/Issues";
import { IssueDetail } from "./pages/IssueDetail";
import { Routines } from "./pages/Routines";
import { RoutineDetail } from "./pages/RoutineDetail";
import { ExecutionWorkspaceDetail } from "./pages/ExecutionWorkspaceDetail";
import { Goals } from "./pages/Goals";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { Costs } from "./pages/Costs";
import { Activity } from "./pages/Activity";
import { Inbox } from "./pages/Inbox";
import { CompanySettings } from "./pages/CompanySettings";
import { CompanyMembers } from "./pages/CompanyMembers";
import { CompanySkills } from "./pages/CompanySkills";
import { CompanyExport } from "./pages/CompanyExport";
import { CompanyImport } from "./pages/CompanyImport";
import { ArchivedCompanies } from "./pages/ArchivedCompanies";
import { DesignGuide } from "./pages/DesignGuide";
import { InstanceGeneralSettings } from "./pages/InstanceGeneralSettings";
import { InstanceSettings } from "./pages/InstanceSettings";
import { InstanceExperimentalSettings } from "./pages/InstanceExperimentalSettings";
import { PluginManager } from "./pages/PluginManager";
import { PluginSettings } from "./pages/PluginSettings";
import { PluginPage } from "./pages/PluginPage";
import { RunTranscriptUxLab } from "./pages/RunTranscriptUxLab";
import { OrgChart } from "./pages/OrgChart";
import { MemoryGraph } from "./pages/MemoryGraph";
import { AgentChat } from "./pages/AgentChat";
const Office = lazy(() => import("./pages/Office").then((m) => ({ default: m.Office })));
const IntelligenceProposals = lazy(() => import("./pages/IntelligenceProposals").then((m) => ({ default: m.IntelligenceProposals })));
import { Blockers } from "./pages/Blockers";
import { CeoTerminal } from "./pages/CeoTerminal";
import { SharedWorkspace } from "./pages/SharedWorkspace";
import { TaskboardV2 } from "./pages/TaskboardV2";
import { Queues } from "./pages/Queues";
import { NewAgent } from "./pages/NewAgent";
import { ControlCenter } from "./pages/ControlCenter";
import { AuthPage } from "./pages/Auth";
import { BoardClaimPage } from "./pages/BoardClaim";
import { CliAuthPage } from "./pages/CliAuth";
import { InviteLandingPage } from "./pages/InviteLanding";
import { NotFoundPage } from "./pages/NotFound";
import { queryKeys } from "./lib/queryKeys";
import { useCompany } from "./context/CompanyContext";
import { useDialog } from "./context/DialogContext";
import { loadLastInboxTab } from "./lib/inbox";
import { shouldRedirectCompanylessRouteToOnboarding } from "./lib/onboarding-route";

function BootstrapPendingPage({ hasActiveInvite = false }: { hasActiveInvite?: boolean }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-foreground">Instance setup required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasActiveInvite
            ? "No instance admin exists yet. A bootstrap invite is already active. Check your CrewSpace startup logs for the first admin invite URL, or run this command to rotate it:"
            : "No instance admin exists yet. Run this command in your CrewSpace environment to generate the first admin invite URL:"}
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-accent p-3 text-xs text-foreground">
{`pnpm crewspaceai auth bootstrap-ceo`}
        </pre>
      </div>
    </div>
  );
}

function CloudAccessGate() {
  const location = useLocation();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as
        | { deploymentMode?: "local_trusted" | "authenticated"; bootstrapStatus?: "ready" | "bootstrap_pending" }
        | undefined;
      return data?.deploymentMode === "authenticated" && data.bootstrapStatus === "bootstrap_pending"
        ? 2000
        : false;
    },
    refetchIntervalInBackground: true,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  if (healthQuery.isLoading || (isAuthenticatedMode && sessionQuery.isLoading)) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground bg-background">Loading...</div>;
  }

  if (healthQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10 text-sm text-destructive">
        {healthQuery.error instanceof Error ? healthQuery.error.message : "Failed to load app state"}
      </div>
    );
  }

  if (isAuthenticatedMode && healthQuery.data?.bootstrapStatus === "bootstrap_pending") {
    const token = healthQuery.data.bootstrapInviteToken;
    if (token) {
      return <Navigate to={`/invite/${token}`} replace />;
    }
    return <BootstrapPendingPage hasActiveInvite={healthQuery.data.bootstrapInviteActive} />;
  }

  if (isAuthenticatedMode && !sessionQuery.data) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <Outlet />;
}

function boardRoutes() {
  return (
    <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="onboarding" element={<OnboardingRoutePage />} />
      <Route path="companies" element={<Companies />} />
      <Route path="archived-companies" element={<ArchivedCompanies />} />
      <Route path="company/settings" element={<CompanySettings />} />
      <Route path="company/members" element={<CompanyMembers />} />
      <Route path="company/export/*" element={<CompanyExport />} />
      <Route path="company/import" element={<CompanyImport />} />
      <Route path="skills/*" element={<CompanySkills />} />
      <Route path="settings" element={<LegacySettingsRedirect />} />
      <Route path="settings/*" element={<LegacySettingsRedirect />} />
      <Route path="plugins/:pluginId" element={<PluginPage />} />
      <Route path="org" element={<OrgChart />} />
      <Route path="memory" element={<MemoryGraph />} />
      <Route path="agent-chat" element={<AgentChat />} />
      <Route path="proposals" element={<Suspense fallback={null}><IntelligenceProposals /></Suspense>} />
      <Route path="office" element={<Suspense fallback={null}><Office /></Suspense>} />
      <Route path="terminal" element={<CeoTerminal />} />
      <Route path="workspace" element={<SharedWorkspace />} />
      <Route path="blockers" element={<Blockers />} />
      <Route path="taskboard" element={<TaskboardV2 />} />
      <Route path="queues" element={<Queues />} />
      <Route path="control" element={<ControlCenter />} />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      <Route path="agents/all" element={<Agents />} />
      <Route path="agents/active" element={<Agents />} />
      <Route path="agents/paused" element={<Agents />} />
      <Route path="agents/error" element={<Agents />} />
      <Route path="agents/new" element={<NewAgent />} />
      <Route path="agents/:agentId" element={<AgentDetail />} />
      <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:projectId" element={<ProjectDetail />} />
      <Route path="projects/:projectId/overview" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues/:filter" element={<ProjectDetail />} />
      <Route path="projects/:projectId/workspaces/:workspaceId" element={<ProjectWorkspaceDetail />} />
      <Route path="projects/:projectId/workspaces" element={<ProjectDetail />} />
      <Route path="projects/:projectId/configuration" element={<ProjectDetail />} />
      <Route path="projects/:projectId/github" element={<ProjectDetail />} />
      <Route path="projects/:projectId/budget" element={<ProjectDetail />} />
      <Route path="issues" element={<Issues />} />
      <Route path="issues/all" element={<Navigate to="/issues" replace />} />
      <Route path="issues/active" element={<Navigate to="/issues" replace />} />
      <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
      <Route path="issues/done" element={<Navigate to="/issues" replace />} />
      <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
      <Route path="issues/:issueId" element={<IssueDetail />} />
      <Route path="routines" element={<Routines />} />
      <Route path="routines/:routineId" element={<RoutineDetail />} />
      <Route path="execution-workspaces/:workspaceId" element={<ExecutionWorkspaceDetail />} />
      <Route path="goals" element={<Goals />} />
      <Route path="goals/:goalId" element={<GoalDetail />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Approvals />} />
      <Route path="approvals/all" element={<Approvals />} />
      <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
      <Route path="costs" element={<Costs />} />
      <Route path="activity" element={<Activity />} />
      <Route path="inbox" element={<InboxRootRedirect />} />
      <Route path="inbox/mine" element={<Inbox />} />
      <Route path="inbox/recent" element={<Inbox />} />
      <Route path="inbox/unread" element={<Inbox />} />
      <Route path="inbox/all" element={<Inbox />} />
      <Route path="inbox/new" element={<Navigate to="/inbox/mine" replace />} />
      <Route path="design-guide" element={<DesignGuide />} />
      <Route path="tests/ux/runs" element={<RunTranscriptUxLab />} />
      <Route path=":pluginRoutePath" element={<PluginPage />} />
      <Route path="*" element={<NotFoundPage scope="board" />} />
    </>
  );
}

function InboxRootRedirect() {
  return <Navigate to={`/inbox/${loadLastInboxTab()}`} replace />;
}

function LegacySettingsRedirect() {
  const location = useLocation();
  return <Navigate to={`/instance/settings/general${location.search}${location.hash}`} replace />;
}

const FIRST_RUN_FEATURES = [
  {
    title: "Run Multiple AI Agent Companies",
    desc: "Create companies with their own agents, tasks, goals, and budgets — all from one dashboard.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <rect x="6" y="10" width="36" height="28" rx="4" />
        <path d="M6 18h36" />
        <circle cx="14" cy="14" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="20" cy="14" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="26" cy="14" r="1.5" fill="currentColor" stroke="none" />
        <path d="M14 28l6 6 10-10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Interactive 3D Office",
    desc: "Visualise your AI workforce in a real-time 3D office — watch agents work and collaborate live.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M8 40V16l16-10 16 10v24" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 22h16v18H16z" />
        <path d="M24 22v18" />
        <circle cx="24" cy="13" r="3" />
      </svg>
    ),
  },
  {
    title: "GitHub Integration & Issues",
    desc: "Connect repositories, delegate issues to AI agents, and track progress with full audit trails.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M24 6C13.5 6 5 14.5 5 25c0 8.4 5.5 15.6 13.1 18.1.95.18 1.3-.41 1.3-.92v-3.2c-5.3 1.2-6.4-2.3-6.4-2.3-.87-2.2-2.1-2.8-2.1-2.8-1.73-1.17.13-1.15.13-1.15 1.9.14 2.9 2 2.9 2 1.7 2.9 4.5 2.1 5.6 1.6.17-1.25.67-2.1 1.22-2.58-4.25-.48-8.72-2.13-8.72-9.48 0-2.1.75-3.81 2-5.15-.2-.49-.87-2.44.18-5.08 0 0 1.62-.52 5.3 1.97A18.5 18.5 0 0 1 24 13.3c1.68.01 3.37.23 4.95.66 3.67-2.49 5.28-1.97 5.28-1.97 1.06 2.64.39 4.59.19 5.08 1.25 1.34 2 3.05 2 5.15 0 7.37-4.48 8.99-8.75 9.46.69.6 1.3 1.78 1.3 3.59v5.33c0 .52.34 1.13 1.32.93C37.52 40.57 43 33.4 43 25c0-10.5-8.5-19-19-19z" />
      </svg>
    ),
  },
  {
    title: "Budget Controls & Approvals",
    desc: "Set spending limits, require human approvals for governed actions, and get hard-stop protection.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <circle cx="24" cy="24" r="18" />
        <path d="M24 12v12l8 5" strokeLinecap="round" />
        <path d="M10 24h5M33 24h5M24 10v5M24 33v5" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

export function FirstRunWelcome() {
  const { openOnboarding } = useDialog();

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-y-auto px-6 py-12">
      {/* Logo + heading */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
            <circle cx="16" cy="7"  r="3" fill="currentColor" className="text-primary" />
            <circle cx="6"  cy="25" r="3" fill="currentColor" className="text-primary" />
            <circle cx="26" cy="25" r="3" fill="currentColor" className="text-primary" />
            <line x1="16" y1="10" x2="6"  y2="22" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
            <line x1="16" y1="10" x2="26" y2="22" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
            <line x1="6"  y1="25" x2="26" y2="25" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-foreground">Welcome to CrewSpace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your AI agent company control plane</p>
      </div>

      {/* Feature grid */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 mb-8">
        {FIRST_RUN_FEATURES.map((f) => (
          <div key={f.title} className="flex gap-4 items-start rounded-lg border border-border bg-card p-4">
            <div className="shrink-0 text-primary mt-0.5">{f.icon}</div>
            <div>
              <p className="text-sm font-medium text-foreground">{f.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => openOnboarding()}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Get Started
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </button>
      <p className="mt-3 text-xs text-muted-foreground">Takes about 2 minutes</p>
    </div>
  );
}

function OnboardingRoutePage() {
  const { companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();

  // First run: no companies yet → show full-screen feature showcase
  if (companies.length === 0) {
    return <FirstRunWelcome />;
  }

  // Returning user: adding another company or agent
  const matchedCompany = companyPrefix
    ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase()) ?? null
    : null;

  const title = matchedCompany
    ? `Add another agent to ${matchedCompany.name}`
    : "Create another company";
  const description = matchedCompany
    ? "Run onboarding again to add an agent and a starter task for this company."
    : "Run onboarding again to create another company and seed its first agent.";

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4">
          <Button
            onClick={() =>
              matchedCompany
                ? openOnboarding({ initialStep: 2, companyId: matchedCompany.id })
                : openOnboarding()
            }
          >
            {matchedCompany ? "Add Agent" : "Start Onboarding"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompanyRootRedirect() {
  const { companies, selectedCompany, loading } = useCompany();
  const location = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground bg-background">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return <Navigate to={`/${targetCompany.issuePrefix}/dashboard`} replace />;
}

function UnprefixedBoardRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground bg-background">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return (
    <Navigate
      to={`/${targetCompany.issuePrefix}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function NoCompaniesStartPage() {
  const { openOnboarding } = useDialog();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-foreground">Create your first company</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by creating a company.
        </p>
        <div className="mt-4">
          <Button onClick={() => openOnboarding()}>New Company</Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="auth" element={<AuthPage />} />
        <Route path="board-claim/:token" element={<BoardClaimPage />} />
        <Route path="cli-auth/:id" element={<CliAuthPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />

        <Route element={<CloudAccessGate />}>
          <Route index element={<CompanyRootRedirect />} />
          <Route path="onboarding" element={<OnboardingRoutePage />} />
          <Route path="instance" element={<Navigate to="/instance/settings/general" replace />} />
          <Route path="instance/settings" element={<Layout />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<InstanceGeneralSettings />} />
            <Route path="heartbeats" element={<InstanceSettings />} />
            <Route path="experimental" element={<InstanceExperimentalSettings />} />
            <Route path="plugins" element={<PluginManager />} />
            <Route path="plugins/:pluginId" element={<PluginSettings />} />
          </Route>
          <Route path="companies" element={<UnprefixedBoardRedirect />} />
          <Route path="archived-companies" element={<UnprefixedBoardRedirect />} />
          <Route path="issues" element={<UnprefixedBoardRedirect />} />
          <Route path="issues/:issueId" element={<UnprefixedBoardRedirect />} />
          <Route path="routines" element={<UnprefixedBoardRedirect />} />
          <Route path="routines/:routineId" element={<UnprefixedBoardRedirect />} />
          <Route path="skills/*" element={<UnprefixedBoardRedirect />} />
          <Route path="settings" element={<LegacySettingsRedirect />} />
          <Route path="settings/*" element={<LegacySettingsRedirect />} />
          <Route path="agents" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/new" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/:tab" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/runs/:runId" element={<UnprefixedBoardRedirect />} />
          <Route path="memory" element={<UnprefixedBoardRedirect />} />
          <Route path="agent-chat" element={<UnprefixedBoardRedirect />} />
          <Route path="office" element={<UnprefixedBoardRedirect />} />
          <Route path="org" element={<UnprefixedBoardRedirect />} />
          <Route path="taskboard" element={<UnprefixedBoardRedirect />} />
          <Route path="blockers" element={<UnprefixedBoardRedirect />} />
          <Route path="terminal" element={<UnprefixedBoardRedirect />} />
          <Route path="workspace" element={<UnprefixedBoardRedirect />} />
          <Route path="projects" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/overview" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues/:filter" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/workspaces" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/workspaces/:workspaceId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/configuration" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/github" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId" element={<UnprefixedBoardRedirect />} />
          <Route path="tests/ux/runs" element={<UnprefixedBoardRedirect />} />
          <Route path=":companyPrefix" element={<Layout />}>
            {boardRoutes()}
          </Route>
          <Route path="*" element={<NotFoundPage scope="global" />} />
        </Route>
      </Routes>
      <OnboardingWizard />
    </>
  );
}
