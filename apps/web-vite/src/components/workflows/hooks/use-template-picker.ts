import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import {
  useWorkflowStartRun,
  useWorkflowSuggestedTemplate,
  useWorkflowSuggestedTemplateEffect,
  useWorkflowTemplatePicker,
  useWorkflowTemplatePickerTemplates,
} from './use-workflow-ui.js';

export type TemplateOption = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  _count: {
    tasks: number;
  };
};

export interface TemplatePickerParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorId?: string;
  contractId?: string;
  preFilterType?: string;
  contractorIds?: string[];
}

export function useTemplatePicker({
  open,
  onOpenChange,
  contractorId,
  contractId,
  preFilterType,
  contractorIds,
}: TemplatePickerParams) {
  const t = useTranslations('Workflows');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(preFilterType ?? null);

  const templatesQuery = useWorkflowTemplatePicker(open, search);
  const templates = useWorkflowTemplatePickerTemplates(
    templatesQuery.data,
    typeFilter,
  ) as TemplateOption[];
  const isLoading = templatesQuery.isLoading;

  const startRunMutation = useWorkflowStartRun();

  const isBulk = Boolean(contractorIds && contractorIds.length > 0);
  const effectiveContractorId = contractorId ?? contractorIds?.[0];

  const suggestionEnabled = open && preFilterType === 'OFFBOARDING' && !!contractorId && !isBulk;
  const suggestionQuery = useWorkflowSuggestedTemplate(contractorId, suggestionEnabled);
  const suggestedTemplateId = suggestionQuery.data?.templateId ?? null;
  const suggestedTemplate = useMemo(() => {
    if (!suggestedTemplateId) return null;
    return templates.find(tmpl => tmpl.id === suggestedTemplateId) ?? null;
  }, [suggestedTemplateId, templates]);

  useWorkflowSuggestedTemplateEffect(suggestedTemplateId, selectedId, setSelectedId);

  const executeRuns = useCallback(
    async (templateId: string): Promise<number> => {
      if (isBulk && contractorIds) {
        const results = await Promise.all(
          contractorIds.map(cId =>
            startRunMutation.mutateAsync({
              subjectType: 'CONTRACTOR',
              templateId,
              contractorId: cId,
              contractId,
            }),
          ),
        );
        let total = 0;
        for (const r of results) {
          total += (r as { calendarTaskCount?: number }).calendarTaskCount ?? 0;
        }
        return total;
      }
      if (effectiveContractorId) {
        const result = (await startRunMutation.mutateAsync({
          subjectType: 'CONTRACTOR',
          templateId,
          contractorId: effectiveContractorId,
          contractId,
        })) as { calendarTaskCount?: number };
        return result.calendarTaskCount ?? 0;
      }
      return 0;
    },
    [isBulk, contractorIds, effectiveContractorId, contractId, startRunMutation],
  );

  const handleStart = useCallback(async () => {
    if (!selectedId) return;

    try {
      const totalCalendarTasks = await executeRuns(selectedId);

      toast.success(t('toast.workflowStarted'));

      if (totalCalendarTasks > 0) {
        toast.info(`Calendar events are being created for ${totalCalendarTasks} task(s)`);
      }
      onOpenChange(false);
      setSelectedId(null);
      setSearch('');

      void queryClient.invalidateQueries({
        queryKey: [['workflow']],
      });
    } catch {
      toast.error(t('errors.failedToStartWorkflow'));
    }
  }, [selectedId, executeRuns, onOpenChange, queryClient, t]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setSelectedId(null);
        setSearch('');
        setTypeFilter(preFilterType ?? null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, preFilterType],
  );

  const canStart = Boolean(selectedId && (effectiveContractorId || isBulk));

  return {
    search,
    setSearch,
    selectedId,
    setSelectedId,
    typeFilter,
    setTypeFilter,
    templates,
    isLoading,
    isBulk,
    contractorIds,
    suggestionEnabled,
    suggestedTemplate,
    startRunMutation,
    effectiveContractorId,
    handleStart,
    handleOpenChange,
    canStart,
  } as const;
}
