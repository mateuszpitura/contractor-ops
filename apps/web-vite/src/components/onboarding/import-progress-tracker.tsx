import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { CheckCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { OnboardingProgressData } from './hooks/use-onboarding-progress.js';

export interface ImportProgressTrackerProps {
  isError: boolean;
  hasData: boolean;
  progress: OnboardingProgressData | undefined;
  isComplete: boolean;
  isFailed: boolean;
  isRunning: boolean;
  percentDone: number;
  onRefetch: () => void;
  onRetry: (email: string) => void;
  isRetrying: boolean;
}

export function ImportProgressTracker({
  isError,
  hasData,
  progress,
  isComplete,
  isFailed,
  percentDone,
  onRefetch,
  onRetry,
  isRetrying,
}: ImportProgressTrackerProps) {
  const t = useTranslations('OnboardingImport.step4');
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={onRefetch}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {tErr('retry')}
        </Button>
      </div>
    );
  }

  if (!(hasData && progress)) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (isComplete && progress.failedItems.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="size-12 text-green-600" aria-hidden="true" />
          <h3 className="text-lg font-semibold">{t('completeHeading')}</h3>
          <p className="text-center text-sm text-muted-foreground">
            {t('completeBody', {
              imported: progress.completedItems,
              projects: 0,
            })}
          </p>
          <Button render={<Link href="/dashboard" />}>{t('completeCta')}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('progressLabel', {
              current: progress.completedItems,
              total: progress.totalItems,
            })}
          </span>
          <span className="font-medium">{percentDone}%</span>
        </div>
        <Progress
          value={percentDone}
          aria-valuenow={progress.completedItems}
          aria-valuemin={0}
          aria-valuemax={progress.totalItems}
        />
      </div>

      {(isFailed || progress.failedItems.length > 0) && (
        <div className="space-y-2">
          {progress.failedItems.map(item => (
            <div
              key={item.email}
              className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-destructive" aria-hidden="true" />
                <div>
                  <span className="text-sm font-medium">{item.email}</span>
                  <p className="text-xs text-muted-foreground">{item.error}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => onRetry(item.email)}
                disabled={isRetrying}>
                {isRetrying ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  t('retryButton')
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {!(isComplete || isFailed) && progress.completedItems < progress.totalItems && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>{t('processing')}</span>
        </div>
      )}
    </div>
  );
}
