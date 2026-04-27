'use client';

// apps/web/src/components/admin/boe-rate/boe-rate-table.tsx
//
// Phase 63 · Plan 05 · D-10 — BoE base rate history table.
// Sorted by effectiveFrom DESC. Columns: date, rate, source, recorded by, notes, actions.

import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { DeleteBoeRateDialog } from '@/components/admin/boe-rate/delete-boe-rate-dialog';
import { EditBoeRateDialog } from '@/components/admin/boe-rate/edit-boe-rate-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/trpc/init';

// Source of truth: router output. Avoids drift when the Prisma generator
// changes runtime types (e.g. Decimal vs string|number for ratePercent).
type RateEntry = inferRouterOutputs<AppRouter>['adminBoeRate']['list'][number];

export function BoeRateTable() {
  const [editEntry, setEditEntry] = useState<RateEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<RateEntry | null>(null);

  const { data: entries, isLoading } = useQuery(trpc.adminBoeRate.list.queryOptions());

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">No rate entries</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a rate entry to start tracking BoE base rates.
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Effective from</TableHead>
            <TableHead className="text-right">Rate %</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Recorded by</TableHead>
            <TableHead>Recorded at</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(entry => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono text-sm">
                {new Date(entry.effectiveFrom).toISOString().slice(0, 10)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-mono">
                {Number(entry.ratePercent).toFixed(2)}%
              </TableCell>
              <TableCell>
                <Badge
                  variant={entry.source === 'BOE_API' ? 'secondary' : 'outline'}
                  aria-label={`Source: ${entry.source === 'BOE_API' ? 'BoE API' : 'Manual'}`}>
                  {entry.source === 'BOE_API' ? 'BoE API' : 'Manual'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {entry.recordedByUserId ?? 'System'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(entry.recordedAt).toISOString().slice(0, 10)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                {entry.notes ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditEntry(entry)}
                    aria-label="Edit rate entry">
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteEntry(entry)}
                    aria-label="Delete rate entry">
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editEntry && (
        <EditBoeRateDialog
          entry={editEntry}
          open={!!editEntry}
          onOpenChange={open => {
            if (!open) setEditEntry(null);
          }}
        />
      )}

      {deleteEntry && (
        <DeleteBoeRateDialog
          entry={deleteEntry}
          open={!!deleteEntry}
          onOpenChange={open => {
            if (!open) setDeleteEntry(null);
          }}
        />
      )}
    </>
  );
}
