import { Skeleton } from "@/components/ui/Progress";

export function DashboardSkeleton() {
  return (
    <div className="animate-route-enter space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
        <Skeleton className="h-64 xl:col-span-2" />
        <Skeleton className="h-64 xl:col-span-2" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 3, cardHeight = "h-32" }: { count?: number; cardHeight?: string }) {
  return (
    <div className="animate-route-enter space-y-5">
      <div className="flex justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={cardHeight} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="animate-route-enter space-y-5">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export function DiagnosticosSkeleton() {
  return (
    <div className="animate-route-enter space-y-5">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-24" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export function PerfilSkeleton() {
  return (
    <div className="animate-route-enter space-y-5">
      <Skeleton className="h-7 w-40" />
      <div className="rounded-[14px] border border-line bg-surface p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
