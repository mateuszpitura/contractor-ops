'use client';

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceDetailLayoutProps = {
  pdfUrl: string | null;
  children: ReactNode;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 60/40 split layout with sticky PDF viewer on the left and scrollable
 * content panel on the right. Stacks vertically below 1024px breakpoint.
 */
export function InvoiceDetailLayout({ pdfUrl, children }: InvoiceDetailLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[60%_1fr] gap-0 lg:gap-8">
      {/* Left: PDF viewer (sticky on desktop, fixed height on mobile) */}
      <div className="h-[300px] lg:h-[calc(100vh-64px)] lg:sticky lg:top-16 min-h-0 lg:min-h-[640px] overflow-hidden rounded-lg border bg-muted">
        {pdfUrl ? (
          <object data={pdfUrl} type="application/pdf" className="h-full w-full">
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                PDF preview is not available in your browser.
              </p>
            </div>
          </object>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No PDF available</p>
          </div>
        )}
      </div>

      {/* Right: scrollable content panel */}
      <div className="max-h-none lg:max-h-[calc(100vh-64px)] overflow-y-auto space-y-6 py-4 lg:py-0">
        {children}
      </div>
    </div>
  );
}
