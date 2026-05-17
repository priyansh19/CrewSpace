import { motion } from "framer-motion";

export default function SlideIllustration({ slideId }: { slideId: string }) {
  switch (slideId) {
    case "agent-orchestration": return <OrgChart />;
    case "3d-office":           return <OfficeScene />;
    case "memory-graph":        return <MemoryGraph />;
    case "budget-control":      return <BudgetDash />;
    case "approval-gates":      return <ApprovalCard />;
    case "plugin-marketplace":  return <PluginGrid />;
    default:                    return null;
  }
}

/* Shared container — fills the dark left panel */
function IllustrationWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      {children}
    </div>
  );
}

/* ── Org Chart ───────────────────────────────────────────────────────────── */
function OrgChart() {
  const agents = [
    { id: "ceo",    label: "CEO",      x: 158, y: 60,  r: 28, color: "#cc785c", delay: 0 },
    { id: "dev",    label: "Dev",      x: 60,  y: 170, r: 22, color: "#4fb8a4", delay: 0.15 },
    { id: "pm",     label: "PM",       x: 158, y: 170, r: 22, color: "#4fb8a4", delay: 0.25 },
    { id: "design", label: "Design",   x: 256, y: 170, r: 22, color: "#4fb8a4", delay: 0.35 },
    { id: "qa",     label: "QA",       x: 60,  y: 280, r: 18, color: "#5c5a54", delay: 0.5 },
    { id: "fe",     label: "Front",    x: 158, y: 280, r: 18, color: "#5c5a54", delay: 0.6 },
    { id: "be",     label: "Back",     x: 256, y: 280, r: 18, color: "#5c5a54", delay: 0.7 },
  ];

  const edges: [string, string][] = [
    ["ceo","dev"], ["ceo","pm"], ["ceo","design"],
    ["dev","qa"],  ["pm","fe"],  ["design","be"],
  ];

  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <IllustrationWrap>
      <svg width="316" height="360" viewBox="0 0 316 360" fill="none">
        {/* Edges */}
        {edges.map(([a, b], i) => {
          const A = byId[a], B = byId[b];
          return (
            <motion.line
              key={i}
              x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke="#2a2825"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
            />
          );
        })}

        {/* Nodes */}
        {agents.map((n) => (
          <motion.g
            key={n.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: n.delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          >
            {/* Glow for CEO */}
            {n.id === "ceo" && (
              <motion.circle
                cx={n.x} cy={n.y} r={n.r + 8}
                fill="rgba(204,120,92,0.1)"
                animate={{ r: [n.r + 8, n.r + 16, n.r + 8] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <circle
              cx={n.x} cy={n.y} r={n.r}
              fill="#1e1d1b"
              stroke={n.color}
              strokeWidth={n.id === "ceo" ? 2 : 1.5}
            />
            <text
              x={n.x} y={n.y} dy="0.35em"
              textAnchor="middle"
              fill={n.id === "ceo" ? "#faf9f5" : "#9e9b94"}
              fontSize={n.id === "ceo" ? 11 : 9}
              fontFamily="Inter, sans-serif"
              fontWeight="500"
            >
              {n.label}
            </text>

            {/* Active dot */}
            {n.id !== "qa" && n.id !== "be" && (
              <motion.circle
                cx={n.x + n.r - 4} cy={n.y - n.r + 4} r={3.5}
                fill={n.color}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: n.delay }}
              />
            )}
          </motion.g>
        ))}
      </svg>
    </IllustrationWrap>
  );
}

/* ── 3D Office ───────────────────────────────────────────────────────────── */
function OfficeScene() {
  const desks = [
    { x: 90,  y: 180, color: "#cc785c", active: true,  delay: 0.1 },
    { x: 200, y: 140, color: "#4fb8a4", active: true,  delay: 0.2 },
    { x: 120, y: 250, color: "#e8a55a", active: false, delay: 0.3 },
    { x: 220, y: 210, color: "#4fb8a4", active: true,  delay: 0.4 },
    { x: 155, y: 310, color: "#cc785c", active: false, delay: 0.5 },
  ];

  return (
    <IllustrationWrap>
      <svg width="316" height="380" viewBox="0 0 316 380" fill="none">
        {/* Grid floor */}
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`fv${i}`}
            x1={60 + i * 30} y1={120}
            x2={60 + i * 30 + 80} y2={370}
            stroke="#232220" strokeWidth="0.8"
          />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`fh${i}`}
            x1={60} y1={140 + i * 30}
            x2={316} y2={120 + i * 30}
            stroke="#232220" strokeWidth="0.8"
          />
        ))}

        {/* Desks */}
        {desks.map((d, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: d.delay, duration: 0.5 }}
          >
            {/* Desk top */}
            <ellipse cx={d.x} cy={d.y} rx={36} ry={14} fill="#252320" stroke="#363330" strokeWidth="1" />
            {/* Screen */}
            <rect x={d.x - 10} y={d.y - 28} width={20} height={14} rx={2} fill="#1a1918" stroke={d.color} strokeWidth="0.8" />
            {/* Screen glow */}
            <rect x={d.x - 9} y={d.y - 27} width={18} height={12} rx={1.5} fill={d.active ? d.color : "#252320"} opacity={d.active ? 0.25 : 0.05} />
            {/* Agent presence dot */}
            {d.active && (
              <motion.circle
                cx={d.x + 18} cy={d.y - 12} r={4}
                fill={d.color}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.6 + i * 0.3, repeat: Infinity }}
              />
            )}
          </motion.g>
        ))}

        {/* Building outline at back */}
        <rect x={80} y={60} width={160} height={80} rx={4} fill="#1a1918" stroke="#2a2825" strokeWidth="1" />
        {/* Windows */}
        {[0,1,2,3].map((i) => (
          <rect key={i} x={90 + i * 36} y={72} width={22} height={16} rx={2}
            fill="#252320" stroke="#333" strokeWidth="0.5" />
        ))}

        {/* Label */}
        <motion.text
          x={158} y={38}
          textAnchor="middle" fill="#5c5a54" fontSize={10} fontFamily="Inter, sans-serif"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        >
          CrewSpace HQ
        </motion.text>
      </svg>
    </IllustrationWrap>
  );
}

