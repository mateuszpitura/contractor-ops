import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

const FIELD_SKELETON_COUNT = 8;

/**
 * Section-appropriate skeleton for the invoice detail screen — mirrors the
 * 60/40 split (PDF + metadata column) so the layout does not jump when
 * suspense resolves. Replaces the generic page spinner used on this route.
 */
export function InvoiceDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[60%_1fr] gap-0 lg:gap-8">
      <Skeleton className="h-[300px] lg:h-[calc(100vh-64px)] rounded-lg" />
      <div className="space-y-6 py-4 lg:py-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-[240px]" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-32 rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: FIELD_SKELETON_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={`invoice-detail-skel-${i}`} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
