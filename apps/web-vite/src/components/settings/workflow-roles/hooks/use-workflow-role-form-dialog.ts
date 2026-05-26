import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { WorkflowRoleFormInput, WorkflowRoleTaskItem } from '../workflow-role-form-dialog.js';

const EMPTY_TASK: WorkflowRoleTaskItem = {
  sortOrder: 0,
  titleEn: '',
  titlePl: '',
  titleDe: '',
  descriptionEn: '',
  descriptionPl: '',
  descriptionDe: '',
  dueDayOffset: 0,
  requiredDocs: [],
};

interface UseWorkflowRoleFormDialogOptions {
  mode: 'create' | 'edit';
  initial?: WorkflowRoleFormInput;
  onOpenChange: (open: boolean) => void;
}

export function useWorkflowRoleFormDialog({
  mode,
  initial,
  onOpenChange,
}: UseWorkflowRoleFormDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('WorkflowRoles');
  const queryClient = useQueryClient();
  const id = useId();

  const [form, setForm] = useState<WorkflowRoleFormInput>(
    initial ?? {
      role: '',
      displayNameEn: '',
      displayNamePl: '',
      displayNameDe: '',
      taskItems: [{ ...EMPTY_TASK }],
    },
  );

  const onSuccess = useCallback(() => {
    toast.success(mode === 'create' ? t('toast.created') : t('toast.updated'));
    queryClient.invalidateQueries(trpc.workflowRoles.pathFilter());
    onOpenChange(false);
  }, [mode, t, queryClient, trpc.workflowRoles, onOpenChange]);

  const createMutation = useMutation(
    trpc.workflowRoles.create.mutationOptions({
      onSuccess,
      onError: err => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.workflowRoles.update.mutationOptions({
      onSuccess,
      onError: err => toast.error(err.message),
    }),
  );

  const setField = useCallback(
    <K extends keyof WorkflowRoleFormInput>(field: K, value: WorkflowRoleFormInput[K]) => {
      setForm(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const setTaskField = useCallback(
    <K extends keyof WorkflowRoleTaskItem>(
      idx: number,
      field: K,
      value: WorkflowRoleTaskItem[K],
    ) => {
      setForm(prev => ({
        ...prev,
        taskItems: prev.taskItems.map((item, i) =>
          i === idx ? { ...item, [field]: value } : item,
        ),
      }));
    },
    [],
  );

  const addTask = useCallback(() => {
    setForm(prev => ({
      ...prev,
      taskItems: [...prev.taskItems, { ...EMPTY_TASK, sortOrder: prev.taskItems.length }],
    }));
  }, []);

  const removeTask = useCallback((idx: number) => {
    setForm(prev => ({
      ...prev,
      taskItems: prev.taskItems
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, sortOrder: i })),
    }));
  }, []);

  const moveTask = useCallback((idx: number, dir: -1 | 1) => {
    setForm(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.taskItems.length) return prev;
      const items = [...prev.taskItems];
      const [moved] = items.splice(idx, 1);
      if (!moved) return prev;
      items.splice(target, 0, moved);
      return {
        ...prev,
        taskItems: items.map((item, i) => ({ ...item, sortOrder: i })),
      };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (form.taskItems.length === 0) {
      toast.error(t('validation.atLeastOneTask'));
      return;
    }
    if (form.taskItems.length > 20) {
      toast.error(t('validation.maxTasks'));
      return;
    }
    const payload = {
      role: form.role,
      displayNameEn: form.displayNameEn,
      displayNamePl: form.displayNamePl || undefined,
      displayNameDe: form.displayNameDe || undefined,
      taskItems: form.taskItems.map(item => ({
        sortOrder: item.sortOrder,
        titleEn: item.titleEn,
        titlePl: item.titlePl || undefined,
        titleDe: item.titleDe || undefined,
        descriptionEn: item.descriptionEn || undefined,
        descriptionPl: item.descriptionPl || undefined,
        descriptionDe: item.descriptionDe || undefined,
        dueDayOffset: item.dueDayOffset,
        requiredDocs: item.requiredDocs.length > 0 ? item.requiredDocs : undefined,
      })),
    };
    if (mode === 'edit' && form.id) {
      updateMutation.mutate({ id: form.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [form, mode, t, createMutation, updateMutation]);

  return {
    id,
    t,
    form,
    setField,
    setTaskField,
    addTask,
    removeTask,
    moveTask,
    handleSubmit,
    isPending: createMutation.isPending || updateMutation.isPending,
  } as const;
}
