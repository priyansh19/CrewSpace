import { create } from "zustand";

export type AgentRole =
  | "ceo"
  | "pm"
  | "engineer"
  | "researcher"
  | "developer"
  | "designer"
  | "security"
  | "manager";

export type AgentStatus =
  | "working"
  | "walking"
  | "sleeping"
  | "idle"
  | "meeting"
  | "collaborating"
  | "standing-up";

export type RoomId =
  | "ceo-cabin"
  | "scrum-room"
  | "conf-dev"
  | "conf-design"
  | "conf-security"
  | "conf-qa"
  | "conf-data"
  | "conf-ops"
  | "conf-product"
  | "workstations"
  | "sleeping-room"
  | "kitchen"
  | "play-area"
  | "server-room"
  | "file-room"
  | "collab-area"
  | "nike-store"
  | "food-court"
  | "gaming-room";

export interface RoomPosition {
  x: number;
  y: number;
  z: number;
}

export interface MissionIssue {
  id: string;
  companyId: string;
  title: string;
  status: string;
  assigneeAgentId: string | null;
  updatedAt: string;
}

export const ROOM_POSITIONS: Record<RoomId, RoomPosition> = {
  "ceo-cabin": { x: -18, y: 0, z: -12 },
  "scrum-room": { x: -9, y: 0, z: -12 },
  "conf-dev": { x: -1, y: 0, z: -12 },
  "conf-design": { x: 7, y: 0, z: -12 },
  "conf-security": { x: 15, y: 0, z: -12 },
  "conf-qa": { x: 23, y: 0, z: -12 },
  "conf-product": { x: 32, y: 0, z: -12 },
  kitchen: { x: -18, y: 0, z: 0 },
  "conf-ops": { x: -8, y: 0, z: 0 },
  "collab-area": { x: 4, y: 0, z: 0 },
  "conf-data": { x: 15, y: 0, z: 0 },
  "sleeping-room": { x: 27, y: 0, z: 0 },
  workstations: { x: -6, y: 0, z: 12 },
  "play-area": { x: 16, y: 0, z: 12 },
  "server-room": { x: 28, y: 0, z: 12 },
  "file-room": { x: 38, y: 0, z: 12 },
  "nike-store": { x: -4, y: 0, z: 30 },
  "food-court": { x: 14, y: 0, z: 30 },
  "gaming-room": { x: 27, y: 0, z: 30 },
};

export const ROOM_DIMS: Record<RoomId, { width: number; depth: number }> = {
  "conf-ops": { width: 7.5, depth: 9 },
  "ceo-cabin": { width: 8, depth: 7 },
  "scrum-room": { width: 7, depth: 7 },
  "conf-dev": { width: 6, depth: 7 },
  "conf-design": { width: 6, depth: 7 },
  "conf-security": { width: 6, depth: 7 },
  "conf-qa": { width: 7, depth: 6 },
  "conf-product": { width: 9, depth: 7 },
  kitchen: { width: 8, depth: 7 },
  workstations: { width: 28, depth: 8 },
  "sleeping-room": { width: 10, depth: 10 },
  "conf-data": { width: 8, depth: 7 },
  "play-area": { width: 10, depth: 8 },
  "server-room": { width: 8, depth: 8 },
  "file-room": { width: 7, depth: 7 },
  "collab-area": { width: 10, depth: 8 },
  "nike-store": { width: 14, depth: 10 },
  "food-court": { width: 14, depth: 10 },
  "gaming-room": { width: 10, depth: 10 },
};

export interface SeatDef {
  offset: [number, number, number];
  rot: number;
}

