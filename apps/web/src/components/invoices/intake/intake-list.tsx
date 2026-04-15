'use client';

import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
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
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import { IntakeFilterChips, parseFilterParam } from './intake-filter-chips';
import { IntakeProfileLevelBadge, type ProfileLevel } from './intake-profile-level-badge';
import { IntakeStatusPill, type IntakeStatus } from './intake-status-pill';
import {
  IntakeValidationStatusPill,
  type ValidationStatus,
} from './intake-validation-status-pill';
import { IntakeUploadDialog } from './intake-upload-dialog';

// ---------------------------------------------------------------------------
// Row shape surfaced by trpc.invoiceIntake.listByOrg. Kept permissive
// because the router returns the raw Prisma row; unused columns are safely
// ignored.
// ---------------------------------------------------------------------------

interface IntakeRow {
  id: string;
  createdAt: string | Date;
  extractedSupplierName: string | null;
  extractedInvoiceNumber: string | null;
  extractedInvoiceDate: string | Date | null;
  extractedTotalAmountMinor: number | null | string;
  extractedCurrency: string | null;
  extractedProfileLevel: ProfileLevel | null;
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
}

interface IntakeListProps {
  /** URL-derived `status` filter token ('NEEDS_REVIEW', 'MATCHED', …) */
  initialStatus?: string | null;
}

function formatTotalMinor(amountMinor: unknown, currency: string | null): string | null {
  if (amountMinor === null || amountMinor === undefined) return null;
  const minor = typeof amountMinor === 'string' ? Number(amountMinor) : Number(amountMinor);
  if (!Number.isFinite(minor)) return null;
  const safeCurrency = currency ?? 'EUR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
    }).format(minor / 100);
  } catch {
    // Unknown currency — fall back to a plain number with ISO suffix.
    return `${(minor / 100).toFixed(2)} ${safeCurrency}`;
  }
}

/**
 * Intake list — cursor-paginated, filter-chip driven. 25 rows per page,
 * "Load more" button beneath the last row (mirrors the invoices-list
 * pagination pattern).
 */
export function IntakeList({ initialStatus }: IntakeListProps) {
  const t = useTranslations('EInvoice.intake');
  const tColumn = useTranslations('EInvoice.intake.column');
  const format = useFormatter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);

  // The IntakeFilterChips component is the source of truth for the URL
  // query param. Reading it here lets the server-driven list stay in sync
  // without re-parsing search params twice on the page.
  const currentFilter = parseFilterParam(initialStatus ?? null);
  const statusFilter = currentFilter === 'all' ? undefined : currentFilter;

  // Map the chip value back to the enum the router expects.
  const statusEnum = useMemo(() => {
    if (!statusFilter) return undefined;
    const map: Record<string, IntakeStatus> = {
      needsReview: 'NEEDS_REVIEW',
      matched: 'MATCHED',
      converted: 'CONVERTED',
      rejected: 'REJECTED',
    };
    return map[statusFilter];
  }, [statusFilter]);

  const lastCursor = cursors[cursors.length - 1];
  const listQuery = useQuery(
    trpc.invoiceIntake.listByOrg.queryOptions({
      status: statusEnum,
      cursor: lastCursor,
      limit: 25,
    }),
  );

  const handleLoadMore = useCallback(() => {
    const data = listQuery.data as { nextCursor?: string } | undefined;
    if (data?.nextCursor) {
      setCursors(prev => [...prev, data.nextCursor]);
    }
  }, [listQuery.data]);

  const rows = (listQuery.data as { items?: IntakeRow[] } | undefined)?.items ?? [];
  const nextCursor = (listQuery.data as { nextCursor?: string } | undefined)?.nextCursor;
  const isLoading = listQuery.isLoading;
  const isEmpty = !isLoading && rows.length === 0 && cursors.length === 1;

  return (
    <div className="space-y-6" data-slot="intake-list">
      <IntakeFilterChips />

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`intake-skel-${i}`} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold">{t('emptyStateHeading')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('emptyStateBody')}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setUploadOpen(true)}
            data-testid="intake-list-empty-upload">
            {t('splitButtonImport')}
          </Button>
          <IntakeUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <caption className="sr-only">{t('pageSubtitle')}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{tColumn('supplier')}</TableHead>
                <TableHead>{tColumn('invoiceNumber')}</TableHead>
                <TableHead>{tColumn('date')}</TableHead>
                <TableHead className="text-right">{tColumn('total')}</TableHead>
                <TableHead>{tColumn('level')}</TableHead>
                <TableHead>{tColumn('status')}</TableHead>
                <TableHead>{tColumn('validation')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const total = formatTotalMinor(row.extractedTotalAmountMinor, row.extractedCurrency);
                const dateStr = row.extractedInvoiceDate
                  ? format.dateTime(new Date(row.extractedInvoiceDate), 'short')
                  : '—';
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-accent/50"
                    data-slot="intake-row"
                    data-intake-id={row.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/intake/${row.id}`}
                        className="block w-full truncate font-medium hover:underline">
                        {row.extractedSupplierName ?? '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.extractedInvoiceNumber ?? '—'}
                    </TableCell>
                    <TableCell>{dateStr}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {total ?? '—'}
                    </TableCell>
                    <TableCell>
                      {row.extractedProfileLevel ? (
                        <IntakeProfileLevelBadge level={row.extractedProfileLevel} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <IntakeStatusPill status={row.status} />
                    </TableCell>
                    <TableCell>
                      {row.validationStatus ? (
                        <IntakeValidationStatusPill status={row.validationStatus} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {nextCursor && (
            <div className="flex justify-center border-t p-4">
              <Button type="button" variant="ghost" onClick={handleLoadMore}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
