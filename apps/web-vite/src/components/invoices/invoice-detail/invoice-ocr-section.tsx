import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { ExtractionStatusBar } from '../../ocr/extraction-status-bar.js';

interface InvoiceOcrSectionProps {
  status: 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED';
  fieldCount: number;
  totalFields: number;
  errorMessage?: string;
}

export function InvoiceOcrSectionSkeleton() {
  return (
    <Card data-slot="invoice-ocr-section">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

/**
 * Compact, read-only summary of the latest OCR extraction for the
 * invoice's source document.
 *
 * Loading and empty (no extraction) states are owned by the container;
 * this view is a single render path for the data-present case.
 */
export function InvoiceOcrSection({
  status,
  fieldCount,
  totalFields,
  errorMessage,
}: InvoiceOcrSectionProps) {
  const t = useTranslations('Invoices.detail');

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
          errorMessage={errorMessage}
        />
      </CardContent>
    </Card>
  );
}
