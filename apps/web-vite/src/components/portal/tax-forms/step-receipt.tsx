import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { CheckCircle2 } from 'lucide-react';

import { useFormatter } from '../../../i18n/useFormatter.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TaxFormType } from './hooks/use-tax-form-wizard.js';

export interface StepReceiptProps {
  formType: TaxFormType;
  signedAt: Date;
}

/**
 * Submission receipt — the lightweight human-readable confirmation shown after a
 * successful self-certification. The pixel-accurate IRS PDF is deferred to the
 * filing phase; this is the on-screen record the contractor sees.
 */
export function StepReceipt({ formType, signedAt }: StepReceiptProps) {
  const t = useTranslations('TaxFormWizard.receipt');
  const tForm = useTranslations('TaxFormWizard.determination');
  const format = useFormatter();
  const formName = tForm(`formName.${formType}`);
  const signedDate = format.dateTime(signedAt, { dateStyle: 'long' });

  return (
    <Card className="bg-card">
      <CardContent className="space-y-4 py-12 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <h2 className="font-display text-2xl font-semibold leading-tight">{t('heading')}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {t('body', { formName, date: signedDate })}
        </p>
      </CardContent>
    </Card>
  );
}
