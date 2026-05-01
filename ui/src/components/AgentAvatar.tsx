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

function makeSvgResponsive(svg: string): string {
  // Remove fixed width/height and add responsive sizing
  return svg
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="100%"')
    .replace(/<svg/, '<svg style="width:100%;height:100%;display:block;"');
}

export function AgentAvatar({
  agent,
  size = "sm",
  animate = true,
  className,
  fallbackIcon,
}: AgentAvatarProps) {
  const svgHtml = useMemo(() => {
    const seed = agent?.icon || agent?.id || agent?.name || "unknown";
    const avatar = createAvatar(adventurer, {
      seed,
      size: SIZE_PX[size],
      backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"],
    });
    return makeSvgResponsive(avatar.toString());
  }, [agent?.id, agent?.name, size]);

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
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
