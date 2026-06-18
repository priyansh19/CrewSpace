import type { ReactNode } from "react";

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
}

export function SidebarSection({ label, children }: SidebarSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 pt-4 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
