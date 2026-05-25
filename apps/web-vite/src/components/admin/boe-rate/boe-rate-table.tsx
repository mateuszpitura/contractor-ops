/**
 * BoE rate history table. Step 10 batch port from
 * apps/web/src/components/admin/boe-rate/boe-rate-table.tsx
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { PencilIcon, TrashIcon } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';

interface BoeRateTableProps {
  entries: BoeRateEntry[] | undefined;
  isLoading: boolean;
  onEdit: (entry: BoeRateEntry) => void;
  onDelete: (entry: BoeRateEntry) => void;
}

export function BoeRateTable({ entries, isLoading, onEdit, onDelete }: BoeRateTableProps) {
  const t = useTranslations('Admin.BoeRate');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`skel-${i}`} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{t('noRateEntries')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('noRateEntriesBody')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('colEffectiveFrom')}</TableHead>
          <TableHead className="text-right">{t('colRatePercent')}</TableHead>
          <TableHead>{t('colSource')}</TableHead>
          <TableHead>{t('colRecordedBy')}</TableHead>
          <TableHead>{t('colRecordedAt')}</TableHead>
          <TableHead>{t('colNotes')}</TableHead>
          <TableHead className="text-right">{t('colActions')}</TableHead>
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
                aria-label={`Source: ${entry.source === 'BOE_API' ? t('sourceBoeApi') : t('sourceManual')}`}>
                {entry.source === 'BOE_API' ? t('sourceBoeApi') : t('sourceManual')}
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
                  onClick={() => onEdit(entry)}
                  aria-label={t('ariaEditRate')}>
                  <PencilIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(entry)}
                  aria-label={t('ariaDeleteRate')}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
