"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prev = useRef<string>("");

  // Trigger on pathname/search change — shows bar immediately, then completes
  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (!prev.current) {
      prev.current = key;
      return;
    }
    if (prev.current === key) return;
    prev.current = key;

    // Start progress
    setActive(true);
    setWidth(10);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);

    // Animate to ~75% while "loading" (Suspense/loading.tsx will be shown by Next)
    timeoutRef.current = setTimeout(() => setWidth(75), 50);
    // Complete shortly after (Next swap ~150ms fade). Enough to give feedback without hanging
    hideRef.current = setTimeout(() => {
      setWidth(100);
      setTimeout(() => {
        setActive(false);
        setWidth(0);
      }, 250);
    }, 350);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [pathname, searchParams]);

  // Also start on Link click via global listener for instant feedback before pathname changes
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return;
      if (href === pathname) return;
      // Only for internal professor nav
      if (!href.startsWith("/professor") && !href.startsWith("/sala")) return;
      setActive(true);
      setWidth(10);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setWidth(55), 80);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!active && width === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] h-0.5 w-full"
      style={{ opacity: active ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-[#3B82F6]"
        style={{
          width: `${width}%`,
          transition: width === 100 ? "width 200ms ease-out" : width === 10 ? "none" : "width 400ms cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "0 0 8px rgba(59,130,246,0.55)",
        }}
      />
    </div>
  );
}
