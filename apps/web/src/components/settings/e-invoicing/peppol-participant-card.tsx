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
import { useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
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
  const format = useFormatter();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [deregisterOpen, setDeregisterOpen] = useState(false);

  const participantsQuery = useQuery(trpc.peppol.listParticipants.queryOptions());

  const participants = (participantsQuery.data ?? []) as PeppolParticipantRow[];
  const active = participants.find(p => p.status !== 'DEREGISTERED') ?? null;

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
            label={statusLabel(active.status, tDialog)}
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
              <DlItem label="Participant">
                <Bdi dir="ltr" className="font-mono text-sm" data-testid="participant-id">
                  {`${active.schemeId}:${active.identifierValue}`}
                </Bdi>
              </DlItem>
              <DlItem label="Status">
                <span className="text-sm">{statusLabel(active.status, tDialog)}</span>
              </DlItem>
              <DlItem label="ASP">
                <span className="text-sm">{active.aspProvider ?? '—'}</span>
              </DlItem>
              <DlItem label="Last capability check">
                <span className="text-sm">
                  {active.lastCapabilityCheckAt
                    ? format.dateTime(new Date(active.lastCapabilityCheckAt), 'short')
                    : 'Never'}
                </span>
              </DlItem>
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
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
  t: ReturnType<typeof useTranslations<'EInvoice.PeppolDialog'>>,
): string {
  // Use the UI-SPEC locked Peppol status strings when available; otherwise
  // fall back to a humanised constant (matches the enum labels).
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'REGISTERED':
      return 'Registered';
    case 'PENDING':
      return t('pendingHeading');
    case 'SUSPENDED':
      return 'Suspended';
    case 'DEREGISTERED':
      return 'Deregistered';
    case 'NOT_REGISTERED':
      return 'Not registered';
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
