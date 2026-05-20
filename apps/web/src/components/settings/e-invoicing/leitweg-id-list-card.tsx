// apps/web/src/components/settings/e-invoicing/leitweg-id-list-card.tsx
//
// Phase 61 · Plan 61-07 — Leitweg-ID list card (Settings → E-invoicing).
//
// Renders the full Leitweg-ID table for the org plus a Create CTA in the
// header. Empty state shows the UI-SPEC locked copy + Inbox icon.

'use client';

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
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { trpc } from '@/trpc/init';

import { LeitwegIdCreateDialog } from './leitweg-id-create-dialog';
import type { LeitwegIdRowData } from './leitweg-id-row';
import { LeitwegIdRow } from './leitweg-id-row';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeitwegIdListCard() {
  const t = useTranslations('EInvoice.Settings.LeitwegIdCard');
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = useQuery(trpc.leitwegId.list.queryOptions());
  const rows = (listQuery.data ?? []) as LeitwegIdRowData[];
  const isEmpty = !listQuery.isLoading && rows.length === 0;

  return (
    <Card data-testid="leitweg-id-list-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-xl">{t('cardTitle')}</CardTitle>
          {isEmpty ? (
            <p className="text-sm text-muted-foreground max-w-prose">{t('emptyBody')}</p>
          ) : null}
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {t('ctaCreate')}
        </Button>
      </CardHeader>

      <CardContent>
        {listQuery.isLoading ? (
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
