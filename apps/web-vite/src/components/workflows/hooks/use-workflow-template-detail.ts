import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useWorkflowTemplateDetail(templateId: string) {
  const trpc = useTRPC();
  const {
    data: template,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } = useEntityDetailQuery(trpc.workflow.getTemplate.queryOptions({ id: templateId }));

  useBreadcrumbOverride(templateId, template?.name);

  return {
    templateId,
    template,
    isLoading,
    isError,
    isNotFound,
    handleRetry,
  } as const;
}
