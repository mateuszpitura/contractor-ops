import { useCallback, useMemo } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useWhtCertificates } from './hooks/use-wht-certificates.js';
import type { WhtSummaryItem } from './wht-summary-card.js';
import { WhtSummaryCard } from './wht-summary-card.js';

interface WhtSummaryCardContainerProps {
  paymentRunId: string;
  items: WhtSummaryItem[];
}

export function WhtSummaryCardContainer({ items }: WhtSummaryCardContainerProps) {
  const t = useTranslations('Payments.wht');
  const locale = useLocale();
  const { onGenerateAll, isGenerating } = useWhtCertificates();

  const whtItems = useMemo(
    () => items.filter(i => i.whtAmountMinor && i.whtAmountMinor > 0),
    [items],
  );

  const handleGenerateAll = useCallback(() => {
    onGenerateAll(whtItems.map(i => i.id));
  }, [onGenerateAll, whtItems]);

  if (whtItems.length === 0) return null;

  return (
    <WhtSummaryCard
      t={t}
      locale={locale}
      whtItems={whtItems}
      totalItemsCount={items.length}
      onGenerateAll={handleGenerateAll}
      isGenerating={isGenerating}
    />
  );
}
