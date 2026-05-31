import type { Table } from '@tanstack/react-table';

import { Skeleton } from '../../shadcn/skeleton.js';
import { TableCell, TableRow } from '../../shadcn/table.js';
import type { SkeletonColumnShape } from './types.js';

function skeletonClassForShape(descriptor: SkeletonColumnShape | undefined): string {
  if (!descriptor) return 'h-4 w-full max-w-[120px]';
  switch (descriptor.shape) {
    case 'checkbox':
      return 'h-4 w-4 rounded-sm';
    case 'avatar':
      return 'h-7 w-7 rounded-full';
    case 'badge':
      return 'h-5 w-16 rounded-full';
    case 'actions':
      return 'ms-auto h-4 w-4 rounded-sm';
    default:
      return `h-4 ${descriptor.width ?? 'w-full max-w-[120px]'}`;
  }
}

interface SkeletonRowsProps<TData> {
  table: Table<TData>;
  count: number;
  columns?: Record<string, SkeletonColumnShape>;
}

export function SkeletonRows<TData>({ table, count, columns }: SkeletonRowsProps<TData>) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <TableRow key={`skeleton-${i}`}>
          {table.getVisibleLeafColumns().map(col => (
            <TableCell key={col.id}>
              <Skeleton className={skeletonClassForShape(columns?.[col.id])} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
