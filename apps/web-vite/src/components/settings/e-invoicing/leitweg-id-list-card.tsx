import { IntegrationsIllustration } from '@contractor-ops/ui';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { useCallback } from 'react';

import {
  useLeitwegIdListCard,
  type useLeitwegIdListCard as UseLeitwegIdListCard,
} from './hooks/use-leitweg-id-list-card.js';
import { LeitwegIdCreateDialog } from './leitweg-id-create-dialog.js';
import { LeitwegIdRow } from './leitweg-id-row.js';

export type LeitwegIdListCardProps = ReturnType<typeof UseLeitwegIdListCard>;

export function LeitwegIdListCardView({
  t,
  createOpen,
  setCreateOpen,
  rows,
  isEmpty,
  isLoading,
}: LeitwegIdListCardProps) {
  const handleOpenCreate = useCallback(() => setCreateOpen(true), [setCreateOpen]);

  return (
    <Card data-testid="leitweg-id-list-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-xl">{t('cardTitle')}</CardTitle>
          {isEmpty ? (
            <p className="text-sm text-muted-foreground max-w-prose">{t('emptyBody')}</p>
          ) : null}
        </div>
        <Button type="button" onClick={handleOpenCreate}>
          {t('ctaCreate')}
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <IntegrationsIllustration className="h-24 w-24" />
            <h3 className="text-base font-semibold">{t('emptyHeading')}</h3>
            <p className="text-sm text-muted-foreground max-w-prose">{t('emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colValue')}</TableHead>
                <TableHead>{t('colDescription')}</TableHead>
                <TableHead>{t('colAssignedTo')}</TableHead>
                <TableHead>{t('colDefault')}</TableHead>
                <TableHead>{t('colValidPeriod')}</TableHead>
                <TableHead className="w-12" aria-label={t('colActionsAria')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <LeitwegIdRow key={row.id} row={row} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <LeitwegIdCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Card>
  );
}

export function LeitwegIdListCard() {
  const card = useLeitwegIdListCard();
  return <LeitwegIdListCardView {...card} />;
}
