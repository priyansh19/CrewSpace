import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Link2, Trash2, Brain, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompany } from "../context/CompanyContext";
import { agentMemoriesApi, type AgentMemory, type AgentMemoryLink } from "../api/agentMemories";
import { queryKeys } from "../lib/queryKeys";

// ── Constants ─────────────────────────────────────────────────────────────────

const MEMORY_TYPE_COLORS: Record<string, string> = {
  fact: "#6366f1",
  insight: "#8b5cf6",
  decision: "#ec4899",
  pattern: "#f59e0b",
  task: "#10b981",
  observation: "#3b82f6",
  learning: "#06b6d4",
};

function typeColor(type: string) {
  return MEMORY_TYPE_COLORS[type] ?? "#94a3b8";
}

const MEMORY_TYPES = ["fact", "insight", "decision", "pattern", "task", "observation", "learning"];

// ── 2D Force Simulation ───────────────────────────────────────────────────────

interface Node2D {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function use2DSimulation(
  memories: AgentMemory[],
  allLinks: Array<{ sourceId: string; targetId: string }>,
) {
  const nodesRef = useRef<Map<string, Node2D>>(new Map());
  const frameRef = useRef<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (memories.length === 0) return;

    const spread = Math.sqrt(memories.length) * 60;

    // Seed new nodes
    for (const m of memories) {
      if (!nodesRef.current.has(m.id)) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        nodesRef.current.set(m.id, {
          id: m.id,
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          vx: 0,
          vy: 0,
        });
      }
    }
    for (const id of nodesRef.current.keys()) {
      if (!memories.find((m) => m.id === id)) nodesRef.current.delete(id);
    }

    const k = Math.sqrt((spread * spread * 2) / Math.max(memories.length, 1)) * 1.8;
    let temp = 30;
    let frame = 0;

    const simulate = () => {
      const nodes = [...nodesRef.current.values()];
      const step = Math.min(temp, 12);

      // Repulsion between all pairs
      for (let i = 0; i < nodes.length; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.5);
          const f = (k * k) / d;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
        // Center gravity — strong enough to counteract repulsion
        fx -= nodes[i].x * 0.06;
        fy -= nodes[i].y * 0.06;

        nodes[i].vx = (nodes[i].vx + fx) * 0.55;
        nodes[i].vy = (nodes[i].vy + fy) * 0.55;
      }

      // Link attraction (spring)
      for (const link of allLinks) {
        const a = nodesRef.current.get(link.sourceId);
        const b = nodesRef.current.get(link.targetId);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.5);
        const f = (d * d) / k * 0.5;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Integrate
      for (const n of nodes) {
        n.x += Math.max(-step, Math.min(step, n.vx));
        n.y += Math.max(-step, Math.min(step, n.vy));
      }

      temp = Math.max(temp * 0.975, 0.05);
      frame++;
      setTick((t) => t + 1);

      // Keep animating until settled, then slow down
      if (temp > 0.05) {
        frameRef.current = requestAnimationFrame(simulate);
      } else {
        // Slow heartbeat redraws
        frameRef.current = setTimeout(() => {
          frameRef.current = requestAnimationFrame(simulate);
          temp = 0.5; // small nudge to keep responsive
        }, 2000) as unknown as number;
      }
    };

    frameRef.current = requestAnimationFrame(simulate);
    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(frameRef.current);
    };
  }, [memories, allLinks]);

  return { nodes: nodesRef.current, tick };
}

// ── Obsidian-style 2D Graph Canvas ───────────────────────────────────────────

