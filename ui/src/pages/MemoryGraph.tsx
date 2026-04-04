import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Link2, Trash2, Brain, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompany } from "../context/CompanyContext";
import { agentMemoriesApi, type AgentMemory, type AgentMemoryLink } from "../api/agentMemories";
import { queryKeys } from "../lib/queryKeys";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodePos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

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

// ── Force Simulation Hook ────────────────────────────────────────────────────

function useForceSimulation(
  memories: AgentMemory[],
  links: AgentMemoryLink[],
  width: number,
  height: number,
) {
  const posRef = useRef<Map<string, NodePos>>(new Map());
  const frameRef = useRef<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (memories.length === 0) return;

    const cx = width / 2;
    const cy = height / 2;

    // Preserve positions of existing nodes; initialize new ones
    for (const m of memories) {
      if (!posRef.current.has(m.id)) {
        const angle = Math.random() * Math.PI * 2;
        const r = 50 + Math.random() * Math.min(width, height) * 0.3;
        posRef.current.set(m.id, {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: 0,
          vy: 0,
        });
      }
    }
    // Remove stale nodes
    for (const id of posRef.current.keys()) {
      if (!memories.find((m) => m.id === id)) posRef.current.delete(id);
    }

    const k = Math.sqrt((width * height) / Math.max(memories.length, 1)) * 0.8;
    let temp = 30;

    const simulate = () => {
      const pos = posRef.current;
      const ids = [...pos.keys()];

      // Repulsion between all pairs
      for (let i = 0; i < ids.length; i++) {
        const pi = pos.get(ids[i])!;
        let fx = 0;
        let fy = 0;

        for (let j = 0; j < ids.length; j++) {
          if (i === j) continue;
          const pj = pos.get(ids[j])!;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f = (k * k) / d;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }

        // Gravity toward center
        fx -= (pi.x - cx) * 0.02;
        fy -= (pi.y - cy) * 0.02;

        pi.vx = (pi.vx + fx) * 0.7;
        pi.vy = (pi.vy + fy) * 0.7;
      }

      // Attraction along links
      for (const link of links) {
        const ps = pos.get(link.sourceMemoryId);
        const pt = pos.get(link.targetMemoryId);
        if (!ps || !pt) continue;
        const dx = pt.x - ps.x;
        const dy = pt.y - ps.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = (d / k) * 0.5;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        ps.vx += fx;
        ps.vy += fy;
        pt.vx -= fx;
        pt.vy -= fy;
      }

      // Apply velocities
      for (const p of pos.values()) {
        const step = Math.min(temp, 15);
        p.x += Math.max(-step, Math.min(step, p.vx));
        p.y += Math.max(-step, Math.min(step, p.vy));
        p.x = Math.max(40, Math.min(width - 40, p.x));
        p.y = Math.max(40, Math.min(height - 40, p.y));
      }

      temp = Math.max(temp * 0.97, 0.3);

      setTick((t) => t + 1);
      frameRef.current = requestAnimationFrame(simulate);
    };

    frameRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [memories, links, width, height]);

  return posRef.current;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-[480px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Add Memory Node</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Users prefer dark mode"
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {MEMORY_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setMemoryType(t)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors capitalize",
                    memoryType === t
                      ? "text-white border-transparent"
                      : "border-border text-muted-foreground hover:border-foreground/30",
                  )}
                  style={memoryType === t ? { backgroundColor: typeColor(t), borderColor: typeColor(t) } : {}}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Details</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Optional: additional context or description…"
              rows={4}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!title.trim()}
            onClick={() => onAdd({ title: title.trim(), content, memoryType })}
          >
            Add Memory
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Link Modal ───────────────────────────────────────────────────────────────