export const ROOM_SEATS: Record<RoomId, SeatDef[]> = {
  "ceo-cabin": [{ offset: [0, 0, 0.5], rot: Math.PI }],
  "scrum-room": Array.from({ length: 6 }).map((_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    return {
      offset: [Math.cos(angle) * 1.8, 0, Math.sin(angle) * 1.8],
      rot: -angle + Math.PI,
    };
  }),
  "conf-dev": [
    ...[-1, 0, 1].map((o) => ({ offset: [o * 0.9, 0, -0.9] as [number, number, number], rot: 0 })),
    ...[-1, 0, 1].map((o) => ({ offset: [o * 0.9, 0, 0.9] as [number, number, number], rot: Math.PI })),
  ],
  "conf-design": [
    ...[-1, 0, 1].map((o) => ({ offset: [o * 0.9, 0, -0.9] as [number, number, number], rot: 0 })),
    ...[-1, 0, 1].map((o) => ({ offset: [o * 0.9, 0, 0.9] as [number, number, number], rot: Math.PI })),
  ],
  "conf-security": [
    ...[-1, 0, 1].map((o) => ({ offset: [o * 0.9, 0, -0.9] as [number, number, number], rot: 0 })),
    ...[-1, 0, 1].map((o) => ({ offset: [o * 0.9, 0, 0.9] as [number, number, number], rot: Math.PI })),
  ],
  "conf-qa": [
    ...[-1.2, 0, 1.2].map((o) => ({ offset: [o, 0, -0.8] as [number, number, number], rot: 0 })),
    ...[-1.2, 0, 1.2].map((o) => ({ offset: [o, 0, 0.8] as [number, number, number], rot: Math.PI })),
    { offset: [-2.2, 0, 0], rot: Math.PI / 2 },
    { offset: [2.2, 0, 0], rot: -Math.PI / 2 },
  ],
  "conf-data": [
    ...[-1.5, -0.5, 0.5, 1.5].map((o) => ({ offset: [o, 0, -1] as [number, number, number], rot: 0 })),
    ...[-1.5, -0.5, 0.5, 1.5].map((o) => ({ offset: [o, 0, 1] as [number, number, number], rot: Math.PI })),
  ],
  "conf-ops": [
    ...[-0.8, 0.8].map((o) => ({ offset: [o, 0, -0.7] as [number, number, number], rot: 0 })),
    ...[-0.8, 0.8].map((o) => ({ offset: [o, 0, 0.7] as [number, number, number], rot: Math.PI })),
  ],
  "conf-product": [
    ...[-2, -0.7, 0.7, 2].map((o) => ({ offset: [o, 0, -1.2] as [number, number, number], rot: 0 })),
    ...[-2, -0.7, 0.7, 2].map((o) => ({ offset: [o, 0, 1.2] as [number, number, number], rot: Math.PI })),
    { offset: [-3.2, 0, 0], rot: Math.PI / 2 },
    { offset: [3.2, 0, 0], rot: -Math.PI / 2 },
  ],
  workstations: [
    ...[-12.5, -10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10, 12.5].map((x) => ({ offset: [x, 0, -0.65] as [number, number, number], rot: Math.PI })),
    ...[-12.5, -10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10, 12.5].map((x) => ({ offset: [x, 0, 0.65] as [number, number, number], rot: 0 })),
  ],
  "sleeping-room": [
    ...[
      [-3, -3], [0, -3], [3, -3],
      [-3, 0], [0, 0], [3, 0],
      [-3, 3], [0, 3], [3, 3],
    ].map(([x, z]) => ({ offset: [x, 0, z] as [number, number, number], rot: 0 })),
  ],
  kitchen: [
    { offset: [1, 0, 1], rot: 0 },
    { offset: [-1.5, 0, 1], rot: Math.PI / 4 },
    { offset: [-2, 0, -2.5], rot: 0 },
    { offset: [0, 0, 1], rot: 0 },
  ],
  "play-area": [
    { offset: [-2.4, 0, -1], rot: Math.PI / 2 },
    { offset: [0.4, 0, -1], rot: -Math.PI / 2 },
    { offset: [3, 0, 0.8], rot: 0 },
    { offset: [-3, 0, 2], rot: 0 },
    { offset: [-1.5, 0, 2.5], rot: 0 },
  ],
  "server-room": [
    { offset: [0, 0, 0], rot: 0 },
    { offset: [-2, 0, 0], rot: 0 },
    { offset: [2, 0, 0], rot: 0 },
  ],
  "file-room": [
    { offset: [0, 0, 0], rot: 0 },
    { offset: [-1.5, 0, 0], rot: 0 },
    { offset: [1.5, 0, 0], rot: 0 },
  ],
  "collab-area": [
    { offset: [-2, 0, -1.5], rot: Math.PI / 4 },
    { offset: [2, 0, -1.5], rot: -Math.PI / 4 },
    { offset: [-2, 0, 1.5], rot: (3 * Math.PI) / 4 },
    { offset: [2, 0, 1.5], rot: (-3 * Math.PI) / 4 },
    { offset: [0, 0, -2.5], rot: 0 },
    { offset: [0, 0, 2.5], rot: Math.PI },
    { offset: [-3.5, 0, 0], rot: Math.PI / 2 },
    { offset: [3.5, 0, 0], rot: -Math.PI / 2 },
  ],
  "nike-store": [
    { offset: [-4, 0, -2], rot: 0 },
    { offset: [-1, 0, -2], rot: 0 },
    { offset: [2, 0, -2], rot: 0 },
    { offset: [5, 0, -2], rot: 0 },
    { offset: [-4, 0, 1], rot: Math.PI },
    { offset: [0, 0, 1], rot: Math.PI },
    { offset: [4, 0, 1], rot: Math.PI },
  ],
  "food-court": [
    { offset: [-4, 0, -2], rot: 0 },
    { offset: [-1.5, 0, -2], rot: 0 },
    { offset: [1.5, 0, -2], rot: 0 },
    { offset: [4, 0, -2], rot: 0 },
    { offset: [-4, 0, 1.5], rot: Math.PI },
    { offset: [-1.5, 0, 1.5], rot: Math.PI },
    { offset: [1.5, 0, 1.5], rot: Math.PI },
    { offset: [4, 0, 1.5], rot: Math.PI },
  ],
  "gaming-room": [
    { offset: [-4, 0, -2.5], rot: 0 },
    { offset: [-1.5, 0, -2.5], rot: 0 },
    { offset: [1.5, 0, -2.5], rot: 0 },
    { offset: [4, 0, -2.5], rot: 0 },
    { offset: [-2.5, 0, 2], rot: Math.PI },
    { offset: [0, 0, 2], rot: Math.PI },
    { offset: [2.5, 0, 2], rot: Math.PI },
  ],
};

