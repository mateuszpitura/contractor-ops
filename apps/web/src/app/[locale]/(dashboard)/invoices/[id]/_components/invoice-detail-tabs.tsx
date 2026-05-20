'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { EInvoiceTab } from '@/components/invoices/einvoice-tab/einvoice-tab';

interface InvoiceDetailTabsProps {
  invoiceId: string;
  /** The existing "Details" tab content — rendered as-is. */
  details: ReactNode;
}

const TAB_DETAILS = 'details';
const TAB_EINVOICE = 'e-invoice';

/**
 * Shell tabs wrapper for the invoice detail page. Order: Details → E-invoice.
 * URL binding: `?tab=e-invoice` activates the E-invoice tab so links from
 * the invoices-list compliance column land directly on the right surface.
 */
export function InvoiceDetailTabs({ invoiceId, details }: InvoiceDetailTabsProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const searchParams = useSearchParams();

  const initialValue = useMemo(() => {
    const tab = searchParams?.get('tab');
    return tab === TAB_EINVOICE ? TAB_EINVOICE : TAB_DETAILS;
  }, [searchParams]);

  const [value, setValue] = useState<string>(initialValue);

  const handleValueChange = useCallback((next: string) => {
    setValue(next);
  }, []);

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      <TabsList>
        <TabsTrigger value={TAB_DETAILS}>Details</TabsTrigger>
        <TabsTrigger value={TAB_EINVOICE}>{t('tabLabel')}</TabsTrigger>
      </TabsList>
      <TabsContent value={TAB_DETAILS}>{details}</TabsContent>
      <TabsContent value={TAB_EINVOICE}>
        <EInvoiceTab invoiceId={invoiceId} />
      </TabsContent>
    </Tabs>
  );
}
