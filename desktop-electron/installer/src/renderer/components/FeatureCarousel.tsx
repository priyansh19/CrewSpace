import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { featureSlides } from "../lib/features";
import { useCarousel } from "../hooks/useCarousel";
import SlideIllustration from "./SlideIllustration";

interface FeatureCarouselProps {
  installReady: boolean;
  installError: string | null;
  onComplete: () => void;
  onRetry: () => void;
}

export default function FeatureCarousel({
  installReady,
  installError,
  onComplete,
  onRetry,
}: FeatureCarouselProps) {
  const [showErrorModal, setShowErrorModal] = useState(false);

  const { index, progress, goTo, next, prev, setPaused } = useCarousel(
    featureSlides.length
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    },
    [prev, next]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (installReady) onComplete();
  }, [installReady, onComplete]);

  const slide = featureSlides[index];

  return (
    <div className="w-full h-full flex" style={{ background: "#faf9f5" }}>

      {/* ── LEFT: dark illustration panel ─────────────────────────────── */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          height: "100%",
          background: "#141413",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Slide progress bar along top edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(255,255,255,0.06)",
            zIndex: 10,
          }}
        >
          <motion.div
            style={{
              height: "100%",
              background: "#cc785c",
              originX: 0,
            }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.08, ease: "linear" }}
          />
        </div>

        {/* Ambient glow behind illustration */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(204,120,92,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Illustration — animated on slide change */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SlideIllustration slideId={slide.id} />
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators at bottom of dark panel */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          {featureSlides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                height: 4,
                width: i === index ? 20 : 4,
                borderRadius: 9999,
                background: i === index ? "#cc785c" : "rgba(255,255,255,0.18)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.3s, background 0.3s",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT: text + nav panel ────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 52px",
        }}
      >
        {/* Feature content — grows to fill */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.38, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Slide number badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 20,
                  padding: "3px 10px",
                  borderRadius: 9999,
                  background: "rgba(204,120,92,0.08)",
                  border: "1px solid rgba(204,120,92,0.18)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#cc785c",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {String(index + 1).padStart(2, "0")} / {String(featureSlides.length).padStart(2, "0")}
                </span>
              </div>

              {/* Title */}
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 38,
                  fontWeight: 400,
                  color: "#141413",
                  letterSpacing: "-0.4px",
                  lineHeight: 1.15,
                  marginBottom: 16,
                }}
              >
                {slide.title}
              </h2>

              {/* Body */}
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.75,
                  color: "#5c5a54",
                  marginBottom: 28,
                  maxWidth: 400,
                }}
              >
                {slide.body}
              </p>

              {/* Bullet features */}
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {slide.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: "#3d3d3a",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#cc785c",
                        flexShrink: 0,
                      }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Bottom controls ──────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "1px solid #ede7da",
          }}
        >
          {/* Nav arrows */}
          <div style={{ display: "flex", gap: 8 }}>
            <NavBtn onClick={prev} dir="prev" />
            <NavBtn onClick={next} dir="next" />
          </div>

          {/* Install status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
            }}
          >
            {installError ? (
              <span
                style={{
                  color: "#c64545",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  maxWidth: 360,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="7" cy="7" r="6.5" stroke="#c64545" />
                  <line x1="7" y1="4" x2="7" y2="8" stroke="#c64545" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="7" cy="10" r="0.75" fill="#c64545" />
                </svg>
                <span 
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
                  onClick={() => setShowErrorModal(true)}
                  title="Click to view full error"
                >
                  {installError.length > 80 ? installError.slice(0, 80) + "…" : installError}
                </span>
                <button
                  onClick={onRetry}
                  style={{
                    flexShrink: 0,
                    marginLeft: 4,
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: "1px solid #c64545",
                    background: "transparent",
                    color: "#c64545",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Retry
                </button>
              </span>
            ) : installReady ? (
              <span
                style={{
                  color: "#4daa62",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6.5" stroke="#4daa62" />
                  <polyline
                    points="4,7 6,9 10,5"
                    stroke="#4daa62"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Ready
              </span>
            ) : (
              <span
                style={{
                  color: "#8e8b82",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <PulsingDot />
                Installing in background…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && installError && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowErrorModal(false)}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              maxWidth: 540,
              width: "90%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16, color: "#c64545", display: "flex", alignItems: "center", gap: 8, fontFamily: "sans-serif", fontSize: 16, fontWeight: 600 }}>
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6.5" stroke="#c64545" strokeWidth="1.5" />
                <line x1="7" y1="4" x2="7" y2="8" stroke="#c64545" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="7" cy="10" r="0.75" fill="#c64545" />
              </svg>
              Installation Error
            </h3>
            <div style={{ flex: 1, overflowY: "auto", background: "#f8f9fa", padding: 14, borderRadius: 6, border: "1px solid #e9ecef", fontSize: 13, color: "#333", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace" }}>
              {installError}
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowErrorModal(false)}
                style={{
                  padding: "8px 18px",
                  background: "#141413",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function NavBtn({ onClick, dir }: { onClick: () => void; dir: "prev" | "next" }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous" : "Next"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid #e2dbd2",
        background: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#3d3d3a",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {dir === "prev" ? (
          <polyline points="9 11 5 7 9 3" />
        ) : (
          <polyline points="5 11 9 7 5 3" />
        )}
      </svg>
    </motion.button>
  );
}

function PulsingDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <motion.span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "#cc785c",
          opacity: 0.4,
        }}
        animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: "50%",
          background: "#cc785c",
        }}
      />
    </span>
  );
}
