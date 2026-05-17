import type { InstallStep } from "../App";

const steps: { key: InstallStep; label: string }[] = [
  { key: "welcome",  label: "Welcome"    },
  { key: "carousel", label: "Installing" },
  { key: "complete", label: "Complete"   },
];

export default function StepIndicator({ step }: { step: InstallStep }) {
  const current = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-0" style={{ userSelect: "none" }}>
      {steps.map((s, i) => {
        const done   = i < current;
        const active = i === current;

        return (
          <div key={s.key} className="flex items-center">
            {/* Node */}
            <div className="flex items-center gap-1.5">
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: done
                    ? "#4daa62"
                    : active
                    ? "#cc785c"
                    : "transparent",
                  border: done || active ? "none" : "1.5px solid #3a3834",
                  transition: "all 0.3s",
                }}
              >
                {done ? (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <polyline
                      points="1.5,4.5 3.5,6.5 7.5,2.5"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: active ? "#fff" : "#3a3834",
                      lineHeight: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 500 : 400,
                  color: done
                    ? "#4daa62"
                    : active
                    ? "#e8e2d8"
                    : "#3a3834",
                  transition: "color 0.3s",
                  letterSpacing: "0.01em",
                }}
              >
                {s.label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 28,
                  height: 1,
                  margin: "0 8px",
                  background: i < current ? "#4daa62" : "#2e2c28",
                  transition: "background 0.4s",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
