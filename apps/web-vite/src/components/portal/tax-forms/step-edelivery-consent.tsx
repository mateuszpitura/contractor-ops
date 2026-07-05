import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Loader2 } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export interface StepEdeliveryConsentProps {
  onAffirm: () => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Affirmative IRS Pub 1179 §4.6 electronic-delivery consent step. A REAL native
 * `<input type="checkbox">` (unchecked by default) gates the affirm button — no
 * implied or pre-checked consent. The audited consent (IP / timestamp / identity)
 * is re-derived server-side; this step captures only the affirmative act.
 */
export function StepEdeliveryConsent({ onAffirm, isSubmitting }: StepEdeliveryConsentProps) {
  const t = useTranslations('Tax1099Consent');
  const fieldId = useId();
  const [checked, setChecked] = useState(false);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setChecked(event.target.checked),
    [],
  );

  return (
    <Card className="bg-card">
      <CardHeader className="space-y-1">
        <h2 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-card-gap">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id={fieldId}
            className="mt-1 size-4 accent-primary"
            checked={checked}
            onChange={handleChange}
          />
          <Label htmlFor={fieldId} className="font-normal text-sm leading-snug">
            {t('consentLabel')}
          </Label>
        </div>

        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={!checked || isSubmitting}
          onClick={() => void onAffirm()}>
          {isSubmitting ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden /> : null}
          {t('affirm')}
        </Button>
      </CardContent>
    </Card>
  );
}
