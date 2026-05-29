import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { TableCell, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import { Check, MoreHorizontal } from 'lucide-react';
import { useCallback } from 'react';
import type { useTranslations } from '../../../i18n/useTranslations.js';
import type { useLeitwegIdRow } from './hooks/use-leitweg-id-row.js';
import type { LeitwegIdEditInitial } from './leitweg-id-create-dialog.js';
import { LeitwegIdCreateDialogContainer } from './leitweg-id-create-dialog-container.js';
import { LeitwegIdDeleteDialogContainer } from './leitweg-id-delete-dialog-container.js';

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

export type LeitwegIdRowProps = {
  row: LeitwegIdRowData;
  t: ReturnType<typeof useTranslations>;
} & ReturnType<typeof useLeitwegIdRow>;

export function LeitwegIdRow({
  row,
  t,
  editOpen,
  setEditOpen,
  deleteOpen,
  setDeleteOpen,
  editInitial,
  isSetDefaultPending,
  handleSetDefault,
}: LeitwegIdRowProps) {
  const handleOpenEdit = useCallback(() => setEditOpen(true), [setEditOpen]);
  const handleOpenDelete = useCallback(() => setDeleteOpen(true), [setDeleteOpen]);

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
              <Check aria-hidden="true" className="size-3" /> {t('defaultBadge')}
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
                  aria-label={t('actionsAriaLabel', { value: row.value })}
                  data-testid={`leitweg-actions-${row.id}`}
                />
              }>
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenEdit}>{t('actionEdit')}</DropdownMenuItem>
              <DropdownMenuItem
                disabled={!row.contractorId || row.isDefaultForContractor || isSetDefaultPending}
                onClick={handleSetDefault}>
                {t('actionSetDefault')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleOpenDelete}
                className="text-destructive focus:text-destructive">
                {t('actionDelete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {editOpen ? (
        <LeitwegIdCreateDialogContainer
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={editInitial as LeitwegIdEditInitial}
        />
      ) : null}
      {deleteOpen ? (
        <LeitwegIdDeleteDialogContainer
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
