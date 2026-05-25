/**
 * BACS Std 18 file preview. Step 11 codemod port from
 * apps/web/src/components/payments/bacs/bacs-preview-pre.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 */

import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';

import { useTranslations } from '../../../i18n/useTranslations.js';

interface BacsPreviewPreProps {
  fileText: string;
}

export function BacsPreviewPre({ fileText }: BacsPreviewPreProps) {
  const t = useTranslations('Payments.bacs');
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
