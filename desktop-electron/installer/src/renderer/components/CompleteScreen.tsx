import { motion } from "framer-motion";

export default function CompleteScreen() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#faf9f5",
      }}
    >
      {/* ── Left decorative panel (matching Welcome) ───────────────────── */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          height: "100%",
          background: "#141413",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Grid */}
        <svg style={{ position: "absolute", inset: 0, opacity: 0.04 }} width="380" height="600">
          {Array.from({ length: 10 }, (_, i) => (
            <line key={`v${i}`} x1={i * 42} y1={0} x2={i * 42 + 80} y2={600} stroke="#faf9f5" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 15 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 42} x2={380} y2={i * 42} stroke="#faf9f5" strokeWidth="0.5" />
          ))}
        </svg>

        {/* Success ring animation */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          {/* Expanding rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              style={{
                position: "absolute",
                borderRadius: "50%",
                border: "1px solid rgba(77,170,98,0.3)",
                inset: -(i + 1) * 22,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.2 + i * 0.18,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}

          {/* Checkmark circle */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(77,170,98,0.15)",
              border: "2px solid #4daa62",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <motion.polyline
                points="7,16 13,22 25,10"
                stroke="#4daa62"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.5, duration: 0.45, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          style={{ textAlign: "center" }}
        >
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 36,
              fontWeight: 400,
              color: "#faf9f5",
              letterSpacing: "-0.3px",
              lineHeight: 1.1,
            }}
          >
            All done
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#5c5a54", letterSpacing: "0.04em" }}>
            CrewSpace is ready on your machine
          </div>
        </motion.div>

        {/* Bottom badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          style={{
            position: "absolute",
            bottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 14px",
            borderRadius: 9999,
            background: "rgba(77,170,98,0.1)",
            border: "1px solid rgba(77,170,98,0.2)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4daa62", display: "block" }} />
          <span style={{ fontSize: 11, color: "#4daa62", fontWeight: 500 }}>
            Installation successful
          </span>
        </motion.div>
      </div>

      {/* ── Right content panel ────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 64px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Success badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 24,
              padding: "4px 10px",
              borderRadius: 9999,
              background: "rgba(77,170,98,0.08)",
              border: "1px solid rgba(77,170,98,0.2)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4daa62", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "#4daa62", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Ready to launch
            </span>
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 46,
              fontWeight: 400,
              color: "#141413",
              letterSpacing: "-0.4px",
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            CrewSpace is installed<br />
            <em style={{ fontStyle: "italic", color: "#4daa62" }}>and ready</em>
          </h2>

          {/* Body */}
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.75,
              color: "#5c5a54",
              maxWidth: 360,
              marginBottom: 40,
            }}
          >
            Your AI company control plane is set up on your machine.
            Launch it now to create your first AI organization.
          </p>

          {/* Desktop shortcut note */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 10,
              background: "#f5f0e8",
              border: "1px solid #e2dbd2",
              marginBottom: 32,
              maxWidth: 380,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="#8e8b82" strokeWidth="1.2" />
              <path d="M5 8.5L7 10.5L11 6.5" stroke="#8e8b82" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 12, color: "#6c6a64" }}>
              Desktop shortcut created — find CrewSpace in your Start Menu
            </span>
          </div>

          {/* Launch button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              window.installerAPI.launchApp();
              setTimeout(() => window.installerAPI.closeWindow(), 600);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 32px",
              borderRadius: 10,
              background: "#141413",
              border: "none",
              cursor: "pointer",
              color: "#faf9f5",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.01em",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              marginBottom: 14,
            }}
          >
            Launch CrewSpace
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>

          {/* Secondary action */}
          <div>
            <button
              onClick={() => window.installerAPI.openInstallFolder()}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#8e8b82",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#3d3d3a")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8e8b82")}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 7V10C2 10.6 2.4 11 3 11H10C10.6 11 11 10.6 11 10V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M6.5 2V8M4 5.5L6.5 8L9 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Open installation folder
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
