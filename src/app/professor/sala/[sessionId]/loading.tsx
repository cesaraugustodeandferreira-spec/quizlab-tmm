import { Skeleton } from "@/components/ui/Progress";

export default function SalaLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64" />
      <Skeleton className="h-32" />
    </div>
  );
}
