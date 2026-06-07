import { useState } from "react";
import type { InstallStep } from "../App";
import StepIndicator from "./StepIndicator";

interface InstallerLayoutProps {
  step: InstallStep;
  children: React.ReactNode;
}

function TitleBarBtn({
  onClick,
  label,
  hoverBg,
  children,
}: {
  onClick: () => void;
  label: string;
  hoverBg: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30,
        height: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        border: "none",
        cursor: "pointer",
        background: hov ? hoverBg : "transparent",
        color: hov ? "#fff" : "#5c5a54",
        transition: "background 0.15s, color 0.15s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function InstallerLayout({ step, children }: InstallerLayoutProps) {
  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: "#141413" }}
    >
      {/* ── Title bar ─────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between select-none"
        style={{
          height: 40,
          paddingLeft: 14,
          paddingRight: 8,
          WebkitAppRegion: "drag",
        } as React.CSSProperties}
      >
        {/* Logo + app name */}
        <div className="flex items-center gap-2" style={{ minWidth: 160 }}>
          {/* Spike-mark icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <defs>
              <radialGradient id="il-bg" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#252538" />
                <stop offset="100%" stopColor="#141422" />
              </radialGradient>
              <linearGradient id="il-bar" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F2A07B" />
                <stop offset="100%" stopColor="#E07A5F" />
              </linearGradient>
            </defs>
            <rect width="24" height="24" rx="5" fill="url(#il-bg)" />
            <rect x="10.5" y="2"    width="3"   height="4.5" rx="1" fill="url(#il-bar)" />
            <rect x="10.5" y="17.5" width="3"   height="4.5" rx="1" fill="url(#il-bar)" />
            <rect x="2"    y="10.5" width="4.5" height="3"   rx="1" fill="url(#il-bar)" />
            <rect x="17.5" y="10.5" width="4.5" height="3"   rx="1" fill="url(#il-bar)" />
            <rect x="15"   y="3.5"  width="2.5" height="5.5" rx="1" fill="url(#il-bar)" transform="rotate(45 16.25 6.25)" />
            <rect x="6.5"  y="3.5"  width="2.5" height="5.5" rx="1" fill="url(#il-bar)" transform="rotate(-45 7.75 6.25)" />
            <rect x="15"   y="15"   width="2.5" height="5.5" rx="1" fill="url(#il-bar)" transform="rotate(-45 16.25 17.75)" />
            <rect x="6.5"  y="15"   width="2.5" height="5.5" rx="1" fill="url(#il-bar)" transform="rotate(45 7.75 17.75)" />
            <rect x="7.5"  y="7.5"  width="9"   height="9"   rx="2" fill="#FFFFFF" />
            <rect x="9"    y="9.5"  width="6"   height="5.5" rx="1" fill="#141422" />
            <polygon points="9.8,10.8 11.8,12 9.8,13.2 9.8,12.5 11,12 9.8,11.5" fill="#FFFFFF" />
            <rect x="12.2" y="13"   width="1.8" height="0.8" rx="0.4" fill="#FFFFFF" />
          </svg>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#5c5a54",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            CrewSpace Setup
          </span>
        </div>

        {/* Step indicator — center */}
        <StepIndicator step={step} />

        {/* Window controls */}
        <div
          className="flex items-center gap-0.5"
          style={{
            minWidth: 160,
            justifyContent: "flex-end",
            WebkitAppRegion: "no-drag",
          } as React.CSSProperties}
        >
          <TitleBarBtn
            onClick={() => window.installerAPI.minimizeWindow()}
            label="Minimize"
            hoverBg="#2a2825"
          >
            <svg width="11" height="2" viewBox="0 0 11 2" fill="currentColor">
              <rect width="11" height="2" rx="1" />
            </svg>
          </TitleBarBtn>
          <TitleBarBtn
            onClick={() => window.installerAPI.closeWindow()}
            label="Close"
            hoverBg="#c64545"
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="8" y2="8" />
              <line x1="8" y1="1" x2="1" y2="8" />
            </svg>
          </TitleBarBtn>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 overflow-hidden"
        style={{ background: "#faf9f5" }}
      >
        {children}
      </div>
    </div>
  );
}
