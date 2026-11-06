import { Skeleton } from "@/components/ui/primitives";

/** Shown while a page streams in, so the layout does not jump and the wait feels short. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-[14px]" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-[14px]" />)}
      </div>
    </div>
  );
}
