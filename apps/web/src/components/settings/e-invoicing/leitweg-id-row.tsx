// apps/web/src/components/settings/e-invoicing/leitweg-id-row.tsx
//
// Phase 61 · Plan 61-07 — Single row of the Leitweg-ID list card.
//
// Renders:
//   - mono Leitweg-ID value wrapped in <Bdi dir="ltr"> for RTL safety
//   - description (muted)
//   - contractor / contract badge pair
//   - default-indicator badge when isDefaultForContractor=true
//   - shadcn DropdownMenu actions (Edit / Set default / Delete)

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Bdi } from '@/components/ui/bdi';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { trpc } from '@/trpc/init';
import type { LeitwegIdEditInitial } from './leitweg-id-create-dialog';
import { LeitwegIdCreateDialog } from './leitweg-id-create-dialog';
import { LeitwegIdDeleteDialog } from './leitweg-id-delete-dialog';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LeitwegIdRowData {
  id: string;
  value: string;
  description?: string | null;
  isDefaultForContractor: boolean;
  contractorId?: string | null;
  contractId?: string | null;
  contractor?: { id: string; displayName: string | null } | null;
  contract?: { id: string; reference: string | null } | null;
  validFrom?: Date | string | null;
  validTo?: Date | string | null;
  notes?: string | null;
}

interface LeitwegIdRowProps {
  row: LeitwegIdRowData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeitwegIdRow({ row }: LeitwegIdRowProps) {
  const tErrors = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setDefaultMutation = useMutation({
    ...trpc.leitwegId.setDefault.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.leitwegId.list.queryKey() });
    },
    onError: (err: Error) => {
      toast.error(err.message || tErrors('Generic'));
    },
  });

  const editInitial: LeitwegIdEditInitial = {
    id: row.id,
    value: row.value,
    description: row.description ?? null,
    contractorId: row.contractorId ?? null,
    contractId: row.contractId ?? null,
    isDefaultForContractor: row.isDefaultForContractor,
    validFrom: row.validFrom ?? null,
    validTo: row.validTo ?? null,
    notes: row.notes ?? null,
  };

  return (
    <>
      <TableRow data-testid={`leitweg-id-row-${row.id}`}>
        <TableCell className="align-top">
          <Bdi
            dir="ltr"
            className="font-mono text-base font-semibold"
            data-testid={`leitweg-value-${row.id}`}>
            {row.value}
          </Bdi>
        </TableCell>
        <TableCell className="align-top text-sm text-muted-foreground">
          {row.description || '—'}
        </TableCell>
        <TableCell className="align-top">
          <div className="flex flex-wrap gap-1">
            {row.contractor ? (
              <Badge variant="outline" className="text-xs">
                {row.contractor.displayName ?? row.contractor.id}
              </Badge>
            ) : null}
            {row.contract ? (
              <Badge variant="outline" className="text-xs">
                {row.contract.reference ?? row.contract.id}
              </Badge>
            ) : null}
            {row.contractor || row.contract ? null : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </TableCell>
        <TableCell className="align-top">
          {row.isDefaultForContractor ? (
            <Badge variant="success">
              <Check aria-hidden="true" className="size-3" /> Default
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="align-top text-sm text-muted-foreground">
          {row.validFrom || row.validTo
            ? `${formatDate(row.validFrom)} → ${formatDate(row.validTo) || '∞'}`
            : '—'}
        </TableCell>
        <TableCell className="align-top">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${row.value}`}
                  data-testid={`leitweg-actions-${row.id}`}
                />
              }>
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                disabled={!row.contractorId || row.isDefaultForContractor}
                onClick={() => {
                  (setDefaultMutation.mutate as (input: { id: string }) => void)({
                    id: row.id,
                  });
                }}>
                Set default
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {editOpen ? (
        <LeitwegIdCreateDialog open={editOpen} onOpenChange={setEditOpen} initial={editInitial} />
      ) : null}
      {deleteOpen ? (
        <LeitwegIdDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          id={row.id}
          value={row.value}
        />
      ) : null}
    </>
  );
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
