"use client";

import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

export function TimerRing({
  secondsLeft,
  totalSeconds,
  size = "md",
}: {
  secondsLeft: number;
  totalSeconds: number;
  size?: "md" | "lg";
}) {
  const total = Math.max(totalSeconds, 1);
  const remaining = clamp(secondsLeft / 1000 / total, 0, 1);
  const secs = Math.ceil(secondsLeft / 1000);
  const tone = remaining > 0.5 ? "#3b82f6" : remaining > 0.2 ? "#f5b85c" : "#f09595";
  const R = 15.9155;
  const dash = remaining * 100;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        viewBox="0 0 42 42"
        className={cn(size === "lg" ? "size-44 sm:size-56" : "size-24")}
        role="timer"
        aria-live="off"
      >
        <circle cx="21" cy="21" r={R} fill="none" stroke="#1c1d23" strokeWidth="4" />
        <circle
          cx="21"
          cy="21"
          r={R}
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${100 - dash}`}
          strokeDashoffset={25}
          transform="rotate(-90 21 21)"
          className="transition-[stroke-dasharray] duration-200 ease-linear"
        />
      </svg>
      <span
        aria-hidden
        className={cn(
          "tnum absolute inset-0 flex flex-col items-center justify-center font-bold leading-none",
          size === "lg" ? "text-7xl sm:text-8xl" : "text-3xl",
        )}
        style={{ color: tone }}
      >
        {secs}
      </span>
      <span aria-live="polite" className="sr-only">
        {secs} segundos restantes
      </span>
    </div>
  );
}
