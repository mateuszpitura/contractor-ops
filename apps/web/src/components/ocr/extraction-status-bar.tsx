'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED';

interface ExtractionStatusBarProps {
  status: ExtractionStatus;
  fieldCount?: number;
  totalFields?: number;
  errorMessage?: string;
  onRetry?: () => void;
}

const STATUS_STYLE: Record<
  Exclude<ExtractionStatus, 'PENDING'>,
  {
    variant: 'info' | 'success' | 'warning' | 'destructive';
    borderClass: string;
  }
> = {
  PROCESSING: {
    variant: 'info',
    borderClass: 'border-blue-500/30 dark:border-blue-400/30',
  },
  EXTRACTED: {
    variant: 'success',
    borderClass: 'border-green-600/30 dark:border-green-500/30',
  },
  PARTIAL: {
    variant: 'warning',
    borderClass: 'border-amber-500/30 dark:border-amber-400/30',
  },
  FAILED: {
    variant: 'destructive',
    borderClass: 'border-destructive/30',
  },
};

export function ExtractionStatusBar({
  status,
  fieldCount,
  totalFields,
  errorMessage,
  onRetry,
}: ExtractionStatusBarProps) {
  const t = useTranslations('OcrReview.extractionStatus');

  if (status === 'PENDING') {
    return null;
  }

  const style = STATUS_STYLE[status];

  const statusLabel: Record<Exclude<ExtractionStatus, 'PENDING'>, string> = {
    PROCESSING: t('statusProcessing'),
    EXTRACTED: t('statusExtracted'),
    PARTIAL: t('statusPartial'),
    FAILED: t('statusFailed'),
  };

  return (
    <Card
      className={cn(
        'animate-in slide-in-from-top-2 fade-in-0 border duration-200 ease-out',
        style.borderClass,
      )}
      size="sm">
      <CardContent className="flex items-center gap-3">
        <Badge variant={style.variant}>{statusLabel[status]}</Badge>

        {status === 'PROCESSING' && (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('extracting')}</span>
          </div>
        )}

        {status === 'EXTRACTED' && (
          <span className="text-sm text-muted-foreground">{t('complete', { fieldCount: fieldCount ?? 0 })}</span>
        )}

        {status === 'PARTIAL' && (
          <span className="text-sm text-muted-foreground">
            {t('partial', { fieldCount: fieldCount ?? 0, totalFields: totalFields ?? 0 })}
          </span>
        )}

        {status === 'FAILED' && (
          <div className="flex flex-1 items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{errorMessage || t('failed')}</span>
            {!!onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {t('rerunOcr')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
