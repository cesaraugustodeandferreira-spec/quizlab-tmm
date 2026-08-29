import { Skeleton } from "@/components/ui/Progress";

export default function QuizEditorLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
