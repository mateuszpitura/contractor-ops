import {
  EInvoiceComplianceSummaryTile,
  EInvoiceComplianceSummaryTileSkeleton,
} from './einvoice-compliance-summary-tile.js';
import { useEinvoiceComplianceSummary } from './hooks/use-einvoice-compliance-summary.js';

interface EInvoiceComplianceSummaryTileContainerProps {
  onReviewFilterRequested?: () => void;
}

export function EInvoiceComplianceSummaryTileContainer({
  onReviewFilterRequested,
}: EInvoiceComplianceSummaryTileContainerProps) {
  const { isLoading, summary } = useEinvoiceComplianceSummary();

  if (isLoading) return <EInvoiceComplianceSummaryTileSkeleton />;

  return (
    <EInvoiceComplianceSummaryTile
      summary={summary}
      onReviewFilterRequested={onReviewFilterRequested}
    />
  );
}
