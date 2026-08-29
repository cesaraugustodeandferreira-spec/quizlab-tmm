"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function PulseValue({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef<string>(String(value));

  useEffect(() => {
    const cur = String(value);
    if (prev.current !== cur) {
      prev.current = cur;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 420);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span className={cn(pulse && "value-pulse inline-block", className)}>{value}</span>
  );
}
