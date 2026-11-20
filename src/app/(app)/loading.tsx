import { Skeleton } from "@/components/ui/skeleton";
import { CaseGridSkeleton } from "@/components/home/sections";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-40 w-full rounded-[20px]" />
      <CaseGridSkeleton />
    </div>
  );
}
