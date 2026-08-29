"use client";

import type { RealtimeStatus } from "@/hooks/useRealtimeChannel";

export function RealtimePill({ status, className }: { status: RealtimeStatus; className?: string }) {
  const dots = {
    connecting: "border-line bg-surface",
    subscribed: "border-ok/30 bg-ok-deep",
    error: "border-warn/30 bg-warn-deep",
  }[status];

  const label =
    status === "subscribed"
      ? "Ao vivo"
      : status === "connecting"
        ? "Conectando…"
        : "Reconectando…";

  const dot =
    status === "subscribed"
      ? "bg-ok"
      : status === "connecting"
        ? "bg-mute"
        : "bg-warn";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${dots} ${className ?? ""}`}
    >
      <span className={`size-2 rounded-full ${dot} ${status === "connecting" ? "animate-pulse" : ""}`} />
      <span className={status === "subscribed" ? "text-ok" : status === "connecting" ? "text-mute" : "text-warn"}>
        {label}
      </span>
    </span>
  );
}