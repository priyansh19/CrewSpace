import type { InstallStep } from "../App";

interface StepIndicatorProps {
  step: InstallStep;
}

const steps: { key: InstallStep; label: string }[] = [
  { key: "welcome", label: "Welcome" },
  { key: "carousel", label: "Features" },
  { key: "installing", label: "Installing" },
  { key: "complete", label: "Complete" },
];

export default function StepIndicator({ step }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;

        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className={[
                  "w-2 h-2 rounded-full transition-colors duration-300",
                  isActive && "bg-primary scale-125",
                  isDone && "bg-success",
                  !isActive && !isDone && "bg-hairline",
                ].join(" ")}
              />
              <span
                className={[
                  "text-[11px] font-medium transition-colors duration-300",
                  isActive && "text-ink",
                  isDone && "text-muted",
                  !isActive && !isDone && "text-muted-soft",
                ].join(" ")}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  "w-6 h-px transition-colors duration-300",
                  isDone ? "bg-success" : "bg-hairline",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
