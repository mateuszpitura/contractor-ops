/**
 * Shared workbench table wrapper — standardizes loading, empty, and pagination chrome.
 * Migrate domain data-table.tsx files to compose this instead of duplicating DataTable props.
 */
import type { DataTableProps } from '@contractor-ops/ui';
import { DataTable, WORKBENCH_TABLE_SECTION_CLASS } from '@contractor-ops/ui';

import { useDirection } from '../../hooks/use-direction.js';

export type WorkbenchDataTableProps<TData> = DataTableProps<TData> & {
  sectionClassName?: string;
};

export function WorkbenchDataTable<TData>({
  sectionClassName = WORKBENCH_TABLE_SECTION_CLASS,
  ...props
}: WorkbenchDataTableProps<TData>) {
  const direction = useDirection();

  return (
    <section dir={direction} className={sectionClassName}>
      <DataTable {...props} />
    </section>
  );
}
