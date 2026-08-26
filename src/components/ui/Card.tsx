import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

export function Card({
  interactive = false,
  padded = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-[14px] border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
        padded && "p-5",
        interactive &&
          "cursor-pointer transition-all duration-150 hover:border-line-strong hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-wide text-mute">{children}</h3>
      {right}
    </div>
  );
}
