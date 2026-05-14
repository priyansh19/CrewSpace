import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function LiveConnectionBadge() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium select-none">
      <span className="relative flex h-2 w-2">
        {online && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            online ? "bg-success" : "bg-destructive",
          )}
        />
      </span>
      <span
        className={
          online
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        }
      >
        {online ? "Live" : "Offline"}
      </span>
    </div>
  );
}

