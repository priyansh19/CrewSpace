import type { InstallStep } from "../App";
import StepIndicator from "./StepIndicator";

interface InstallerLayoutProps {
  step: InstallStep;
  children: React.ReactNode;
}

export default function InstallerLayout({ step, children }: InstallerLayoutProps) {
  return (
    <div className="relative w-full h-full flex flex-col bg-canvas overflow-hidden">
      {/* Custom title bar */}
      <div
        className="shrink-0 h-8 flex items-center justify-between px-3 select-none"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" fill="#141413" />
            <path d="M16 6 L16 26 M6 16 L26 16" stroke="#faf9f5" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M9 9 L23 23 M23 9 L9 23" stroke="#faf9f5" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="text-[11px] font-medium text-muted">CrewSpace Setup</span>
        </div>

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <button
            onClick={() => window.installerAPI.minimizeWindow()}
            className="w-8 h-6 flex items-center justify-center rounded hover:bg-surface-card transition-colors"
            aria-label="Minimize"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            onClick={() => window.installerAPI.closeWindow()}
            className="w-8 h-6 flex items-center justify-center rounded hover:bg-error hover:text-white transition-colors text-muted"
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="shrink-0 pt-4 pb-2 flex justify-center">
        <StepIndicator step={step} />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 px-8 pb-6">
        {children}
      </div>
    </div>
  );
}
