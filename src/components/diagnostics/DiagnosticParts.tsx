"use client";

import { Badge } from "@/components/ui/Badge";
import { masteryOf, masteryTone } from "@/lib/scoring";
import { pctText } from "@/lib/utils";

export function MasteryBadge({ pct }: { pct: number | null | undefined }) {
  const level = masteryOf(pct);
  if (!level) return <Badge tone="neutral">Sem dados</Badge>;
  const tone = masteryTone(level);
  return (
    <Badge tone={tone}>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current opacity-80"
      />
      {pctText(pct)} · {level}
    </Badge>
  );
}

interface TimelineItem {
  title: string;
  description?: string;
  time?: string;
  tone?: "accent" | "ok" | "bad" | "warn" | "faint";
}

const dotColors = {
  accent: "bg-accent ring-accent/30",
  ok: "bg-ok ring-ok/30",
  bad: "bg-bad ring-bad/30",
  warn: "bg-warn ring-warn/30",
  faint: "bg-faint ring-white/20",
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return null;
  return (
    <ol className="relative space-y-6 pl-1">
      {items.map((item, i) => (
        <li key={i} className="relative flex gap-4">
          {i < items.length - 1 && (
            <span aria-hidden className="absolute top-5 left-[7px] h-[calc(100%+4px)] w-px bg-line-strong" />
          )}
          <span
            aria-hidden
            className={`mt-1 size-3.5 shrink-0 rounded-full ring-4 ${dotColors[item.tone ?? "faint"]}`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-medium text-ink">{item.title}</p>
              {item.time && <span className="text-xs text-faint">{item.time}</span>}
            </div>
            {item.description && <p className="mt-0.5 text-sm text-mute">{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DiffBlock({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: string;
  newValue: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line" aria-label={`${label}: de ${oldValue} para ${newValue}`}>
      <p className="border-b border-line bg-surface px-4 py-2 text-xs font-semibold tracking-wide text-mute uppercase">
        {label}
      </p>
      <p className="flex items-center gap-2 border-b border-line bg-bad-deep px-4 py-2 text-sm text-bad line-through decoration-bad/40">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 12h14" />
        </svg>
        {oldValue}
      </p>
      <p className="flex items-center gap-2 bg-ok-deep px-4 py-2 text-sm text-ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {newValue}
      </p>
    </div>
  );
}
