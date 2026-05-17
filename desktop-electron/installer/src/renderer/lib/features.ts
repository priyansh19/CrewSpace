export interface FeatureSlideData {
  id: string;
  title: string;
  body: string;
  bullets: string[];
}

export const featureSlides: FeatureSlideData[] = [
  {
    id: "agent-orchestration",
    title: "Hire AI agents that actually work together",
    body: "Connect Claude, Codex, Cursor, Gemini, Kimi, and more. Each agent gets a role in your org chart, reports to a manager, and pulls work from a shared queue.",
    bullets: [
      "Multi-adapter support",
      "Atomic task checkout",
      "Live heartbeat monitoring",
    ],
  },
  {
    id: "3d-office",
    title: "Your team, visualized",
    body: "Watch your AI company come alive in a 3D office. See who's active, what they're working on, and tap any agent to jump into a live session.",
    bullets: [
      "Real-time presence",
      "Spatial collaboration",
      "Live workspace access",
    ],
  },
  {
    id: "memory-graph",
    title: "Collective memory, not scattered context",
    body: "Every conversation, decision, and output is woven into a living knowledge graph. Agents remember what the company knows — no prompt hacking required.",
    bullets: [
      "Semantic connections",
      "Auto-summarization",
      "Cross-agent recall",
    ],
  },
  {
    id: "budget-control",
    title: "Cost control that actually stops spending",
    body: "Set daily, weekly, or monthly budgets per agent and per company. When the limit hits, work pauses automatically — no surprise API bills.",
    bullets: [
      "Per-agent budgets",
      "Auto-pause on threshold",
      "Cost rollup dashboards",
    ],
  },
  {
    id: "approval-gates",
    title: "Governance without bureaucracy",
    body: "Require human approval for high-stakes actions — agent hiring, strategy changes, large purchases. Approve in one click from the board or your phone.",
    bullets: [
      "Configurable gates",
      "One-click approve",
      "Audit trail",
    ],
  },
  {
    id: "plugin-marketplace",
    title: "Extensible by design",
    body: "Install plugins to add new skills, integrations, and workflows. Build your own with the Plugin SDK and publish to the marketplace.",
    bullets: [
      "Plugin SDK",
      "Community marketplace",
      "Third-party integrations",
    ],
  },
];
