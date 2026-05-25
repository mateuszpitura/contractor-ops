import { useInvoiceOcrSection } from './hooks/use-invoice-ocr-section.js';
import {
  InvoiceOcrSection,
  InvoiceOcrSectionSkeleton,
} from './invoice-detail/invoice-ocr-section.js';

interface InvoiceOcrSectionContainerProps {
  documentId: string;
}

export function InvoiceOcrSectionContainer({ documentId }: InvoiceOcrSectionContainerProps) {
  const { isLoading, extraction, status, fieldCount, totalFields, errorMessage } =
    useInvoiceOcrSection(documentId);

  if (isLoading) return <InvoiceOcrSectionSkeleton />;
  if (!(extraction && status)) return null;

  return (
    <InvoiceOcrSection
      status={status}
      fieldCount={fieldCount}
      totalFields={totalFields}
      errorMessage={errorMessage}
    />
  );
}