export interface OfficeAgent {
  id: string;
  name: string;
  role: AgentRole;
  backendRole: string;
  title: string | null;
  status: AgentStatus;
  backendStatus: string;
  currentRoom: RoomId;
  targetRoom: RoomId;
  position: [number, number, number];
  targetPosition: [number, number, number];
  waypoints: [number, number, number][];
  task: string;
  stateTimer: number;
  isSitting: boolean;
  seatIndex: number;
  standUpTimer: number;
  assignedWorkstation: number;
  capabilities: string | null;
  liveRunCount: number;
  openIssueCount: number;
  lastHeartbeatAt: string | null;
  reportsTo: string | null;
  urlKey: string | null;
}

interface BackendSnapshot {
  agents: Array<{
    id: string;
    name: string;
    role: string;
    title: string | null;
    status: string;
    capabilities: string | null;
    lastHeartbeatAt: string | null;
    reportsTo: string | null;
    urlKey: string | null;
  }>;
  issues: MissionIssue[];
  liveRuns: Array<{ id: string; agentId: string }>;
}

interface OfficeStore {
  agents: OfficeAgent[];
  officeAgents: OfficeAgent[];
  issues: MissionIssue[];
  selectedAgentId: string | null;
  isNightMode: boolean;
  liveMode: boolean;
  selectAgent: (id: string | null) => void;
  toggleNightMode: () => void;
  setBackendSnapshot: (snapshot: BackendSnapshot) => void;
}

const DONE_STATUSES = new Set(["done", "completed", "closed", "resolved", "cancelled", "canceled"]);

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeRole(role: string): AgentRole {
  switch (role) {
    case "ceo": return "ceo";
    case "pm": return "pm";
    case "researcher": return "researcher";
    case "designer": return "designer";
    case "security": return "security";
    case "manager": return "manager";
    case "developer": return "developer";
    default: return "engineer";
  }
}

function deriveStatus(
  agent: BackendSnapshot["agents"][number],
  issues: MissionIssue[],
  liveRuns: number,
): AgentStatus {
  if (liveRuns > 0) return "working";

  const openAssigned = issues.filter(
    (issue) => issue.assigneeAgentId === agent.id && !DONE_STATUSES.has(issue.status.toLowerCase()),
  );

  if (openAssigned.length > 0) {
    if (agent.role === "ceo" || agent.role === "pm" || agent.role === "manager") return "meeting";
    return openAssigned.length > 1 ? "collaborating" : "working";
  }

  if (!agent.lastHeartbeatAt) return "idle";

  const ageMs = Date.now() - new Date(agent.lastHeartbeatAt).getTime();
  if (ageMs > 1000 * 60 * 60 * 12) return "sleeping";
  return "idle";
}

