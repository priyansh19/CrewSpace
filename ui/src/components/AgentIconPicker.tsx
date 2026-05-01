import { useState, useMemo, memo } from "react";
import { Dices } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAgentIcon } from "../lib/agent-icons";
import { tryDicebearDataUri } from "./AgentAvatar";

/** Curated seed pool — each produces a distinct Dicebear adventurer avatar. */
const AVATAR_SEEDS = [
  "Nova", "Orion", "Kai", "Luna", "Phoenix",
  "Jett", "Zoe", "Atlas", "Mae", "Ezra",
  "Ivy", "Finn", "Juno", "Silas", "Cleo",
  "Theo", "Wren", "Elara", "Iris", "Rowan",
  "Cyrus", "Sage", "Remy", "Dahlia", "Koa",
  "Sienna", "Nico", "Arlo", "Cade", "Reese",
  "Lexi", "Milo", "Nina", "Liza", "Tessa",
  "Mark", "Jake", "Carl", "Russel", "Rory",
] as const;

const PREVIEW_SIZE_PX = 64;

function generateRandomSeed(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const AvatarCell = memo(function AvatarCell({
  seed,
  isSelected,
  onSelect,
}: {
  seed: string;
  isSelected: boolean;
  onSelect: (seed: string) => void;
}) {
  const dataUri = useMemo(
    () => tryDicebearDataUri(seed, PREVIEW_SIZE_PX),
    [seed]
  );

  if (!dataUri) return null;

  return (
    <button
      onClick={() => onSelect(seed)}
      className={cn(
        "relative flex items-center justify-center rounded-xl overflow-hidden transition-all",
        "hover:scale-105 hover:shadow-md",
        isSelected
          ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-105 shadow-md"
          : "ring-1 ring-border/50"
      )}
      title={seed}
    >
      <img
        src={dataUri}
        alt={seed}
        className="h-16 w-16 object-cover"
        draggable={false}
        loading="lazy"
      />
      {isSelected && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
      )}
    </button>
  );
});

interface AgentIconProps {
  icon: string | null | undefined;
  className?: string;
}

/** Small inline icon — kept for backward compat in chat/mentions. */
export function AgentIcon({ icon, className }: AgentIconProps) {
  const Icon = getAgentIcon(icon);
  return <Icon className={className} />;
}

interface AgentIconPickerProps {
  value: string | null | undefined;
  onChange: (icon: string) => void;
  children: React.ReactNode;
}

export function AgentIconPicker({ value, onChange, children }: AgentIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return [...AVATAR_SEEDS];
    const q = search.toLowerCase().trim();
    return AVATAR_SEEDS.filter((s) => s.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = (seed: string) => {
    onChange(seed);
    setOpen(false);
    setSearch("");
  };

  const handleRandom = () => {
    const seed = generateRandomSeed();
    onChange(seed);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        {/* Search + Random */}
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Search avatars..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm flex-1"
            autoFocus
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleRandom}
            title="Random avatar"
          >
            <Dices className="h-4 w-4" />
          </Button>
        </div>

        {/* Current selection preview */}
        {value && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
            <span className="text-xs text-muted-foreground">Current:</span>
            <AvatarCell seed={value} isSelected={false} onSelect={() => {}} />
            <span className="text-xs font-medium">{value}</span>
          </div>
        )}

        {/* Avatar grid */}
        <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          {filtered.map((seed) => (
            <AvatarCell
              key={seed}
              seed={seed}
              isSelected={value === seed}
              onSelect={handleSelect}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-4 text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">
                No curated avatars match “{search}”
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleRandom}
              >
                <Dices className="h-3 w-3 mr-1" />
                Generate random
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
