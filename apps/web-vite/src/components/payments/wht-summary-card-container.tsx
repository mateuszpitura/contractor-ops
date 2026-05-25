import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useWhtCertificates } from './hooks/use-wht-certificates.js';
import { WhtSummaryCard } from './wht-summary-card.js';

interface WhtSummaryCardContainerProps {
  paymentRunId: string;
  items: Array<{
    id: string;
    amountMinor: number;
    grossAmountMinor?: number | null;
    whtAmountMinor?: number | null;
    whtRate?: number | null;
    whtTreatyApplied?: boolean | null;
    currency: string;
  }>;
}

export function WhtSummaryCardContainer({ items }: WhtSummaryCardContainerProps) {
  const t = useTranslations('Payments.wht');
  const locale = useLocale();
  const { onGenerateAll, isGenerating } = useWhtCertificates();

  return (
    <WhtSummaryCard
      t={t}
      locale={locale}
      items={items}
      onGenerateAll={onGenerateAll}
      isGenerating={isGenerating}
    />
  );
}
