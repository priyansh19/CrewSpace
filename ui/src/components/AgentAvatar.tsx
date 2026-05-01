import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { adventurer } from "@dicebear/collection";
import { cn } from "@/lib/utils";
import { getAgentIcon } from "../lib/agent-icons";

export type AgentAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AgentLike {
  id: string;
  name?: string;
  icon?: string | null;
}

interface AgentAvatarProps {
  agent: AgentLike | null | undefined;
  size?: AgentAvatarSize;
  animate?: boolean;
  className?: string;
  fallbackIcon?: string | null;
}

const SIZE_PX: Record<AgentAvatarSize, number> = {
  xs: 64,
  sm: 96,
  md: 128,
  lg: 192,
  xl: 256,
};

const CONTAINER_SIZE: Record<AgentAvatarSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

const TEXT_SIZE: Record<AgentAvatarSize, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
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

/** Generate a dicebear avatar as a base64 data URI. Returns null on failure. */
export function tryDicebearDataUri(seed: string, sizePx: number): string | null {
  try {
    const avatar = createAvatar(adventurer, {
      seed,
      size: sizePx,
      backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"],
    });
    const svg = avatar.toString();
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    return null;
  }
}

export function AgentAvatar({
  agent,
  size = "sm",
  animate = true,
  className,
  fallbackIcon,
}: AgentAvatarProps) {
  const seed = agent?.icon || agent?.id || agent?.name || "unknown";
  const initial = (agent?.name?.trim()?.charAt(0) || "?").toUpperCase();
  const hsl = useMemo(() => seedToHsl(seed), [seed]);

  const dataUri = useMemo(() => {
    if (!agent) return null;
    return tryDicebearDataUri(seed, SIZE_PX[size]);
  }, [agent, seed, size]);

  if (!agent) {
    const FallbackIcon = getAgentIcon(fallbackIcon);
    return (
      <div
        className={cn(
          "rounded-full bg-muted flex items-center justify-center overflow-hidden",
          CONTAINER_SIZE[size],
          className,
        )}
      >
        <FallbackIcon className="h-1/2 w-1/2 text-muted-foreground" />
      </div>
    );
  }

  if (dataUri) {
    return (
      <div
        className={cn(
          "rounded-full flex items-center justify-center overflow-hidden shrink-0",
          "bg-background/60 border border-border/50",
          CONTAINER_SIZE[size],
          animate && "agent-avatar-animated",
          className,
        )}
        title={agent.name}
      >
        <img
          src={dataUri}
          alt={agent.name || "Agent"}
          className="h-full w-full object-cover"
          draggable={false}
          loading="eager"
        />
      </div>
    );
  }

  // Fallback: deterministic colored initial circle
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center overflow-hidden shrink-0",
        "border border-border/50",
        CONTAINER_SIZE[size],
        animate && "agent-avatar-animated",
        className,
      )}
      title={agent.name}
      style={{ backgroundColor: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)` }}
    >
      <span
        className={cn("font-bold text-white select-none", TEXT_SIZE[size])}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
      >
        {initial}
      </span>
    </div>
  );
}
