"use client";

import { cn } from "@/lib/utils";

interface TabItem<T extends string> {
  id: T;
  label: string;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1", className)}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "cursor-pointer rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            active === t.id ? "bg-accent-deep text-accent-bright" : "text-mute hover:bg-surface-2 hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
