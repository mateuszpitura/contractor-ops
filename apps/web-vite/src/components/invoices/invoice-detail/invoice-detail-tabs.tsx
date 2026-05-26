/**
 * Invoice detail tab shell. Ported from
 * apps/web/src/app/[locale]/(dashboard)/invoices/[id]/_components/invoice-detail-tabs.tsx:
 *   - next/navigation → react-router-dom
 *   - EInvoiceTab → EInvoiceTabContainer (web-vite data layer)
 */

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EInvoiceTabContainer } from '../einvoice-tab/einvoice-tab-container.js';

const TAB_DETAILS = 'details';
const TAB_EINVOICE = 'e-invoice';

interface InvoiceDetailTabsProps {
  invoiceId: string;
  /** Existing "Details" tab content — rendered as-is. */
  details: ReactNode;
}

/**
 * Shell tabs wrapper for the invoice detail page. Order: Details → E-invoice.
 * URL binding: `?tab=e-invoice` activates the E-invoice tab so links from
 * the invoices-list compliance column land directly on the right surface.
 */
export function InvoiceDetailTabs({ invoiceId, details }: InvoiceDetailTabsProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const [searchParams, setSearchParams] = useSearchParams();

  const value = searchParams.get('tab') === TAB_EINVOICE ? TAB_EINVOICE : TAB_DETAILS;

  const handleValueChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      if (next === TAB_EINVOICE) {
        params.set('tab', TAB_EINVOICE);
      } else {
        params.delete('tab');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      <TabsList>
        <TabsTrigger value={TAB_DETAILS}>Details</TabsTrigger>
        <TabsTrigger value={TAB_EINVOICE}>{t('tabLabel')}</TabsTrigger>
      </TabsList>
      <TabsContent value={TAB_DETAILS}>{details}</TabsContent>
      <TabsContent value={TAB_EINVOICE}>
        <EInvoiceTabContainer invoiceId={invoiceId} />
      </TabsContent>
    </Tabs>
  );
}
