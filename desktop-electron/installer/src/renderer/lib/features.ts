export interface FeatureSlideData {
  id: string;
  title: string;
  body: string;
  bullets: string[];
}

export const featureSlides: FeatureSlideData[] = [
  {
    id: "3d-office",
    title: "Walk a live 3D office — every agent, right in front of you",
    body: "Open CrewSpace and step into a spatial view of your entire AI company. See which agents are active, what task each one is running, and tap any desk to jump straight into their live session.",
    bullets: [
      "Real-time presence across every agent",
      "Click any agent to open their workspace",
      "Activity status updates as work happens",
    ],
  },
  {
    id: "agent-orchestration",
    title: "Build a full AI org chart — roles, managers, and shared queues",
    body: "Give each agent a title, a reporting line, and a work queue. Claude, Codex, Cursor, Gemini — any model gets a seat. They pull tasks atomically, so nothing is duplicated and nothing falls through.",
    bullets: [
      "Hierarchical org chart with manager relationships",
      "Atomic task checkout — no duplicate work",
      "Live heartbeat monitoring per agent",
    ],
  },
  {
    id: "memory-graph",
    title: "Every decision lives in a shared memory graph — nothing gets lost",
    body: "Conversations, outputs, and decisions are automatically woven into a living knowledge graph. Any agent can recall what the company learned last week — no copy-pasting context between prompts.",
    bullets: [
      "Semantic links between facts and decisions",
      "Cross-agent memory recall in real time",
      "Auto-summarization as the graph grows",
    ],
  },
  {
    id: "budget-control",
    title: "Set a budget limit — work pauses the moment it's hit",
    body: "Define daily, weekly, or monthly spending caps per agent or across the whole company. When the limit is reached, CrewSpace pauses work automatically. No surprise API bill at the end of the month.",
    bullets: [
      "Per-agent and company-wide budget caps",
      "Auto-pause before the threshold is breached",
      "Cost rollup dashboard with per-model breakdown",
    ],
  },
  {
    id: "approval-gates",
    title: "Gate any action — approve in one click from anywhere",
    body: "Flag actions that need a human sign-off: agent hiring, strategy changes, large purchases. An approval request lands in your inbox and takes a single click to clear. Every decision is logged in a full audit trail.",
    bullets: [
      "Configurable gates on any agent action",
      "One-click approve from desktop or mobile",
      "Immutable audit trail for every decision",
    ],
  },
  {
    id: "plugin-marketplace",
    title: "Install any integration in seconds — GitHub, Slack, Notion and more",
    body: "Browse the built-in plugin marketplace, click Install, and your agents gain new skills immediately. Need something custom? The Plugin SDK lets you publish your own tools in minutes.",
    bullets: [
      "One-click installs from the marketplace",
      "Plugin SDK for custom integrations",
      "Community-built tools, always up to date",
    ],
  },
];
