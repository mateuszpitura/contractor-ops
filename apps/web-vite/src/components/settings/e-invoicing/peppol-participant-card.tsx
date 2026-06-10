// Peppol participant card (Settings → E-invoicing).
//
// Two states:
//   A) No active participant → empty state with "Register Peppol participant" CTA.
//   B) Active participant    → status pill + labelled details list + Deregister
//      destructive CTA.
//
// Data source: trpc.peppol.listParticipants query. The card considers the
// newest non-DEREGISTERED row as "active". If the org has only DEREGISTERED
// rows or none at all, it renders the empty state.

import { IntegrationsIllustration } from '@contractor-ops/ui';
import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useCallback } from 'react';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { useFormatter } from '../../../i18n/useFormatter.js';
import type { usePeppolParticipantCard as UsePeppolParticipantCard } from './hooks/use-peppol-participant-card.js';
import { usePeppolParticipantCard } from './hooks/use-peppol-participant-card.js';
import { PeppolParticipantDeregisterDialog } from './peppol-participant-deregister-dialog.js';
import { PeppolParticipantRegisterDialog } from './peppol-participant-register-dialog.js';
import type { PeppolParticipantStatus } from './peppol-participant-status-pill.js';
import { PeppolParticipantStatusPill } from './peppol-participant-status-pill.js';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type PeppolParticipantCardProps = ReturnType<typeof UsePeppolParticipantCard> & {
  format: ReturnType<typeof useFormatter>;
};

export function PeppolParticipantCardView({
  format,
  t,
  tDialog,
  tCap,
  registerOpen,
  setRegisterOpen,
  deregisterOpen,
  setDeregisterOpen,
  active,
  lookupQuery,
  handleRecheckCapabilities,
  isLoading,
}: PeppolParticipantCardProps) {
  const handleOpenDeregister = useCallback(() => setDeregisterOpen(true), [setDeregisterOpen]);
  const handleOpenRegister = useCallback(() => setRegisterOpen(true), [setRegisterOpen]);

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
        {isLoading ? (
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
              <Button type="button" variant="destructive" onClick={handleOpenDeregister}>
                {tDialog('deregisterButton')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <IntegrationsIllustration className="h-24 w-24" />
            <Button type="button" onClick={handleOpenRegister}>
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
  tCard: LooseTranslator,
  tDialog: LooseTranslator,
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

export function PeppolParticipantCard() {
  const format = useFormatter();
  const card = usePeppolParticipantCard();
  return <PeppolParticipantCardView format={format} {...card} />;
}

function DlItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
