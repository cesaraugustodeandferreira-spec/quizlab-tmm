"use client";

import { cn } from "@/lib/utils";
import { masteryOf, masteryTone } from "@/lib/scoring";
import { Dot } from "@/components/ui/Badge";
import { pctText } from "@/lib/utils";

export interface BarItem {
  label: string;
  value: number | null;
  n?: number;
  semantic?: boolean;
}

export function BarList({
  items,
  emptyLabel = "Sem dados suficientes.",
  className,
  semantic = false,
}: {
  items: BarItem[];
  emptyLabel?: string;
  className?: string;
  semantic?: boolean;
}) {
  if (!items.length) {
    return <p className="py-6 text-center text-sm text-faint">{emptyLabel}</p>;
  }

  const maxVal = Math.max(...items.map((i) => i.value ?? 0), 1);

  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => {
        const v = item.value ?? 0;
        const useSemantic = item.semantic ?? semantic;
        const intensity = useSemantic
          ? undefined
          : `color-mix(in srgb, #2563eb ${Math.round(30 + (v / maxVal) * 70)}%, #16171b)`;
        return (
          <li key={item.label} className="group">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                {useSemantic && masteryOf(v) && (
                  <Dot tone={masteryTone(masteryOf(v)!)} />
                )}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="tnum shrink-0 text-sm font-semibold text-ink">
                {pctText(item.value)}
                {typeof item.n === "number" && (
                  <span className="ml-1.5 font-sans text-xs font-normal text-faint">
                    ({item.n})
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${(v / maxVal) * 100}%`,
                  background:
                    intensity ??
                    (v >= 70 ? "#3ed598" : v >= 50 ? "#2563eb" : v >= 35 ? "#f5b85c" : "#f09595"),
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DonutStat({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const R = 15.9155;
  let offset = 25;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 42 42" className="size-32 -rotate-0" role="img" aria-label="Distribuição de respostas">
        <circle cx="21" cy="21" r={R} fill="none" stroke="#1c1d23" strokeWidth="6" />
        {total > 0 &&
          segments.map((s) => {
            const frac = (s.value / total) * 100;
            const el = (
              <circle
                key={s.label}
                cx="21"
                cy="21"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="6"
                strokeDasharray={`${frac} ${100 - frac}`}
                strokeDashoffset={offset}
              />
            );
            offset -= frac;
            return el;
          })}
      </svg>
      <ul className="space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-mute">{s.label}</span>
            <span className="tnum ml-auto pl-4 font-semibold text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineEvolution({
  points,
}: {
  points: { label: string; value: number | null }[];
}) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-faint">Nenhum quiz realizado ainda.</p>;
  }

  const W = 560;
  const H = 200;
  const PAD_X = 28;
  const PAD_Y = 24;
  const valid = points.filter((p) => p.value !== null);
  const stepX =
    points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0;

  const xAt = (i: number) =>
    points.length > 1 ? PAD_X + i * stepX : W / 2;
  const yAt = (v: number) => H - PAD_Y - ((v / 100) * (H - PAD_Y * 2));

  const path = valid
    .map((p, vi) => `${vi === 0 ? "M" : "L"} ${xAt(points.indexOf(p))} ${yAt(p.value ?? 0)}`)
    .join(" ");

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução do aproveitamento ao longo dos quizzes">
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={PAD_X} x2={W - PAD_X} y1={yAt(g)} y2={yAt(g)} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 5" />
            <text x={PAD_X - 8} y={yAt(g) + 4} textAnchor="end" fontSize="10" fill="#6b6e76">
              {g}
            </text>
          </g>
        ))}
        {valid.length > 1 && (
          <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {points.map((p, i) =>
          p.value === null ? null : (
            <g key={i}>
              <circle cx={xAt(i)} cy={yAt(p.value)} r="4.5" fill="#16171b" stroke="#3b82f6" strokeWidth="2.5" />
              <title>{`${p.label}: ${Math.round(p.value)}%`}</title>
            </g>
          ),
        )}
      </svg>
      <figcaption className="mt-2 flex justify-between px-2 text-[11px] text-faint">
        {points.map((p, i) => (
          <span key={i} className="max-w-24 truncate">
            {p.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
