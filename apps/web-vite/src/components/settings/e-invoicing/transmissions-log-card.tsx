// apps/web/src/components/settings/e-invoicing/transmissions-log-card.tsx
//
// Renders the org-wide e-invoice transmissions log card (Settings →
// E-invoicing → Log). Consumes `einvoice.listByOrg` for filtered server-
// side pagination via cursor + status enum.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Tabs, TabsList, TabsTrigger } from '@contractor-ops/ui/components/shadcn/tabs';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import type {
  LifecycleRow,
  StatusFilter,
  useTransmissionsLogCard,
} from './hooks/use-transmissions-log-card.js';

// ---------------------------------------------------------------------------
// Pills
// ---------------------------------------------------------------------------

const validationPillClass: Record<string, string> = {
  VALID: 'bg-green-500/10 text-green-800 dark:text-green-400',
  WARNINGS: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  INVALID: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const transmissionPillClass: Record<string, string> = {
  SENT: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  DELIVERED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  PENDING: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Row (extracted to keep CardContent below the cognitive-complexity ceiling)
// ---------------------------------------------------------------------------

function TransmissionRow({
  row,
  formatDate,
  t,
}: {
  row: LifecycleRow;
  formatDate: (value: Date | string | null | undefined) => string;
  t: LooseTranslator;
}) {
  const validation = row.eInvoiceLifecycle?.validationStatus ?? null;
  const transmission = row.eInvoiceLifecycle?.transmissionStatus ?? null;
  const updatedAt = row.eInvoiceLifecycle?.updatedAt ?? row.createdAt ?? null;
  const updatedAtStr = updatedAt ? formatDate(updatedAt) : '—';
  return (
    <TableRow>
      <TableCell className="font-mono text-sm">
        {row.invoiceNumber ?? t('unknownInvoice')}
      </TableCell>
      <TableCell>
        {validation ? (
          <Badge variant="secondary" className={validationPillClass[validation] ?? ''}>
            {tDynLoose(t, 'validation', validation)}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{t('validation.notGenerated')}</span>
        )}
      </TableCell>
      <TableCell>
        {transmission ? (
          <Badge variant="secondary" className={transmissionPillClass[transmission] ?? ''}>
            {tDynLoose(t, 'transmission', transmission)}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">&mdash;</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground tabular-nums">{updatedAtStr}</TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export type TransmissionsLogCardProps = ReturnType<typeof useTransmissionsLogCard> & {
  formatDate: (value: Date | string | null | undefined) => string;
};

export function TransmissionsLogCard({
  formatDate,
  t,
  status,
  setStatus,
  listQuery,
  rows,
  isLoading,
}: TransmissionsLogCardProps) {
  return (
    <Card data-testid="einvoice-transmissions-log">
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle className="text-xl">{t('cardTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground max-w-prose">{t('cardDescription')}</p>
        </div>
        <Tabs
          value={status}
          // biome-ignore lint/nursery/noJsxPropsBind: Tabs onValueChange is a stable controlled-component handler
          onValueChange={v => setStatus(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">{t('filter.all')}</TabsTrigger>
            <TabsTrigger value="notGenerated">{t('filter.notGenerated')}</TabsTrigger>
            <TabsTrigger value="valid">{t('filter.valid')}</TabsTrigger>
            <TabsTrigger value="warnings">{t('filter.warnings')}</TabsTrigger>
            <TabsTrigger value="invalid">{t('filter.invalid')}</TabsTrigger>
            <TabsTrigger value="transmitted">{t('filter.transmitted')}</TabsTrigger>
            <TabsTrigger value="failed">{t('filter.failed')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <h3 className="text-base font-semibold">{t('emptyHeading')}</h3>
            <p className="text-sm text-muted-foreground max-w-prose">{t('emptyBody')}</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col.invoice')}</TableHead>
                  <TableHead>{t('col.validation')}</TableHead>
                  <TableHead>{t('col.transmission')}</TableHead>
                  <TableHead>{t('col.updated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TransmissionRow key={row.id} row={row} formatDate={formatDate} t={t} />
                ))}
              </TableBody>
            </Table>

            {listQuery.hasNextPage ? (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => listQuery.fetchNextPage()}
                  disabled={listQuery.isFetchingNextPage}>
                  {listQuery.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
