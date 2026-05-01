import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { tryDicebearDataUri } from "../components/AgentAvatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Link2, Trash2, Search, Brain, RotateCcw } from "lucide-react";
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
  edges: Array<{ source: string; target: string; type: "orbit" | "link" }>;
}

// Live node positions — updated every frame from 3D sphere positions
interface LivePos {
  id: string;
  x: number; y: number; // perspective-projected 2D (updated each frame)
  z: number;            // rotated z-depth (for sorting and depth fade)
  scale: number;        // perspective scale factor = FOV/(FOV+z)
  vx: number; vy: number;
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

  const agentById = new Map(agents.map((a) => [a.id, a]));

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

  // Edges: orbit (mem → agent) + link (mem → mem)
  const edges: GraphData["edges"] = [];
  for (const mem of mems) {
    if (mem.agentId) edges.push({ source: mem.id, target: mem.agentId, type: "orbit" });
  }
  for (const link of links) {
    const sm = mems.find((n) => n.id === link.sourceMemoryId);
    const tm = mems.find((n) => n.id === link.targetMemoryId);
    if (sm && tm) edges.push({ source: sm.id, target: tm.id, type: "link" });
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

// ── Force simulation ─────────────────────────────────────────────────────────

const K_REP = 12000;
const K_SPR_ORBIT = 0.03;
const K_SPR_LINK = 0.015;
const REST_ORBIT = 110;
const REST_LINK = 180;
const K_GRAV = 0.006;
const DAMP = 0.82;

function tickForces(positions: Map<string, LivePos>, edges: GraphData["edges"]) {
  const nodes = [...positions.values()];

  // Repulsion
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
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  // Spring attraction
  for (const edge of edges) {
    const s = positions.get(edge.source);
    const t = positions.get(edge.target);
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const rest = edge.type === "orbit" ? REST_ORBIT : REST_LINK;
    const k = edge.type === "orbit" ? K_SPR_ORBIT : K_SPR_LINK;
    const f = k * (d - rest);
    const fx = (f * dx) / d;
    const fy = (f * dy) / d;
    s.vx += fx; s.vy += fy;
    t.vx -= fx; t.vy -= fy;
  }

  // Center gravity + damping + integrate
  for (const n of nodes) {
    n.vx += -K_GRAV * n.x;
    n.vy += -K_GRAV * n.y;
    n.vx *= DAMP;
    n.vy *= DAMP;
    n.x += n.vx;
    n.y += n.vy;
  }
}

function kineticEnergy(positions: Map<string, LivePos>) {
  let e = 0;
  for (const n of positions.values()) e += n.vx * n.vx + n.vy * n.vy;
  return e;
}

// ── Particle system ───────────────────────────────────────────────────────────

interface Particle { x: number; y: number; vx: number; vy: number; r: number; }

function makeParticles(w: number, h: number, count = 70): Particle[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * w * 1.2,
    y: (Math.random() - 0.5) * h * 1.2,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.2 + 0.4,
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

// ── 3D helpers ────────────────────────────────────────────────────────────────

function fibonacciSphere(n: number, i: number, radius: number) {
  const golden = (1 + Math.sqrt(5)) / 2;
  const theta = (2 * Math.PI * i) / golden;
  const phi = Math.acos(1 - 2 * (i + 0.5) / Math.max(n, 1));
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

// ── 3D Globe Renderer hook ────────────────────────────────────────────────────

function use2DRenderer({
  graph,
  selectedId,
  hoveredId,
  filterAgentId,
  search,
  onSelect,
  onHover,
  isDark,
}: {
  graph: GraphData;
  selectedId: string | null;
  hoveredId: string | null;
  filterAgentId: string | null;
  search: string;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  isDark: boolean;
}) {
  const avatarImgRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Pan / zoom / 3D rotation
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const rotXRef = useRef(0.3); // slight initial tilt for nice default view
  const rotYRef = useRef(0);

  // 3D sphere positions (fixed per node, set on graph change)
  const pos3dRef = useRef<Map<string, { x3d: number; y3d: number; z3d: number }>>(new Map());

  // Live 2D projected positions (updated each frame)
  const posRef = useRef<Map<string, LivePos>>(new Map());
  const particlesRef = useRef<Particle[]>([]);

  const rafRef = useRef(0);
  const timeRef = useRef(0);

  // Drag
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Live value refs
  const selectedRef = useRef(selectedId);
  const hoveredRef = useRef(hoveredId);
  const filterRef = useRef(filterAgentId);
  const searchRef = useRef(search);
  selectedRef.current = selectedId;
  hoveredRef.current = hoveredId;
  filterRef.current = filterAgentId;
  searchRef.current = search;

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

  // Place nodes on 3D Fibonacci sphere when graph changes
  useEffect(() => {
    const { agents, mems } = graph;
    const R_AGENTS = Math.max(80, Math.min(160, 50 + agents.length * 10));
    const R_MEMS = R_AGENTS * 1.9;

    const pos3d = new Map<string, { x3d: number; y3d: number; z3d: number }>();
    const positions = new Map<string, LivePos>();

    // Agents on inner Fibonacci sphere
    agents.forEach((a, i) => {
      const p = fibonacciSphere(agents.length, i, R_AGENTS);
      pos3d.set(a.id, { x3d: p.x, y3d: p.y, z3d: p.z });
      positions.set(a.id, { id: a.id, isAgent: true, pinned: true, x: p.x, y: p.y, z: p.z, scale: 1, vx: 0, vy: 0 });
    });

    // Group memories by agent, cluster on outer sphere around agent direction
    const memsByAgent = new Map<string | null, MemNode[]>();
    for (const m of mems) {
      const key = m.agentId ?? null;
      if (!memsByAgent.has(key)) memsByAgent.set(key, []);
      memsByAgent.get(key)!.push(m);
    }

    for (const [agentId, agentMems] of memsByAgent) {
      const agentPos = agentId ? pos3d.get(agentId) : null;
      agentMems.forEach((m, i) => {
        let x3d: number, y3d: number, z3d: number;
        if (agentPos) {
          // Cluster memories around agent direction on outer sphere
          const { x3d: ax, y3d: ay, z3d: az } = agentPos;
          const aN = Math.sqrt(ax * ax + ay * ay + az * az) + 0.001;
          const nx = ax / aN, ny = ay / aN, nz = az / aN;
          // Build tangent basis for spreading memories on sphere surface
          const upX = Math.abs(ny) < 0.9 ? 0 : 1, upY = Math.abs(ny) < 0.9 ? 1 : 0, upZ = 0;
          const dot = upX * nx + upY * ny + upZ * nz;
          const tx = upX - dot * nx, ty = upY - dot * ny, tz = upZ - dot * nz;
          const tN = Math.sqrt(tx * tx + ty * ty + tz * tz) + 0.001;
          const ux = tx / tN, uy = ty / tN, uz = tz / tN;
          const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
          const count = agentMems.length;
          const maxSpread = Math.min(Math.PI * 0.4, 0.2 + count * 0.1);
          const angle = (i / Math.max(count, 1)) * Math.PI * 2;
          const tilt = maxSpread * (0.3 + (i % 4) * 0.18);
          const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const tangX = ux * cosA + vx * sinA, tangY = uy * cosA + vy * sinA, tangZ = uz * cosA + vz * sinA;
          x3d = (nx * cosT + tangX * sinT) * R_MEMS;
          y3d = (ny * cosT + tangY * sinT) * R_MEMS;
          z3d = (nz * cosT + tangZ * sinT) * R_MEMS;
        } else {
          const p = fibonacciSphere(mems.length, mems.indexOf(m), R_MEMS);
          x3d = p.x; y3d = p.y; z3d = p.z;
        }
        pos3d.set(m.id, { x3d, y3d, z3d });
        positions.set(m.id, { id: m.id, isAgent: false, pinned: false, x: x3d, y: y3d, z: z3d, scale: 1, vx: 0, vy: 0 });
      });
    }

    pos3dRef.current = pos3d;
    posRef.current = positions;
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
      const rotX = rotXRef.current;
      const rotY = rotYRef.current;
      const sel = selectedRef.current;
      const hov = hoveredRef.current;
      const fAgent = filterRef.current;
      const q = searchRef.current.toLowerCase();
      const activeId = hov ?? sel;
      const positions = posRef.current;
      const FOV = 800;
      const R_AGENTS = Math.max(80, Math.min(160, 50 + agents.length * 10));
      const R_MEMS = R_AGENTS * 1.9;
      const R_DEPTH = R_MEMS + 60;

      // ── Project all 3D positions → 2D (runs every frame) ──────────────────────
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      for (const [id, p3d] of pos3dRef.current) {
        const { x3d, y3d, z3d } = p3d;
        const rx = x3d * cosY + z3d * sinY;
        const rz1 = -x3d * sinY + z3d * cosY;
        const ry = y3d * cosX - rz1 * sinX;
        const rz = y3d * sinX + rz1 * cosX;
        const perspScale = FOV / (FOV + rz + 50);
        const lp = positions.get(id);
        if (lp) { lp.x = rx * perspScale; lp.y = ry * perspScale; lp.z = rz; lp.scale = perspScale; }
      }

      // ── Tick particles ─────────────────────────────────────────────────────────
      tickParticles(particlesRef.current, w, h);

      // ── Background ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
      if (isDark) {
        bg.addColorStop(0, "#0d0f1a");
        bg.addColorStop(0.6, "#080a12");
        bg.addColorStop(1, "#05060e");
      } else {
        bg.addColorStop(0, "#f8fafc");
        bg.addColorStop(0.6, "#f1f5f9");
        bg.addColorStop(1, "#e2e8f0");
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ── Particles (2D background layer) ────────────────────────────────────────
      const particles = particlesRef.current;
      const CONN_DIST = 90;
      ctx.save();
      ctx.translate(cx + pan.x, cy + pan.y);
      ctx.scale(zoom, zoom);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.15)";
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q2 = particles[j];
          const dx = q2.x - p.x, dy = q2.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONN_DIST) {
            const alpha = (1 - d / CONN_DIST) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q2.x, q2.y);
            ctx.strokeStyle = isDark ? `rgba(99,102,241,${alpha})` : `rgba(99,102,241,${alpha * 0.6})`;
            ctx.lineWidth = 0.5 / zoom;
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // ── 3D Globe scene ─────────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(cx + pan.x, cy + pan.y);
      ctx.scale(zoom, zoom);

      // Draw orbit edges (mem → agent) with depth fade
      ctx.setLineDash([4, 5]);
      for (const edge of edges) {
        if (edge.type !== "orbit") continue;
        const sp = positions.get(edge.source);
        const tp = positions.get(edge.target);
        if (!sp || !tp) continue;
        const mem = memById.get(edge.source);
        if (!mem) continue;
        const visFilter = !fAgent || mem.agentId === fAgent;
        const visSearch = !q || mem.title.toLowerCase().includes(q);
        if (!visFilter && !visSearch) continue;
        const isActive = edge.source === activeId || edge.target === activeId;
        const midZ = (sp.z + tp.z) / 2;
        const dAlpha = Math.min(1, Math.max(0.03, 1 - midZ / R_DEPTH * 0.75));
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.strokeStyle = rgba(mem.agentColor, (isActive ? 0.45 : 0.12) * dAlpha);
        ctx.lineWidth = isActive ? 1.5 : 0.6;
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw link edges (mem → mem)
      for (const edge of edges) {
        if (edge.type !== "link") continue;
        const sp = positions.get(edge.source);
        const tp = positions.get(edge.target);
        if (!sp || !tp) continue;
        const sm = memById.get(edge.source);
        const tm = memById.get(edge.target);
        if (!sm || !tm) continue;
        const isActive = edge.source === activeId || edge.target === activeId;
        const midZ = (sp.z + tp.z) / 2;
        const dAlpha = Math.min(1, Math.max(0.03, 1 - midZ / R_DEPTH * 0.75));
        const grad = ctx.createLinearGradient(sp.x, sp.y, tp.x, tp.y);
        grad.addColorStop(0, rgba(sm.agentColor, (isActive ? 0.7 : 0.25) * dAlpha));
        grad.addColorStop(1, rgba(tm.agentColor, (isActive ? 0.7 : 0.25) * dAlpha));
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();
      }

      // Draw all nodes sorted back-to-front (painter's algorithm for correct occlusion)
      const drawOrder: Array<{ type: "agent"; node: AgentNode } | { type: "mem"; node: MemNode }> = [
        ...agents.map((a) => ({ type: "agent" as const, node: a })),
        ...mems.map((m) => ({ type: "mem" as const, node: m })),
      ];
      drawOrder.sort((a, b) => (positions.get(b.node.id)?.z ?? 0) - (positions.get(a.node.id)?.z ?? 0));

      for (const item of drawOrder) {
        if (item.type === "mem") {
          const mem = item.node;
          const pos = positions.get(mem.id);
          if (!pos) continue;
          const visFilter = !fAgent || mem.agentId === fAgent;
          const visSearch = !q || mem.title.toLowerCase().includes(q);
          const vis = visFilter && visSearch;
          const isHov = hov === mem.id;
          const isSel = sel === mem.id;
          const isDimmed = !vis || (!!activeId && activeId !== mem.id && activeId !== mem.agentId);
          const dAlpha = Math.min(1, Math.max(0.08, 1 - pos.z / R_DEPTH * 0.72));
          const alpha = (isDimmed ? 0.15 : 0.95) * dAlpha;
          const color = typeColor(mem.memoryType);
          const r = mem.r * pos.scale; // perspective-scaled radius

          ctx.globalAlpha = alpha;

          const glowR = r * (isHov || isSel ? 4 : 2.5);
          const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
          glow.addColorStop(0, rgba(color, isHov || isSel ? 0.35 : 0.15));
          glow.addColorStop(1, rgba(color, 0));
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.shadowBlur = isHov || isSel ? 18 : 8;
          ctx.shadowColor = color;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fillStyle = rgba(color, 0.25);
          ctx.strokeStyle = rgba(color, isSel ? 1 : isHov ? 0.9 : 0.65);
          ctx.lineWidth = isSel ? 2 : 1.2;
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = rgba(color, 0.9);
          ctx.fill();

          if (isHov || isSel) {
            const lbl = mem.title.length > 28 ? mem.title.slice(0, 28) + "…" : mem.title;
            ctx.font = `500 11px Inter, system-ui, sans-serif`;
            const tw = ctx.measureText(lbl).width;
            const lx = pos.x - tw / 2;
            const ly = pos.y - r - 10;
            ctx.fillStyle = isDark ? "rgba(8,10,18,0.9)" : "rgba(255,255,255,0.95)";
            ctx.beginPath();
            (ctx as any).roundRect?.(lx - 6, ly - 13, tw + 12, 18, 4);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.fillText(lbl, pos.x, ly);
            ctx.textAlign = "left";
          }

          ctx.globalAlpha = 1;
        } else {
          const agent = item.node;
          const pos = positions.get(agent.id);
          if (!pos) continue;
          const isHov = hov === agent.id;
          const isSel = sel === agent.id;
          const isActive = activeId === agent.id || (activeId ? memById.get(activeId)?.agentId === agent.id : false);
          const isDimmed = !!activeId && !isActive;
          const pulse = 1 + Math.sin(t * 2.2 + agents.indexOf(agent)) * 0.06;
          const dAlpha = Math.min(1, Math.max(0.12, 1 - pos.z / R_DEPTH * 0.7));
          const r = agent.r * pos.scale * pulse;
          const color = agent.color;

          ctx.globalAlpha = (isDimmed ? 0.2 : 1) * dAlpha;

          const haloR = r * (isSel || isHov ? 3.2 : 2.5);
          const halo = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, haloR);
          halo.addColorStop(0, rgba(color, isSel ? 0.3 : 0.15));
          halo.addColorStop(1, rgba(color, 0));
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, haloR, 0, Math.PI * 2);
          ctx.fillStyle = halo;
          ctx.fill();

          const avatarImg = avatarImgRef.current.get(agent.id);
          const hasAvatar = avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0;

          if (hasAvatar) {
            // Draw clipped avatar image
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, pos.x - r, pos.y - r, r * 2, r * 2);
            ctx.restore();

            // Border
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
            ctx.shadowBlur = isSel || isHov ? 40 : 25;
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

          // Draw agent initial as fallback when no avatar
          if (!hasAvatar) {
            const initial = agent.name.trim().charAt(0).toUpperCase() || "?";
            ctx.font = `bold ${Math.max(10, r * 0.6)}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = isDark ? "#ffffff" : "#ffffff";
            ctx.fillText(initial, pos.x, pos.y);
            ctx.textBaseline = "alphabetic";
          }

          ctx.globalAlpha = (isDimmed ? 0.15 : 1) * dAlpha;

          ctx.font = `700 12px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          const lbl = agent.name;
          const tw = ctx.measureText(lbl).width;
          ctx.fillStyle = isDark ? "rgba(5,7,14,0.75)" : "rgba(255,255,255,0.9)";
          ctx.beginPath();
          (ctx as any).roundRect?.(pos.x - tw / 2 - 5, pos.y + r + 5, tw + 10, 16, 3);
          ctx.fill();
          ctx.fillStyle = isSel || isHov ? (isDark ? "#ffffff" : "#0f172a") : rgba(color, 0.95);
          ctx.fillText(lbl, pos.x, pos.y + r + 17);
          ctx.textAlign = "left";

          if (agent.hasMemories) {
            ctx.font = `400 10px Inter, system-ui, sans-serif`;
            ctx.fillStyle = rgba(color, 0.5);
            ctx.textAlign = "center";
            ctx.fillText(`${agent.memCount} mem`, pos.x, pos.y + r + 31);
            ctx.textAlign = "left";
          } else {
            ctx.font = `400 10px Inter, system-ui, sans-serif`;
            ctx.fillStyle = rgba(color, 0.35);
            ctx.textAlign = "center";
            ctx.fillText("no memories", pos.x, pos.y + r + 31);
            ctx.textAlign = "left";
          }

          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [graph, size]);

  // ── Hit testing (in world coords) ─────────────────────────────────────────────

  const hitTest = useCallback((canvasX: number, canvasY: number): string | null => {
    const { agents, mems } = graph;
    const { w, h } = size;
    const pan = panRef.current;
    const zoom = zoomRef.current;
    const positions = posRef.current;
    // pos.x/y are already perspective-projected; just undo translate+scale
    const wx = (canvasX - w / 2 - pan.x) / zoom;
    const wy = (canvasY - h / 2 - pan.y) / zoom;

    let best: { id: string; d2: number } | null = null;
    for (const a of agents) {
      const pos = positions.get(a.id);
      if (!pos) continue;
      const dx = wx - pos.x, dy = wy - pos.y;
      const d2 = dx * dx + dy * dy;
      const hitR = a.r * pos.scale + 6;
      if (d2 <= hitR * hitR && (!best || d2 < best.d2)) best = { id: a.id, d2 };
    }
    for (const m of mems) {
      const pos = positions.get(m.id);
      if (!pos) continue;
      const dx = wx - pos.x, dy = wy - pos.y;
      const d2 = dx * dx + dy * dy;
      const hitR = Math.max(m.r * pos.scale + 5, 8);
      if (d2 <= hitR * hitR && (!best || d2 < best.d2)) best = { id: m.id, d2 };
    }
    return best?.id ?? null;
  }, [graph, size]);

  // ── Mouse events ──────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    hasDragged.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - lastMouse.current.x;
      const dy = ev.clientY - lastMouse.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDragged.current = true;
      // Drag rotates the 3D globe: horizontal → yaw, vertical → pitch
      const ROT_SPEED = 0.005;
      rotYRef.current += dx * ROT_SPEED;
      rotXRef.current += dy * ROT_SPEED;
      lastMouse.current = { x: ev.clientX, y: ev.clientY };
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

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
    zoomRef.current = Math.max(0.2, Math.min(4, zoomRef.current * factor));
  }, []);

  const resetView = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    zoomRef.current = 1.0;
    rotXRef.current = 0.3;
    rotYRef.current = 0;
  }, []);

  return { canvasRef, containerRef, size, handleMouseDown, handleClick, handleMouseMove, handleMouseLeave, handleWheel, resetView };
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
    const connected = allLinks
      .filter((l) => l.sourceMemoryId === mem.id || l.targetMemoryId === mem.id)
      .map((l) => {
        const id = l.sourceMemoryId === mem.id ? l.targetMemoryId : l.sourceMemoryId;
        return allMemories.find((m) => m.id === id);
      }).filter(Boolean) as AgentMemory[];

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
          {connected.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Linked ({connected.length})</p>
              <div className="flex flex-col gap-1">
                {connected.map((c) => (
                  <button key={c.id} onClick={() => onSelectNode(c.id)}
                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-accent transition-colors text-left">
                    <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: typeColor(c.memoryType) }} />
                    <span className="truncate text-foreground/70">{c.title}</span>
                  </button>
                ))}
              </div>
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
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[480px] p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
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
  const [targetId, setTargetId] = useState(""); const [relType, setRelType] = useState("related_to"); const [label, setLabel] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[420px] p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
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
          {["related_to","supports","contradicts","precedes","derived_from","example_of"].map((r) => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);

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
    use2DRenderer({ graph: graphData, selectedId, hoveredId, filterAgentId, search, onSelect: setSelectedId, onHover: setHoveredId, isDark });

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
            <div className="relative max-w-48">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories…"
                className="w-full rounded-md border border-border bg-muted/40 pl-7 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary/50" />
            </div>
            <ScrollArea className="max-w-full" type="scroll">
              <div className="flex items-center gap-1.5 w-max pb-0.5">
                <button
                  onClick={() => setFilterAgentId(null)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border shrink-0",
                    !filterAgentId
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
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
                        isActive
                          ? ""
                          : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      style={
                        isActive
                          ? { color: a.color, background: `${a.color}18`, borderColor: `${a.color}60` }
                          : {}
                      }
                    >
                      <span
                        className="flex items-center justify-center rounded-full text-[9px] font-bold w-4 h-4 shrink-0"
                        style={{ background: `${a.color}40`, color: a.color, border: `1px solid ${a.color}60` }}
                      >
                        {initials}
                      </span>
                      {a.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" className="h-1" />
            </ScrollArea>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
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

          {!isEmpty && (
            <>
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg border border-border bg-background/90 px-3 py-2.5 text-[10px] backdrop-blur">
                <p className="font-semibold text-foreground/70 mb-0.5">Legend</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-3 w-3 rounded-full border border-amber-400 bg-amber-400/30" /><span>Agent (with memories)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-3 w-3 rounded-full border border-dashed border-violet-400" /><span>Agent (no memories)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-2 w-2 rounded-full border border-indigo-400 bg-indigo-400/20" /><span>Memory node</span>
                </div>
              </div>
              <p className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-muted-foreground/40">
                Drag nodes · Scroll to zoom · Click to inspect
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

