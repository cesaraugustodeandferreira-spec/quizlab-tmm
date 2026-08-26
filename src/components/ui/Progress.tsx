import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

export function Progress({
  value,
  max = 100,
  color = "accent",
  className,
  label,
}: {
  value: number;
  max?: number;
  color?: "accent" | "ok" | "bad" | "warn" | "auto";
  className?: string;
  label?: string;
}) {
  const pct = clamp((value / Math.max(max, 1)) * 100, 0, 100);
  const resolved =
    color === "auto" ? (pct >= 70 ? "ok" : pct >= 50 ? "accent" : pct >= 35 ? "warn" : "bad") : color;
  const barColor = {
    accent: "bg-accent",
    ok: "bg-ok",
    bad: "bg-bad",
    warn: "bg-warn",
  }[resolved];

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", barColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-pulse", className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
