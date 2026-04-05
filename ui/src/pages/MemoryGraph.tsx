import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Link2, Trash2, Search, Brain, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompany } from "../context/CompanyContext";
import { agentMemoriesApi, type AgentMemory, type AgentMemoryLink } from "../api/agentMemories";
import { queryKeys } from "../lib/queryKeys";

// ── Palette ───────────────────────────────────────────────────────────────────

const AGENT_COLORS = [
  "#f59e0b", "#818cf8", "#34d399", "#f472b6",
  "#38bdf8", "#fb923c", "#a78bfa", "#4ade80",
];
const MEMORY_TYPE_COLORS: Record<string, string> = {
  fact: "#6366f1", insight: "#8b5cf6", decision: "#ec4899",
  pattern: "#f59e0b", task: "#10b981", observation: "#3b82f6", learning: "#06b6d4",
};
function typeColor(t: string) { return MEMORY_TYPE_COLORS[t] ?? "#94a3b8"; }
const MEMORY_TYPES = ["fact", "insight", "decision", "pattern", "task", "observation", "learning"];

// ── 3-D Math ─────────────────────────────────────────────────────────────────

type Vec3 = [number, number, number];

function rotY([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function rotX([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

/** Perspective projection — camera at (0,0,-dist), looking at origin */
function project(v: Vec3, dist: number, cx: number, cy: number) {
  const z = v[2] + dist;
  const scale = dist / Math.max(z, 1);
  return { sx: cx + v[0] * scale, sy: cy + v[1] * scale, scale, depth: v[2] };
}

/** Fibonacci sphere — evenly distributes n points on unit sphere */
function fibSphere(n: number): Vec3[] {
  const phi = Math.PI * (Math.sqrt(5) - 1);
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = phi * i;
    return [r * Math.cos(t), y, r * Math.sin(t)] as Vec3;
  });
}

/** Cross product */
function cross([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}
function normalize([x, y, z]: Vec3): Vec3 {
  const l = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / l, y / l, z / l];
}
function scale([x, y, z]: Vec3, s: number): Vec3 { return [x * s, y * s, z * s]; }
function add([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 { return [ax + bx, ay + by, az + bz]; }

/** Orbit a point around a center normal in 3D */
function orbitAround(center: Vec3, normal: Vec3, radius: number, angle: number): Vec3 {
  const up: Vec3 = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = normalize(cross(normal, up));
  const t2 = normalize(cross(normal, t1));
  return add(center, add(scale(t1, radius * Math.cos(angle)), scale(t2, radius * Math.sin(angle))));
}

// ── Node data ─────────────────────────────────────────────────────────────────

interface Agent3D {
  id: string;
  name: string;
  color: string;
  memCount: number;
  pos: Vec3;       // unit-sphere position (pre-rotation base)
  r: number;       // visual radius
}

interface Mem3D {
  id: string;
  title: string;
  content: string;
  memoryType: string;
  agentId: string | null;
  agentColor: string;
  orbitNormal: Vec3;
  orbitRadius: number;
  orbitOffset: number;  // phase offset
  orbitSpeed: number;
  agentPos: Vec3;
  r: number;
  raw: AgentMemory;
}

interface GraphData {
  agents: Agent3D[];
  mems: Mem3D[];
  agentEdges: Array<[number, number]>; // indices
}

function buildGraph3D(memories: AgentMemory[], links: AgentMemoryLink[]): GraphData {
  const agentInfo = new Map<string, { name: string; count: number; colorIdx: number }>();
  let colorIdx = 0;
  for (const m of memories) {
    for (const a of m.agents) {
      if (!agentInfo.has(a.agentId)) {
        agentInfo.set(a.agentId, { name: a.agentName ?? "Agent", count: 0, colorIdx: colorIdx++ });
      }
      agentInfo.get(a.agentId)!.count++;
    }
  }

  const agentIds = [...agentInfo.keys()];
  const spherePositions = fibSphere(Math.max(agentIds.length, 1));

  const agents: Agent3D[] = agentIds.map((id, i) => {
    const info = agentInfo.get(id)!;
    return {
      id, name: info.name,
      color: AGENT_COLORS[info.colorIdx % AGENT_COLORS.length],
      memCount: info.count,
      pos: spherePositions[i],
      r: 18 + Math.min(info.count * 1.5, 10),
    };
  });

  const agentById = new Map(agents.map((a) => [a.id, a]));

  // Memory nodes grouped by agent
  const byAgent = new Map<string, AgentMemory[]>();
  const orphans: AgentMemory[] = [];
  for (const m of memories) {
    const owner = m.agents.find((a) => a.isOwner) ?? m.agents[0];
    if (owner) {
      const list = byAgent.get(owner.agentId) ?? [];
      list.push(m);
      byAgent.set(owner.agentId, list);
    } else {
      orphans.push(m);
    }
  }

  const mems: Mem3D[] = [];
  for (const agent of agents) {
    const agentMems = byAgent.get(agent.id) ?? [];
    const count = agentMems.length;
    const orbitR = agent.r * 0.09 + 0.12; // in sphere-space units
    agentMems.forEach((m, j) => {
      mems.push({
        id: m.id, title: m.title, content: m.content ?? "",
        memoryType: m.memoryType, agentId: agent.id, agentColor: agent.color,
        orbitNormal: agent.pos,
        orbitRadius: orbitR,
        orbitOffset: (2 * Math.PI * j) / Math.max(count, 1),
        orbitSpeed: 0.2 + Math.random() * 0.15,
        agentPos: agent.pos,
        r: 6 + Math.min((m.content?.length ?? 0) / 80, 4),
        raw: m,
      });
    });
  }

  // Agent-to-agent edges from memory links
  const agentEdgeSet = new Set<string>();
  const agentEdges: Array<[number, number]> = [];
  for (const link of links) {
    const sm = mems.find((n) => n.id === link.sourceMemoryId);
    const tm = mems.find((n) => n.id === link.targetMemoryId);
    if (!sm?.agentId || !tm?.agentId || sm.agentId === tm.agentId) continue;
    const ai = agents.findIndex((a) => a.id === sm.agentId);
    const bi = agents.findIndex((a) => a.id === tm.agentId);
    if (ai < 0 || bi < 0) continue;
    const key = [ai, bi].sort().join(":");
    if (!agentEdgeSet.has(key)) { agentEdgeSet.add(key); agentEdges.push([ai, bi]); }
  }

  return { agents, mems, agentEdges };
}

// ── Hex helpers ───────────────────────────────────────────────────────────────

function hexRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
function rgba(hex: string, a: number) { return `rgba(${hexRgb(hex)},${a})`; }

// ── 3D Canvas Renderer ────────────────────────────────────────────────────────

const SPHERE_R = 220;   // px radius of agent sphere at zoom=1
const CAM_DIST = 700;   // camera distance

function use3DRenderer({
  graph,
  selectedId,
  hoveredId,
  filterAgentId,
  search,
  onSelect,
  onHover,
}: {
  graph: GraphData;
  selectedId: string | null;
  hoveredId: string | null;
  filterAgentId: string | null;
  search: string;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Rotation state
  const rotYRef = useRef(0);
  const rotXRef = useRef(-0.25);
  const zoomRef = useRef(1.0);
  const timeRef = useRef(0);
  const rafRef = useRef(0);

  // Drag
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // Refs for live values
  const selectedRef = useRef(selectedId);
  const hoveredRef = useRef(hoveredId);
  const filterRef = useRef(filterAgentId);
  const searchRef = useRef(search);
  selectedRef.current = selectedId;
  hoveredRef.current = hoveredId;
  filterRef.current = filterAgentId;
  searchRef.current = search;

  // Resize
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

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { agents, mems, agentEdges } = graph;
    const { w, h } = size;
    const cx = w / 2, cy = h / 2;
    const zoom = zoomRef.current;

    const draw = () => {
      timeRef.current += 0.008;
      const t = timeRef.current;
      const rY = rotYRef.current;
      const rX = rotXRef.current;
      const z = zoomRef.current;
      const dist = CAM_DIST / z;
      const r = SPHERE_R * z;
      const sel = selectedRef.current;
      const hov = hoveredRef.current;
      const fAgent = filterRef.current;
      const q = searchRef.current.toLowerCase();
      const activeId = hov ?? sel;

      ctx.clearRect(0, 0, w, h);

      // Dark deep-space background
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
      bg.addColorStop(0, "#10121a");
      bg.addColorStop(0.5, "#0b0d14");
      bg.addColorStop(1, "#06080e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ── Compute all projected positions ──
      type Projected = { id: string; sx: number; sy: number; scale: number; depth: number; type: "agent" | "mem"; idx: number };
      const projected: Projected[] = [];

      // Project agent positions
      const agentProj: Array<{ sx: number; sy: number; scale: number; depth: number }> = agents.map((a) => {
        let v: Vec3 = scale(a.pos, r);
        v = rotY(v, rY + t * 0.15);
        v = rotX(v, rX);
        const p = project(v, dist, cx, cy);
        projected.push({ id: a.id, sx: p.sx, sy: p.sy, scale: p.scale, depth: p.depth, type: "agent", idx: agents.indexOf(a) });
        return p;
      });

      // Project memory positions (orbiting their agents)
      const memProj: Array<{ sx: number; sy: number; scale: number; depth: number }> = mems.map((m) => {
        const angle = m.orbitOffset + t * m.orbitSpeed;
        // orbit in 3D around agent pos on sphere
        let agentV: Vec3 = scale(m.agentPos, r);
        const orbitPt = orbitAround(agentV, m.orbitNormal, r * m.orbitRadius * 1.6, angle);
        let v: Vec3 = orbitPt;
        v = rotY(v, rY + t * 0.15);
        v = rotX(v, rX);
        const p = project(v, dist, cx, cy);
        projected.push({ id: m.id, sx: p.sx, sy: p.sy, scale: p.scale, depth: p.depth, type: "mem", idx: mems.indexOf(m) });
        return p;
      });

      // ── Wireframe sphere ──
      const wireAlpha = 0.06;
      ctx.strokeStyle = `rgba(150,170,220,${wireAlpha})`;
      ctx.lineWidth = 0.5;

      // Latitude circles
      const latCount = 5;
      for (let li = 1; li < latCount; li++) {
        const phi = (Math.PI * li) / latCount;
        const circleR = Math.sin(phi) * r;
        const circleY = Math.cos(phi) * r;
        const segs = 64;
        ctx.beginPath();
        for (let si = 0; si <= segs; si++) {
          const theta = (2 * Math.PI * si) / segs;
          let v: Vec3 = [circleR * Math.cos(theta), circleY, circleR * Math.sin(theta)];
          v = rotY(v, rY + t * 0.15);
          v = rotX(v, rX);
          const p = project(v, dist, cx, cy);
          if (si === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      }

      // Longitude lines
      const lonCount = 6;
      for (let li = 0; li < lonCount; li++) {
        const theta = (Math.PI * li) / lonCount;
        const segs = 64;
        ctx.beginPath();
        for (let si = 0; si <= segs; si++) {
          const phi = (Math.PI * si) / segs;
          let v: Vec3 = [Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(theta) * r];
          v = rotY(v, rY + t * 0.15);
          v = rotX(v, rX);
          const p = project(v, dist, cx, cy);
          if (si === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      }

      // Center gravity glow
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.25);
      cg.addColorStop(0, "rgba(99,102,241,0.15)");
      cg.addColorStop(0.5, "rgba(99,102,241,0.05)");
      cg.addColorStop(1, "rgba(99,102,241,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(99,102,241,0.6)";
      ctx.fill();

      // ── Draw agent-to-agent edges ──
      for (const [ai, bi] of agentEdges) {
        const ap = agentProj[ai], bp = agentProj[bi];
        if (!ap || !bp) continue;
        const depthFade = Math.min(1, (ap.scale + bp.scale) / 2);
        const isActive = agents[ai].id === activeId || agents[bi].id === activeId;
        ctx.beginPath();
        ctx.moveTo(ap.sx, ap.sy);
        ctx.lineTo(bp.sx, bp.sy);
        ctx.strokeStyle = `rgba(148,163,184,${isActive ? 0.5 * depthFade : 0.15 * depthFade})`;
        ctx.lineWidth = isActive ? 1.5 : 0.7;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // ── Draw mem-to-agent edges ──
      ctx.setLineDash([3, 4]);
      for (let i = 0; i < mems.length; i++) {
        const m = mems[i];
        const agentIdx = agents.findIndex((a) => a.id === m.agentId);
        if (agentIdx < 0) continue;
        const ap = agentProj[agentIdx];
        const mp = memProj[i];
        if (!ap || !mp) continue;
        const visFilter = !fAgent || m.agentId === fAgent;
        const visSearch = !q || m.title.toLowerCase().includes(q);
        const vis = visFilter && visSearch;
        const isActive = m.id === activeId || m.agentId === activeId;
        const depthFade = Math.min(1, (ap.scale + mp.scale) / 2);
        ctx.beginPath();
        ctx.moveTo(ap.sx, ap.sy);
        ctx.lineTo(mp.sx, mp.sy);
        ctx.strokeStyle = rgba(m.agentColor, vis ? (isActive ? 0.6 * depthFade : 0.18 * depthFade) : 0.04);
        ctx.lineWidth = isActive ? 1 : 0.4;
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // ── Sort all for Z-order draw ──
      const sorted = [...projected].sort((a, b) => a.depth - b.depth);

      for (const node of sorted) {
        if (node.type === "agent") {
          const a = agents[node.idx];
          const p = agentProj[node.idx];
          const isSel = sel === a.id;
          const isHov = hov === a.id;
          const memHov = hov ? mems.find((m) => m.id === hov)?.agentId === a.id : false;
          const isDimmed = !!activeId && !isSel && !isHov && !memHov && !(mems.find((m) => m.id === activeId)?.agentId === a.id);
          const nodeR = a.r * p.scale * z;
          const depthAlpha = 0.4 + 0.6 * p.scale;
          ctx.globalAlpha = isDimmed ? 0.15 : depthAlpha;

          // Outer pulse ring
          const pulseR = nodeR * (1.55 + Math.sin(t * 2.5 + node.idx) * 0.08);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(a.color, 0.22);
          ctx.lineWidth = 1;
          ctx.stroke();

          // Dashed orbit ring
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, nodeR * 1.28, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(a.color, 0.35);
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.setLineDash([]);

          // Glow halo
          const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, nodeR * 2.2);
          glow.addColorStop(0, rgba(a.color, 0.22));
          glow.addColorStop(1, rgba(a.color, 0));
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, nodeR * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          // Main sphere gradient
          const sphere = ctx.createRadialGradient(p.sx - nodeR * 0.3, p.sy - nodeR * 0.3, 0, p.sx, p.sy, nodeR);
          sphere.addColorStop(0, rgba(a.color, 0.95));
          sphere.addColorStop(0.7, rgba(a.color, 0.55));
          sphere.addColorStop(1, rgba(a.color, 0.2));
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, nodeR, 0, Math.PI * 2);
          ctx.fillStyle = sphere;
          ctx.fill();
          ctx.strokeStyle = rgba(a.color, isSel ? 1 : 0.7);
          ctx.lineWidth = isSel ? 2 : 1.2;
          ctx.stroke();

          // Inner bright dot
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, nodeR * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = rgba(a.color, 0.95);
          ctx.fill();

          ctx.globalAlpha = isDimmed ? 0.1 : depthAlpha;

          // Name label
          const fontSize = Math.max(9, Math.min(13, 11 * p.scale * z));
          ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = rgba(a.color, isSel || isHov ? 1 : 0.85);
          ctx.textAlign = "center";
          ctx.fillText(a.name, p.sx, p.sy + nodeR + fontSize + 2);

          ctx.font = `400 ${Math.max(7, fontSize - 2)}px 'JetBrains Mono', monospace`;
          ctx.fillStyle = rgba(a.color, 0.4);
          ctx.fillText(`${a.memCount} mem`, p.sx, p.sy + nodeR + fontSize * 2 + 3);

          ctx.globalAlpha = 1;
          ctx.textAlign = "left";

        } else {
          // Memory node
          const m = mems[node.idx];
          const p = memProj[node.idx];
          const visFilter = !fAgent || m.agentId === fAgent;
          const visSearch = !q || m.title.toLowerCase().includes(q);
          const vis = visFilter && visSearch;
          const isHov = hov === m.id;
          const isSel = sel === m.id;
          const isDimmed = !vis || (!!activeId && activeId !== m.id && activeId !== m.agentId);
          const nodeR = m.r * p.scale * z;
          const depthAlpha = 0.35 + 0.65 * p.scale;
          ctx.globalAlpha = isDimmed ? 0.08 : depthAlpha;

          if (isHov || isSel) {
            const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, nodeR * 3);
            g.addColorStop(0, rgba(m.agentColor, 0.3));
            g.addColorStop(1, rgba(m.agentColor, 0));
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, nodeR * 3, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }

          // Outer ring
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, nodeR, 0, Math.PI * 2);
          ctx.fillStyle = rgba(m.agentColor, 0.12);
          ctx.fill();
          ctx.strokeStyle = rgba(m.agentColor, isSel ? 0.95 : isHov ? 0.8 : 0.5);
          ctx.lineWidth = isSel ? 1.5 : 1;
          ctx.stroke();

          // Inner dot
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, nodeR * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = rgba(m.agentColor, isSel || isHov ? 1 : 0.9);
          ctx.fill();

          ctx.globalAlpha = isDimmed ? 0.06 : depthAlpha;

          // Hover/select label
          if (isHov || isSel) {
            const label = m.title.length > 26 ? m.title.slice(0, 26) + "…" : m.title;
            const fontSize = Math.max(9, 10 * p.scale * z);
            ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
            const tw = ctx.measureText(label).width;
            const lx = p.sx - tw / 2;
            const ly = p.sy - nodeR - 8;
            ctx.fillStyle = "rgba(12,14,22,0.88)";
            ctx.beginPath();
            (ctx as any).roundRect(lx - 5, ly - fontSize, tw + 10, fontSize + 6, 3);
            ctx.fill();
            ctx.fillStyle = m.agentColor;
            ctx.textAlign = "center";
            ctx.fillText(label, p.sx, ly);
            ctx.textAlign = "left";
          }

          ctx.globalAlpha = 1;
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [graph, size]);

  // ── Hit testing ──────────────────────────────────────────────────────────────

  const hitTest = useCallback((canvasX: number, canvasY: number): string | null => {
    const { agents, mems } = graph;
    const r = SPHERE_R * zoomRef.current;
    const rY = rotYRef.current;
    const rX = rotXRef.current;
    const t = timeRef.current;
    const dist = CAM_DIST / zoomRef.current;
    const { w, h } = size;
    const cx = w / 2, cy = h / 2;
    const z = zoomRef.current;

    let best: { id: string; distSq: number } | null = null;

    // Check agents
    for (const a of agents) {
      let v: Vec3 = scale(a.pos, r);
      v = rotY(v, rY + t * 0.15);
      v = rotX(v, rX);
      const p = project(v, dist, cx, cy);
      const nodeR = a.r * p.scale * z;
      const dx = canvasX - p.sx, dy = canvasY - p.sy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= (nodeR + 4) * (nodeR + 4)) {
        if (!best || d2 < best.distSq) best = { id: a.id, distSq: d2 };
      }
    }

    // Check memories
    for (let i = 0; i < mems.length; i++) {
      const m = mems[i];
      const angle = m.orbitOffset + t * m.orbitSpeed;
      let agentV: Vec3 = scale(m.agentPos, r);
      const orbitPt = orbitAround(agentV, m.orbitNormal, r * m.orbitRadius * 1.6, angle);
      let v: Vec3 = orbitPt;
      v = rotY(v, rY + t * 0.15);
      v = rotX(v, rX);
      const p = project(v, dist, cx, cy);
      const nodeR = m.r * p.scale * z;
      const dx = canvasX - p.sx, dy = canvasY - p.sy;
      const d2 = dx * dx + dy * dy;
      const hitR = Math.max(nodeR + 6, 12);
      if (d2 <= hitR * hitR) {
        if (!best || d2 < best.distSq) best = { id: m.id, distSq: d2 };
      }
    }

    return best?.id ?? null;
  }, [graph, size]);

  // ── Mouse events ─────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    hasDragged.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - lastMouse.current.x;
      const dy = ev.clientY - lastMouse.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDragged.current = true;
      rotYRef.current += dx * 0.006;
      rotXRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotXRef.current + dy * 0.006));
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
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    zoomRef.current = Math.max(0.3, Math.min(3, zoomRef.current * factor));
  }, []);

  const resetView = useCallback(() => {
    rotYRef.current = 0;
    rotXRef.current = -0.25;
    zoomRef.current = 1.0;
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mt-2">Activity</p>
          <div className="flex items-end gap-0.5 h-10">
            {Array.from({ length: 14 }, (_, i) => {
              const h = 18 + Math.sin(i * 1.3 + agent.id.length) * 12;
              return <div key={i} className="flex-1 rounded-t-sm"
                style={{ height: `${h}px`, background: agent.color, opacity: 0.25 + (i / 14) * 0.55 }} />;
            })}
          </div>
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
            <span className="rounded-full px-2.5 py-1 text-[10px] font-medium capitalize text-white"
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
          <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed whitespace-pre">
            <span className="text-muted-foreground/40">// </span>
            {ownerAgent && <span style={{ color: ownerAgent.color }}>@{ownerAgent.name}</span>}
            {"\n"}
            <span className="text-muted-foreground/60">type: </span>
            <span style={{ color: typeColor(mem.memoryType) }}>"{mem.memoryType}"</span>
            {"\n"}
            <span className="text-muted-foreground/60">active: </span>
            <span className="text-emerald-500">true</span>
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
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
                memoryType === t ? "text-white border-transparent" : "border-border text-muted-foreground hover:border-foreground/30")}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
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

  const memories = graph?.memories ?? [];
  const links = graph?.links ?? [];

  const graphData = useMemo(() => buildGraph3D(memories, links), [memories, links]);

  const { canvasRef, containerRef, size, handleMouseDown, handleClick, handleMouseMove, handleMouseLeave, handleWheel, resetView } =
    use3DRenderer({ graph: graphData, selectedId, hoveredId, filterAgentId, search, onSelect: setSelectedId, onHover: setHoveredId });

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Memory Graph</span>
          {memories.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
              {agents.length} agents · {memories.length} nodes
            </span>
          )}
        </div>

        {memories.length > 0 && (
          <>
            <div className="relative max-w-48">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories…"
                className="w-full rounded-md border border-border bg-muted/40 pl-7 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary/50" />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setFilterAgentId(null)}
                className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border",
                  !filterAgentId ? "bg-foreground text-background border-transparent" : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground")}>
                All
              </button>
              {agents.map((a) => (
                <button key={a.id} onClick={() => setFilterAgentId(filterAgentId === a.id ? null : a.id)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors"
                  style={filterAgentId === a.id
                    ? { color: a.color, background: `${a.color}18`, borderColor: `${a.color}50` }
                    : { color: "hsl(var(--muted-foreground))", background: "transparent", borderColor: "hsl(var(--border))" }}>
                  {a.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {memories.length > 0 && (
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
          ) : memories.length === 0 ? (
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

          {memories.length > 0 && (
            <>
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg border border-border bg-background/90 px-3 py-2.5 text-[10px] backdrop-blur">
                <p className="font-semibold text-foreground/70 mb-0.5">Legend</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-3 w-3 rounded-full border border-amber-400 bg-amber-400/20" /><span>Agent Node</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-2 w-2 rounded-full border border-indigo-400 bg-indigo-400/20" /><span>Memory Node</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-4 border-t border-dashed border-muted-foreground/40" /><span>Orbit link</span>
                </div>
              </div>
              <p className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-muted-foreground/40">
                Drag to rotate · Scroll to zoom · Click to inspect
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
