/**
 * Resolved Leitweg-ID inline display.
 */

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { ShieldAlert } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export type LeitwegIdSource = 'contract' | 'contractorDefault';

interface LeitwegIdResolvedInlineProps {
  leitwegIdValue: string | null;
  source?: LeitwegIdSource;
}

export function LeitwegIdResolvedInline({
  leitwegIdValue,
  source = 'contractorDefault',
}: LeitwegIdResolvedInlineProps) {
  const t = useTranslations('EInvoice.InvoiceTab');

  if (!leitwegIdValue) {
    return (
      <Alert
        data-slot="leitweg-id-missing-alert"
        className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{t('leitwegMissingWarningHeading')}</AlertTitle>
        <AlertDescription>{t('leitwegMissingWarningBody')}</AlertDescription>
      </Alert>
    );
  }

  const sourceLabel =
    source === 'contract' ? t('leitwegSourceContract') : t('leitwegSourceContractorDefault');

  return (
    <p className="text-sm text-muted-foreground" data-slot="leitweg-id-resolved-inline">
      {t('leitwegResolvedPattern', { leitwegIdValue, source: sourceLabel })}
    </p>
  );
}
