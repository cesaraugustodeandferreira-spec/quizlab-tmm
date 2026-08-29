import { Skeleton } from "@/components/ui/Progress";
export default function Loading() {
  return (
    <div className="animate-route-enter space-y-4 p-2">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
