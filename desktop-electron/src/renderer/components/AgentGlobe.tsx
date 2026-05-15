import { useRef, useEffect, useState, useCallback } from "react";
import { tryDicebearDataUri } from "./AgentAvatar";
import type { Agent } from "@crewspaceai/shared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GlobeNode {
  id: string;
  name: string;
  icon: string | null;
  x3d: number; y3d: number; z3d: number;
  x: number; y: number; z: number; scale: number;
}

interface Particle { x: number; y: number; vx: number; vy: number; r: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGENT_COLORS = [
  "#f59e0b", "#818cf8", "#34d399", "#f472b6",
  "#38bdf8", "#fb923c", "#a78bfa", "#4ade80",
  "#e879f9", "#67e8f9", "#fbbf24", "#86efac",
];

function agentColor(index: number) { return AGENT_COLORS[index % AGENT_COLORS.length]; }

function hexRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
function rgba(hex: string, a: number) { return `rgba(${hexRgb(hex)},${a})`; }

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

function makeParticles(w: number, h: number, count = 60): Particle[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * w * 1.2,
    y: (Math.random() - 0.5) * h * 1.2,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
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

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AgentRunStat {
  succeeded: number;
  failed: number;
  total: number;
  status: string;
}

export interface AgentGlobeProps {
  agents: Agent[];
  workingAgentIds?: Set<string>;
  blockedAgentIds?: Set<string>;
  agentTaskMap?: Map<string, string>;
  agentRunStats?: Map<string, AgentRunStat>;
  onSelectAgent?: (agentId: string) => void;
  isDark?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentGlobe({
  agents,
  workingAgentIds = new Set(),
  blockedAgentIds = new Set(),
  agentTaskMap = new Map(),
  agentRunStats = new Map(),
  onSelectAgent,
  isDark = true,
}: AgentGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarImgRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [size, setSize] = useState({ w: 800, h: 600 });

  // 3D rotation state
  const rotXRef = useRef(0.3);
  const rotYRef = useRef(0);
  const autoRotateRef = useRef(true);
  const autoRotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Node positions
  const nodesRef = useRef<GlobeNode[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const timeRef = useRef(0);

  // Hover tracking (ref so render loop sees latest without closure capture)
  const hoveredRef = useRef<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  hoveredRef.current = hoveredId;

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

  // Build sphere nodes when agents change
  useEffect(() => {
    const n = agents.length;
    const R = Math.max(70, Math.min(160, 50 + n * 12));
    nodesRef.current = agents.map((agent, i) => {
      const p = fibonacciSphere(n, i, R);
      return {
        id: agent.id,
        name: agent.name,
        icon: agent.icon ?? null,
        x3d: p.x, y3d: p.y, z3d: p.z,
        x: p.x, y: p.y, z: p.z, scale: 1,
      };
    });
  }, [agents]);

  // Preload avatar images
  useEffect(() => {
    const cache = avatarImgRef.current;
    for (const agent of agents) {
      if (cache.has(agent.id)) continue;
      const seed = agent.icon || agent.id || agent.name || "unknown";
      const dataUri = tryDicebearDataUri(seed, 128);
      if (!dataUri) continue;
      const img = new Image();
      img.src = dataUri;
      cache.set(agent.id, img);
    }
  }, [agents]);

  // Particles
  useEffect(() => {
    particlesRef.current = makeParticles(size.w, size.h);
  }, [size.w, size.h]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      timeRef.current += 0.012;
      const t = timeRef.current;
      const { w, h } = size;
      const cx = w / 2, cy = h / 2;
      const FOV = 700;

      // Auto-rotate
      if (autoRotateRef.current) {
        rotYRef.current += 0.004;
      }

      const rotX = rotXRef.current;
      const rotY = rotYRef.current;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      // Project nodes
      const nodes = nodesRef.current;
      for (const node of nodes) {
        const { x3d, y3d, z3d } = node;
        const rx = x3d * cosY + z3d * sinY;
        const rz1 = -x3d * sinY + z3d * cosY;
        const ry = y3d * cosX - rz1 * sinX;
        const rz = y3d * sinX + rz1 * cosX;
        node.x = rx * (FOV / (FOV + rz + 50));
        node.y = ry * (FOV / (FOV + rz + 50));
        node.z = rz;
        node.scale = FOV / (FOV + rz + 50);
      }

      // Tick particles
      tickParticles(particlesRef.current, w, h);

      // Background
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

      ctx.save();
      ctx.translate(cx, cy);

      // Particles
      const particles = particlesRef.current;
      const CONN_DIST = 80;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "rgba(204,120,92,0.2)" : "rgba(204,120,92,0.12)";
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONN_DIST) {
            const alpha = (1 - d / CONN_DIST) * (isDark ? 0.1 : 0.06);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(204,120,92,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Orbital ring hints
      ctx.save();
      const n = agents.length;
      const R = Math.max(70, Math.min(160, 50 + n * 12));
      const ringA = isDark ? 0.06 : 0.04;
      for (let ring = 0; ring < 2; ring++) {
        const rr = R * (ring === 0 ? 0.85 : 1.12);
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * 0.32, rotY * 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(204,120,92,${ringA})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      // Draw nodes back-to-front
      const sorted = [...nodes].sort((a, b) => b.z - a.z);

      for (let ni = 0; ni < sorted.length; ni++) {
        const node = sorted[ni];
        const colorIdx = agents.findIndex((a) => a.id === node.id);
        const color = agentColor(colorIdx);
        const isWorking = workingAgentIds.has(node.id);
        const isBlocked = blockedAgentIds.has(node.id);
        const isHov = hoveredRef.current === node.id;

        const baseR = 18;
        const pulse = isWorking ? 1 + Math.sin(t * 2.5 + ni) * 0.08 : 1;
        const r = baseR * node.scale * pulse;

        const R_DEPTH = R + 80;
        const dAlpha = Math.min(1, Math.max(0.15, 1 - node.z / R_DEPTH * 0.7));

        ctx.globalAlpha = dAlpha;

        // Halo glow
        const haloR = r * (isHov ? 3.5 : 2.5);
        const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloR);
        halo.addColorStop(0, rgba(color, isHov ? 0.28 : 0.13));
        halo.addColorStop(1, rgba(color, 0));
        ctx.beginPath();
        ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // Working pulse ring
        if (isWorking) {
          const pulseR = r * (1.8 + Math.sin(t * 2.5 + ni) * 0.3);
          ctx.beginPath();
          ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(204,120,92,${0.25 * dAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        const avatarImg = avatarImgRef.current.get(node.id);
        const hasAvatar = avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0;

        if (hasAvatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImg, node.x - r, node.y - r, r * 2, r * 2);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(color, isHov ? 1 : 0.7);
          ctx.lineWidth = isHov ? 2.5 : 1.5;
          ctx.stroke();
        } else {
          ctx.shadowBlur = isHov ? 40 : 20;
          ctx.shadowColor = color;
          const sphere = ctx.createRadialGradient(
            node.x - r * 0.3, node.y - r * 0.3, 0,
            node.x, node.y, r,
          );
          sphere.addColorStop(0, rgba(color, 0.95));
          sphere.addColorStop(0.6, rgba(color, 0.55));
          sphere.addColorStop(1, rgba(color, 0.2));
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = sphere;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(color, isHov ? 1 : 0.7);
          ctx.lineWidth = isHov ? 2.5 : 1.5;
          ctx.stroke();

          // Initial letter fallback
          const initial = node.name.trim().charAt(0).toUpperCase() || "?";
          ctx.font = `bold ${Math.max(10, r * 0.6)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = isDark ? "#faf9f5" : "#141413";
          ctx.fillText(initial, node.x, node.y);
          ctx.textBaseline = "alphabetic";
        }

        // Status dot (top-right of avatar)
        const dotX = node.x + r * 0.68;
        const dotY = node.y - r * 0.68;
        const dotR = Math.max(3, r * 0.22);
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#181715" : "#faf9f5";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = isBlocked ? "#c64545" : isWorking ? "#5db872" : "#6c6a64";
        if (isWorking) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#5db872";
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.globalAlpha = dAlpha;

        // Name label
        ctx.font = `600 11px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        const lbl = node.name.length > 16 ? node.name.slice(0, 16) + "…" : node.name;
        const tw = ctx.measureText(lbl).width;
        ctx.fillStyle = isDark ? "rgba(24,23,21,0.78)" : "rgba(250,249,245,0.9)";
        ctx.beginPath();
        (ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect?.(
          node.x - tw / 2 - 5, node.y + r + 4, tw + 10, 16, 3,
        );
        ctx.fill();
        ctx.fillStyle = isHov ? (isDark ? "#faf9f5" : "#141413") : rgba(color, 0.95);
        ctx.fillText(lbl, node.x, node.y + r + 15);

        // Rich tooltip card on hover
        if (isHov) {
          const runStat = agentRunStats.get(node.id);
          const task = agentTaskMap.get(node.id);
          const cardW = 180;
          const cardH = runStat ? 82 : (task ? 52 : 36);
          const cardX = Math.max(8, Math.min(node.x - cardW / 2, w - cardW - 8));
          const cardY = node.y - r - cardH - 10;
          const safeCardY = cardY < 8 ? node.y + r + 14 : cardY;

          const roundRect = (ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect;

          // Card background
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = isDark ? "rgba(20,19,17,0.97)" : "rgba(250,249,245,0.97)";
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          roundRect?.call(ctx, cardX, safeCardY, cardW, cardH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.globalAlpha = 1;

          // Status dot + agent name
          const agentStatus = runStat?.status ?? "idle";
          const dotColor = agentStatus === "running" || agentStatus === "idle" ? "#5db872"
            : agentStatus === "error" ? "#c64545"
            : agentStatus === "paused" ? "#e8a55a"
            : "#6c6a64";

          ctx.beginPath();
          ctx.arc(cardX + 12, safeCardY + 14, 4, 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();

          ctx.font = `600 11px Inter, system-ui, sans-serif`;
          ctx.textAlign = "left";
          ctx.fillStyle = isDark ? "#faf9f5" : "#141413";
          const nameLabel = node.name.length > 18 ? node.name.slice(0, 18) + "…" : node.name;
          ctx.fillText(nameLabel, cardX + 22, safeCardY + 17);

          // Status badge
          ctx.font = `500 9px Inter, system-ui, sans-serif`;
          ctx.fillStyle = dotColor;
          const statusText = agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1);
          ctx.fillText(statusText, cardX + cardW - ctx.measureText(statusText).width - 8, safeCardY + 17);

          // Divider
          ctx.fillStyle = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
          ctx.fillRect(cardX + 8, safeCardY + 23, cardW - 16, 1);

          if (runStat) {
            // Runs today
            ctx.font = `400 10px Inter, system-ui, sans-serif`;
            ctx.fillStyle = isDark ? "#a09d96" : "#6c6a64";
            ctx.fillText("Today:", cardX + 10, safeCardY + 39);
            ctx.fillStyle = isDark ? "#faf9f5" : "#141413";
            ctx.font = `600 10px Inter, system-ui, sans-serif`;
            ctx.fillText(`${runStat.total} run${runStat.total !== 1 ? "s" : ""}`, cardX + 48, safeCardY + 39);

            // Succeeded
            ctx.fillStyle = "#5db872";
            ctx.font = `400 10px Inter, system-ui, sans-serif`;
            ctx.fillText(`✓  ${runStat.succeeded} succeeded`, cardX + 10, safeCardY + 55);

            // Failed
            ctx.fillStyle = "#c64545";
            ctx.fillText(`✗  ${runStat.failed} failed`, cardX + 10, safeCardY + 70);
          } else if (task) {
            ctx.font = `400 10px Inter, system-ui, sans-serif`;
            ctx.fillStyle = isDark ? "#a09d96" : "#6c6a64";
            const taskShort = task.length > 24 ? task.slice(0, 24) + "…" : task;
            ctx.fillText(taskShort, cardX + 10, safeCardY + 39);
          } else {
            ctx.font = `400 10px Inter, system-ui, sans-serif`;
            ctx.fillStyle = isDark ? "#6c6a64" : "#8e8b82";
            ctx.fillText("No runs today", cardX + 10, safeCardY + 39);
          }

          ctx.textAlign = "center";
        }

        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [agents, workingAgentIds, blockedAgentIds, agentTaskMap, agentRunStats, size, isDark]);

  // Hit test
  const hitTest = useCallback((canvasX: number, canvasY: number): string | null => {
    const { w, h } = size;
    const cx = w / 2, cy = h / 2;
    const wx = canvasX - cx;
    const wy = canvasY - cy;
    const nodes = nodesRef.current;

    let best: { id: string; d2: number } | null = null;
    for (const node of nodes) {
      const dx = wx - node.x, dy = wy - node.y;
      const d2 = dx * dx + dy * dy;
      const hitR = (18 * node.scale + 6) * 1.4;
      if (d2 <= hitR * hitR && (!best || d2 < best.d2)) best = { id: node.id, d2 };
    }
    return best?.id ?? null;
  }, [size]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    hasDragged.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    autoRotateRef.current = false;
    if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - lastMouse.current.x;
      const dy = ev.clientY - lastMouse.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) hasDragged.current = true;
      rotYRef.current += dx * 0.006;
      rotXRef.current += dy * 0.006;
      rotXRef.current = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotXRef.current));
      lastMouse.current = { x: ev.clientX, y: ev.clientY };
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      autoRotateTimerRef.current = setTimeout(() => { autoRotateRef.current = true; }, 3000);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    setHoveredId(id);
  }, [hitTest]);

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (id) onSelectAgent?.(id);
  }, [hitTest, onSelectAgent]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        style={{ display: "block", width: "100%", height: "100%", cursor: hoveredId ? "pointer" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    </div>
  );
}
