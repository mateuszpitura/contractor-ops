'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// ImportProgressTracker
// ---------------------------------------------------------------------------

interface ImportProgressTrackerProps {
  jobId: string;
}

export function ImportProgressTracker({ jobId }: ImportProgressTrackerProps) {
  const t = useTranslations('OnboardingImport.step4');
  const queryClient = useQueryClient();

  const progressQuery = useQuery({
    ...trpc.onboardingImport.getProgress.queryOptions({ jobId }),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 2000;
    },
  });

  const progress = progressQuery.data;

  const retryMutation = useMutation({
    ...trpc.onboardingImport.retryFailedItem.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.onboardingImport.getProgress.queryKey({ jobId }),
      });
    },
  });

  if (!progress) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isComplete = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  const percentDone =
    progress.totalItems > 0 ? Math.round((progress.completedItems / progress.totalItems) * 100) : 0;

  // Completed state
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
      {/* Progress bar */}
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

      {/* Failed items list */}
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
                onClick={() => retryMutation.mutate({ jobId, email: item.email })}
                disabled={retryMutation.isPending}>
                {retryMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  t('retryButton')
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* In-progress items indicator */}
      {!(isComplete || isFailed) && progress.completedItems < progress.totalItems && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
}
