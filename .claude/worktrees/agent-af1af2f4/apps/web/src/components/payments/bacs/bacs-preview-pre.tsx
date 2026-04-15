'use client';

import { useTranslations } from 'next-intl';

import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// BACS File Preview (Preformatted Text)
//
// Phase 63 Plan 04 — scrollable monospace preview of the BACS Std 18 file.
// Accessible: role="region", aria-label, tabindex for keyboard scrolling.
// ---------------------------------------------------------------------------

interface BacsPreviewPreProps {
  fileText: string;
}

export function BacsPreviewPre({ fileText }: BacsPreviewPreProps) {
  const t = useTranslations('Payments');

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <ScrollArea className="max-h-[420px]">
        <pre
          role="region"
          aria-label={t('bacsFilePreviewAriaLabel')}
          tabIndex={0}
          className="whitespace-pre font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {fileText}
        </pre>
      </ScrollArea>
    </div>
  );
}