function deriveRoom(role: AgentRole, status: AgentStatus, hash: number): RoomId {
  if (status === "sleeping") return "sleeping-room";
  if (status === "meeting") {
    if (role === "ceo") return "ceo-cabin";
    return hash % 2 === 0 ? "scrum-room" : "conf-product";
  }
  if (status === "collaborating") {
    if (role === "researcher") return "conf-data";
    if (role === "security") return "conf-security";
    if (role === "designer") return "conf-design";
    return "collab-area";
  }
  if (status === "working") {
    if (role === "ceo") return "ceo-cabin";
    if (role === "pm" || role === "manager") return hash % 2 === 0 ? "scrum-room" : "conf-product";
    if (role === "researcher") return "conf-data";
    if (role === "designer") return "conf-design";
    if (role === "security") return "conf-security";
    return hash % 4 === 0 ? "server-room" : "workstations";
  }
  const idleRooms: RoomId[] = ["kitchen", "play-area", "collab-area", "nike-store", "food-court", "gaming-room"];
  return idleRooms[hash % idleRooms.length];
}

function getSeatWorldPos(roomId: RoomId, seatIdx: number): [number, number, number] {
  const room = ROOM_POSITIONS[roomId];
  const seats = ROOM_SEATS[roomId];
  const seat = seats[seatIdx % seats.length];
  return [room.x + seat.offset[0], seat.offset[1], room.z + seat.offset[2]];
}

function findSeat(roomId: RoomId, occupiedSeats: Map<RoomId, number[]>, preferredSeed: number) {
  const seats = ROOM_SEATS[roomId];
  const occupied = occupiedSeats.get(roomId) ?? [];
  if (roomId === "workstations") {
    const preferred = preferredSeed % seats.length;
    if (!occupied.includes(preferred)) return preferred;
  }
  for (let i = 0; i < seats.length; i += 1) {
    if (!occupied.includes(i)) return i;
  }
  return preferredSeed % seats.length;
}

function deriveTask(agent: BackendSnapshot["agents"][number], issues: MissionIssue[]) {
  const assigned = issues
    .filter((issue) => issue.assigneeAgentId === agent.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const active = assigned.find((issue) => !DONE_STATUSES.has(issue.status.toLowerCase()));
  if (active) return active.title;
  if (agent.title) return agent.title;
  if (agent.capabilities) return agent.capabilities.split(",")[0]?.trim() ?? "Monitoring";
  return "Standing by";
}

function buildAgents(snapshot: BackendSnapshot, existingAgents: OfficeAgent[]) {
  const occupiedSeats = new Map<RoomId, number[]>();
  const existingById = new Map(existingAgents.map((a) => [a.id, a]));
  const liveRunsByAgent = new Map<string, number>();

  for (const run of snapshot.liveRuns) {
    liveRunsByAgent.set(run.agentId, (liveRunsByAgent.get(run.agentId) ?? 0) + 1);
  }

  return [...snapshot.agents]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((backendAgent) => {
      const hash = hashString(backendAgent.id);
      const role = normalizeRole(backendAgent.role);
      const liveRunCount = liveRunsByAgent.get(backendAgent.id) ?? 0;
      const status = deriveStatus(backendAgent, snapshot.issues, liveRunCount);
      const room = deriveRoom(role, status, hash);
      const seatIndex = findSeat(room, occupiedSeats, hash);
      occupiedSeats.set(room, [...(occupiedSeats.get(room) ?? []), seatIndex]);

      const targetPosition = getSeatWorldPos(room, seatIndex);
      const previous = existingById.get(backendAgent.id);
      const position = previous?.position ?? targetPosition;
      const openIssueCount = snapshot.issues.filter(
        (issue) => issue.assigneeAgentId === backendAgent.id && !DONE_STATUSES.has(issue.status.toLowerCase()),
      ).length;

      return {
        id: backendAgent.id,
        name: backendAgent.name,
        role,
        backendRole: backendAgent.role,
        title: backendAgent.title,
        status,
        backendStatus: backendAgent.status,
        currentRoom: room,
        targetRoom: room,
        position,
        targetPosition,
        waypoints: [],
        task: deriveTask(backendAgent, snapshot.issues),
        stateTimer: 0,
        isSitting: status !== "idle" && status !== "walking",
        seatIndex,
        standUpTimer: 0,
        assignedWorkstation: room === "workstations" ? seatIndex : -1,
        capabilities: backendAgent.capabilities,
        liveRunCount,
        openIssueCount,
        lastHeartbeatAt: backendAgent.lastHeartbeatAt,
        reportsTo: backendAgent.reportsTo,
        urlKey: backendAgent.urlKey,
      } satisfies OfficeAgent;
    });
}

type MockSeed = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  currentRoom: RoomId;
  task: string;
  title: string | null;
  capabilities: string | null;
  reportsTo?: string | null;
};

