'use client';

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type LeitwegIdSource = 'contract' | 'contractorDefault';

interface LeitwegIdResolvedInlineProps {
  /**
   * The resolved Leitweg-ID value, or null when the buyer is marked as
   * DE public-sector but no default / contract override exists.
   */
  leitwegIdValue: string | null;
  source?: LeitwegIdSource;
}

/**
 * Inline Leitweg-ID display above the Generation section. When a value is
 * resolved, shows "Resolved Leitweg-ID: {value} (from contract override)"
 * with the value in mono. When null, falls back to a warning `<Alert>`
 * prompting the user to add one.
 */
export function LeitwegIdResolvedInline({
  leitwegIdValue,
  source = 'contractorDefault',
}: LeitwegIdResolvedInlineProps) {
  const t = useTranslations('EInvoice.InvoiceTab');

  if (!leitwegIdValue) {
    return (
      <Alert
        data-slot="leitweg-id-missing-alert"
        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{t('leitwegMissingWarningHeading')}</AlertTitle>
        <AlertDescription>{t('leitwegMissingWarningBody')}</AlertDescription>
      </Alert>
    );
  }

  const sourceLabel =
    source === 'contract' ? t('leitwegSourceContract') : t('leitwegSourceContractorDefault');

  // Split the pattern so the Leitweg-ID value renders in mono font without
  // building unsafe HTML strings. next-intl's rich-text API is an option
  // but this keeps the template readable.
  return (
    <p className="text-sm text-muted-foreground" data-slot="leitweg-id-resolved-inline">
      {t('leitwegResolvedPattern', {
        leitwegIdValue,
        source: sourceLabel,
      })}
    </p>
  );
}
