import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { FileText, Loader2 } from 'lucide-react';

import type { TranslateFn } from '../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../lib/format-currency.js';

interface WhtSummaryCardProps {
  t: TranslateFn;
  locale: string;
  items: Array<{
    id: string;
    amountMinor: number;
    grossAmountMinor?: number | null;
    whtAmountMinor?: number | null;
    whtRate?: number | null;
    whtTreatyApplied?: boolean | null;
    currency: string;
  }>;
  onGenerateAll: (itemIds: string[]) => void;
  isGenerating: boolean;
}

export function WhtSummaryCard({
  t,
  locale,
  items,
  onGenerateAll,
  isGenerating,
}: WhtSummaryCardProps) {
  const whtItems = items.filter(i => i.whtAmountMinor && i.whtAmountMinor > 0);

  if (whtItems.length === 0) return null;

  const currency = whtItems[0]?.currency ?? 'SAR';
  const totalGross = whtItems.reduce((sum, i) => sum + (i.grossAmountMinor ?? i.amountMinor), 0);
  const totalWht = whtItems.reduce((sum, i) => sum + (i.whtAmountMinor ?? 0), 0);
  const totalNet = totalGross - totalWht;
  const treatyCount = whtItems.filter(i => i.whtTreatyApplied).length;

  function handleGenerateAll() {
    onGenerateAll(whtItems.map(i => i.id));
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base font-semibold">{t('summaryTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-sm text-muted-foreground">{t('grossTotal')}</p>
            <p className="font-mono text-xl font-semibold">
              {currency} {formatMinorUnits(totalGross, currency, locale)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('whtWithheld')}</p>
            <p className="font-mono text-xl font-semibold">
              {currency} {formatMinorUnits(totalWht, currency, locale)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('netPayable')}</p>
            <p className="font-mono text-xl font-semibold">
              {currency} {formatMinorUnits(totalNet, currency, locale)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{t('itemsWithWht', { count: whtItems.length, total: items.length })}</span>
          {treatyCount > 0 ? (
            <Badge variant="outline">{t('treatyRatesApplied', { count: treatyCount })}</Badge>
          ) : null}
        </div>

        <Button onClick={handleGenerateAll} disabled={isGenerating} className="mt-6">
          {isGenerating ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="me-2 h-4 w-4" />
          )}
          {t('generateCertificates')}
        </Button>
      </CardContent>
    </Card>
  );
}
