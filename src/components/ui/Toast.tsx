"use client";

import { cn } from "@/lib/utils";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type ToastTone = "ok" | "bad" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  if (typeof document !== "undefined" && !mounted) {
    queueMicrotask(() => setMounted(true));
  }

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-full max-w-sm flex-col gap-2">
            {items.map((t) => (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "acrylic animate-scale-in pointer-events-auto flex items-start gap-3 px-4 py-3 text-sm text-ink",
                  t.tone === "ok" && "border-ok/30",
                  t.tone === "bad" && "border-bad/30",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-2 shrink-0 rounded-full",
                    t.tone === "ok" && "bg-ok",
                    t.tone === "bad" && "bg-bad",
                    t.tone === "info" && "bg-accent-bright",
                  )}
                />
                <p className="leading-snug">{t.message}</p>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
