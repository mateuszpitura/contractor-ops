/**
 * Invoice detail 60/40 split layout.
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
      {/* No nested scroll — main scrolls; avoids clipping card shadows (incl. hover). */}
      <div className="min-w-0 space-y-6 py-4 lg:py-0 lg:pe-3">{children}</div>
    </div>
  );
}
