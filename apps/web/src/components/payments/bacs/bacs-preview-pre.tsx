// apps/web/src/components/payments/bacs/bacs-preview-pre.tsx
//
// Phase 63 · Plan 04 · D-06 — BACS Std 18 file preview <pre> block.
//
// Monospace, fixed-height with vertical scroll. Keyboard scrollable
// (`tabindex={0}`) and screen-reader announces with role="region" + aria-label.
// Horizontal scroll preserves fixed-width semantics (lines must not reflow).

'use client';

import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { useTranslations } from 'next-intl';

interface BacsPreviewPreProps {
  fileText: string;
}

export function BacsPreviewPre({ fileText }: BacsPreviewPreProps) {
  const t = useTranslations('Payments.bacs');
  // The `<pre>` itself is non-interactive (lint rule), so the keyboard
  // scrolling region is hosted on a wrapping <section> with tabIndex=0.
  // tabIndex on a region IS the recommended a11y pattern for an
  // overflowing scrollable container so keyboard-only users can pan the
  // monospace content (WAI-ARIA Authoring Practices, "Scrollable Region").
  // Biome's noNoninteractiveTabindex rule is overridden here because the
  // accessibility goal explicitly requires keyboard scroll for this content.
  return (
    <ScrollArea className="max-h-[420px] rounded-md border bg-muted/30">
      <section
        aria-label={t('previewCardTitle')}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region needs tabindex for keyboard panning
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md">
        <pre
          className="font-mono text-xs leading-relaxed p-4 whitespace-pre min-w-max"
          data-testid="bacs-preview-pre">
          {fileText}
        </pre>
      </section>
    </ScrollArea>
  );
}
