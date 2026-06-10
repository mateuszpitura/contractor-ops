/**
 * E-invoice tab — presentational view + wired export (`hooks/use-einvoice-tab.ts`).
 */

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useRef } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useEinvoiceTab as UseEinvoiceTab } from '../hooks/use-einvoice-tab.js';
import { useEinvoiceTab } from '../hooks/use-einvoice-tab.js';
import { DownloadZugferdPdfButton } from './download-zugferd-pdf-button.js';
import { GenerationSection } from './generation-section.js';
import { LeitwegIdResolvedInline } from './leitweg-id-resolved-inline.js';
import { TransmissionSection } from './transmission-section.js';
import type { InvoiceTabData } from './types.js';
import { ValidationSection } from './validation-section.js';

type EInvoiceTabHookReturn = ReturnType<typeof UseEinvoiceTab>;
export type EInvoiceTabViewProps = {
  invoiceId: string;
  tabData: NonNullable<EInvoiceTabHookReturn['tabData']>;
} & Omit<EInvoiceTabHookReturn, 'isLoading' | 'tabData'>;

export function EInvoiceTabSkeleton() {
  return (
    <div className="space-y-12">
      <Skeleton className="h-6 w-96" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function EInvoiceTabView({
  invoiceId,
  tabData,
  errorMessage,
  isFinalizePending,
  isRevalidatePending,
  isSendPending,
  isDownloadXmlPending,
  isDownloadReportPending,
  onFinalize,
  onRevalidate,
  onSend,
  onDownloadXml,
  onDownloadReport,
}: EInvoiceTabViewProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const announcementRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="space-y-12" data-slot="einvoice-tab">
      <div ref={announcementRef} aria-live="polite" role="status" className="sr-only" />

      {errorMessage ? (
        <Alert variant="destructive" data-slot="einvoice-tab-error">
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {tabData.isPublicSectorBuyer ? (
        <LeitwegIdResolvedInline
          leitwegIdValue={tabData.leitwegIdValue}
          source={tabData.leitwegIdSource ?? 'contractorDefault'}
        />
      ) : null}

      <GenerationSection
        lifecycle={tabData.lifecycle}
        isFinalizePending={isFinalizePending}
        isDownloadXmlPending={isDownloadXmlPending}
        onFinalize={onFinalize}
        onDownloadXml={onDownloadXml}
      />

      <ValidationSection
        lifecycle={tabData.lifecycle}
        isRevalidatePending={isRevalidatePending}
        isDownloadReportPending={isDownloadReportPending}
        onRevalidate={onRevalidate}
        onDownloadReport={onDownloadReport}
      />

      <TransmissionSection
        lifecycle={tabData.lifecycle}
        peppolParticipant={tabData.peppolParticipant}
        receiverAcceptsXRechnungCii={tabData.receiverAcceptsXRechnungCii}
        isSendPending={isSendPending}
        onSend={onSend}
      />

      <ZugferdSection invoiceId={invoiceId} lifecycle={tabData.lifecycle} />
    </div>
  );
}

interface ZugferdSectionProps {
  invoiceId: string;
  lifecycle: InvoiceTabData['lifecycle'];
}

function ZugferdSection({ invoiceId, lifecycle }: ZugferdSectionProps) {
  const t = useTranslations('EInvoice.intake');
  const generated = (lifecycle as { zugferdPdfKey?: string | null } | null)?.zugferdPdfKey;
  const generatedAt = (lifecycle as { zugferdGeneratedAt?: Date | string | null } | null)
    ?.zugferdGeneratedAt;

  return (
    <section
      aria-labelledby="zugferd-section-heading"
      data-slot="einvoice-tab-zugferd-section"
      className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 id="zugferd-section-heading" className="font-display text-xl font-semibold">
            {t('zugferdSectionHeading')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('zugferdSectionBody')}</p>
        </div>
        <DownloadZugferdPdfButton invoiceId={invoiceId} />
      </div>
      <p className="text-xs text-muted-foreground">
        {generated && generatedAt
          ? t('generatedOnPattern', { date: String(generatedAt) })
          : t('notYetGenerated')}
      </p>
    </section>
  );
}

interface EInvoiceTabProps {
  data?: InvoiceTabData;
  invoiceId: string;
}

export function EInvoiceTab({ data, invoiceId }: EInvoiceTabProps) {
  const tab = useEinvoiceTab(data, invoiceId);

  if (tab.isLoading) return <EInvoiceTabSkeleton />;
  if (!tab.tabData) return null;

  return (
    <EInvoiceTabView
      invoiceId={invoiceId}
      tabData={tab.tabData}
      errorMessage={tab.errorMessage}
      isFinalizePending={tab.isFinalizePending}
      isRevalidatePending={tab.isRevalidatePending}
      isSendPending={tab.isSendPending}
      isDownloadXmlPending={tab.isDownloadXmlPending}
      isDownloadReportPending={tab.isDownloadReportPending}
      onFinalize={tab.onFinalize}
      onRevalidate={tab.onRevalidate}
      onSend={tab.onSend}
      onDownloadXml={tab.onDownloadXml}
      onDownloadReport={tab.onDownloadReport}
    />
  );
}
