'use client';

import type { OcrExtractionResult } from '@contractor-ops/integrations/types/ocr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ExtractionStatusBar } from '@/components/ocr/extraction-status-bar';
import { trpc } from '@/trpc/init';

interface InvoiceOcrSectionProps {
  /**
   * The `documentId` of the invoice's `SOURCE_ORIGINAL` file. When the
   * invoice has no source document (e.g. KSeF or PEPPOL inbound), the
   * caller should simply not render this component.
   */
  documentId: string;
}

/**
 * Compact, read-only summary of the latest OCR extraction for the
 * invoice's source document. Driven by `ocr.getByDocument` so the surface
 * works for any invoice that has at least one extraction recorded,
 * without requiring callers to plumb the `extractionId` through the
 * detail page.
 *
 * Renders nothing when the document has never been OCR'd — the empty
 * state is intentionally invisible because every invoice goes through
 * intake flows that may or may not include OCR.
 */
export function InvoiceOcrSection({ documentId }: InvoiceOcrSectionProps) {
  const t = useTranslations('Invoices.detail');

  const query = useQuery({
    ...trpc.ocr.getByDocument.queryOptions({ documentId }),
    enabled: !!documentId,
  });

  if (query.isLoading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  const extraction = query.data;
  if (!extraction) {
    // No extraction recorded for this document — keep the page quiet.
    return null;
  }

  const status = extraction.status as 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED';
  const resultJson = extraction.resultJson as OcrExtractionResult | null;
  const fieldCount = resultJson
    ? Object.values(resultJson.fields).filter(f => f.value != null).length
    : 0;
  const totalFields = resultJson ? Object.keys(resultJson.fields).length : 0;

  return (
    <Card data-slot="invoice-ocr-section">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t('ocrSectionHeading')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ExtractionStatusBar
          status={status}
          fieldCount={fieldCount}
          totalFields={totalFields}
          errorMessage={resultJson?.errorMessage}
        />
      </CardContent>
    </Card>
  );
}
