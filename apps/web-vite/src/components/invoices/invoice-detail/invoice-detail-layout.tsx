/**
 * Invoice detail 60/40 split layout. Step 11 codemod port from
 * apps/web/src/components/invoices/invoice-detail/invoice-detail-layout.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 */

import type { ReactNode } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

type InvoiceDetailLayoutProps = {
  pdfUrl: string | null;
  children: ReactNode;
};

export function InvoiceDetailLayout({ pdfUrl, children }: InvoiceDetailLayoutProps) {
  const t = useTranslations('Invoices.detail');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[60%_1fr] gap-0 lg:gap-8">
      <div className="h-[300px] lg:h-[calc(100vh-64px)] lg:sticky lg:top-16 min-h-0 lg:min-h-[640px] overflow-hidden rounded-lg border bg-muted">
        {pdfUrl ? (
          <object data={pdfUrl} type="application/pdf" className="h-full w-full">
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('pdfNotAvailable')}</p>
            </div>
          </object>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('noPdf')}</p>
          </div>
        )}
      </div>
      <div className="max-h-none lg:max-h-[calc(100vh-64px)] overflow-y-auto space-y-6 py-4 lg:py-0">
        {children}
      </div>
    </div>
  );
}