const MOCK_OFFICE_AGENT_SEEDS: MockSeed[] = [
  // ── C-Suite ──────────────────────────────────────────────────────────────────
  { id: "mock-ceo-1",      name: "Alex Mercer",     role: "ceo",      status: "meeting",      currentRoom: "ceo-cabin",    task: "Q4 AI Roadmap Review",                   title: "Chief Executive Officer",           capabilities: "Vision, strategy, P&L management, board relations",            reportsTo: null },
  { id: "mock-cmo-1",      name: "Nora Patel",      role: "pm",       status: "working",      currentRoom: "conf-product", task: "Q4 GTM Strategy & Pilot Demo Prep",      title: "Chief Marketing Officer",           capabilities: "Brand strategy, GTM, demand generation, product positioning",    reportsTo: "mock-ceo-1" },
  { id: "mock-cto-1",      name: "Leo Zhang",       role: "manager",  status: "meeting",      currentRoom: "scrum-room",   task: "Engineering Status Sync",                title: "Chief Technology Officer",          capabilities: "Technical strategy, AI/ML architecture, cloud infra, R&D",      reportsTo: "mock-ceo-1" },

  // ── VPs (under CTO) ──────────────────────────────────────────────────────────
  { id: "mock-mgr-apps",   name: "Jordan Blake",    role: "manager",  status: "meeting",      currentRoom: "conf-dev",     task: "Sprint Planning – AI Apps Team",         title: "VP of AI Applications",             capabilities: "Agile delivery, sprint planning, production readiness, releases", reportsTo: "mock-cto-1" },
  { id: "mock-mgr-infra",  name: "Priya Mehta",     role: "manager",  status: "working",      currentRoom: "server-room",  task: "Azure Cost Optimisation Review",         title: "VP of AI Infrastructure",           capabilities: "Azure cloud, AI infra, MLOps, cost optimisation, DevOps",       reportsTo: "mock-cto-1" },

  // ── Dev Team (under Jordan) ──────────────────────────────────────────────────
  { id: "mock-dev-1",      name: "Sam Torres",      role: "developer", status: "working",     currentRoom: "workstations", task: "RAG Chunking Strategy – v2.4 Tuning",    title: "Senior AI Engineer",                capabilities: "Python, LangChain, RAG, LLM fine-tuning, FastAPI",             reportsTo: "mock-mgr-apps" },
  { id: "mock-dev-2",      name: "Lena Kim",        role: "developer", status: "working",     currentRoom: "workstations", task: "Streaming API – SSE Integration",        title: "AI Application Engineer",           capabilities: "React, TypeScript, SSE streaming, prompt engineering, UX",      reportsTo: "mock-mgr-apps" },

  // ── QA Team (under Jordan) ──────────────────────────────────────────────────
  { id: "mock-qa-1",       name: "Omar Hassan",     role: "security",  status: "working",     currentRoom: "conf-qa",      task: "Production Readiness Sign-off – v2.4",   title: "QA Lead – AI Systems",              capabilities: "AI testing, hallucination detection, Playwright, k6",           reportsTo: "mock-mgr-apps" },
  { id: "mock-qa-2",       name: "Yuki Tanaka",     role: "security",  status: "idle",        currentRoom: "kitchen",      task: "Coffee Break",                           title: "AI Quality Engineer",               capabilities: "Automated test pipelines, model evaluation, regression",        reportsTo: "mock-mgr-apps" },

  // ── Production Release Team (under Jordan) ────────────────────────────────────
  { id: "mock-prod-1",     name: "Carlos Diaz",     role: "engineer",  status: "working",     currentRoom: "workstations", task: "Blue-Green Deploy Pipeline Optimisation", title: "Release Engineer",                 capabilities: "CI/CD, GitHub Actions, blue-green deploys, canary releases",    reportsTo: "mock-mgr-apps" },
  { id: "mock-prod-2",     name: "Nia Williams",    role: "engineer",  status: "idle",        currentRoom: "food-court",   task: "Lunch Break",                            title: "Site Reliability Engineer",         capabilities: "SRE, Datadog, PagerDuty, incident management, SLO tracking",    reportsTo: "mock-mgr-apps" },

  // ── DevOps Bangers Team (under Priya) ────────────────────────────────────────
  { id: "mock-devops-1",   name: "Axel Johansson",  role: "engineer",  status: "working",     currentRoom: "server-room",  task: "PR Preview Environments – Terraform",    title: "DevOps Lead – Bangers",             capabilities: "Azure DevOps, Terraform, Helm, Kubernetes, container registry",  reportsTo: "mock-mgr-infra" },
  { id: "mock-devops-2",   name: "Fatima Al-Rashid",role: "engineer",  status: "working",     currentRoom: "workstations", task: "Kubernetes Resource Limits Audit",       title: "DevOps Engineer – Bangers",         capabilities: "Kubernetes, Helm, network policies, security patching, Renovate", reportsTo: "mock-mgr-infra" },

  // ── Orion Infra Team (under Priya) ───────────────────────────────────────────
  { id: "mock-orion-1",    name: "Derek Novak",     role: "researcher",status: "collaborating",currentRoom: "conf-data",    task: "Q4 GPU Cluster Capacity Planning",       title: "AI Infrastructure Lead – Orion",    capabilities: "Azure ML, GPU clusters, MLflow, ONNX Runtime, model serving",    reportsTo: "mock-mgr-infra" },
  { id: "mock-orion-2",    name: "Ifeoma Obi",      role: "researcher",status: "collaborating",currentRoom: "conf-data",    task: "Embedding Cache Warm-up Init Container", title: "AI Infrastructure Engineer – Orion", capabilities: "Azure Cognitive Search, embeddings infra, vector indexing, hybrid search", reportsTo: "mock-mgr-infra" },
];

