"use client";

import { useEffect, useState } from "react";

export function useCountdown(deadlineMs: number | null, serverOffsetMs = 0): number {
  const calc = () =>
    deadlineMs === null ? 0 : Math.max(0, deadlineMs - (Date.now() + serverOffsetMs));
  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    setRemaining(calc());
    if (deadlineMs === null) return;
    const interval = setInterval(() => setRemaining(calc()), 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs]);

  return remaining;
}

export function computeServerOffset(serverNowIso?: string | null): number {
  if (!serverNowIso) return 0;
  try {
    return new Date(serverNowIso).getTime() - Date.now();
  } catch {
    return 0;
  }
}
