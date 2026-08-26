"use client";

import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export function CodeBlocksInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setCharAt = (index: number, char: string) => {
    const next = [...chars];
    next[index] = char;
    onChange(next.join(""));
  };

  const handleChange = (i: number, raw: string) => {
    const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!clean) {
      setCharAt(i, "");
      return;
    }
    if (clean.length > 1) {
      const next = [...chars];
      let cursor = i;
      for (const ch of clean) {
        if (cursor > 5) break;
        next[cursor] = ch;
        cursor += 1;
      }
      const joined = next.join("");
      onChange(joined);
      const focusIdx = Math.min(cursor, 5);
      refs.current[focusIdx]?.focus();
      if (joined.length === 6 && !joined.includes("")) onComplete?.(joined);
      return;
    }
    setCharAt(i, clean);
    if (i < 5) refs.current[i + 1]?.focus();
    const joined = [...chars].map((c, idx) => (idx === i ? clean : c)).join("");
    if (joined.length === 6 && !joined.includes("")) onComplete?.(joined);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setCharAt(i - 1, "");
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div
      role="group"
      aria-label="Código da sala"
      className={cn("flex items-center justify-center gap-2 sm:gap-3")}
    >
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={char}
          inputMode="text"
          autoCapitalize="characters"
          maxLength={6}
          disabled={disabled}
          aria-label={`Caractere ${i + 1} do código`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="h-14 w-10 rounded-xl border border-line-strong bg-surface text-center font-display text-2xl font-bold tracking-widest text-ink uppercase transition-all caret-accent-bright focus:border-accent focus:bg-surface-2 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.18)] focus:outline-none disabled:opacity-50 sm:h-16 sm:w-12 sm:text-3xl"
        />
      ))}
    </div>
  );
}

export function BrandHint() {
  return (
    <p className="text-center text-xs text-faint">
      {BRAND.name} · uso interno escolar
    </p>
  );
}
