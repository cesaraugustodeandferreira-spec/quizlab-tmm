import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

const sizes = {
  sm: "size-8 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof sizes }) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-accent-deep font-semibold text-accent-bright ring-1 ring-line-strong",
        sizes[size],
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
