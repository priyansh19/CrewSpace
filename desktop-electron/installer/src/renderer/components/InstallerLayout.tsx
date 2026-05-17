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
            <rect width="24" height="24" rx="5" fill="#252538" />
            <rect x="10.5" y="2"    width="3"   height="4.5" rx="1" fill="#E07A5F" />
            <rect x="10.5" y="17.5" width="3"   height="4.5" rx="1" fill="#E07A5F" />
            <rect x="2"    y="10.5" width="4.5" height="3"   rx="1" fill="#E07A5F" />
            <rect x="17.5" y="10.5" width="4.5" height="3"   rx="1" fill="#E07A5F" />
            <rect x="8"    y="8"    width="8"   height="8"   rx="1.5" fill="#FFFFFF" />
            <polygon
              points="10.5,10.8 13.2,12 10.5,13.2 10.5,12.4 12,12 10.5,11.6"
              fill="#252538"
            />
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
