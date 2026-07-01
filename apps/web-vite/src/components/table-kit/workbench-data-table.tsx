/**
 * Shared workbench table wrapper — standardizes loading, empty, and pagination chrome.
 * Migrate domain data-table.tsx files to compose this instead of duplicating DataTable props.
 */
import type { DataTableProps } from '@contractor-ops/ui';
import { DataTable, WORKBENCH_TABLE_SECTION_CLASS } from '@contractor-ops/ui';

import { useDirection } from '../../hooks/use-direction.js';
import { cn } from '../../lib/utils.js';

export type WorkbenchDataTableProps<TData> = DataTableProps<TData> & {
  sectionClassName?: string;
};

export function WorkbenchDataTable<TData>({
  sectionClassName,
  fill,
  ...props
}: WorkbenchDataTableProps<TData>) {
  const direction = useDirection();

  // In fill mode this section MUST stay in the viewport flex chain so the table
  // body bounds to its slot and scrolls internally. Pages that wrap the table in
  // their own section pass `sectionClassName=""` to avoid double styling — but an
  // unstyled (content-height) section here collapses the chain and the whole page
  // scrolls instead. So always apply the flex chain when filling; the page's
  // override merges on top (tailwind-merge wins). Cap mode keeps the
  // content-height default.
  const className = fill
    ? cn('flex min-h-0 min-w-0 flex-1 flex-col', sectionClassName)
    : (sectionClassName ?? WORKBENCH_TABLE_SECTION_CLASS);

  return (
    <section dir={direction} className={className}>
      <DataTable fill={fill} {...props} />
    </section>
  );
}
