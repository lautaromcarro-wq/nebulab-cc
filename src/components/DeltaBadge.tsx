// src/components/DeltaBadge.tsx
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

function delta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

interface DeltaBadgeProps {
  current: number;
  prev: number;
  /** Set true when lower is better (e.g. CPA, CPM, bounce rate) */
  inverse?: boolean;
  /** Show value text only, no icon */
  compact?: boolean;
}

export function DeltaBadge({ current, prev, inverse = false, compact = false }: DeltaBadgeProps) {
  const d = delta(current, prev);
  if (d === null) return <span className="text-[10px] text-muted-foreground">–</span>;
  const positive = inverse ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-medium",
      neutral ? "text-muted-foreground" : positive ? "text-success" : "text-destructive",
    )}>
      {!compact && (neutral ? <Minus className="h-2.5 w-2.5" /> : positive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />)}
      {Math.abs(d).toFixed(1)}%
    </span>
  );
}
