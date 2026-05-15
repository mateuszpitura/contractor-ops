'use client';

import { AlertTriangle, ArrowUp, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreditExhaustedInlineProps {
  onUpgrade: () => void;
  onBuyCredits: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
