import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useWorkflowTemplateDetail(templateId: string) {
  const trpc = useTRPC();
  const templateQuery = useQuery(trpc.workflow.getTemplate.queryOptions({ id: templateId }));
  const template = templateQuery.data;

  useBreadcrumbOverride(templateId, template?.name);

  const handleRetry = useCallback(() => {
    void templateQuery.refetch();
  }, [templateQuery]);

  const isNotFound = !(templateQuery.isLoading || templateQuery.isError || template);

  return {
    templateId,
    template,
    isLoading: templateQuery.isLoading,
    isError: templateQuery.isError,
    isNotFound,
    handleRetry,
  } as const;
}
