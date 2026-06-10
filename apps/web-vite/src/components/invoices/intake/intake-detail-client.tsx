/**
 * Intake detail client composition.
 */

import { Alert, AlertDescription } from '@contractor-ops/ui/components/shadcn/alert';
import { useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchPageHeader } from '../../shared/workbench-page-header.js';
import { IntakeDetailActionsBar } from './intake-detail-actions-bar.js';
import { IntakeDetailFieldsPane } from './intake-detail-fields-pane.js';
import { IntakeDetailMatchPane } from './intake-detail-match-pane.js';
import { IntakeDetailPdfPane } from './intake-detail-pdf-pane.js';
import { IntakeDetailValidationPane } from './intake-detail-validation-pane.js';
import type { ProfileLevel } from './intake-profile-level-badge.js';
import type { IntakeStatus } from './intake-status-pill.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

export interface IntakeDetailData {
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

export function IntakeDetailClient({ intake, pageTitle }: IntakeDetailClientProps) {
  const t = useTranslations('EInvoice.intake');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const lineCount = Array.isArray(intake.parsedInvoiceJson?.lines)
    ? intake.parsedInvoiceJson.lines.length
    : null;

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      <WorkbenchPageHeader
        title={pageTitle}
        description={intake.extractedSupplierName ?? undefined}
      />

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
        selectedCandidateId={selectedCandidateId}
      />
    </div>
  );
}
