// apps/web/src/components/contractors/contractor-e-invoicing-section.tsx
//
// Phase 61 · Plan 61-07 — Contractor-profile E-invoicing fields section.
//
// Hosts:
//   - PeppolIdentifierFields (pair-constrained scheme + value inputs)
//   - LeitwegIdInlineSelector scoped to this contractor
//
// Local state only for this plan: the persistence path (an authoritative
// `contractor.updatePeppolIdentifier` mutation) is part of Plan 61-08's
// backend wiring + Phase 57 country-fields schema extension. The section
// surfaces the UI so users can see both widgets in place; the SUMMARY
// documents the deferred persistence mutation.

'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/trpc/init';

import { LeitwegIdInlineSelector } from './leitweg-id-inline-selector';
import { PeppolIdentifierFields } from './peppol-identifier-fields';

interface ContractorEInvoicingSectionProps {
  contractorId: string;
  /**
   * When the contractor is flagged as a German public-sector buyer, the
   * Leitweg-ID selector surfaces a `LEITWEG_ID_MISSING` warning alert when no
   * Leitweg-ID is selected. The flag is optional — default false.
   */
  isPublicSectorBuyer?: boolean;
}

export function ContractorEInvoicingSection({
  contractorId,
  isPublicSectorBuyer,
}: ContractorEInvoicingSectionProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const [peppol, setPeppol] = useState({ schemeId: '', value: '' });
  const [selectedLeitweg, setSelectedLeitweg] = useState<string | null>(null);

  // Light touch: read the contractor so public-sector flag is honoured when
  // the parent didn't pass one explicitly. We only need the flag, so fetch is
  // conservative (no fan-out).
  const contractorQuery = useQuery(
    trpc.contractor.getById.queryOptions({ id: contractorId } as never),
  );
  const contractor = contractorQuery.data as { isPublicSectorBuyer?: boolean } | undefined;
  const effectiveIsPublicSector =
    isPublicSectorBuyer ?? contractor?.isPublicSectorBuyer ?? false;

  return (
    <Card data-testid="contractor-e-invoicing-section">
      <CardHeader>
        <CardTitle className="text-xl">E-invoicing</CardTitle>
        <p className="text-sm text-muted-foreground">{t('leitwegResolvedPattern', {
          leitwegIdValue: '—',
          source: '—',
        })}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <PeppolIdentifierFields value={peppol} onChange={setPeppol} />

        <LeitwegIdInlineSelector
          mode="contractor"
          contractorId={contractorId}
          value={selectedLeitweg}
          onChange={setSelectedLeitweg}
          isPublicSectorBuyer={effectiveIsPublicSector}
          label="Default Leitweg-ID"
        />
      </CardContent>
    </Card>
  );
}