function GraphCanvas({
  memories,
  links,
  selectedId,
  filterType,
  onSelect,
  containerRef,
}: {
  memories: AgentMemory[];
  links: AgentMemoryLink[];
  selectedId: string | null;
  filterType: string | null;
  onSelect: (id: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [containerRef]);

  // Agent-based links (memories sharing same agent)
  const agentLinks = useMemo(() => {
    const explicitPairs = new Set(
      links.flatMap((l) => [
        `${l.sourceMemoryId}:${l.targetMemoryId}`,
        `${l.targetMemoryId}:${l.sourceMemoryId}`,
      ]),
    );
    const byAgent = new Map<string, string[]>();
    for (const m of memories) {
      for (const a of m.agents) {
        const list = byAgent.get(a.agentId) ?? [];
        list.push(m.id);
        byAgent.set(a.agentId, list);
      }
    }
    const result: Array<{ sourceId: string; targetId: string; isAgent: boolean }> = [];
    for (const ids of byAgent.values()) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length - 1; i++) {
        const key = `${ids[i]}:${ids[i + 1]}`;
        if (!explicitPairs.has(key)) {
          result.push({ sourceId: ids[i], targetId: ids[i + 1], isAgent: true });
        }
      }
    }
    return result;
  }, [memories, links]);

  const allLinks = useMemo(
    () => [
      ...links.map((l) => ({ sourceId: l.sourceMemoryId, targetId: l.targetMemoryId, isAgent: false })),
      ...agentLinks,
    ],
    [links, agentLinks],
  );

  const { nodes } = use2DSimulation(memories, allLinks);

  const visibleIds = useMemo(() => {
    const ids = filterType
      ? memories.filter((m) => m.memoryType === filterType).map((m) => m.id)
      : memories.map((m) => m.id);
    return new Set(ids);
  }, [memories, filterType]);

  const connectionCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of allLinks) {
      counts.set(l.sourceId, (counts.get(l.sourceId) ?? 0) + 1);
      counts.set(l.targetId, (counts.get(l.targetId) ?? 0) + 1);
    }
    return counts;
  }, [allLinks]);

  // World → screen
  const toScreen = useCallback(
    (wx: number, wy: number) => ({
      sx: size.w / 2 + (wx + panRef.current.x) * zoomRef.current,
      sy: size.h / 2 + (wy + panRef.current.y) * zoomRef.current,
    }),
    [size],
  );

  // Screen → world
  const toWorld = useCallback(
    (sx: number, sy: number) => ({
      wx: (sx - size.w / 2) / zoomRef.current - panRef.current.x,
      wy: (sy - size.h / 2) / zoomRef.current - panRef.current.y,
    }),
    [size],
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const { w, h } = size;
      ctx.clearRect(0, 0, w, h);

      // Obsidian-style dark background
      ctx.fillStyle = "#0f0f12";
      ctx.fillRect(0, 0, w, h);

      const z = zoomRef.current;
      const px = panRef.current.x;
      const py = panRef.current.y;

      // Helper: world to screen
      const ws = (wx: number, wy: number) => ({
        sx: w / 2 + (wx + px) * z,
        sy: h / 2 + (wy + py) * z,
      });

      // Build projected node map
      const projected = new Map<string, { sx: number; sy: number; r: number; memory: AgentMemory }>();
      for (const memory of memories) {
        if (!visibleIds.has(memory.id)) continue;
        const n = nodes.get(memory.id);
        if (!n) continue;
        const { sx, sy } = ws(n.x, n.y);
        const conns = connectionCount.get(memory.id) ?? 0;
        const r = Math.max(3.5, 3.5 + Math.min(conns * 1.2, 6)) * Math.max(0.5, z * 0.7 + 0.3);
        projected.set(memory.id, { sx, sy, r, memory });
      }

      // Draw edges
      for (const link of allLinks) {
        const src = projected.get(link.sourceId);
        const tgt = projected.get(link.targetId);
        if (!src || !tgt) continue;
        const isHighlighted =
          selectedId === link.sourceId || selectedId === link.targetId ||
          hoveredRef.current === link.sourceId || hoveredRef.current === link.targetId;

        ctx.beginPath();
        ctx.moveTo(src.sx, src.sy);
        ctx.lineTo(tgt.sx, tgt.sy);

        if (link.isAgent) {
          ctx.setLineDash([3, 5]);
          ctx.strokeStyle = isHighlighted ? "rgba(139,92,246,0.55)" : "rgba(255,255,255,0.09)";
          ctx.lineWidth = isHighlighted ? 1.2 : 0.7;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = isHighlighted ? "rgba(99,102,241,0.75)" : "rgba(255,255,255,0.14)";
          ctx.lineWidth = isHighlighted ? 1.5 : 0.9;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const [id, p] of projected) {
        const { sx, sy, r, memory } = p;
        const isSelected = selectedId === id;
        const isHovered = hoveredRef.current === id;
        const color = typeColor(memory.memoryType);
        const conns = connectionCount.get(id) ?? 0;

        // Subtle glow for connected/selected nodes
        if (isSelected || isHovered || conns > 0) {
          const glowR = r * (isSelected ? 4 : 2.5);
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
          const hexR = parseInt(color.slice(1, 3), 16);
          const hexG = parseInt(color.slice(3, 5), 16);
          const hexB = parseInt(color.slice(5, 7), 16);
          const glowAlpha = isSelected ? 0.35 : isHovered ? 0.2 : 0.1;
          glow.addColorStop(0, `rgba(${hexR},${hexG},${hexB},${glowAlpha})`);
          glow.addColorStop(1, `rgba(${hexR},${hexG},${hexB},0)`);
          ctx.beginPath();
          ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        if (isSelected || isHovered) {
          ctx.fillStyle = color;
        } else {
          // Un-selected: slightly desaturated, like Obsidian
          ctx.fillStyle = conns > 0 ? color : "rgba(120,120,140,0.9)";
        }
        ctx.fill();

        // Selected ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(sx, sy, r + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Label — shown when zoomed in enough or always for selected/hovered
        const showLabel = z > 0.55 || isSelected || isHovered;
        if (showLabel) {
          const fontSize = Math.max(9, Math.min(13, 11 * z));
          ctx.font = `${isSelected || isHovered ? 500 : 400} ${fontSize}px Inter, system-ui, sans-serif`;
          const label = memory.title.length > 28 ? memory.title.slice(0, 28) + "…" : memory.title;
          const alpha = isSelected || isHovered ? 0.95 : Math.min(1, (z - 0.4) * 4);
          ctx.fillStyle = `rgba(220,220,235,${alpha})`;
          ctx.textAlign = "left";
          ctx.fillText(label, sx + r + 5, sy + fontSize * 0.36);
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [memories, links, nodes, visibleIds, allLinks, connectionCount, selectedId, size]);

  // Mouse events — pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    hasDraggedRef.current = false;
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - lastMouseRef.current.x;
      const dy = ev.clientY - lastMouseRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDraggedRef.current = true;
      panRef.current.x += dx / zoomRef.current;
      panRef.current.y += dy / zoomRef.current;
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY };
    };
    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hasDraggedRef.current) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { wx, wy } = toWorld(mx, my);

      let hit: string | null = null;
      let bestD = Infinity;
      for (const memory of memories) {
        if (!visibleIds.has(memory.id)) continue;
        const n = nodes.get(memory.id);
        if (!n) continue;
        const conns = connectionCount.get(memory.id) ?? 0;
        const r = (Math.max(3.5, 3.5 + Math.min(conns * 1.2, 6)) + 6) / Math.max(0.5, zoomRef.current * 0.7 + 0.3);
        const dx = wx - n.x, dy = wy - n.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= r && d < bestD) { hit = memory.id; bestD = d; }
      }
      onSelect(hit === selectedId ? null : hit);
    },
    [memories, visibleIds, nodes, connectionCount, toWorld, selectedId, onSelect],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { wx, wy } = toWorld(mx, my);

      let hit: string | null = null;
      for (const memory of memories) {
        if (!visibleIds.has(memory.id)) continue;
        const n = nodes.get(memory.id);
        if (!n) continue;
        const conns = connectionCount.get(memory.id) ?? 0;
        const r = (Math.max(3.5, 3.5 + Math.min(conns * 1.2, 6)) + 8) / Math.max(0.5, zoomRef.current * 0.7 + 0.3);
        const dx = wx - n.x, dy = wy - n.y;
        if (Math.sqrt(dx * dx + dy * dy) <= r) { hit = memory.id; break; }
      }
      hoveredRef.current = hit;
      (e.target as HTMLCanvasElement).style.cursor = hit ? "pointer" : isDraggingRef.current ? "grabbing" : "grab";
    },
    [memories, visibleIds, nodes, connectionCount, toWorld],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Zoom toward cursor
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.max(0.15, Math.min(4, zoomRef.current * factor));
    const ratio = newZoom / zoomRef.current;

    // Adjust pan so the point under cursor stays fixed
    panRef.current.x = (panRef.current.x + (mx - size.w / 2) / zoomRef.current) - (mx - size.w / 2) / newZoom;
    panRef.current.y = (panRef.current.y + (my - size.h / 2) / zoomRef.current) - (my - size.h / 2) / newZoom;

    zoomRef.current = newZoom;
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size.w}
      height={size.h}
      className="absolute inset-0 w-full h-full cursor-grab"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
    />
  );
}

