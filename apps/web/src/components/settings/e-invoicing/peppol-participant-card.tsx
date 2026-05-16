// apps/web/src/components/settings/e-invoicing/peppol-participant-card.tsx
//
// Phase 61 · Plan 61-07 — Peppol participant card (Settings → E-invoicing).
//
// Two states:
//   A) No active participant → empty state with "Register Peppol participant" CTA.
//   B) Active participant    → status pill + labelled details list + Deregister
//      destructive CTA.
//
// Data source: trpc.peppol.listParticipants query. The card considers the
// newest non-DEREGISTERED row as "active". If the org has only DEREGISTERED
// rows or none at all, it renders the empty state.

'use client';

import { IntegrationsIllustration } from '@contractor-ops/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Bdi } from '@/components/ui/bdi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { PeppolParticipantDeregisterDialog } from './peppol-participant-deregister-dialog';
import { PeppolParticipantRegisterDialog } from './peppol-participant-register-dialog';
import type { PeppolParticipantStatus } from './peppol-participant-status-pill';
import { PeppolParticipantStatusPill } from './peppol-participant-status-pill';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeppolParticipantRow {
  id: string;
  status: PeppolParticipantStatus;
  schemeId: string;
  identifierValue: string;
  participantId: string;
  aspProvider: string | null;
  createdAt: string | Date;
  lastCapabilityCheckAt?: string | Date | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeppolParticipantCard() {
  const t = useTranslations('EInvoice.Settings.PeppolCard');
  const tDialog = useTranslations('EInvoice.PeppolDialog');
  const tCap = useTranslations('Peppol.capabilities');
  const format = useFormatter();
  const queryClient = useQueryClient();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [deregisterOpen, setDeregisterOpen] = useState(false);

  const participantsQuery = useQuery(trpc.peppol.listParticipants.queryOptions());

  const participants = (participantsQuery.data ?? []) as PeppolParticipantRow[];
  const active = participants.find(p => p.status !== 'DEREGISTERED') ?? null;

  // Capability re-check — runs `peppol.lookupCapabilities` against the active
  // participant with `forceRefresh: true`, bypassing the 6h SMP cache. The
  // server side-effect mirrors `supportsXRechnungCii` + `lastCapabilityCheckAt`
  // onto the participant row, so we invalidate the list query afterwards to
  // pick up the fresh timestamp.
  const lookupQuery = useQuery({
    ...trpc.peppol.lookupCapabilities.queryOptions(
      active
        ? { schemeId: active.schemeId, value: active.identifierValue, forceRefresh: true }
        : ({} as never),
    ),
    enabled: false,
  });

  const handleRecheckCapabilities = useCallback(async () => {
    if (!active) return;
    try {
      const result = await lookupQuery.refetch({ throwOnError: true });
      const data = result.data as { supportsXRechnungCii: boolean } | undefined;
      if (data?.supportsXRechnungCii) {
        toast.success(tCap('xrechnungCiiSupported'));
      } else {
        toast.warning(tCap('xrechnungCiiUnsupported'));
      }
      await queryClient.invalidateQueries({
        queryKey: trpc.peppol.listParticipants.queryKey(),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCap('recheckFailed'));
    }
  }, [active, lookupQuery, queryClient, tCap]);

  return (
    <Card data-testid="peppol-participant-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-xl">
            {active ? tDialog('activeHeading') : t('emptyHeading')}
          </CardTitle>
          {active ? null : (
            <p className="text-sm text-muted-foreground max-w-prose">{t('emptyBody')}</p>
          )}
        </div>
        {active ? (
          <PeppolParticipantStatusPill
            status={active.status}
            label={statusLabel(active.status, t, tDialog)}
          />
        ) : null}
      </CardHeader>

      <CardContent>
        {participantsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-72" />
            <Skeleton className="h-6 w-48" />
          </div>
        ) : active ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DlItem label={t('labelParticipant')}>
                <Bdi dir="ltr" className="font-mono text-sm" data-testid="participant-id">
                  {`${active.schemeId}:${active.identifierValue}`}
                </Bdi>
              </DlItem>
              <DlItem label={t('labelStatus')}>
                <span className="text-sm">{statusLabel(active.status, t, tDialog)}</span>
              </DlItem>
              <DlItem label={t('labelAsp')}>
                <span className="text-sm">{active.aspProvider ?? '—'}</span>
              </DlItem>
              <DlItem label={t('labelLastCapabilityCheck')}>
                <span className="text-sm">
                  {active.lastCapabilityCheckAt
                    ? format.dateTime(new Date(active.lastCapabilityCheckAt), 'short')
                    : t('neverChecked')}
                </span>
              </DlItem>
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleRecheckCapabilities}
                disabled={lookupQuery.isFetching}>
                {lookupQuery.isFetching ? (
                  <RefreshCw className="me-2 size-4 animate-spin" aria-hidden="true" />
                ) : lookupQuery.data ? (
                  (lookupQuery.data as { supportsXRechnungCii: boolean }).supportsXRechnungCii ? (
                    <CheckCircle2 className="me-2 size-4 text-success" aria-hidden="true" />
                  ) : (
                    <XCircle className="me-2 size-4 text-destructive" aria-hidden="true" />
                  )
                ) : (
                  <RefreshCw className="me-2 size-4" aria-hidden="true" />
                )}
                {lookupQuery.isFetching ? tCap('rechecking') : tCap('recheckCapabilities')}
              </Button>
              <Button type="button" variant="destructive" onClick={() => setDeregisterOpen(true)}>
                {tDialog('deregisterButton')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <IntegrationsIllustration className="h-24 w-24" />
            <Button type="button" onClick={() => setRegisterOpen(true)}>
              {t('ctaNotRegistered')}
            </Button>
          </div>
        )}
      </CardContent>

      <PeppolParticipantRegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      {active ? (
        <PeppolParticipantDeregisterDialog open={deregisterOpen} onOpenChange={setDeregisterOpen} />
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(
  status: PeppolParticipantStatus,
  tCard: ReturnType<typeof useTranslations<'EInvoice.Settings.PeppolCard'>>,
  tDialog: ReturnType<typeof useTranslations<'EInvoice.PeppolDialog'>>,
): string {
  switch (status) {
    case 'ACTIVE':
      return tCard('statusActive');
    case 'REGISTERED':
      return tCard('statusRegistered');
    case 'PENDING':
      return tDialog('pendingHeading');
    case 'SUSPENDED':
      return tCard('statusSuspended');
    case 'DEREGISTERED':
      return tCard('statusDeregistered');
    case 'NOT_REGISTERED':
      return tCard('statusNotRegistered');
  }
}

function DlItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
