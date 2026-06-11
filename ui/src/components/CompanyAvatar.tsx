import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";
import { cn } from "@/lib/utils";

export type CompanyAvatarSize = "sm" | "md" | "lg";

interface CompanyAvatarProps {
  companyName: string;
  logoUrl?: string | null;
  size?: CompanyAvatarSize;
  className?: string;
  selected?: boolean;
}

const CONTAINER_SIZE: Record<CompanyAvatarSize, string> = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

const SIZE_PX: Record<CompanyAvatarSize, number> = {
  sm: 64,
  md: 96,
  lg: 128,
};

/** Deterministic HSL color from a string seed. */
function seedToHsl(seed: string): { h: number; s: number; l: number } {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const h = (hash >>> 0) % 360;
  const s = 55 + ((hash >>> 8) % 20);
  const l = 45 + ((hash >>> 16) % 15);
  return { h, s, l };
}

function svgToBase64DataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const base64 = btoa(bin);
  return `data:image/svg+xml;base64,${base64}`;
}

/** Generate a dicebear shapes avatar as a base64 data URI. Returns null on failure. */
function tryShapesDataUri(seed: string, sizePx: number): string | null {
  try {
    const avatar = createAvatar(shapes, {
      seed,
      size: sizePx,
    });
    const svg = avatar.toString();
    return svgToBase64DataUri(svg);
  } catch {
    return null;
  }
}

export function CompanyAvatar({
  companyName,
  logoUrl,
  size = "md",
  className,
  selected = false,
}: CompanyAvatarProps) {
  const seed = companyName || "unknown";
  const initial = (companyName?.trim()?.charAt(0) || "?").toUpperCase();
  const hsl = useMemo(() => seedToHsl(seed), [seed]);

  const hasLogo = typeof logoUrl === "string" && logoUrl.trim().length > 0;

  const dataUri = useMemo(() => {
    if (hasLogo) return null;
    return tryShapesDataUri(seed, SIZE_PX[size]);
  }, [hasLogo, seed, size]);

  if (hasLogo) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden shrink-0",
          "bg-background/60 border border-border/50 shadow-sm",
          selected ? "rounded-[14px]" : "rounded-[22px]",
          CONTAINER_SIZE[size],
          "company-avatar-animated",
          className,
        )}
      >
        <img
          src={logoUrl!}
          alt={companyName}
          className="h-full w-full object-cover"
          draggable={false}
          loading="eager"
        />
      </div>
    );
  }

  if (dataUri) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden shrink-0",
          "bg-background/60 border border-border/50 shadow-sm",
          selected ? "rounded-[14px]" : "rounded-[22px]",
          CONTAINER_SIZE[size],
          "company-avatar-animated",
          className,
        )}
        title={companyName}
      >
        <img
          src={dataUri}
          alt={companyName}
          className="h-full w-full object-cover"
          draggable={false}
          loading="eager"
        />
      </div>
    );
  }

  // Fallback: building icon on colored background
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden shrink-0",
        "border border-border/50 shadow-sm",
        selected ? "rounded-[14px]" : "rounded-[22px]",
        CONTAINER_SIZE[size],
        "company-avatar-animated",
        className,
      )}
      title={companyName}
      style={{ backgroundColor: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)` }}
    >
      <Building2 className="h-1/2 w-1/2 text-primary-foreground/90" />
      <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-primary-foreground/70 select-none">
        {initial}
      </span>
    </div>
  );
}
