import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { tryDicebearDataUri } from "../components/AgentAvatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Link2, Trash2, Search, Brain, RotateCcw, SlidersHorizontal, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCompany } from "../context/CompanyContext";
import { useTheme } from "../context/ThemeContext";
import { agentMemoriesApi, type AgentMemory, type AgentMemoryLink } from "../api/agentMemories";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import type { Agent } from "@crewspaceai/shared";

// ── Palette ───────────────────────────────────────────────────────────────────

const AGENT_COLORS = [
  "#f59e0b", "#818cf8", "#34d399", "#f472b6",
  "#38bdf8", "#fb923c", "#a78bfa", "#4ade80",
  "#e879f9", "#67e8f9", "#fbbf24", "#86efac",
];
const MEMORY_TYPE_COLORS: Record<string, string> = {
  fact: "#6366f1", insight: "#8b5cf6", decision: "#ec4899",
  pattern: "#f59e0b", task: "#10b981", observation: "#3b82f6", learning: "#06b6d4",
};
function typeColor(t: string) { return MEMORY_TYPE_COLORS[t] ?? "#94a3b8"; }
const MEMORY_TYPES = ["fact", "insight", "decision", "pattern", "task", "observation", "learning"];

// ── Link type styles ──────────────────────────────────────────────────────────

const LINK_STYLES: Record<string, { color: string; dash: number[]; arrow: boolean }> = {
  related_to:   { color: "#6b7280", dash: [],     arrow: false },
  supports:     { color: "#22c55e", dash: [],     arrow: true  },
  contradicts:  { color: "#ef4444", dash: [6, 4], arrow: false },
  precedes:     { color: "#3b82f6", dash: [],     arrow: true  },
  derived_from: { color: "#a855f7", dash: [3, 3], arrow: true  },
  example_of:   { color: "#f59e0b", dash: [8, 4], arrow: false },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentNode {
  id: string;
  name: string;
  color: string;
  memCount: number;
  hasMemories: boolean;
  r: number;
  icon?: string | null;
}

interface MemNode {
  id: string;
  title: string;
  content: string;
  memoryType: string;
  agentId: string | null;
  agentColor: string;
  r: number;
  raw: AgentMemory;
}

interface GraphData {
  agents: AgentNode[];
  mems: MemNode[];
  edges: Array<{ source: string; target: string; type: "link" | "agent-mem"; relType?: string; weight?: string }>;
}

// 2D force-directed live positions
interface LivePos {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isAgent: boolean;
  pinned: boolean;
}

// ── Graph builder ─────────────────────────────────────────────────────────────

function buildGraphData(
  memories: AgentMemory[],
  links: AgentMemoryLink[],
  allAgents: Agent[],
): GraphData {
  let colorIdx = 0;
  const agentColorMap = new Map<string, string>();
  const agentMemCount = new Map<string, number>();

  // Seed from allAgents first so every agent gets a color
  for (const a of allAgents) {
    if (!agentColorMap.has(a.id)) {
      agentColorMap.set(a.id, AGENT_COLORS[colorIdx++ % AGENT_COLORS.length]);
      agentMemCount.set(a.id, 0);
    }
  }
  // Also cover any agents found only in memories
  for (const m of memories) {
    for (const a of m.agents) {
      if (!agentColorMap.has(a.agentId)) {
        agentColorMap.set(a.agentId, AGENT_COLORS[colorIdx++ % AGENT_COLORS.length]);
        agentMemCount.set(a.agentId, 0);
      }
      agentMemCount.set(a.agentId, (agentMemCount.get(a.agentId) ?? 0) + 1);
    }
  }

  // Build agents — allAgents provides names, fallback for memory-only agents
  const agentNameMap = new Map<string, string>();
  const agentIconMap = new Map<string, string | null>();
  for (const a of allAgents) {
    agentNameMap.set(a.id, a.name);
    agentIconMap.set(a.id, a.icon ?? null);
  }
  for (const m of memories) {
    for (const a of m.agents) {
      if (!agentNameMap.has(a.agentId)) agentNameMap.set(a.agentId, a.agentName ?? "Agent");
    }
  }

  const agentIds = [...agentColorMap.keys()];
  const agents: AgentNode[] = agentIds.map((id) => {
    const cnt = agentMemCount.get(id) ?? 0;
    return {
      id, name: agentNameMap.get(id) ?? "Agent",
      color: agentColorMap.get(id)!,
      memCount: cnt,
      hasMemories: cnt > 0,
      r: 18 + Math.min(cnt * 1.5, 12),
      icon: agentIconMap.get(id) ?? null,
    };
  });

  // Build memory nodes
  const mems: MemNode[] = memories.map((m) => {
    const owner = m.agents.find((a) => a.isOwner) ?? m.agents[0];
    const agentId = owner?.agentId ?? null;
    const agentColor = agentId ? (agentColorMap.get(agentId) ?? "#94a3b8") : "#94a3b8";
    return {
      id: m.id, title: m.title, content: m.content ?? "",
      memoryType: m.memoryType, agentId, agentColor,
      r: 6 + Math.min((m.content?.length ?? 0) / 100, 4),
      raw: m,
    };
  });

  // Build edges: mem-to-mem links + agent-to-memory ownership edges
  const memSet = new Set(mems.map((m) => m.id));
  const agentSet = new Set(agents.map((a) => a.id));
  const edges: GraphData["edges"] = [];
  for (const link of links) {
    if (memSet.has(link.sourceMemoryId) && memSet.has(link.targetMemoryId)) {
      edges.push({
        source: link.sourceMemoryId,
        target: link.targetMemoryId,
        type: "link",
        relType: link.relationshipType ?? "related_to",
        weight: link.weight ?? "1",
      });
    }
  }
  // Agent-to-memory edges so agent nodes are visually connected to their memories
  for (const mem of mems) {
    if (mem.agentId && agentSet.has(mem.agentId)) {
      edges.push({ source: mem.agentId, target: mem.id, type: "agent-mem" });
    }
  }

  return { agents, mems, edges };
}

// ── Hex helpers ───────────────────────────────────────────────────────────────

function hexRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
function rgba(hex: string, a: number) { return `rgba(${hexRgb(hex)},${a})`; }

// ── Force simulation constants ────────────────────────────────────────────────

const K_REP = 12000;
const K_CLUSTER = 0.004;
const K_GRAV = 0.003;
const DAMP = 0.82;

function tickForces(
  positions: Map<string, LivePos>,
  edges: GraphData["edges"],
  graph: GraphData,
) {
  const nodes = [...positions.values()];

  // Repulsion: Coulomb-style between every pair
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + 0.1;
      const d = Math.sqrt(d2);
      const f = K_REP / d2;
      const fx = (f * dx) / d;
      const fy = (f * dy) / d;
      if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
      if (!b.pinned) { b.vx += fx; b.vy += fy; }
    }
  }

  // Link spring: Hooke's law with rest length by weight
  for (const edge of edges) {
    const s = positions.get(edge.source);
    const t = positions.get(edge.target);
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const w = parseFloat(edge.weight ?? "1");
    const rest = 120 + (1 - w) * 60;
    const k = 0.015;
    const f = k * (d - rest);
    const fx = (f * dx) / d;
    const fy = (f * dy) / d;
    if (!s.pinned) { s.vx += fx; s.vy += fy; }
    if (!t.pinned) { t.vx -= fx; t.vy -= fy; }
  }

  // Cluster gravity: each memory node pulls toward its agent's centroid
  const agentCentroids = new Map<string, { x: number; y: number; count: number }>();
  for (const mem of graph.mems) {
    if (!mem.agentId) continue;
    const pos = positions.get(mem.id);
    if (!pos) continue;
    const c = agentCentroids.get(mem.agentId) ?? { x: 0, y: 0, count: 0 };
    c.x += pos.x; c.y += pos.y; c.count++;
    agentCentroids.set(mem.agentId, c);
  }
  for (const mem of graph.mems) {
    if (!mem.agentId) continue;
    const pos = positions.get(mem.id);
    if (!pos || pos.pinned) continue;
    const c = agentCentroids.get(mem.agentId);
    if (!c || c.count === 0) continue;
    const cx = c.x / c.count;
    const cy = c.y / c.count;
    pos.vx += K_CLUSTER * (cx - pos.x);
    pos.vy += K_CLUSTER * (cy - pos.y);
  }

  // Center gravity + damping + integrate + boundary clamp
  for (const n of nodes) {
    if (n.pinned) continue;
    n.vx += -K_GRAV * n.x;
    n.vy += -K_GRAV * n.y;
    n.vx *= DAMP;
    n.vy *= DAMP;
    n.x += n.vx;
    n.y += n.vy;
    // Boundary clamp
    n.x = Math.max(-1000, Math.min(1000, n.x));
    n.y = Math.max(-1000, Math.min(1000, n.y));
  }
}

