import { useEinvoiceTab } from '../hooks/use-einvoice-tab.js';
import { EInvoiceTab, EInvoiceTabSkeleton } from './einvoice-tab.js';
import type { InvoiceTabData } from './types.js';

interface EInvoiceTabContainerProps {
  data?: InvoiceTabData;
  invoiceId: string;
}

export function EInvoiceTabContainer({ data, invoiceId }: EInvoiceTabContainerProps) {
  const tab = useEinvoiceTab(data, invoiceId);

  if (tab.isLoading) return <EInvoiceTabSkeleton />;
  if (!tab.tabData) return null;

  return (
    <EInvoiceTab
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