/* ── Memory Graph ────────────────────────────────────────────────────────── */
function MemoryGraph() {
  const nodes = [
    { x: 158, y: 155, r: 18, color: "#cc785c", label: "Core" },
    { x: 80,  y: 90,  r: 12, color: "#4fb8a4", label: "Fact" },
    { x: 236, y: 90,  r: 12, color: "#4fb8a4", label: "Task" },
    { x: 50,  y: 190, r: 12, color: "#4fb8a4", label: "Plan" },
    { x: 266, y: 190, r: 12, color: "#4fb8a4", label: "Idea" },
    { x: 90,  y: 275, r: 10, color: "#5c5a54", label: "Log" },
    { x: 158, y: 295, r: 10, color: "#5c5a54", label: "Mem" },
    { x: 226, y: 275, r: 10, color: "#5c5a54", label: "Ref" },
    { x: 158, y: 50,  r: 10, color: "#e8a55a", label: "Goal" },
  ];

  const edges = [
    [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],
    [1,2],[1,8],[3,5],[4,7],[5,6],[6,7],
  ];

  return (
    <IllustrationWrap>
      <svg width="316" height="360" viewBox="0 0 316 360" fill="none">
        {/* Edges */}
        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke="#2a2825" strokeWidth="1.2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.04, duration: 0.4 }}
          />
        ))}

        {/* Nodes */}
        {nodes.map((n, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.4, ease: [0.16,1,0.3,1] }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          >
            {i === 0 && (
              <motion.circle
                cx={n.x} cy={n.y} r={n.r + 10}
                fill="rgba(204,120,92,0.08)"
                animate={{ r: [n.r + 10, n.r + 20, n.r + 10] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <circle cx={n.x} cy={n.y} r={n.r} fill="#1e1d1b" stroke={n.color} strokeWidth={i === 0 ? 2 : 1.2} />
            <text
              x={n.x} y={n.y} dy="0.35em"
              textAnchor="middle"
              fill={i === 0 ? "#faf9f5" : "#6c6a64"}
              fontSize={i === 0 ? 8 : 7}
              fontFamily="Inter, sans-serif" fontWeight="500"
            >
              {n.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </IllustrationWrap>
  );
}

/* ── Budget Dashboard ────────────────────────────────────────────────────── */
function BudgetDash() {
  const bars = [
    { label: "Claude",  pct: 0.42, color: "#cc785c" },
    { label: "Codex",   pct: 0.28, color: "#4fb8a4" },
    { label: "Gemini",  pct: 0.18, color: "#e8a55a" },
    { label: "Cursor",  pct: 0.12, color: "#5c5a54" },
  ];
  const gaugeR = 62;
  const gaugePct = 0.68;
  const circ = 2 * Math.PI * gaugeR;

  return (
    <IllustrationWrap>
      <svg width="290" height="380" viewBox="0 0 290 380" fill="none">
        {/* Gauge arc */}
        <path
          d={`M ${145 - gaugeR} 170 A ${gaugeR} ${gaugeR} 0 1 1 ${145 + gaugeR} 170`}
          stroke="#252320" strokeWidth="12" fill="none" strokeLinecap="round"
        />
        <motion.path
          d={`M ${145 - gaugeR} 170 A ${gaugeR} ${gaugeR} 0 1 1 ${145 + gaugeR} 170`}
          stroke="#cc785c" strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - gaugePct) }}
          transition={{ duration: 1.6, ease: "easeOut", delay: 0.2 }}
        />

        {/* Gauge center */}
        <motion.text
          x="145" y="155"
          textAnchor="middle" fill="#faf9f5"
          fontSize="28" fontFamily="Cormorant Garamond, serif"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
        >
          68%
        </motion.text>
        <motion.text
          x="145" y="176"
          textAnchor="middle" fill="#5c5a54"
          fontSize="10" fontFamily="Inter, sans-serif"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
        >
          of budget used
        </motion.text>

        {/* Budget card */}
        <rect x="28" y="205" width="234" height="148" rx="10" fill="#1e1d1b" stroke="#2a2825" />

        <text x="40" y="228" fill="#9e9b94" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="500" letterSpacing="0.06em">
          COST BY AGENT
        </text>

        {/* Bars */}
        {bars.map((b, i) => (
          <motion.g
            key={b.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.12, duration: 0.4 }}
          >
            <text x="40" y={248 + i * 26} fill="#6c6a64" fontSize="9" fontFamily="Inter, sans-serif">
              {b.label}
            </text>
            <rect
              x="90" y={238 + i * 26}
              width="120" height="8" rx="4"
              fill="#252320"
            />
            <motion.rect
              x="90" y={238 + i * 26}
              width={120 * b.pct} height="8" rx="4"
              fill={b.color}
              initial={{ width: 0 }}
              animate={{ width: 120 * b.pct }}
              transition={{ delay: 0.8 + i * 0.12, duration: 0.8, ease: "easeOut" }}
            />
            <text x="218" y={248 + i * 26} fill="#5c5a54" fontSize="9" fontFamily="Inter, sans-serif">
              {Math.round(b.pct * 100)}%
            </text>
          </motion.g>
        ))}
      </svg>
    </IllustrationWrap>
  );
}

/* ── Approval Gate ───────────────────────────────────────────────────────── */
function ApprovalCard() {
  return (
    <IllustrationWrap>
      <svg width="290" height="370" viewBox="0 0 290 370" fill="none">
        {/* Notification stack behind */}
        <rect x="38" y="70" width="214" height="130" rx="12" fill="#181715" stroke="#2a2825" />
        <rect x="30" y="64" width="214" height="130" rx="12" fill="#1e1d1b" stroke="#252320" />

        {/* Main card */}
        <motion.rect
          x="22" y="58" width="214" height="176" rx="12"
          fill="#252320" stroke="#363330"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 58, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
        />

        {/* Card content */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          {/* Header */}
          <circle cx="46" cy="82" r="10" fill="#cc785c" opacity="0.2" />
          <text x="46" y="86" textAnchor="middle" fill="#cc785c" fontSize="10">✦</text>
          <text x="64" y="79" fill="#faf9f5" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="500">
            Approval Required
          </text>
          <text x="64" y="93" fill="#5c5a54" fontSize="9" fontFamily="Inter, sans-serif">
            Action needs your sign-off
          </text>

          {/* Divider */}
          <line x1="34" y1="106" x2="224" y2="106" stroke="#2e2c28" />

          {/* Request details */}
          <text x="34" y="124" fill="#9e9b94" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="500" letterSpacing="0.06em">
            ACTION
          </text>
          <text x="34" y="140" fill="#faf9f5" fontSize="11" fontFamily="Inter, sans-serif">
            Hire agent: "Senior Dev"
          </text>

          <text x="34" y="158" fill="#9e9b94" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="500" letterSpacing="0.06em">
            REQUESTED BY
          </text>
          <text x="34" y="174" fill="#6c6a64" fontSize="10" fontFamily="Inter, sans-serif">
            CEO Agent · Budget: $50/mo
          </text>

          {/* Buttons */}
          <motion.rect
            x="34" y="196" width="90" height="30" rx="7"
            fill="#4daa62"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.3 }}
          />
          <text x="79" y="215" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">
            ✓ Approve
          </text>

          <motion.rect
            x="134" y="196" width="90" height="30" rx="7"
            fill="transparent" stroke="#2e2c28"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.3 }}
          />
          <text x="179" y="215" textAnchor="middle" fill="#5c5a54" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="500">
            ✕ Deny
          </text>
        </motion.g>

        {/* Second card below */}
        <motion.rect
          x="22" y="252" width="214" height="80" rx="12"
          fill="#1e1d1b" stroke="#2a2825"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        />
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <circle cx="46" cy="278" r="8" fill="#4fb8a4" opacity="0.15" />
          <text x="46" y="282" textAnchor="middle" fill="#4fb8a4" fontSize="9">◎</text>
          <text x="62" y="275" fill="#9e9b94" fontSize="10" fontFamily="Inter, sans-serif">Deploy: GPT wrapper v2</text>
          <text x="62" y="289" fill="#5c5a54" fontSize="9" fontFamily="Inter, sans-serif">PM Agent · No budget impact</text>
          <rect x="34" y="302" width="60" height="20" rx="5" fill="#252320" stroke="#2e2c28" />
          <text x="64" y="316" textAnchor="middle" fill="#6c6a64" fontSize="9" fontFamily="Inter, sans-serif">Review</text>
        </motion.g>
      </svg>
    </IllustrationWrap>
  );
}

