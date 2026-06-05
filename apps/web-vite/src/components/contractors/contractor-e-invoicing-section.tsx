// Contractor-profile E-invoicing fields section.

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { LeitwegIdInlineSelectorContainer } from './leitweg-id-inline-selector-container.js';
import { PeppolIdentifierFields } from './peppol-identifier-fields.js';

export interface ContractorEInvoicingSectionProps {
  contractorId: string;
  isPublicSectorBuyer?: boolean;
}

type ContractorEInvoicingSectionViewProps = ContractorEInvoicingSectionProps & {
  contractorIsPublicSector: boolean;
};

export function ContractorEInvoicingSectionView({
  contractorId,
  isPublicSectorBuyer,
  contractorIsPublicSector,
}: ContractorEInvoicingSectionViewProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const tContractors = useTranslations('Contractors.eInvoicing');
  const [peppol, setPeppol] = useState({ schemeId: '', value: '' });
  const [selectedLeitweg, setSelectedLeitweg] = useState<string | null>(null);

  const effectiveIsPublicSector = isPublicSectorBuyer ?? contractorIsPublicSector;

  return (
    <Card data-testid="contractor-e-invoicing-section">
      <CardHeader>
        <CardTitle className="text-xl">{tContractors('cardTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('leitwegResolvedPattern', {
            leitwegIdValue: '—',
            source: '—',
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <PeppolIdentifierFields value={peppol} onChange={setPeppol} />

        <LeitwegIdInlineSelectorContainer
          mode="contractor"
          contractorId={contractorId}
          value={selectedLeitweg}
          onChange={setSelectedLeitweg}
          isPublicSectorBuyer={effectiveIsPublicSector}
          label={tContractors('defaultLeitwegIdLabel')}
        />
      </CardContent>
    </Card>
  );
}
