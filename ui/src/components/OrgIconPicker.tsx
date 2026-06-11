import { useState, useMemo, memo } from "react";
import { Dices, Palette } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanyPatternIcon } from "./CompanyPatternIcon";

/** Curated brand colors that produce distinct, attractive pattern icons. */
const ORG_BRAND_COLORS = [
  "#cc785c", "#5b8dc9", "#7b5ff5", "#2ecfc1", "#d946ef",
  "#84cc16", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6",
  "#ec4899", "#10b981", "#6366f1", "#f97316", "#14b8a6",
  "#a855f7", "#e11d48", "#3b82f6", "#22c55e", "#eab308",
  "#64748b", "#b45309", "#1e40af", "#be123c", "#047857",
] as const;

const PatternCell = memo(function PatternCell({
  companyName,
  brandColor,
  isSelected,
  onSelect,
}: {
  companyName: string;
  brandColor: string;
  isSelected: boolean;
  onSelect: (color: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(brandColor)}
      className={cn(
        "relative flex items-center justify-center rounded-xl overflow-hidden transition-all",
        "hover:scale-105 hover:shadow-md",
        isSelected
          ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-105 shadow-md"
          : "ring-1 ring-border/50"
      )}
      title={brandColor}
    >
      <CompanyPatternIcon
        companyName={companyName}
        brandColor={brandColor}
        className="w-12 h-12 rounded-xl"
      />
      {isSelected && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
      )}
    </button>
  );
});

interface OrgIconPickerProps {
  companyName: string;
  brandColor: string | null | undefined;
  onChange: (color: string) => void;
  children: React.ReactNode;
}

export function OrgIconPicker({ companyName, brandColor, onChange, children }: OrgIconPickerProps) {
  const [open, setOpen] = useState(false);

  const handleRandom = () => {
    const randomColor = ORG_BRAND_COLORS[Math.floor(Math.random() * ORG_BRAND_COLORS.length)];
    onChange(randomColor);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Choose an icon</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleRandom}
            title="Random color"
          >
            <Dices className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Current selection preview */}
        {brandColor && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
            <CompanyPatternIcon
              companyName={companyName}
              brandColor={brandColor}
              className="w-8 h-8 rounded-lg"
            />
            <span className="text-xs text-muted-foreground">Current pattern</span>
            <div
              className="ml-auto w-5 h-5 rounded-full border border-border/50"
              style={{ backgroundColor: brandColor }}
            />
          </div>
        )}

        {/* Pattern grid */}
        <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
          {ORG_BRAND_COLORS.map((color) => (
            <PatternCell
              key={color}
              companyName={companyName}
              brandColor={color}
              isSelected={brandColor?.toLowerCase() === color.toLowerCase()}
              onSelect={(c) => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
        </div>

        {/* Custom color */}
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Custom:</span>
          <input
            type="color"
            value={brandColor || "#cc785c"}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
          />
          <input
            type="text"
            value={brandColor ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                onChange(v);
              }
            }}
            placeholder="Auto"
            className="w-24 rounded-md border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