function kineticEnergy(positions: Map<string, LivePos>) {
  let e = 0;
  for (const n of positions.values()) e += n.vx * n.vx + n.vy * n.vy;
  return e;
}

// ── Particle system ───────────────────────────────────────────────────────────

interface Particle { x: number; y: number; vx: number; vy: number; r: number; }

function makeParticles(w: number, h: number, count = 60): Particle[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * w * 1.2,
    y: (Math.random() - 0.5) * h * 1.2,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    r: Math.random() * 1.1 + 0.3,
  }));
}

function tickParticles(particles: Particle[], w: number, h: number) {
  const hw = w * 0.65, hh = h * 0.65;
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x > hw) p.x = -hw;
    if (p.x < -hw) p.x = hw;
    if (p.y > hh) p.y = -hh;
    if (p.y < -hh) p.y = hh;
  }
}

// ── Arrowhead helper ──────────────────────────────────────────────────────────

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, nodeR: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLen = 9;
  const arrowAngle = Math.PI / 6;
  // Place tip at edge of target node
  const tipX = x2 - Math.cos(angle) * (nodeR + 2);
  const tipY = y2 - Math.sin(angle) * (nodeR + 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - arrowLen * Math.cos(angle - arrowAngle), tipY - arrowLen * Math.sin(angle - arrowAngle));
  ctx.lineTo(tipX - arrowLen * Math.cos(angle + arrowAngle), tipY - arrowLen * Math.sin(angle + arrowAngle));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ── 2D Renderer hook ──────────────────────────────────────────────────────────

