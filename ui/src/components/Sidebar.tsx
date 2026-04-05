import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  Settings,
  MessageCircle,
  Brain,
  ShieldAlert,
  KanbanSquare,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useChat } from "../context/ChatContext";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { sessions } = useChat();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Brand header */}
      <div className="flex items-center gap-2 px-4 h-13 shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Nexus logo mark */}
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" fill="currentColor" />
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">Nexus</span>
          {selectedCompany?.brandColor && (
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0 ml-0.5"
              style={{ backgroundColor: selectedCompany.brandColor }}
            />
          )}
          {selectedCompany && (
            <span className="text-xs text-muted-foreground truncate font-normal">
              {selectedCompany.name}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-3 px-3 py-3">
        {/* Quick actions */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
          >
            <SquarePen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">New Task</span>
          </button>
        </div>

        {/* Home */}
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem
            to="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            liveCount={liveRunCount}
          />
          <SidebarNavItem
            to="/inbox"
            label="Inbox"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        {/* Work */}
        <SidebarSection label="Work">
          <SidebarNavItem to="/issues" label="Issues" icon={CircleDot} />
          <SidebarNavItem to="/taskboard" label="Board" icon={KanbanSquare} />
          <SidebarNavItem to="/blockers" label="Alerts" icon={ShieldAlert} />
          <SidebarNavItem to="/routines" label="Routines" icon={Repeat} textBadge="Beta" textBadgeTone="amber" />
          <SidebarNavItem to="/goals" label="Goals" icon={Target} />
        </SidebarSection>

        <SidebarProjects />

        <SidebarAgents />

        {/* Intelligence */}
        <SidebarSection label="Intelligence">
          <SidebarNavItem to="/org" label="Org Chart" icon={Network} />
          <SidebarNavItem to="/memory" label="Memory Graph" icon={Brain} />
          <SidebarNavItem
            to="/agent-chat"
            label="Agent Chat"
            icon={MessageCircle}
            badge={sessions.length > 0 ? sessions.length : undefined}
          />
        </SidebarSection>

        {/* System */}
        <SidebarSection label="System">
          <SidebarNavItem to="/skills" label="Skills" icon={Boxes} />
          <SidebarNavItem to="/costs" label="Costs" icon={DollarSign} />
          <SidebarNavItem to="/activity" label="Activity" icon={History} />
          <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