// ── Add Memory Modal ─────────────────────────────────────────────────────────

function AddMemoryModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: { title: string; content: string; memoryType: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [memoryType, setMemoryType] = useState("fact");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-[480px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Add Memory Node</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <input
              autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Users prefer dark mode"
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {MEMORY_TYPES.map((t) => (
                <button key={t} onClick={() => setMemoryType(t)}
                  className={cn("px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors capitalize",
                    memoryType === t ? "text-white border-transparent" : "border-border text-muted-foreground hover:border-foreground/30")}
                  style={memoryType === t ? { backgroundColor: typeColor(t), borderColor: typeColor(t) } : {}}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Details</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Optional: additional context…" rows={4}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!title.trim()} onClick={() => onAdd({ title: title.trim(), content, memoryType })}>Add Memory</Button>
        </div>
      </div>
    </div>
  );
}

// ── Link Modal ───────────────────────────────────────────────────────────────

function LinkModal({
  sourceMemory, memories, onClose, onLink,
}: {
  sourceMemory: AgentMemory; memories: AgentMemory[];
  onClose: () => void;
  onLink: (targetId: string, relationshipType: string, label: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [relType, setRelType] = useState("related_to");
  const [label, setLabel] = useState("");
  const others = memories.filter((m) => m.id !== sourceMemory.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[420px] p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Link Memory</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">Linking from: <span className="font-medium text-foreground">{sourceMemory.title}</span></p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target memory *</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none">
              <option value="">Select a memory…</option>
              {others.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Relationship</label>
            <select value={relType} onChange={(e) => setRelType(e.target.value)}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none">
              {["related_to", "supports", "contradicts", "precedes", "derived_from", "example_of"].map((r) =>
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label (optional)</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. strongly"
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!targetId} onClick={() => onLink(targetId, relType, label)}>Create Link</Button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  memory, links, allMemories, onClose, onDelete, onLink,
}: {
  memory: AgentMemory; links: AgentMemoryLink[]; allMemories: AgentMemory[];
  onClose: () => void; onDelete: () => void; onLink: () => void;
}) {
  const connected = useMemo(() => {
    const ids = new Set<string>();
    for (const l of links) {
      if (l.sourceMemoryId === memory.id) ids.add(l.targetMemoryId);
      if (l.targetMemoryId === memory.id) ids.add(l.sourceMemoryId);
    }
    return [...ids].map((id) => allMemories.find((m) => m.id === id)).filter(Boolean) as AgentMemory[];
  }, [memory.id, links, allMemories]);

  return (
    <div className="w-72 shrink-0 border-l border-border flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: typeColor(memory.memoryType) }} />
        <span className="text-xs font-semibold text-foreground flex-1 truncate">{memory.title}</span>
        <button onClick={onClose} className="text-muted-foreground/40 hover:text-foreground shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-medium capitalize"
            style={{ backgroundColor: typeColor(memory.memoryType) }}>{memory.memoryType}</span>
          <span className="text-muted-foreground">{new Date(memory.createdAt).toLocaleDateString()}</span>
        </div>
        {memory.content && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Content</p>
            <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-[11px]">{memory.content}</p>
          </div>
        )}
        {memory.agents.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Agents</p>
            <div className="flex flex-col gap-1">
              {memory.agents.map((a) => (
                <div key={a.agentId} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                    <Brain className="h-2 w-2 text-primary" />
                  </div>
                  <span className="text-foreground/80">{a.agentName ?? a.agentId}</span>
                  {a.isOwner && <span className="text-[9px] text-primary/70 ml-auto">owner</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {connected.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Linked Memories ({connected.length})
            </p>
            <div className="flex flex-col gap-1">
              {connected.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: typeColor(m.memoryType) }} />
                  <span className="text-foreground/70 truncate">{m.title}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-border flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onLink}>
          <Link2 className="h-3 w-3 mr-1.5" /> Link
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/40" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MemoryGraph() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: graph, isLoading } = useQuery({
    queryKey: queryKeys.memories.graph(selectedCompanyId!),
    queryFn: () => agentMemoriesApi.getGraph(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const memories = graph?.memories ?? [];
  const links = graph?.links ?? [];

  const selectedMemory = useMemo(
    () => memories.find((m) => m.id === selectedId) ?? null,
    [memories, selectedId],
  );

  const addMutation = useMutation({
    mutationFn: (data: { title: string; content: string; memoryType: string }) =>
      agentMemoriesApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.graph(selectedCompanyId!) });
      setShowAddModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => agentMemoriesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.graph(selectedCompanyId!) });
      setSelectedId(null);
    },
  });

  const linkMutation = useMutation({
    mutationFn: (data: { targetId: string; relationshipType: string; label: string }) =>
      agentMemoriesApi.createLink(selectedCompanyId!, {
        sourceMemoryId: selectedId!,
        targetMemoryId: data.targetId,
        relationshipType: data.relationshipType,
        label: data.label || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories.graph(selectedCompanyId!) });
      setShowLinkModal(false);
    },
  });

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of memories) counts.set(m.memoryType, (counts.get(m.memoryType) ?? 0) + 1);
    return counts;
  }, [memories]);

  const usedTypes = [...typeCounts.keys()];

  const uniqueAgents = useMemo(() => {
    const seen = new Set<string>();
    const agents: typeof memories[0]["agents"] = [];
    for (const m of memories) {
      for (const a of m.agents) {
        if (!seen.has(a.agentId)) { seen.add(a.agentId); agents.push(a); }
      }
    }
    return agents;
  }, [memories]);

  return (
    <div className="flex h-full min-h-0 bg-[#0f0f12]">
      {/* Graph area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 shrink-0 bg-[#0f0f12]/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white/90">Memory Graph</span>
            {memories.length > 0 && (
              <span className="text-[10px] text-white/30 bg-white/5 rounded-full px-2 py-0.5 tabular-nums">
                {memories.length} nodes · {links.length} links
              </span>
            )}
          </div>

          {/* Agent legend */}
          {uniqueAgents.length > 0 && (
            <div className="flex items-center gap-2.5 border-r border-white/10 pr-3">
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Agents</span>
              {uniqueAgents.map((agent, idx) => (
                <div key={agent.agentId} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColor(MEMORY_TYPES[idx % MEMORY_TYPES.length]) }} />
                  <span className="text-[10px] text-white/50">{agent.agentName ?? "Agent"}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1" />

          {/* Type filters */}
          {usedTypes.length > 0 && (
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-white/30" />
              <button
                onClick={() => setFilterType(null)}
                className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors",
                  !filterType ? "bg-white text-black border-transparent" : "border-white/10 text-white/40 hover:border-white/20")}
              >
                All
              </button>
              {usedTypes.map((t) => (
                <button key={t} onClick={() => setFilterType(filterType === t ? null : t)}
                  className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors capitalize",
                    filterType === t ? "text-white border-transparent" : "border-white/10 text-white/40 hover:border-white/20")}
                  style={filterType === t ? { backgroundColor: typeColor(t), borderColor: typeColor(t) } : {}}>
                  {t} <span className="opacity-50">({typeCounts.get(t)})</span>
                </button>
              ))}
            </div>
          )}

          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white border-0" onClick={() => setShowAddModal(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Memory
          </Button>
        </div>

        {/* Graph canvas */}
        <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden bg-[#0f0f12]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Brain className="h-8 w-8 text-indigo-400/40 animate-pulse" />
                <p className="text-sm text-white/30">Loading memory graph…</p>
              </div>
            </div>
          ) : memories.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <Brain className="h-8 w-8 text-indigo-400/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/70">No memories yet</p>
                  <p className="text-xs text-white/30 mt-1 leading-relaxed">Agents learn and store knowledge here.</p>
                </div>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white border-0" onClick={() => setShowAddModal(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Add First Memory
                </Button>
              </div>
            </div>
          ) : (
            <GraphCanvas
              memories={memories}
              links={links}
              selectedId={selectedId}
              filterType={filterType}
              onSelect={setSelectedId}
              containerRef={containerRef}
            />
          )}

          {memories.length > 0 && (
            <div className="absolute bottom-3 left-3 text-[10px] text-white/20 select-none pointer-events-none">
              Drag to pan · Scroll to zoom · Click node for details
            </div>
          )}

          {/* Type legend */}
          {memories.length > 0 && (
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 pointer-events-none">
              {MEMORY_TYPES.filter((t) => typeCounts.has(t)).map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColor(t) }} />
                  <span className="text-[9px] text-white/25 capitalize">{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedMemory && (
        <DetailPanel
          memory={selectedMemory}
          links={links}
          allMemories={memories}
          onClose={() => setSelectedId(null)}
          onDelete={() => deleteMutation.mutate(selectedMemory.id)}
          onLink={() => setShowLinkModal(true)}
        />
      )}

      {/* Modals */}
      {showAddModal && (
        <AddMemoryModal onClose={() => setShowAddModal(false)} onAdd={(data) => addMutation.mutate(data)} />
      )}
      {showLinkModal && selectedMemory && (
        <LinkModal
          sourceMemory={selectedMemory}
          memories={memories}
          onClose={() => setShowLinkModal(false)}
          onLink={(targetId, relationshipType, label) => linkMutation.mutate({ targetId, relationshipType, label })}
        />
      )}
    </div>
  );
}