/* ── Plugin Grid ─────────────────────────────────────────────────────────── */
function PluginGrid() {
  const plugins = [
    { name: "GitHub",   icon: "⬡", color: "#cc785c", installed: true  },
    { name: "Slack",    icon: "◈", color: "#4fb8a4", installed: true  },
    { name: "Notion",   icon: "□", color: "#e8a55a", installed: false },
    { name: "Stripe",   icon: "⊕", color: "#9e9b94", installed: false },
    { name: "Linear",   icon: "◎", color: "#4fb8a4", installed: true  },
    { name: "Jira",     icon: "◆", color: "#cc785c", installed: false },
  ];

  const cols = 2;

  return (
    <IllustrationWrap>
      <svg width="290" height="380" viewBox="0 0 290 380" fill="none">
        {/* Title */}
        <text x="145" y="32" textAnchor="middle" fill="#5c5a54" fontSize="10"
          fontFamily="Inter, sans-serif" fontWeight="500" letterSpacing="0.08em">
          PLUGIN MARKETPLACE
        </text>

        {plugins.map((p, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = 22 + col * 130;
          const y = 48 + row * 104;

          return (
            <motion.g
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.45 }}
            >
              {/* Card */}
              <rect x={x} y={y} width={116} height={90} rx="10"
                fill="#1e1d1b" stroke={p.installed ? p.color : "#252320"}
                strokeWidth={p.installed ? "1.5" : "1"}
                strokeOpacity={p.installed ? 0.5 : 1}
              />

              {/* Icon circle */}
              <circle cx={x + 24} cy={y + 28} r={16} fill={p.color} opacity="0.12" />
              <text x={x + 24} y={y + 33} textAnchor="middle"
                fill={p.color} fontSize="14" fontFamily="Inter, sans-serif">
                {p.icon}
              </text>

              {/* Name */}
              <text x={x + 48} y={y + 25} fill="#faf9f5" fontSize="10"
                fontFamily="Inter, sans-serif" fontWeight="500">
                {p.name}
              </text>
              <text x={x + 48} y={y + 38} fill="#5c5a54" fontSize="8"
                fontFamily="Inter, sans-serif">
                Integration
              </text>

              {/* Status */}
              {p.installed ? (
                <>
                  <rect x={x + 14} y={y + 60} width={88} height={20} rx="5"
                    fill="rgba(77,170,98,0.12)" />
                  <text x={x + 58} y={y + 73} textAnchor="middle"
                    fill="#4daa62" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="500">
                    ✓ Installed
                  </text>
                </>
              ) : (
                <>
                  <rect x={x + 14} y={y + 60} width={88} height={20} rx="5"
                    fill="#252320" stroke="#363330" />
                  <text x={x + 58} y={y + 73} textAnchor="middle"
                    fill="#6c6a64" fontSize="9" fontFamily="Inter, sans-serif">
                    + Install
                  </text>
                </>
              )}
            </motion.g>
          );
        })}
      </svg>
    </IllustrationWrap>
  );
}
