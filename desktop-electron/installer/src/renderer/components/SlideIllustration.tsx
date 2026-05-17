import { motion } from "framer-motion";

interface SlideIllustrationProps {
  slideId: string;
}

export default function SlideIllustration({ slideId }: SlideIllustrationProps) {
  const cardClass = "w-full h-full rounded-xl bg-surface-dark p-5 flex items-center justify-center overflow-hidden";

  switch (slideId) {
    case "agent-orchestration":
      return <OrgChartIllustration className={cardClass} />;
    case "3d-office":
      return <OfficeIllustration className={cardClass} />;
    case "memory-graph":
      return <MemoryGraphIllustration className={cardClass} />;
    case "budget-control":
      return <BudgetIllustration className={cardClass} />;
    case "approval-gates":
      return <ApprovalIllustration className={cardClass} />;
    case "plugin-marketplace":
      return <PluginIllustration className={cardClass} />;
    default:
      return <div className={cardClass} />;
  }
}

/* ── Org Chart ───────────────────────────────────────────────────────────── */

function OrgChartIllustration({ className }: { className: string }) {
  const nodes = [
    { cx: 140, cy: 40, r: 18, label: "CEO" },
    { cx: 70, cy: 110, r: 14, label: "Dev" },
    { cx: 140, cy: 110, r: 14, label: "PM" },
    { cx: 210, cy: 110, r: 14, label: "Design" },
  ];

  return (
    <div className={className}>
      <svg width="280" height="160" viewBox="0 0 280 160">
        {/* Connection lines */}
        <motion.path
          d="M140 58 L70 96 M140 58 L140 96 M140 58 L210 96"
          stroke="#3d3d3a"
          strokeWidth="1.5"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
        {/* Nodes */}
        {nodes.map((n, i) => (
          <motion.g
            key={n.label}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
          >
            <circle cx={n.cx} cy={n.cy} r={n.r} fill="#252320" stroke="#5db8a6" strokeWidth="2" />
            <text
              x={n.cx}
              y={n.cy}
              dy="0.35em"
              textAnchor="middle"
              fill="#faf9f5"
              fontSize={n.r > 15 ? "10" : "9"}
              fontFamily="Inter, sans-serif"
            >
              {n.label}
            </text>
            {i === 0 && (
              <motion.circle
                cx={n.cx}
                cy={n.cy}
                r={n.r + 4}
                fill="none"
                stroke="#5db8a6"
                strokeWidth="1"
                opacity="0.4"
                animate={{ r: [n.r + 4, n.r + 10, n.r + 4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

/* ── 3D Office ───────────────────────────────────────────────────────────── */

function OfficeIllustration({ className }: { className: string }) {
  return (
    <div className={className}>
      <svg width="280" height="160" viewBox="0 0 280 160">
        {/* Floor */}
        <polygon points="40,100 140,60 240,100 140,140" fill="#1f1e1b" stroke="#3d3d3a" strokeWidth="1" />
        {/* Back wall */}
        <polygon points="40,100 140,60 140,20 40,60" fill="#181715" stroke="#3d3d3a" strokeWidth="0.5" />
        {/* Right wall */}
        <polygon points="140,60 240,100 240,60 140,20" fill="#1f1e1b" stroke="#3d3d3a" strokeWidth="0.5" />
        {/* Desk 1 */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <polygon points="60,90 100,75 120,82 80,97" fill="#252320" stroke="#3d3d3a" />
          <polygon points="80,97 120,82 120,72 80,87" fill="#2a2825" stroke="#3d3d3a" />
          <circle cx="95" cy="78" r="5" fill="#cc785c" opacity="0.8" />
        </motion.g>
        {/* Desk 2 */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <polygon points="160,82 200,97 220,90 180,75" fill="#252320" stroke="#3d3d3a" />
          <polygon points="180,75 220,90 220,80 180,65" fill="#2a2825" stroke="#3d3d3a" />
          <circle cx="195" cy={84} r="5" fill="#5db8a6" opacity="0.8" />
        </motion.g>
        {/* Desk 3 */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <polygon points="110,105 150,90 170,97 130,112" fill="#252320" stroke="#3d3d3a" />
          <polygon points="130,112 170,97 170,87 130,102" fill="#2a2825" stroke="#3d3d3a" />
          <circle cx="145" cy="97" r="5" fill="#e8a55a" opacity="0.8" />
        </motion.g>
      </svg>
    </div>
  );
}

/* ── Memory Graph ────────────────────────────────────────────────────────── */

function MemoryGraphIllustration({ className }: { className: string }) {
  const nodes = [
    { x: 140, y: 80 },
    { x: 80, y: 50 },
    { x: 200, y: 50 },
    { x: 60, y: 100 },
    { x: 220, y: 100 },
    { x: 110, y: 120 },
    { x: 170, y: 120 },
    { x: 140, y: 40 },
  ];

  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
    [1, 2], [1, 7], [2, 7], [3, 5], [4, 6], [5, 6],
  ];

  return (
    <div className={className}>
      <svg width="280" height="160" viewBox="0 0 280 160">
        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="#3d3d3a"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
          />
        ))}
        {nodes.map((n, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
          >
            <circle cx={n.x} cy={n.y} r={i === 0 ? 10 : 6} fill={i === 0 ? "#cc785c" : "#5db8a6"} />
            {i === 0 && (
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={14}
                fill="none"
                stroke="#cc785c"
                strokeWidth="1"
                opacity="0.3"
                animate={{ r: [14, 20, 14] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

/* ── Budget Gauge ────────────────────────────────────────────────────────── */

function BudgetIllustration({ className }: { className: string }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = 0.72;

  return (
    <div className={className}>
      <svg width="200" height="140" viewBox="0 0 200 140">
        {/* Background arc */}
        <path
          d={`M 40 100 A ${radius} ${radius} 0 1 1 160 100`}
          fill="none"
          stroke="#2a2825"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <motion.path
          d={`M 40 100 A ${radius} ${radius} 0 1 1 160 100`}
          fill="none"
          stroke="#cc785c"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />
        {/* Center text */}
        <motion.text
          x="100"
          y="85"
          textAnchor="middle"
          fill="#faf9f5"
          fontSize="24"
          fontFamily="Cormorant Garamond, serif"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          72%
        </motion.text>
        <motion.text
          x="100"
          y="105"
          textAnchor="middle"
          fill="#a09d96"
          fontSize="10"
          fontFamily="Inter, sans-serif"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Budget used
        </motion.text>
        {/* Warning indicator */}
        <motion.circle
          cx="160"
          cy="55"
          r="6"
          fill="#cc785c"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
        />
      </svg>
    </div>
  );
}

/* ── Approval Card ───────────────────────────────────────────────────────── */

function ApprovalIllustration({ className }: { className: string }) {
  return (
    <div className={className}>
      <svg width="240" height="140" viewBox="0 0 240 140">
        {/* Card bg */}
        <rect x="20" y="15" width="200" height="110" rx="10" fill="#252320" stroke="#3d3d3a" />
        {/* Header */}
        <text x="35" y="40" fill="#faf9f5" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="500">
          Hire Agent: "Senior Dev"
        </text>
        <text x="35" y="58" fill="#a09d96" fontSize="9" fontFamily="Inter, sans-serif">
          Requested by CEO · Budget: $50/mo
        </text>
        {/* Divider */}
        <line x1="35" y1="72" x2="205" y2="72" stroke="#3d3d3a" />
        {/* Approve button */}
        <motion.rect
          x="35"
          y="85"
          width="80"
          height="28"
          rx="6"
          fill="#5db872"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        />
        <motion.text
          x="75"
          y="103"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="10"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Approve
        </motion.text>
        {/* Deny button */}
        <motion.rect
          x="125"
          y="85"
          width="80"
          height="28"
          rx="6"
          fill="#1f1e1b"
          stroke="#3d3d3a"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        />
        <motion.text
          x="165"
          y="103"
          textAnchor="middle"
          fill="#a09d96"
          fontSize="10"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Deny
        </motion.text>
      </svg>
    </div>
  );
}

/* ── Plugin Marketplace ──────────────────────────────────────────────────── */

function PluginIllustration({ className }: { className: string }) {
  const plugins = [
    { name: "GitHub", color: "#cc785c", x: 30, y: 25 },
    { name: "Slack", color: "#5db8a6", x: 150, y: 25 },
    { name: "Notion", color: "#e8a55a", x: 30, y: 85 },
    { name: "Stripe", color: "#a09d96", x: 150, y: 85 },
  ];

  return (
    <div className={className}>
      <svg width="260" height="150" viewBox="0 0 260 150">
        {plugins.map((p, i) => (
          <motion.g
            key={p.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.12 }}
          >
            <rect x={p.x} y={p.y} width="100" height="55" rx="8" fill="#252320" stroke="#3d3d3a" />
            <circle cx={p.x + 20} cy={p.y + 20} r="8" fill={p.color} opacity="0.8" />
            <text x={p.x + 38} y={p.y + 24} fill="#faf9f5" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="500">
              {p.name}
            </text>
            <rect x={p.x + 12} y={p.y + 38} width="50" height="14" rx="4" fill="#1f1e1b" stroke="#3d3d3a" />
            <text x={p.x + 37} y={p.y + 48} textAnchor="middle" fill="#a09d96" fontSize="7" fontFamily="Inter, sans-serif">
              Install
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
