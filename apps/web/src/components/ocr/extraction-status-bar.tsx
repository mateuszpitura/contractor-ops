'use client';

import { Loader2 } from 'lucide-react';
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

const STATUS_CONFIG: Record<
  Exclude<ExtractionStatus, 'PENDING'>,
  {
    variant: 'info' | 'success' | 'warning' | 'destructive';
    label: string;
    borderClass: string;
  }
> = {
  PROCESSING: {
    variant: 'info',
    label: 'Processing',
    borderClass: 'border-blue-500/30 dark:border-blue-400/30',
  },
  EXTRACTED: {
    variant: 'success',
    label: 'Extracted',
    borderClass: 'border-green-600/30 dark:border-green-500/30',
  },
  PARTIAL: {
    variant: 'warning',
    label: 'Partial',
    borderClass: 'border-amber-500/30 dark:border-amber-400/30',
  },
  FAILED: {
    variant: 'destructive',
    label: 'Failed',
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
  if (status === 'PENDING') {
    return null;
  }

  const config = STATUS_CONFIG[status];

  return (
    <Card
      className={cn(
        'animate-in slide-in-from-top-2 fade-in-0 border duration-200 ease-out',
        config.borderClass,
      )}
      size="sm">
      <CardContent className="flex items-center gap-3">
        <Badge variant={config.variant}>{config.label}</Badge>

        {status === 'PROCESSING' && (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Extracting invoice data...</span>
          </div>
        )}

        {status === 'EXTRACTED' && (
          <span className="text-sm text-muted-foreground">
            Extraction complete &mdash; {fieldCount} fields extracted
          </span>
        )}

        {status === 'PARTIAL' && (
          <span className="text-sm text-muted-foreground">
            Partial extraction &mdash; {fieldCount} of {totalFields} fields extracted. Please fill
            in the remaining fields.
          </span>
        )}

        {status === 'FAILED' && (
          <div className="flex flex-1 items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {errorMessage ||
                'Extraction failed. You can re-run OCR or fill in the fields manually.'}
            </span>
            {!!onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Re-run OCR
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
