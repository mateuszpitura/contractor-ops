import { WORKBENCH_TABLE_PAGE_CLASS, WORKBENCH_TABLE_SECTION_CLASS } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

const TABLE_ROW_COUNT = 8;
const TABLE_ROW_SKELETON_KEYS = Array.from(
  { length: TABLE_ROW_COUNT },
  (_, i) => `invoices-list-skel-${i}`,
);

/**
 * Layout-stable skeleton for the invoices list route. Preserves the header
 * + compliance tile + table-section rhythm so suspense resolution does not
 * shift the layout (replaces the generic full-page spinner fallback).
 */
export function InvoicesListSkeleton() {
  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-8 w-64" />
      <section className={WORKBENCH_TABLE_SECTION_CLASS}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {TABLE_ROW_SKELETON_KEYS.map(key => (
            <Skeleton key={key} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </section>
    </div>
  );
}
