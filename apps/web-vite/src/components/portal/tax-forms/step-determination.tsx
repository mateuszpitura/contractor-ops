import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { ArrowRight } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TaxFormType } from './hooks/use-tax-form-wizard.js';

const FORM_TYPE_OPTIONS: TaxFormType[] = ['W9', 'W8BEN', 'W8BENE'];

export interface StepDeterminationProps {
  fieldId: string;
  /** The server-routed form type — the recommended default. */
  routedFormType: TaxFormType;
  /** The form type the contractor has confirmed or overridden to. */
  activeFormType: TaxFormType;
  onFormTypeChange: (formType: TaxFormType) => void;
  onContinue: () => void;
}

/**
 * First wizard step: show the auto-routed form and let the contractor confirm
 * or override it (e.g. a US person abroad, or a dual-status edge case). The form
 * names (W-9 / W-8BEN / W-8BEN-E) are IRS document identifiers, not free copy.
 */
export function StepDetermination({
  fieldId,
  routedFormType,
  activeFormType,
  onFormTypeChange,
  onContinue,
}: StepDeterminationProps) {
  const t = useTranslations('TaxFormWizard.determination');
  const formName = t(`formName.${routedFormType}`);

  const handleFormTypeChange = useCallback(
    (value: TaxFormType | null) => onFormTypeChange(value as TaxFormType),
    [onFormTypeChange],
  );

  return (
    <Card className="bg-card">
      <CardHeader className="space-y-1">
        <h2 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('body', { formName })}</p>
      </CardHeader>
      <CardContent className="space-y-card-gap">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-form-type`} className="font-normal text-sm">
            {t('formTypeLabel')}
          </Label>
          <Select value={activeFormType} onValueChange={handleFormTypeChange}>
            <SelectTrigger id={`${fieldId}-form-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_TYPE_OPTIONS.map(option => (
                <SelectItem key={option} value={option}>
                  {t(`formName.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('formTypeHelp')}</p>
        </div>

        <Button type="button" className="w-full" onClick={onContinue}>
          {t('continue')}
          <ArrowRight className="ms-2 size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}
