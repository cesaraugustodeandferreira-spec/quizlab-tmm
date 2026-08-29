import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "ok" | "bad" | "warn";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-white/[0.07] text-mute",
  accent: "bg-accent-deep text-accent-bright",
  ok: "bg-ok-deep text-ok",
  bad: "bg-bad-deep text-bad",
  warn: "bg-warn-deep text-warn",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-200 ease-out",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: "ok" | "bad" | "warn" | "accent" | "faint" }) {
  const map = {
    ok: "bg-ok",
    bad: "bg-bad",
    warn: "bg-warn",
    accent: "bg-accent-bright",
    faint: "bg-faint",
  };
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", map[tone])} />;
}
