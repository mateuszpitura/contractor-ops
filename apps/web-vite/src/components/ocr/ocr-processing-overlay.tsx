/**
 * OCR processing overlay.
 */

import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Loader2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface OcrProcessingOverlayProps {
  progress?: number;
}

const FIELD_SKELETON_KEYS = [
  'invoice-number',
  'issue-date',
  'due-date',
  'supplier',
  'buyer',
  'net-amount',
  'tax-amount',
  'total-amount',
] as const;

export function OcrProcessingOverlay({ progress }: OcrProcessingOverlayProps) {
  const t = useTranslations('OcrReview.processingOverlay');
  return (
    <div className="relative">
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-6 animate-spin text-primary" />
          {progress != null && (
            <div className="w-48">
              <Progress value={progress} />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-semibold">{t('analyzing')}</p>
            <p className="text-sm text-muted-foreground">{t('takesSeconds')}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {FIELD_SKELETON_KEYS.map(key => (
          <div key={key} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