function buildMockOfficeAgents(existingOfficeAgents: OfficeAgent[]) {
  const existingById = new Map(existingOfficeAgents.map((a) => [a.id, a]));
  const occupiedSeats = new Map<RoomId, number[]>();

  return MOCK_OFFICE_AGENT_SEEDS.map((seed) => {
    const hash = hashString(seed.id);
    const seatIndex = findSeat(seed.currentRoom, occupiedSeats, hash);
    occupiedSeats.set(seed.currentRoom, [...(occupiedSeats.get(seed.currentRoom) ?? []), seatIndex]);
    const targetPosition = getSeatWorldPos(seed.currentRoom, seatIndex);
    const previous = existingById.get(seed.id);

    return {
      id: seed.id,
      name: seed.name,
      role: seed.role,
      backendRole: seed.role,
      title: seed.title,
      status: seed.status,
      backendStatus: seed.status,
      currentRoom: seed.currentRoom,
      targetRoom: seed.currentRoom,
      position: previous?.position ?? targetPosition,
      targetPosition,
      waypoints: [],
      task: seed.task,
      stateTimer: 0,
      isSitting: seed.status !== "idle" && seed.status !== "walking",
      seatIndex,
      standUpTimer: 0,
      assignedWorkstation: seed.currentRoom === "workstations" ? seatIndex : -1,
      capabilities: seed.capabilities,
      liveRunCount: 0,
      openIssueCount: 0,
      lastHeartbeatAt: null,
      reportsTo: seed.reportsTo ?? null,
      urlKey: null,
    } satisfies OfficeAgent;
  });
}

export const useOfficeStore = create<OfficeStore>((set) => ({
  agents: [],
  officeAgents: buildMockOfficeAgents([]),
  issues: [],
  selectedAgentId: null,
  isNightMode: false,
  liveMode: false,
  selectAgent: (id) => set({ selectedAgentId: id }),
  toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
  setBackendSnapshot: (snapshot) =>
    set((state) => {
      const agents = buildAgents(snapshot, state.agents);
      const officeAgents = [...agents, ...buildMockOfficeAgents(state.officeAgents)];
      const hasSelectedAgent = state.selectedAgentId && agents.some((a) => a.id === state.selectedAgentId);
      return {
        agents,
        officeAgents,
        issues: snapshot.issues,
        liveMode: true,
        selectedAgentId: hasSelectedAgent ? state.selectedAgentId : null,
      };
    }),
}));
