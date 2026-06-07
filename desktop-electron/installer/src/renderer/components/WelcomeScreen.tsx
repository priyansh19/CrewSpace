import { motion } from "framer-motion";

const PILLARS = [
  { label: "3D office — watch agents work live",    icon: "⬡" },
  { label: "Budget guardrails — no bill surprises", icon: "◎" },
  { label: "One-click approval gates",              icon: "✦" },
];

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <div className="w-full h-full flex" style={{ background: "#faf9f5" }}>

      {/* ── Left decorative panel ─────────────────────────────────────── */}
      <div
        className="shrink-0 relative overflow-hidden flex flex-col items-center justify-center"
        style={{ width: 380, background: "#141413" }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "35%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(204,120,92,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Faint grid lines */}
        <svg
          style={{ position: "absolute", inset: 0, opacity: 0.04 }}
          width="380"
          height="600"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={i * 42}
              y1={0}
              x2={i * 42}
              y2={600}
              stroke="#faf9f5"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: 15 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={i * 42}
              x2={380}
              y2={i * 42}
              stroke="#faf9f5"
              strokeWidth="0.5"
            />
          ))}
        </svg>

        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: "relative", marginBottom: 36 }}
        >
          {/* Outer pulse ring */}
          <motion.div
            style={{
              position: "absolute",
              inset: -16,
              borderRadius: "50%",
              border: "1px solid rgba(204,120,92,0.35)",
            }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Inner pulse ring */}
          <motion.div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: "50%",
              border: "1px solid rgba(204,120,92,0.2)",
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />

          {/* The spike-mark at 80px — full 8-bar design with gradients */}
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
            <defs>
              <radialGradient id="ws-bg" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#252538" />
                <stop offset="100%" stopColor="#141422" />
              </radialGradient>
              <linearGradient id="ws-bar" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F2A07B" />
                <stop offset="100%" stopColor="#E07A5F" />
              </linearGradient>
            </defs>
            <rect width="24" height="24" rx="5" fill="url(#ws-bg)" />
            {/* N */}
            <rect x="10.5" y="1.5" width="3"   height="5"   rx="1" fill="url(#ws-bar)" />
            {/* S */}
            <rect x="10.5" y="17.5" width="3"  height="5"   rx="1" fill="url(#ws-bar)" />
            {/* W */}
            <rect x="1.5"  y="10.5" width="5"  height="3"   rx="1" fill="url(#ws-bar)" />
            {/* E */}
            <rect x="17.5" y="10.5" width="5"  height="3"   rx="1" fill="url(#ws-bar)" />
            {/* NE */}
            <rect x="15" y="3" width="2.5" height="5.5" rx="1" fill="url(#ws-bar)" transform="rotate(45 16.25 5.75)" />
            {/* NW */}
            <rect x="6.5" y="3" width="2.5" height="5.5" rx="1" fill="url(#ws-bar)" transform="rotate(-45 7.75 5.75)" />
            {/* SE */}
            <rect x="15" y="15.5" width="2.5" height="5.5" rx="1" fill="url(#ws-bar)" transform="rotate(-45 16.25 18.25)" />
            {/* SW */}
            <rect x="6.5" y="15.5" width="2.5" height="5.5" rx="1" fill="url(#ws-bar)" transform="rotate(45 7.75 18.25)" />
            {/* Terminal frame */}
            <rect x="7.5"  y="7.5"  width="9"  height="9"   rx="2"   fill="#FFFFFF" />
            {/* Terminal screen */}
            <rect x="9"    y="9.5"  width="6"  height="5.5" rx="1"   fill="#141422" />
            {/* > prompt */}
            <polygon points="9.8,10.8 11.8,12 9.8,13.2 9.8,12.5 11,12 9.8,11.5" fill="#FFFFFF" />
            {/* _ cursor */}
            <rect x="12.2" y="13" width="1.8" height="0.8" rx="0.4" fill="#FFFFFF" />
          </svg>
        </motion.div>

        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center" }}
        >
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 46,
              fontWeight: 400,
              color: "#faf9f5",
              letterSpacing: "-0.5px",
              lineHeight: 1.05,
            }}
          >
            CrewSpace
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "#5c5a54",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Control plane for AI companies
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          style={{
            position: "absolute",
            bottom: 36,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            padding: "0 32px",
          }}
        >
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ color: "#cc785c", fontSize: 14, lineHeight: 1 }}>{p.icon}</span>
              <span style={{ fontSize: 12, color: "#7a7870", fontWeight: 400 }}>{p.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Right content panel ────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-center"
        style={{ padding: "0 64px" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Label */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 24,
              padding: "4px 10px",
              borderRadius: 9999,
              background: "rgba(204,120,92,0.1)",
              border: "1px solid rgba(204,120,92,0.2)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#cc785c",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#cc785c",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Version 0.1
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 48,
              fontWeight: 400,
              color: "#141413",
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
              marginBottom: 18,
            }}
          >
            Your AI company,<br />
            <em style={{ fontStyle: "italic", color: "#cc785c" }}>built in minutes</em>
          </h1>

          {/* Body */}
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.75,
              color: "#5c5a54",
              maxWidth: 380,
              marginBottom: 32,
            }}
          >
            Walk a live 3D office, deploy AI agents with real roles, set
            budget guardrails, and approve high-stakes actions in one click —
            all on your machine, fully private.
          </p>

          {/* One-click install note */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(204,120,92,0.06)",
              border: "1px solid rgba(204,120,92,0.15)",
              maxWidth: 340,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="6" stroke="#cc785c" strokeWidth="1.1" />
              <path d="M6.5 4v3.5M6.5 9h.01" stroke="#cc785c" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 12, color: "#8e7060", lineHeight: 1.4 }}>
              One click — no config, no admin rights, no Docker required
            </span>
          </div>

          {/* Primary CTA — Install */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onGetStarted}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 32px",
              borderRadius: 10,
              background: "#cc785c",
              border: "none",
              cursor: "pointer",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.01em",
              boxShadow: "0 4px 20px rgba(204,120,92,0.35)",
              transition: "box-shadow 0.2s",
              marginBottom: 14,
            }}
          >
            {/* Download icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v8M5 7l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 12h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Install CrewSpace
          </motion.button>

          {/* Learn more */}
          <div>
            <button
              onClick={() => window.installerAPI.openExternal("https://crewspace.ing")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#8e8b82",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#cc785c")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8e8b82")}
            >
              Learn more
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path
                  d="M2 9L9 2M9 2H4M9 2v5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </motion.div>

        {/* Bottom footnote */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            right: 64,
            fontSize: 11,
            color: "#b5b0a6",
            letterSpacing: "0.04em",
          }}
        >
          On-premise · Private · Secure
        </div>
      </div>
    </div>
  );
}
