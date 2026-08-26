import { BRAND } from "@/config/brand";
import { IconFlask } from "@tabler/icons-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const icons = {
  flask: IconFlask,
} as const;

export function BrandLogo({
  href,
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = icons[BRAND.logoIcon as keyof typeof icons] ?? IconFlask;
  const box = { sm: "size-7", md: "size-8", lg: "size-10" }[size];
  const iconSize = { sm: 16, md: 18, lg: 22 }[size];

  const inner = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center justify-center rounded-xl bg-accent text-white", box)}
      >
        <Icon size={iconSize} stroke={2} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-ink">{BRAND.name}</span>
    </span>
  );

  return href ? (
    <Link href={href} aria-label={`Página inicial ${BRAND.name}`}>
      {inner}
    </Link>
  ) : (
    inner
  );
}