function use2DRenderer({
  graph,
  selectedId,
  hoveredId,
  filterAgentId,
  search,
  activeTypes,
  activeAgentFilter,
  showOrphans,
  hopsFilter,
  onSelect,
  onHover,
  isDark,
}: {
  graph: GraphData;
  selectedId: string | null;
  hoveredId: string | null;
  filterAgentId: string | null;
  search: string;
  activeTypes: Set<string>;
  activeAgentFilter: Set<string>;
  showOrphans: boolean;
  hopsFilter: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  isDark: boolean;
}) {
  const avatarImgRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Pan / zoom
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);

  // 2D live positions
  const posRef = useRef<Map<string, LivePos>>(new Map());
  const particlesRef = useRef<Particle[]>([]);

  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const simulatingRef = useRef(true);

  // Drag state
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const dragNodeRef = useRef<string | null>(null);

  // Live value refs
  const selectedRef = useRef(selectedId);
  const hoveredRef = useRef(hoveredId);
  const filterRef = useRef(filterAgentId);
  const searchRef = useRef(search);
  const activeTypesRef = useRef(activeTypes);
  const activeAgentFilterRef = useRef(activeAgentFilter);
  const showOrphansRef = useRef(showOrphans);
  const hopsFilterRef = useRef(hopsFilter);
  selectedRef.current = selectedId;
  hoveredRef.current = hoveredId;
  filterRef.current = filterAgentId;
  searchRef.current = search;
  activeTypesRef.current = activeTypes;
  activeAgentFilterRef.current = activeAgentFilter;
  showOrphansRef.current = showOrphans;
  hopsFilterRef.current = hopsFilter;

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Preload dicebear avatar images for agents
  useEffect(() => {
    const cache = avatarImgRef.current;
    for (const agent of graph.agents) {
      if (cache.has(agent.id)) continue;
      const seed = agent.icon || agent.id || agent.name || "unknown";
      const dataUri = tryDicebearDataUri(seed, 128);
      if (!dataUri) continue;
      const img = new Image();
      img.src = dataUri;
      cache.set(agent.id, img);
    }
  }, [graph.agents]);

  // Place nodes randomly in 2D when graph changes
  useEffect(() => {
    const { agents, mems } = graph;
    const positions = new Map<string, LivePos>();
    const W = 600, H = 400;

    // Try to keep existing positions for nodes that persist
    const prev = posRef.current;

    for (const a of agents) {
      const existing = prev.get(a.id);
      if (existing) {
        positions.set(a.id, { ...existing, isAgent: true });
      } else {
        positions.set(a.id, {
          id: a.id, isAgent: true, pinned: false,
          x: (Math.random() - 0.5) * W,
          y: (Math.random() - 0.5) * H,
          vx: 0, vy: 0,
        });
      }
    }

    for (const m of mems) {
      const existing = prev.get(m.id);
      if (existing) {
        positions.set(m.id, { ...existing, isAgent: false });
      } else {
        // Scatter near the agent's current position if possible
        const agentPos = m.agentId ? positions.get(m.agentId) : null;
        const bx = agentPos ? agentPos.x : 0;
        const by = agentPos ? agentPos.y : 0;
        positions.set(m.id, {
          id: m.id, isAgent: false, pinned: false,
          x: bx + (Math.random() - 0.5) * 120,
          y: by + (Math.random() - 0.5) * 120,
          vx: 0, vy: 0,
        });
      }
    }

    posRef.current = positions;
    simulatingRef.current = true;
  }, [graph]);

  // Initialize particles when size changes
  useEffect(() => {
    particlesRef.current = makeParticles(size.w, size.h);
  }, [size.w, size.h]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { agents, mems, edges } = graph;
    const agentById = new Map(agents.map((a) => [a.id, a]));
    const memById = new Map(mems.map((m) => [m.id, m]));

    const draw = () => {
      timeRef.current += 0.012;
      const t = timeRef.current;
      const { w, h } = size;
      const cx = w / 2, cy = h / 2;
      const pan = panRef.current;
      const zoom = zoomRef.current;
      const sel = selectedRef.current;
      const hov = hoveredRef.current;
      const fAgent = filterRef.current;
      const q = searchRef.current.toLowerCase();
      const typesFilter = activeTypesRef.current;
      const agentFilter = activeAgentFilterRef.current;
      const orphans = showOrphansRef.current;
      const hops = hopsFilterRef.current;
      const positions = posRef.current;

      // Tick simulation if still active
      if (simulatingRef.current) {
        tickForces(positions, edges, graph);
        const ke = kineticEnergy(positions);
        if (ke < 0.01 * positions.size) simulatingRef.current = false;
      }

      // ── Build node visibility set ─────────────────────────────────────────────
      const linkedMemIds = new Set<string>();
      for (const e of edges) {
        linkedMemIds.add(e.source);
        linkedMemIds.add(e.target);
      }

      const visibleMems = new Set<string>();
      for (const mem of mems) {
        // Type filter
        if (!typesFilter.has(mem.memoryType)) continue;
        // Agent filter (from filters panel)
        if (agentFilter.size > 0 && mem.agentId && !agentFilter.has(mem.agentId)) continue;
        // Agent filter (from toolbar chips)
        if (fAgent && mem.agentId !== fAgent) continue;
        // Orphan filter
        if (!orphans && !linkedMemIds.has(mem.id)) continue;
        visibleMems.add(mem.id);
      }

      // ── Neighborhood BFS for local graph view ─────────────────────────────────
      let neighborhood: Set<string> | null = null;
      if (sel) {
        neighborhood = new Set<string>([sel]);
        for (let hop = 0; hop < hops; hop++) {
          for (const edge of edges) {
            if (neighborhood.has(edge.source)) neighborhood.add(edge.target);
            if (neighborhood.has(edge.target)) neighborhood.add(edge.source);
          }
          // Also include the selected node's agent
          const selMem = memById.get(sel);
          if (selMem?.agentId) neighborhood.add(selMem.agentId);
          // And all mems of a selected agent
          const selAgent = agentById.get(sel);
          if (selAgent) {
            for (const m of mems) if (m.agentId === sel) neighborhood.add(m.id);
          }
        }
      }

      const nodeAlpha = (id: string) => neighborhood && !neighborhood.has(id) ? 0.1 : 1.0;

      // Search match
      const matchesSearch = (id: string) => {
        if (!q) return true;
        const mem = memById.get(id);
        return mem ? mem.title.toLowerCase().includes(q) : true;
      };

      // ── Degree map for node sizing ─────────────────────────────────────────────
      const degree = new Map<string, number>();
      for (const edge of edges) {
        degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
        degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
      }
      const nodeRadius = (id: string, baseR: number) =>
        Math.max(baseR, Math.min(24, baseR + (degree.get(id) ?? 0) * 2));

      // ── Visible edges ─────────────────────────────────────────────────────────
      const drawAgentIds = new Set(agents.map((a) => a.id));
      const linksForDraw = edges.filter(
        (e) =>
          // mem→mem links: both endpoints must be visible memories
          (e.type === "link" && visibleMems.has(e.source) && visibleMems.has(e.target)) ||
          // agent→mem edges: agent always shown, target memory must be visible
          (e.type === "agent-mem" && drawAgentIds.has(e.source) && visibleMems.has(e.target)),
      );

      // ── Background ────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
      if (isDark) {
        bg.addColorStop(0, "#181715");
        bg.addColorStop(0.6, "#141312");
        bg.addColorStop(1, "#0e0d0c");
      } else {
        bg.addColorStop(0, "#faf9f5");
        bg.addColorStop(0.6, "#f5f3ee");
        bg.addColorStop(1, "#efe9de");
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ── Particles ─────────────────────────────────────────────────────────────
      tickParticles(particlesRef.current, w, h);
      const particles = particlesRef.current;
      const CONN_DIST = 90;
      ctx.save();
      ctx.translate(cx + pan.x, cy + pan.y);
      ctx.scale(zoom, zoom);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "rgba(204,120,92,0.2)" : "rgba(204,120,92,0.12)";
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q2 = particles[j];
          const ddx = q2.x - p.x, ddy = q2.y - p.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < CONN_DIST) {
            const alpha = (1 - d / CONN_DIST) * 0.10;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q2.x, q2.y);
            ctx.strokeStyle = isDark ? `rgba(204,120,92,${alpha})` : `rgba(204,120,92,${alpha * 0.6})`;
            ctx.lineWidth = 0.5 / zoom;
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      ctx.save();
      ctx.translate(cx + pan.x, cy + pan.y);
      ctx.scale(zoom, zoom);

      // ── Agent cluster blobs (before nodes) ───────────────────────────────────
      for (const agent of agents) {
        const agentMems = mems.filter((m) => m.agentId === agent.id && visibleMems.has(m.id));
        if (agentMems.length === 0) continue;
        const blobCx = agentMems.reduce((s, m) => s + (positions.get(m.id)?.x ?? 0), 0) / agentMems.length;
        const blobCy = agentMems.reduce((s, m) => s + (positions.get(m.id)?.y ?? 0), 0) / agentMems.length;
        const blobR = Math.max(60, agentMems.length * 20);
        const grad = ctx.createRadialGradient(blobCx, blobCy, 0, blobCx, blobCy, blobR);
        grad.addColorStop(0, rgba(agent.color, 0.10));
        grad.addColorStop(1, rgba(agent.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(blobCx, blobCy, blobR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Links ─────────────────────────────────────────────────────────────────
      for (const edge of linksForDraw) {
        const sp = positions.get(edge.source);
        const tp = positions.get(edge.target);
        if (!sp || !tp) continue;

        // Agent-to-memory ownership edge: faint dashed line in agent color
        if (edge.type === "agent-mem") {
          const agentNode = agents.find((a) => a.id === edge.source);
          const agentColor = agentNode?.color ?? "#94a3b8";
          const memAlpha = nodeAlpha(edge.target);
          const isActive = edge.source === (hov ?? sel) || edge.target === (hov ?? sel);
          ctx.globalAlpha = (isActive ? 0.65 : 0.32) * memAlpha;
          ctx.setLineDash([4, 7]);
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(tp.x, tp.y);
          ctx.strokeStyle = agentColor;
          ctx.lineWidth = isActive ? 1.5 : 1.0;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          continue;
        }

        const style = LINK_STYLES[edge.relType ?? "related_to"] ?? LINK_STYLES.related_to;
        const isActive = edge.source === (hov ?? sel) || edge.target === (hov ?? sel);
        const sa = nodeAlpha(edge.source) * nodeAlpha(edge.target);
        const lineAlpha = (isActive ? 0.85 : 0.35) * sa;
        const lw = 1 + parseFloat(edge.weight ?? "1") * 0.8;

        ctx.globalAlpha = lineAlpha;
        ctx.setLineDash(style.dash);
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = isActive ? lw + 0.5 : lw;
        ctx.stroke();
        ctx.setLineDash([]);

        if (style.arrow) {
          const tm = memById.get(edge.target);
          const tR = tm ? nodeRadius(edge.target, tm.r) : 8;
          ctx.globalAlpha = lineAlpha;
          drawArrow(ctx, sp.x, sp.y, tp.x, tp.y, style.color, tR);
        }

        ctx.globalAlpha = 1;
      }

      // ── Memory nodes ─────────────────────────────────────────────────────────
      for (const mem of mems) {
        if (!visibleMems.has(mem.id)) continue;
        const pos = positions.get(mem.id);
        if (!pos) continue;

        const isHov = hov === mem.id;
        const isSel = sel === mem.id;
        const alpha = nodeAlpha(mem.id);
        const searchMatch = matchesSearch(mem.id);
        const nodeAlphaFinal = searchMatch ? alpha : alpha * 0.15;
        const color = typeColor(mem.memoryType);
        const r = nodeRadius(mem.id, mem.r);

        ctx.globalAlpha = nodeAlphaFinal;

        // Glow
        const glowR = r * (isHov || isSel ? 4 : 2.5);
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
        glow.addColorStop(0, rgba(color, isHov || isSel ? 0.35 : 0.12));
        glow.addColorStop(1, rgba(color, 0));
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Main circle
        ctx.shadowBlur = isHov || isSel ? 18 : 6;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = rgba(color, 0.25);
        ctx.strokeStyle = rgba(color, isSel ? 1 : isHov ? 0.9 : 0.65);
        ctx.lineWidth = isSel ? 2.5 : 1.2;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = rgba(color, 0.9);
        ctx.fill();

        // Search ring (yellow) when matches search
        if (searchMatch && q) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(250,204,21,0.9)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Label on hover/select
        if (isHov || isSel) {
          const lbl = mem.title.length > 28 ? mem.title.slice(0, 28) + "…" : mem.title;
          ctx.font = `500 11px Inter, system-ui, sans-serif`;
          const tw = ctx.measureText(lbl).width;
          const lx = pos.x - tw / 2;
          const ly = pos.y - r - 10;
          ctx.globalAlpha = 1;
          ctx.fillStyle = isDark ? "rgba(24,23,21,0.92)" : "rgba(250,249,245,0.95)";
          ctx.beginPath();
          (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect?.(lx - 6, ly - 13, tw + 12, 18, 4);
          ctx.fill();
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.fillText(lbl, pos.x, ly);
          ctx.textAlign = "left";
        }

        ctx.globalAlpha = 1;
      }

      // ── Agent nodes ───────────────────────────────────────────────────────────
      for (const agent of agents) {
        const pos = positions.get(agent.id);
        if (!pos) continue;
        const isHov = hov === agent.id;
        const isSel = sel === agent.id;
        const alpha = nodeAlpha(agent.id);
        const pulse = 1 + Math.sin(t * 2.2 + agents.indexOf(agent)) * 0.05;
        const r = nodeRadius(agent.id, agent.r) * pulse;
        const color = agent.color;

        ctx.globalAlpha = alpha;

        // Halo
        const haloR = r * (isSel || isHov ? 3.2 : 2.4);
        const halo = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, haloR);
        halo.addColorStop(0, rgba(color, isSel ? 0.3 : 0.12));
        halo.addColorStop(1, rgba(color, 0));
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, haloR, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        const avatarImg = avatarImgRef.current.get(agent.id);
        const hasAvatar = avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0;

        if (hasAvatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImg, pos.x - r, pos.y - r, r * 2, r * 2);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(color, isSel ? 1 : isHov ? 0.9 : 0.65);
          ctx.lineWidth = isSel ? 2.5 : 1.5;
          ctx.stroke();
        } else if (!agent.hasMemories) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(color, isSel || isHov ? 0.9 : 0.45);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        } else {
          ctx.shadowBlur = isSel || isHov ? 40 : 22;
          ctx.shadowColor = color;
          const sphere = ctx.createRadialGradient(
            pos.x - r * 0.3, pos.y - r * 0.3, 0,
            pos.x, pos.y, r,
          );
          sphere.addColorStop(0, rgba(color, 0.95));
          sphere.addColorStop(0.6, rgba(color, 0.55));
          sphere.addColorStop(1, rgba(color, 0.2));
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fillStyle = sphere;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(color, isSel ? 1 : 0.7);
          ctx.lineWidth = isSel ? 2.5 : 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = rgba(color, 0.9);
          ctx.fill();
        }

        // Initial letter fallback
        if (!hasAvatar) {
          const initial = agent.name.trim().charAt(0).toUpperCase() || "?";
          ctx.font = `bold ${Math.max(10, r * 0.6)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = isDark ? "#faf9f5" : "#141413";
          ctx.fillText(initial, pos.x, pos.y);
          ctx.textBaseline = "alphabetic";
        }

        // Agent name label
        ctx.font = `700 12px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        const lbl = agent.name;
        const tw = ctx.measureText(lbl).width;
        ctx.fillStyle = isDark ? "rgba(24,23,21,0.80)" : "rgba(250,249,245,0.92)";
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect?.(pos.x - tw / 2 - 5, pos.y + r + 5, tw + 10, 16, 3);
        ctx.fill();
        ctx.fillStyle = isSel || isHov ? (isDark ? "#faf9f5" : "#141413") : rgba(color, 0.95);
        ctx.fillText(lbl, pos.x, pos.y + r + 17);

        ctx.font = `400 10px Inter, system-ui, sans-serif`;
        ctx.fillStyle = rgba(color, agent.hasMemories ? 0.5 : 0.35);
        ctx.fillText(agent.hasMemories ? `${agent.memCount} mem` : "no memories", pos.x, pos.y + r + 31);
        ctx.textAlign = "left";

        ctx.globalAlpha = 1;
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [graph, size, isDark]);

  // ── Hit testing (in world coords) ─────────────────────────────────────────────

  const hitTest = useCallback((canvasX: number, canvasY: number): string | null => {
    const { agents, mems } = graph;
    const { w, h } = size;
    const pan = panRef.current;
    const zoom = zoomRef.current;
    const positions = posRef.current;
    const wx = (canvasX - w / 2 - pan.x) / zoom;
    const wy = (canvasY - h / 2 - pan.y) / zoom;

    let best: { id: string; d2: number } | null = null;
    for (const a of agents) {
      const pos = positions.get(a.id);
      if (!pos) continue;
      const dx = wx - pos.x, dy = wy - pos.y;
      const d2 = dx * dx + dy * dy;
      const hitR = a.r + 6;
      if (d2 <= hitR * hitR && (!best || d2 < best.d2)) best = { id: a.id, d2 };
    }
    for (const m of mems) {
      const pos = positions.get(m.id);
      if (!pos) continue;
      const dx = wx - pos.x, dy = wy - pos.y;
      const d2 = dx * dx + dy * dy;
      const hitR = Math.max(m.r + 5, 10);
      if (d2 <= hitR * hitR && (!best || d2 < best.d2)) best = { id: m.id, d2 };
    }
    return best?.id ?? null;
  }, [graph, size]);

  // ── Mouse events ──────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    dragging.current = true;
    hasDragged.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    // Try to hit a node for individual dragging
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        dragNodeRef.current = hit;
        // Pin the node while dragging
        const pos = posRef.current.get(hit);
        if (pos) pos.pinned = true;
      } else {
        dragNodeRef.current = null;
      }
    }

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - lastMouse.current.x;
      const dy = ev.clientY - lastMouse.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDragged.current = true;

      if (dragNodeRef.current) {
        // Move the dragged node directly
        const pos = posRef.current.get(dragNodeRef.current);
        if (pos) {
          pos.x += dx / zoomRef.current;
          pos.y += dy / zoomRef.current;
          pos.vx = 0; pos.vy = 0;
          simulatingRef.current = true;
        }
      } else {
        // Pan canvas
        panRef.current.x += dx;
        panRef.current.y += dy;
      }
      lastMouse.current = { x: ev.clientX, y: ev.clientY };
    };

    const onUp = () => {
      dragging.current = false;
      // Unpin node (let simulation take over from dropped position)
      if (dragNodeRef.current) {
        const pos = posRef.current.get(dragNodeRef.current);
        if (pos) { pos.pinned = false; pos.vx = 0; pos.vy = 0; }
        dragNodeRef.current = null;
        simulatingRef.current = true;
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [hitTest]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hasDragged.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    onSelect(hit === selectedId ? null : hit);
  }, [hitTest, onSelect, selectedId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    onHover(hit);
    e.currentTarget.style.cursor = hit ? "pointer" : "grab";
  }, [hitTest, onHover]);

  const handleMouseLeave = useCallback(() => { onHover(null); }, [onHover]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomRef.current = Math.max(0.15, Math.min(5, zoomRef.current * factor));
  }, []);

  const resetView = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    zoomRef.current = 1.0;
  }, []);

  return { canvasRef, containerRef, size, handleMouseDown, handleClick, handleMouseMove, handleMouseLeave, handleWheel, resetView, posRef };
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ nodeId, graph, allMemories, allLinks, onClose, onDelete, onLink, onSelectNode }: {
  nodeId: string;
  graph: GraphData;
  allMemories: AgentMemory[];
  allLinks: AgentMemoryLink[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onLink: (id: string) => void;
  onSelectNode: (id: string | null) => void;
}) {
  const agent = graph.agents.find((a) => a.id === nodeId);
  const mem = graph.mems.find((m) => m.id === nodeId);

  if (agent) {
    const mems = graph.mems.filter((m) => m.agentId === agent.id);
    return (
      <aside className="w-72 shrink-0 border-l border-border flex flex-col bg-background/95 backdrop-blur">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: agent.color }} />
          <span className="text-sm font-semibold flex-1 truncate">{agent.name}</span>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </header>
        <div className="px-4 py-3 border-b border-border">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-xl font-bold" style={{ color: agent.color }}>{agent.memCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Memories</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Memory Clusters</p>
          {mems.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 italic">No memories yet</p>
          ) : (
            <div className="flex flex-col gap-1">
              {mems.map((m) => (
                <button key={m.id} onClick={() => onSelectNode(m.id)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-accent transition-colors">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: typeColor(m.memoryType) }} />
                  <span className="flex-1 truncate text-foreground/80">{m.title}</span>
                  <span className="text-[10px] capitalize rounded-full px-1.5 py-0.5"
                    style={{ color: typeColor(m.memoryType), background: `${typeColor(m.memoryType)}18` }}>
                    {m.memoryType}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    );
  }

  if (mem) {
    const ownerAgent = graph.agents.find((a) => a.id === mem.agentId);

    // Backlinks: split into inbound (reference TO this) and outbound (this references)
    const referencedBy = allLinks
      .filter((l) => l.targetMemoryId === mem.id)
      .map((l) => {
        const m = allMemories.find((mm) => mm.id === l.sourceMemoryId);
        return m ? { mem: m, link: l } : null;
      }).filter(Boolean) as Array<{ mem: AgentMemory; link: AgentMemoryLink }>;

    const references = allLinks
      .filter((l) => l.sourceMemoryId === mem.id)
      .map((l) => {
        const m = allMemories.find((mm) => mm.id === l.targetMemoryId);
        return m ? { mem: m, link: l } : null;
      }).filter(Boolean) as Array<{ mem: AgentMemory; link: AgentMemoryLink }>;

    return (
      <aside className="w-72 shrink-0 border-l border-border flex flex-col bg-background/95 backdrop-blur">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: typeColor(mem.memoryType) }} />
          <span className="text-sm font-semibold flex-1 truncate">{mem.title}</span>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-medium capitalize text-primary-foreground"
              style={{ background: typeColor(mem.memoryType) }}>{mem.memoryType}</span>
            {ownerAgent && (
              <button onClick={() => onSelectNode(ownerAgent.id)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium hover:opacity-80 transition-opacity"
                style={{ background: `${ownerAgent.color}18`, border: `1px solid ${ownerAgent.color}35`, color: ownerAgent.color }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: ownerAgent.color }} />
                {ownerAgent.name}
              </button>
            )}
          </div>
          {mem.content && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Content</p>
              <p className="text-foreground/75 leading-relaxed whitespace-pre-wrap">{mem.content}</p>
            </div>
          )}

          {/* Connections — backlinks in/out */}
          {(referencedBy.length > 0 || references.length > 0) && (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Connections</p>

              {references.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/50 mb-1 flex items-center gap-1">
                    <ChevronRight className="h-2.5 w-2.5" />References ({references.length})
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {references.map(({ mem: c, link: l }) => {
                      const ls = LINK_STYLES[l.relationshipType ?? "related_to"] ?? LINK_STYLES.related_to;
                      return (
                        <button key={c.id} onClick={() => onSelectNode(c.id)}
                          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-accent transition-colors text-left">
                          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: typeColor(c.memoryType) }} />
                          <span className="truncate flex-1 text-foreground/70">{c.title}</span>
                          <span className="text-[9px] shrink-0 rounded px-1 py-0.5 font-mono" style={{ color: ls.color, background: `${ls.color}18` }}>
                            {(l.relationshipType ?? "related_to").replace(/_/g, " ")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {referencedBy.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/50 mb-1 flex items-center gap-1">
                    <ChevronRight className="h-2.5 w-2.5 rotate-180" />Referenced by ({referencedBy.length})
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {referencedBy.map(({ mem: c, link: l }) => {
                      const ls = LINK_STYLES[l.relationshipType ?? "related_to"] ?? LINK_STYLES.related_to;
                      return (
                        <button key={c.id} onClick={() => onSelectNode(c.id)}
                          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-accent transition-colors text-left">
                          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: typeColor(c.memoryType) }} />
                          <span className="truncate flex-1 text-foreground/70">{c.title}</span>
                          <span className="text-[9px] shrink-0 rounded px-1 py-0.5 font-mono" style={{ color: ls.color, background: `${ls.color}18` }}>
                            {(l.relationshipType ?? "related_to").replace(/_/g, " ")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="px-4 py-3 border-t border-border flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onLink(mem.id)}>
            <Link2 className="h-3 w-3 mr-1.5" />Link
          </Button>
          <Button size="sm" variant="outline"
            className="h-7 text-xs text-destructive border-destructive/20 hover:border-destructive/40"
            onClick={() => onDelete(mem.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </footer>
      </aside>
    );
  }

  return null;
}

// ── Filters Panel ─────────────────────────────────────────────────────────────

function FiltersPanel({
  agents,
  activeTypes,
  setActiveTypes,
  activeAgentFilter,
  setActiveAgentFilter,
  showOrphans,
  setShowOrphans,
  onClose,
}: {
  agents: AgentNode[];
  activeTypes: Set<string>;
  setActiveTypes: (s: Set<string>) => void;
  activeAgentFilter: Set<string>;
  setActiveAgentFilter: (s: Set<string>) => void;
  showOrphans: boolean;
  setShowOrphans: (v: boolean) => void;
  onClose: () => void;
}) {
  const toggleType = (t: string) => {
    const next = new Set(activeTypes);
    next.has(t) ? next.delete(t) : next.add(t);
    setActiveTypes(next);
  };
  const toggleAgent = (id: string) => {
    const next = new Set(activeAgentFilter);
    next.has(id) ? next.delete(id) : next.add(id);
    setActiveAgentFilter(next);
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 z-20 w-56 border-l border-border bg-background/97 backdrop-blur flex flex-col shadow-xl">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold">Filters</span>
        <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* Memory types */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Memory Type</p>
          <div className="flex flex-col gap-1">
            {MEMORY_TYPES.map((t) => {
              const active = activeTypes.has(t);
              return (
                <label key={t} className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent transition-colors">
                  <input type="checkbox" checked={active} onChange={() => toggleType(t)} className="sr-only" />
                  <div className={cn(
                    "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                    active ? "border-transparent" : "border-border bg-muted"
                  )} style={active ? { background: typeColor(t) } : {}}>
                    {active && <svg viewBox="0 0 8 8" className="h-2 w-2 text-white fill-current"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                  </div>
                  <span className="text-xs capitalize" style={{ color: active ? typeColor(t) : undefined }}>{t}</span>
                  <div className="h-1.5 w-1.5 rounded-full ml-auto shrink-0" style={{ background: typeColor(t) }} />
                </label>
              );
            })}
          </div>
        </div>

        {/* Agents */}
        {agents.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Agents</p>
            <p className="text-[10px] text-muted-foreground/50 mb-1.5">Leave all unchecked to show all agents</p>
            <div className="flex flex-col gap-1">
              {agents.map((a) => {
                const active = activeAgentFilter.has(a.id);
                return (
                  <label key={a.id} className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent transition-colors">
                    <input type="checkbox" checked={active} onChange={() => toggleAgent(a.id)} className="sr-only" />
                    <div className={cn(
                      "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                      active ? "border-transparent" : "border-border bg-muted"
                    )} style={active ? { background: a.color } : {}}>
                      {active && <svg viewBox="0 0 8 8" className="h-2 w-2 text-white fill-current"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                    </div>
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                    <span className="text-xs truncate flex-1">{a.name}</span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">{a.memCount}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Show orphans */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Visibility</p>
          <label className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent transition-colors">
            <input type="checkbox" checked={showOrphans} onChange={() => setShowOrphans(!showOrphans)} className="sr-only" />
            <div className={cn(
              "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
              showOrphans ? "bg-primary border-transparent" : "border-border bg-muted"
            )}>
              {showOrphans && <svg viewBox="0 0 8 8" className="h-2 w-2 text-white fill-current"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
            </div>
            <span className="text-xs">Show isolated nodes</span>
          </label>
        </div>

        {/* Reset filters */}
        <button
          onClick={() => {
            setActiveTypes(new Set(MEMORY_TYPES));
            setActiveAgentFilter(new Set());
            setShowOrphans(true);
          }}
          className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors text-left px-2 underline underline-offset-2"
        >
          Reset all filters
        </button>
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function AddMemoryModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (d: { title: string; content: string; memoryType: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [memoryType, setMemoryType] = useState("fact");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg shadow-2xl w-[480px] p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add Memory Node</h2>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Title *"
          className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40" />
        <div className="flex flex-wrap gap-1.5">
          {MEMORY_TYPES.map((t) => (
            <button key={t} onClick={() => setMemoryType(t)}
              className={cn("px-2.5 py-1 text-[11px] font-medium rounded-full border capitalize transition-colors",
                memoryType === t ? "text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:border-foreground/30")}
              style={memoryType === t ? { background: typeColor(t) } : {}}>{t}</button>
          ))}
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="Details (optional)…" rows={3}
          className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/40" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!title.trim()} onClick={() => onAdd({ title: title.trim(), content, memoryType })}>Add Memory</Button>
        </div>
      </div>
    </div>
  );
}

function LinkModal({ sourceMemory, memories, onClose, onLink }: {
  sourceMemory: AgentMemory; memories: AgentMemory[];
  onClose: () => void; onLink: (targetId: string, rel: string, label: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [relType, setRelType] = useState("related_to");
  const [label, setLabel] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg shadow-2xl w-[420px] p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Link Memory</h2>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">Linking from: <span className="font-medium text-foreground">{sourceMemory.title}</span></p>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none">
          <option value="">Select a memory…</option>
          {memories.filter((m) => m.id !== sourceMemory.id).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <select value={relType} onChange={(e) => setRelType(e.target.value)} className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none">
          {["related_to", "supports", "contradicts", "precedes", "derived_from", "example_of"].map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!targetId} onClick={() => onLink(targetId, relType, label)}>Create Link</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MemoryGraph() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);

  // Filter panel state
  const [showFilters, setShowFilters] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(() => new Set(MEMORY_TYPES));
  const [activeAgentFilter, setActiveAgentFilter] = useState<Set<string>>(() => new Set());
  const [showOrphans, setShowOrphans] = useState(true);
  const [hopsFilter, setHopsFilter] = useState(2);

  const { data: graph, isLoading } = useQuery({
    queryKey: queryKeys.memories.graph(selectedCompanyId!),
    queryFn: () => agentMemoriesApi.getGraph(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const { data: allAgents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const memories = graph?.memories ?? [];
  const links = graph?.links ?? [];

  const graphData = useMemo(
    () => buildGraphData(memories, links, allAgents),
    [memories, links, allAgents],
  );

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { canvasRef, containerRef, size, handleMouseDown, handleClick, handleMouseMove, handleMouseLeave, handleWheel, resetView } =
    use2DRenderer({
      graph: graphData,
      selectedId, hoveredId, filterAgentId, search,
      activeTypes, activeAgentFilter, showOrphans, hopsFilter,
      onSelect: setSelectedId,
      onHover: setHoveredId,
      isDark,
    });

  const addMutation = useMutation({
    mutationFn: (d: { title: string; content: string; memoryType: string }) => agentMemoriesApi.create(selectedCompanyId!, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.memories.graph(selectedCompanyId!) }); setShowAddModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => agentMemoriesApi.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.memories.graph(selectedCompanyId!) }); setSelectedId(null); },
  });

  const linkMutation = useMutation({
    mutationFn: (d: { targetId: string; rel: string; label: string }) =>
      agentMemoriesApi.createLink(selectedCompanyId!, {
        sourceMemoryId: linkSourceId!, targetMemoryId: d.targetId, relationshipType: d.rel, label: d.label || undefined,
      }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.memories.graph(selectedCompanyId!) }); setLinkSourceId(null); },
  });

  const linkSourceMemory = linkSourceId ? memories.find((m) => m.id === linkSourceId) ?? null : null;
  const { agents } = graphData;
  const showPanel = selectedId && (agents.some((a) => a.id === selectedId) || graphData.mems.some((m) => m.id === selectedId));
  const isEmpty = memories.length === 0 && allAgents.length === 0;

  // Count active filters
  const filterCount =
    (MEMORY_TYPES.length - activeTypes.size) +
    activeAgentFilter.size +
    (!showOrphans ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Memory Graph</span>
          {(agents.length > 0 || memories.length > 0) && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
              {agents.length} agents · {memories.length} nodes
            </span>
          )}
        </div>

        {agents.length > 0 && (
          <>
            {/* Search input */}
            <div className="relative max-w-44">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memories…"
                className="w-full rounded-md border border-border bg-muted/40 pl-7 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary/50"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Agent chips */}
            <ScrollArea className="max-w-xs" type="scroll">
              <div className="flex items-center gap-1.5 w-max pb-0.5">
                <button
                  onClick={() => setFilterAgentId(null)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border shrink-0",
                    !filterAgentId
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}>
                  All
                </button>
                {agents.map((a) => {
                  const initials = a.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                  const isActive = filterAgentId === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setFilterAgentId(isActive ? null : a.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium border transition-colors shrink-0",
                        isActive ? "" : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      style={isActive ? { color: a.color, background: `${a.color}18`, borderColor: `${a.color}60` } : {}}>
                      <span className="flex items-center justify-center rounded-full text-[9px] font-bold w-4 h-4 shrink-0"
                        style={{ background: `${a.color}40`, color: a.color, border: `1px solid ${a.color}60` }}>
                        {initials}
                      </span>
                      {a.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" className="h-1" />
            </ScrollArea>

            {/* Hops slider — only when something is selected */}
            {selectedId && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground/70">Hops:</span>
                <input
                  type="range" min={1} max={4} value={hopsFilter}
                  onChange={(e) => setHopsFilter(parseInt(e.target.value))}
                  className="w-16 accent-primary h-1"
                />
                <span className="text-[11px] font-medium text-primary w-3">{hopsFilter}</span>
              </div>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Filters button */}
          {agents.length > 0 && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors",
                showFilters
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}>
              <SlidersHorizontal className="h-3 w-3" />
              Filters
              {filterCount > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[9px] w-4 h-4 flex items-center justify-center font-bold">
                  {filterCount}
                </span>
              )}
            </button>
          )}

          {(agents.length > 0 || memories.length > 0) && (
            <button onClick={resetView} title="Reset view"
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <RotateCcw className="h-3 w-3" />Reset
            </button>
          )}
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Memory
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div ref={containerRef} className="relative flex-1 min-w-0 overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="h-8 w-8 animate-pulse text-primary/40" />
            </div>
          ) : isEmpty ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Brain className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No memories yet</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-56">Agents learn and grow their knowledge graph as they work.</p>
                </div>
                <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add First Memory</Button>
              </div>
            </div>
          ) : (
            <canvas ref={canvasRef} width={size.w} height={size.h}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onClick={handleClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onWheel={handleWheel}
            />
          )}

          {/* Filters panel (overlay on right, within canvas area) */}
          {showFilters && !isEmpty && (
            <FiltersPanel
              agents={agents}
              activeTypes={activeTypes}
              setActiveTypes={setActiveTypes}
              activeAgentFilter={activeAgentFilter}
              setActiveAgentFilter={setActiveAgentFilter}
              showOrphans={showOrphans}
              setShowOrphans={setShowOrphans}
              onClose={() => setShowFilters(false)}
            />
          )}

          {!isEmpty && (
            <>
              {/* Legend */}
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg border border-border bg-background/90 px-3 py-2.5 text-[10px] backdrop-blur">
                <p className="font-semibold text-foreground/70 mb-0.5">Legend</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-3 w-3 rounded-full border border-primary bg-primary/30" /><span>Agent</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-2 w-2 rounded-full border border-muted-foreground/60 bg-muted/30 ml-0.5" /><span>Memory node</span>
                </div>
                <div className="h-px bg-border/60 my-0.5" />
                {Object.entries(LINK_STYLES).map(([rel, style]) => (
                  <div key={rel} className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-5 h-px relative flex items-center">
                      <svg width="20" height="8" viewBox="0 0 20 8">
                        <line x1="0" y1="4" x2={style.arrow ? "14" : "20"} y2="4"
                          stroke={style.color} strokeWidth="1.5"
                          strokeDasharray={style.dash.length > 0 ? style.dash.join(",") : undefined} />
                        {style.arrow && (
                          <polygon points="14,1 20,4 14,7" fill={style.color} />
                        )}
                      </svg>
                    </div>
                    <span className="capitalize" style={{ color: style.color }}>{rel.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
              <p className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-muted-foreground/40">
                Drag nodes · Scroll to zoom · Middle-drag to pan · Click to inspect
              </p>
            </>
          )}
        </div>

        {showPanel && selectedId && (
          <DetailPanel nodeId={selectedId} graph={graphData} allMemories={memories} allLinks={links}
            onClose={() => setSelectedId(null)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onLink={(id) => { setLinkSourceId(id); setSelectedId(null); }}
            onSelectNode={setSelectedId} />
        )}
      </div>

      {showAddModal && <AddMemoryModal onClose={() => setShowAddModal(false)} onAdd={(d) => addMutation.mutate(d)} />}
      {linkSourceMemory && (
        <LinkModal sourceMemory={linkSourceMemory} memories={memories}
          onClose={() => setLinkSourceId(null)}
          onLink={(targetId, rel, label) => linkMutation.mutate({ targetId, rel, label })} />
      )}
    </div>
  );
}
