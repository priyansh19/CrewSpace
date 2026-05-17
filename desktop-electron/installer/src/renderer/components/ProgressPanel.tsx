import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ProgressPanelProps {
  onComplete: () => void;
}

const stages = [
  { threshold: 0, label: "Extracting files…", detail: "Unpacking application payload" },
  { threshold: 0.35, label: "Creating shortcuts…", detail: "Adding Start Menu and Desktop entries" },
  { threshold: 0.7, label: "Finalizing setup…", detail: "Verifying installation integrity" },
];

export default function ProgressPanel({ onComplete }: ProgressPanelProps) {
  const [percent, setPercent] = useState(0);
  const [logs, setLogs] = useState<string[]>(["Initializing installer…"]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 400);
          return 100;
        }
        // Non-linear progress for realism
        const increment = prev < 30 ? 1.5 : prev < 70 ? 1.0 : 0.6;
        return Math.min(prev + increment, 100);
      });
    }, 80);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    const currentStage = stages.slice().reverse().find((s) => percent >= s.threshold * 100);
    if (currentStage && !logs.includes(currentStage.detail)) {
      setLogs((prev) => [...prev, currentStage.detail]);
    }
  }, [percent, logs]);

  const currentStage = stages.slice().reverse().find((s) => percent >= s.threshold * 100);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <h2
          className="font-display text-3xl text-ink text-center mb-2"
          style={{ letterSpacing: "-0.5px" }}
        >
          Installing CrewSpace
        </h2>
        <p className="text-sm text-muted text-center mb-8">
          This will only take a moment
        </p>

        {/* Progress bar */}
        <div className="w-full h-2 bg-hairline rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full bg-primary rounded-full"
            style={{ width: `${percent}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Stage label */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-sm font-medium text-ink">
            {currentStage?.label ?? "Preparing…"}
          </span>
          <span className="text-sm text-muted">{Math.round(percent)}%</span>
        </div>

        {/* Log toggle */}
        <button
          onClick={() => setShowLogs((s) => !s)}
          className="text-xs text-muted-soft hover:text-muted transition-colors mb-2"
        >
          {showLogs ? "Hide details" : "Show details"}
        </button>

        {/* Log panel */}
        {showLogs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="w-full bg-surface-dark rounded-lg p-3 overflow-hidden"
          >
            <div className="h-24 overflow-y-auto space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-[11px] font-mono text-on-dark-soft">
                  <span className="text-accent-teal mr-2">→</span>
                  {log}
                </div>
              ))}
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-[11px] font-mono text-muted-soft"
              >
                _
              </motion.div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
