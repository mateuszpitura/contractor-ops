/**
 * Billing date card. Step 11 codemod port from
 * apps/web/src/components/billing/billing-date-card.tsx:
 *   - `next-intl#useFormatter` → inline Intl.DateTimeFormat (next-intl's
 *     formatter is a thin wrapper over Intl with locale plumbing; in the
 *     SPA we read the active locale from react-i18next).
 *   - `next-intl#useTranslations` → `../../i18n/useTranslations.js`
 */

import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTranslations } from '../../i18n/useTranslations.js';

interface BillingDateCardProps {
  date: string | null;
  isTrialing: boolean;
}

export function BillingDateCard({ date, isTrialing }: BillingDateCardProps) {
  const t = useTranslations('Billing.usage');
  const { i18n } = useTranslation();

  const formattedDate = date
    ? new Intl.DateTimeFormat(i18n.language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(date))
    : null;

  return (
    <Card className="p-4">
      <CardContent className="flex flex-col gap-1 p-0">
        <div className="flex items-start justify-between">
          <span className="text-xs text-muted-foreground">{t('nextBillingDate')}</span>
          <Calendar size={16} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="text-2xl font-semibold">{formattedDate ?? '—'}</div>
        {!!formattedDate && (
          <span className="text-xs text-muted-foreground">
            {isTrialing ? t('trialEnds') : t('renewsOn')}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
