'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinorUnits } from '@/lib/format-currency';
import { trpc } from '@/trpc/init';

interface WhtSummaryCardProps {
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

export function WhtSummaryCard({ paymentRunId: _paymentRunId, items }: WhtSummaryCardProps) {
  const t = useTranslations('Payments.wht');
  const locale = useLocale();
  const whtItems = items.filter(i => i.whtAmountMinor && i.whtAmountMinor > 0);
  const queryClient = useQueryClient();

  const generateMutation = useMutation(
    trpc.tax.generateWhtCertificate.mutationOptions({
      onSuccess: (data: { certificateNumber: string }) => {
        toast.success(t('certificateGenerated', { number: data.certificateNumber }));
        queryClient.invalidateQueries(trpc.tax.pathFilter());
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || t('certificateGenerationFailed'));
      },
    }),
  );

  if (whtItems.length === 0) return null;

  const currency = whtItems[0]?.currency ?? 'SAR';
  const totalGross = whtItems.reduce((sum, i) => sum + (i.grossAmountMinor ?? i.amountMinor), 0);
  const totalWht = whtItems.reduce((sum, i) => sum + (i.whtAmountMinor ?? 0), 0);
  const totalNet = totalGross - totalWht;
  const treatyCount = whtItems.filter(i => i.whtTreatyApplied).length;

  function handleGenerateAll() {
    for (const item of whtItems) {
      generateMutation.mutate({ paymentRunItemId: item.id });
    }
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
          {treatyCount > 0 && (
            <Badge variant="outline">{t('treatyRatesApplied', { count: treatyCount })}</Badge>
          )}
        </div>

        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button onClick={handleGenerateAll} disabled={generateMutation.isPending} className="mt-6">
          {generateMutation.isPending ? (
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