function LinkModal({
  sourceMemory,
  memories,
  onClose,
  onLink,
}: {
  sourceMemory: AgentMemory;
  memories: AgentMemory[];
  onClose: () => void;
  onLink: (targetId: string, relationshipType: string, label: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [relType, setRelType] = useState("related_to");
  const [label, setLabel] = useState("");
  const others = memories.filter((m) => m.id !== sourceMemory.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-[420px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Link Memory</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Linking from: <span className="font-medium text-foreground">{sourceMemory.title}</span>
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target memory</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a memory…</option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Relationship</label>
            <select
              value={relType}
              onChange={(e) => setRelType(e.target.value)}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="related_to">Related to</option>
              <option value="supports">Supports</option>
              <option value="contradicts">Contradicts</option>
              <option value="leads_to">Leads to</option>
              <option value="derived_from">Derived from</option>
              <option value="part_of">Part of</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. because of user feedback"
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!targetId}
            onClick={() => onLink(targetId, relType, label)}
          >
            Create Link
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  memory,
  links,
  allMemories,
  onClose,
  onDelete,
  onLink,
}: {
  memory: AgentMemory;
  links: AgentMemoryLink[];
  allMemories: AgentMemory[];
  onClose: () => void;
  onDelete: () => void;
  onLink: () => void;
}) {
  const connectedLinks = links.filter(
    (l) => l.sourceMemoryId === memory.id || l.targetMemoryId === memory.id,
  );

  const relatedMemories = connectedLinks.map((l) => {
    const otherId = l.sourceMemoryId === memory.id ? l.targetMemoryId : l.sourceMemoryId;
    const other = allMemories.find((m) => m.id === otherId);
    return { link: l, memory: other };
  });

  return (
    <div className="w-72 h-full border-l border-border bg-background flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: typeColor(memory.memoryType) }}
          />
          <span className="text-xs font-semibold text-foreground truncate capitalize">
            {memory.memoryType}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onLink} title="Link to another memory">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete memory">
            <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* Title */}
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{memory.title}</h3>
          {memory.createdAt && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              {new Date(memory.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Content */}
        {memory.content && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Details</span>
            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{memory.content}</p>
          </div>
        )}

        {/* Agents */}
        {memory.agents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Agents</span>
            <div className="flex flex-col gap-1">
              {memory.agents.map((a) => (
                <div key={a.agentId} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Brain className="h-2.5 w-2.5 text-foreground/50" />
                  </div>
                  <span className="text-xs text-foreground/80">{a.agentName ?? a.agentId}</span>
                  {a.isOwner && (
                    <span className="text-[9px] text-muted-foreground/60 bg-muted rounded px-1">owner</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections */}
        {relatedMemories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Connections ({relatedMemories.length})
            </span>
            <div className="flex flex-col gap-1.5">
              {relatedMemories.map(({ link, memory: other }) => (
                <div key={link.id} className="flex items-start gap-2 group">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground/80 truncate">{other?.title ?? "Unknown"}</p>
                    <p className="text-[10px] text-muted-foreground/50 capitalize">
                      {link.relationshipType.replace(/_/g, " ")}
                      {link.label ? ` · ${link.label}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Graph Canvas ─────────────────────────────────────────────────────────────

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
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const draggingIdRef = useRef<string | null>(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [containerRef]);

  const positions = useForceSimulation(memories, links, size.width, size.height);

  const connectionCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      counts.set(link.sourceMemoryId, (counts.get(link.sourceMemoryId) ?? 0) + 1);
      counts.set(link.targetMemoryId, (counts.get(link.targetMemoryId) ?? 0) + 1);
    }
    return counts;
  }, [links]);

  const visibleMemories = filterType
    ? memories.filter((m) => m.memoryType === filterType)
    : memories;

  const visibleIds = new Set(visibleMemories.map((m) => m.id));

  const visibleLinks = links.filter(
    (l) => visibleIds.has(l.sourceMemoryId) && visibleIds.has(l.targetMemoryId),
  );

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((prev) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const scale = Math.max(0.2, Math.min(4, prev.scale * factor));
      return { ...prev, scale };
    });
  }, []);

  // Pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest("[data-node]")) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIdRef.current) {
      const pos = positions.get(draggingIdRef.current);
      if (pos) {
        pos.x += e.movementX / transform.scale;
        pos.y += e.movementY / transform.scale;
        pos.vx = 0;
        pos.vy = 0;
      }
      return;
    }
    if (!isPanningRef.current) return;
    setTransform((prev) => ({
      ...prev,
      x: panStartRef.current.tx + (e.clientX - panStartRef.current.x),
      y: panStartRef.current.ty + (e.clientY - panStartRef.current.y),
    }));
  }, [positions, transform.scale]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    draggingIdRef.current = null;
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    draggingIdRef.current = id;
  }, []);

  return (
    <svg
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Dark-tinted background grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"
          patternTransform={`translate(${transform.x % 40},${transform.y % 40}) scale(${transform.scale})`}
        >
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-border/40" />
        </pattern>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" fillOpacity="0.5" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Edges */}
        {visibleLinks.map((link) => {
          const ps = positions.get(link.sourceMemoryId);
          const pt = positions.get(link.targetMemoryId);
          if (!ps || !pt) return null;

          const isHighlighted =
            selectedId === link.sourceMemoryId || selectedId === link.targetMemoryId;

          return (
            <g key={link.id}>
              <line
                x1={ps.x}
                y1={ps.y}
                x2={pt.x}
                y2={pt.y}
                stroke={isHighlighted ? "#6366f1" : "#94a3b8"}
                strokeWidth={isHighlighted ? 1.5 : 0.8}
                strokeOpacity={isHighlighted ? 0.8 : 0.3}
                markerEnd="url(#arrow)"
              />
              {link.label && (
                <text
                  x={(ps.x + pt.x) / 2}
                  y={(ps.y + pt.y) / 2 - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#94a3b8"
                  fillOpacity="0.6"
                >
                  {link.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {visibleMemories.map((memory) => {
          const pos = positions.get(memory.id);
          if (!pos) return null;

          const conns = connectionCount.get(memory.id) ?? 0;
          const r = 10 + Math.min(conns * 3, 18);
          const isSelected = selectedId === memory.id;
          const color = typeColor(memory.memoryType);

          return (
            <g
              key={memory.id}
              data-node="true"
              transform={`translate(${pos.x},${pos.y})`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : memory.id);
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, memory.id)}
              className="cursor-pointer"
            >
              {/* Glow ring when selected */}
              {isSelected && (
                <circle r={r + 6} fill={color} fillOpacity="0.15" />
              )}
              {/* Outer ring */}
              <circle
                r={r + 2}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 2 : 1}
                strokeOpacity={isSelected ? 0.9 : 0.4}
              />
              {/* Node body */}
              <circle
                r={r}
                fill={color}
                fillOpacity={isSelected ? 0.95 : 0.75}
              />
              {/* Label */}
              <text
                y={r + 12}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isSelected ? "600" : "400"}
                fill="currentColor"
                className="text-foreground/80"
                style={{ pointerEvents: "none" }}
              >
                {memory.title.length > 22 ? memory.title.slice(0, 22) + "…" : memory.title}
              </text>
              {/* Connection count badge */}
              {conns > 0 && (
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill="white"
                  style={{ pointerEvents: "none" }}
                >
                  {conns}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Click-off to deselect */}
      <rect
        width="100%"
        height="100%"
        fill="transparent"
        onClick={() => onSelect(null)}
        style={{ pointerEvents: "none" }}
      />
    </svg>
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

  // Count memories by type for filter pills
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of memories) {
      counts.set(m.memoryType, (counts.get(m.memoryType) ?? 0) + 1);
    }
    return counts;
  }, [memories]);

  const usedTypes = [...typeCounts.keys()];

  // Get unique agents across all memories
  const uniqueAgents = useMemo(() => {
    const seen = new Set<string>();
    const agents: typeof memories[0]["agents"] = [];
    for (const m of memories) {
      for (const a of m.agents) {
        if (!seen.has(a.agentId)) {
          seen.add(a.agentId);
          agents.push(a);
        }
      }
    }
    return agents;
  }, [memories]);

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Graph area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Agent Memory Graph</span>
            {memories.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
                {memories.length} nodes · {links.length} links
              </span>
            )}
          </div>

          {/* Agent legend */}
          {uniqueAgents.length > 0 && (
            <div className="flex items-center gap-2.5 border-r border-border pr-3">
              <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">Agents</span>
              {uniqueAgents.map((agent, idx) => {
                const agentColor = typeColor(MEMORY_TYPES[idx % MEMORY_TYPES.length]);
                return (
                  <div key={agent.agentId} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full shadow-sm"
                      style={{ backgroundColor: agentColor }}
                    />
                    <span className="text-[10px] text-foreground/70">{agent.agentName ?? "Agent"}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-1" />

          {/* Type filters */}
          {usedTypes.length > 0 && (
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => setFilterType(null)}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors",
                  !filterType
                    ? "bg-foreground text-background border-transparent"
                    : "border-border text-muted-foreground hover:border-foreground/30",
                )}
              >
                All
              </button>
              {usedTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(filterType === t ? null : t)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors capitalize",
                    filterType === t
                      ? "text-white border-transparent"
                      : "border-border text-muted-foreground hover:border-foreground/30",
                  )}
                  style={filterType === t ? { backgroundColor: typeColor(t), borderColor: typeColor(t) } : {}}
                >
                  {t} <span className="opacity-60">({typeCounts.get(t)})</span>
                </button>
              ))}
            </div>
          )}

          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Memory
          </Button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <Brain className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
                <p className="text-sm text-muted-foreground">Loading memory graph…</p>
              </div>
            </div>
          ) : memories.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Brain className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No memories yet</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Agents learn and store knowledge here. Add the first memory node to start building the graph.
                  </p>
                </div>
                <Button size="sm" onClick={() => setShowAddModal(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add First Memory
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

          {/* Zoom hint */}
          {memories.length > 0 && (
            <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/40 select-none pointer-events-none">
              Scroll to zoom · Drag to pan · Click node for details
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
        <AddMemoryModal
          onClose={() => setShowAddModal(false)}
          onAdd={(data) => addMutation.mutate(data)}
        />
      )}
      {showLinkModal && selectedMemory && (
        <LinkModal
          sourceMemory={selectedMemory}
          memories={memories}
          onClose={() => setShowLinkModal(false)}
          onLink={(targetId, relationshipType, label) =>
            linkMutation.mutate({ targetId, relationshipType, label })
          }
        />
      )}
    </div>
  );
}
