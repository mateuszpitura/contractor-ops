import { useCallback, useEffect, useRef } from 'react';

import type { TemplateFormValues } from '../template-builder/use-template-form.js';
import { useTemplateForm } from '../template-builder/use-template-form.js';
import { useWorkflowTemplateForm } from './use-workflow-ui.js';

export function useTemplateFormSection(templateId?: string) {
  const onUpdateSuccessRef = useRef<(() => void) | undefined>(undefined);

  const {
    templateQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    duplicateMutation,
    isEditing,
  } = useWorkflowTemplateForm(templateId, {
    onUpdateSuccess: () => onUpdateSuccessRef.current?.(),
  });

  const templateData = templateQuery.data;
  const templateStatus: string =
    ((templateData as Record<string, unknown> | undefined)?.status as string) ?? 'DRAFT';

  const initialValues =
    isEditing && templateData
      ? ({
          name: templateData.name,
          type: templateData.type,
          description: templateData.description ?? '',
          tasks:
            templateData.tasks?.map(task => ({
              id: task.id,
              title: task.title,
              taskType: task.taskType,
              description: task.description ?? '',
              sortOrder: task.sortOrder,
              required: task.required,
              assigneeMode: task.assigneeMode,
              assigneeRole: task.assigneeRole ?? undefined,
              assigneeUserId: task.assigneeUserId ?? undefined,
              dueOffsetDays: task.dueOffsetDays ?? undefined,
              dueOffsetHours: task.dueOffsetHours ?? undefined,
              dependsOnTaskTemplateId: task.dependsOnTaskTemplateId ?? undefined,
              externalUrl: task.externalUrl ?? '',
              conditions: (task.configJson ?? null) as Record<string, unknown> | null,
            })) ?? [],
        } as Parameters<typeof useTemplateForm>[0])
      : undefined;

  const { form, fields, isDirty, addTask, removeTask, reorderTasks } =
    useTemplateForm(initialValues);

  onUpdateSuccessRef.current = () => form.reset(form.getValues());

  const tasks = form.watch('tasks');

  useEffect(() => {
    if (!(isEditing && templateData)) return;
    form.reset({
      name: templateData.name,
      type: templateData.type,
      description: templateData.description ?? '',
      tasks:
        templateData.tasks?.map(task => ({
          id: task.id,
          title: task.title,
          taskType: task.taskType,
          description: task.description ?? '',
          sortOrder: task.sortOrder,
          required: task.required,
          assigneeMode: task.assigneeMode,
          assigneeRole: task.assigneeRole ?? undefined,
          assigneeUserId: task.assigneeUserId ?? undefined,
          dueOffsetDays: task.dueOffsetDays ?? undefined,
          dueOffsetHours: task.dueOffsetHours ?? undefined,
          dependsOnTaskTemplateId: task.dependsOnTaskTemplateId ?? undefined,
          externalUrl: task.externalUrl ?? '',
          conditions: (task.configJson ?? null) as Record<string, unknown> | null,
        })) ?? [],
    } as Parameters<typeof form.reset>[0]);
  }, [isEditing, templateData, form]);

  const handleSave = useCallback(
    (values: TemplateFormValues) => {
      const payload = {
        name: values.name,
        type: values.type,
        description: values.description || undefined,
        tasks: values.tasks.map((task, i) => ({
          id: task.id,
          title: task.title,
          taskType: task.taskType,
          description: task.description || undefined,
          sortOrder: i,
          required: task.required,
          assigneeMode: task.assigneeMode,
          assigneeRole: task.assigneeRole || undefined,
          assigneeUserId: task.assigneeUserId || undefined,
          dueOffsetDays: task.dueOffsetDays || undefined,
          dueOffsetHours: task.dueOffsetHours || undefined,
          dependsOnTaskTemplateId: task.dependsOnTaskTemplateId || undefined,
          externalUrl: task.externalUrl || undefined,
          conditions: task.conditions ?? undefined,
        })),
      };

      if (isEditing) {
        updateMutation.mutate({ id: templateId as string, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
    [isEditing, templateId, createMutation, updateMutation],
  );

  const handleActivate = useCallback(() => {
    if (!templateId) return;
    updateMutation.mutate({ id: templateId, status: 'ACTIVE' });
  }, [templateId, updateMutation]);

  const handleArchive = useCallback(() => {
    if (!templateId) return;
    updateMutation.mutate({ id: templateId, status: 'ARCHIVED' });
  }, [templateId, updateMutation]);

  const handleDuplicate = useCallback(() => {
    if (!templateId) return;
    duplicateMutation.mutate({ id: templateId });
  }, [templateId, duplicateMutation]);

  const handleDelete = useCallback(() => {
    if (!templateId) return;
    deleteMutation.mutate({ id: templateId });
  }, [templateId, deleteMutation]);

  return {
    form,
    fields,
    tasks,
    isDirty,
    addTask,
    removeTask,
    reorderTasks,
    templateStatus,
    isEditing,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isUpdatePending: updateMutation.isPending,
    isDuplicatePending: duplicateMutation.isPending,
    isDeletePending: deleteMutation.isPending,
    handleSave,
    handleActivate,
    handleArchive,
    handleDuplicate,
    handleDelete,
  } as const;
}
