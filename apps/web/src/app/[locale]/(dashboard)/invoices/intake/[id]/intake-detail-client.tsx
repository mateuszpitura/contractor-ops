'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { IntakeDetailActionsBar } from '@/components/invoices/intake/intake-detail-actions-bar';
import { IntakeDetailFieldsPane } from '@/components/invoices/intake/intake-detail-fields-pane';
import { IntakeDetailMatchPane } from '@/components/invoices/intake/intake-detail-match-pane';
import { IntakeDetailPdfPane } from '@/components/invoices/intake/intake-detail-pdf-pane';
import { IntakeDetailValidationPane } from '@/components/invoices/intake/intake-detail-validation-pane';
import type { ProfileLevel } from '@/components/invoices/intake/intake-profile-level-badge';
import type { IntakeStatus } from '@/components/invoices/intake/intake-status-pill';
import type { ValidationStatus } from '@/components/invoices/intake/intake-validation-status-pill';
import { PageHeader } from '@/components/shared/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ---------------------------------------------------------------------------
// Permissive shape — we only read the fields we render. Fields are nullable
// per Prisma schema (see invoice.prisma > model InvoiceIntakeRequest).
// ---------------------------------------------------------------------------

interface IntakeDetailData {
  id: string;
  sourceKind: 'UPLOAD_XML' | 'UPLOAD_PDF';
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  profileLevel: ProfileLevel;
  extractedSupplierName: string | null;
  extractedSupplierVatId: string | null;
  extractedSupplierLeitwegId: string | null;
  extractedInvoiceNumber: string | null;
  extractedInvoiceDate: Date | string | null;
  extractedCurrency: string | null;
  extractedTotalMinor: number | bigint | string | null;
  parsedInvoiceJson?: { lines?: unknown[] } | null;
  unmappedFieldsJson?: unknown;
  validationReportSummary?: Array<{
    severity: string;
    ruleId?: string | null;
    message?: string | null;
    xpath?: string | null;
  }> | null;
}

interface IntakeDetailClientProps {
  intake: IntakeDetailData;
  pageTitle: string;
}

/**
 * Client-side composition of the 4 detail panes + the actions bar.
 *
 * Layout:
 *   - < md: single column, actions bar sticky at bottom.
 *   - md+ : 2-column grid (PDF/XML preview left, 3 stacked panes right).
 *
 * The EXTENDED-profile banner sits above the grid when applicable
 * (pairs with the IntakeProfileLevelBadge warm-amber variant).
 */
export function IntakeDetailClient({ intake, pageTitle }: IntakeDetailClientProps) {
  const t = useTranslations('EInvoice.intake');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const lineCount = Array.isArray(intake.parsedInvoiceJson?.lines)
    ? intake.parsedInvoiceJson.lines.length
    : null;

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      <PageHeader title={pageTitle} description={intake.extractedSupplierName ?? undefined} />

      {intake.profileLevel === 'EXTENDED' && (
        <Alert variant="default" data-slot="intake-extended-banner">
          <AlertDescription>{t('bannerExtendedBestEffort')}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <IntakeDetailPdfPane intakeId={intake.id} sourceKind={intake.sourceKind} />
        <div className="space-y-6">
          <IntakeDetailFieldsPane
            supplierName={intake.extractedSupplierName}
            supplierVatId={intake.extractedSupplierVatId}
            supplierLeitwegId={intake.extractedSupplierLeitwegId}
            invoiceNumber={intake.extractedInvoiceNumber}
            invoiceDate={intake.extractedInvoiceDate}
            currency={intake.extractedCurrency}
            totalMinor={intake.extractedTotalMinor}
            lineCount={lineCount}
            profileLevel={intake.profileLevel}
            unmappedFields={intake.unmappedFieldsJson}
          />
          <IntakeDetailValidationPane
            intakeId={intake.id}
            validationStatus={intake.validationStatus}
            validationAcknowledgedAt={intake.validationAcknowledgedAt}
            validationReportSummary={intake.validationReportSummary ?? null}
          />
          <IntakeDetailMatchPane
            intakeId={intake.id}
            currentStatus={intake.status}
            onSelectedCandidateChange={setSelectedCandidateId}
          />
        </div>
      </div>

      <IntakeDetailActionsBar
        intakeId={intake.id}
        status={intake.status}
        validationStatus={intake.validationStatus}
        validationAcknowledgedAt={intake.validationAcknowledgedAt}
        hasSelectedCandidate={selectedCandidateId !== null}
      />
    </div>
  );
}
