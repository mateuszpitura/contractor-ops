/**
 * Credit-exhausted banner. Step 11 codemod port from
 * apps/web/src/components/billing/credit-exhausted-inline.tsx:
 *   - `next-intl` → `../../i18n/useTranslations.js`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { AlertTriangle, ArrowUp, ShoppingCart } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface CreditExhaustedInlineProps {
  onUpgrade: () => void;
  onBuyCredits: () => void;
}

export function CreditExhaustedInline({ onUpgrade, onBuyCredits }: CreditExhaustedInlineProps) {
  const t = useTranslations('Billing.creditExhausted');
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-destructive">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <div className="flex gap-2 ps-8">
        <Button variant="default" size="sm" onClick={onUpgrade}>
          <ArrowUp className="me-1.5 size-4" />
          {t('upgradePlan')}
        </Button>
        <Button variant="outline" size="sm" onClick={onBuyCredits}>
          <ShoppingCart className="me-1.5 size-4" />
          {t('buyCredits')}
        </Button>
      </div>
    </div>
  );
}
