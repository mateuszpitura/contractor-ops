import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTemplateMutations } from '../../../hooks/use-template-mutations.js';
import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useWorkflowSeedStarterTemplates, useWorkflowTemplatesList } from './use-workflow-ui.js';

export type TemplateRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    runs: number;
    tasks: number;
  };
};

export function useTemplatesTable() {
  const t = useTranslations('Workflows');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);

  const templatesQuery = useWorkflowTemplatesList(page);

  const templates = useMemo(() => {
    const result = templatesQuery.data as { items: TemplateRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [templatesQuery.data]);

  const total = useMemo(() => {
    const result = templatesQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [templatesQuery.data]);

  const {
    activate: activateTemplate,
    archive: archiveTemplate,
    duplicate: duplicateTemplate,
    deleteTemplate,
  } = useTemplateMutations(t);

  const seedMutation = useWorkflowSeedStarterTemplates();
  const seedAttempted = useRef(false);

  useEffect(() => {
    if (
      !templatesQuery.isLoading &&
      templates.length === 0 &&
      total === 0 &&
      !seedAttempted.current
    ) {
      seedAttempted.current = true;
      seedMutation.mutate(undefined, {
        onSuccess: data => {
          if ((data as { seeded: boolean }).seeded) {
            void queryClient.invalidateQueries({
              queryKey: [['workflow', 'listTemplates']],
            });
          }
        },
      });
    }
  }, [templatesQuery.isLoading, templates.length, total, seedMutation, queryClient]);

  const handleActivate = useCallback(
    (template: TemplateRow) => {
      void activateTemplate(template.id);
    },
    [activateTemplate],
  );

  const handleArchive = useCallback(
    (template: TemplateRow) => {
      void archiveTemplate(template.id);
    },
    [archiveTemplate],
  );

  const handleDuplicate = useCallback(
    (template: TemplateRow) => {
      void duplicateTemplate(template.id);
    },
    [duplicateTemplate],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    void deleteTemplate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteTemplate]);

  const handleRowNavigate = useCallback(
    (templateId: string) => {
      void router.push(`/workflows/templates/${templateId}`);
    },
    [router],
  );

  return {
    templates,
    isLoading: templatesQuery.isLoading,
    isFetching: templatesQuery.isFetching,
    isError: templatesQuery.isError,
    handleRetry: templatesQuery.handleRetry,
    deleteTarget,
    setDeleteTarget,
    handleActivate,
    handleArchive,
    handleDuplicate,
    handleDelete,
    handleRowNavigate,
  } as const;
}
