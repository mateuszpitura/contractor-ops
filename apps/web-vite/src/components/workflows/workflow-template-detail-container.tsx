import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useParams } from 'react-router-dom';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useWorkflowTemplateDetail } from './hooks/use-workflow-template-detail.js';
import { TemplateFormContainer } from './template-builder/template-form-container.js';

function TemplateDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`template-skel-${i}`} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function WorkflowTemplateDetailContainer() {
  const params = useParams<{ id: string }>();
  const templateId = params.id ?? '';
  const t = useTranslations('Workflows');
  const { template, isLoading, isError, isNotFound, handleRetry } =
    useWorkflowTemplateDetail(templateId);

  if (isError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('errors.failedToLoadTemplates')}</h2>
        <Button variant="outline" onClick={handleRetry}>
          {t('errors.retry')}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TemplateDetailSkeleton />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="space-y-6">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">{t('templates.empty.heading')}</h2>
          <Button variant="outline" render={<Link href="/workflows?tab=templates" />}>
            {t('backToWorkflows')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!!template && <TemplateFormContainer templateId={templateId} />}
    </div>
  );
}
