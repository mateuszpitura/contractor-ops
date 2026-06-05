/**
 * useTemplateForm — workflow template form hook.
 */

import { workflowAssignableRoleValues } from '@contractor-ops/validators/roles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

const conditionRuleSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equals', 'notEquals', 'contains', 'startsWith']),
  value: z.string().min(1),
});

const conditionGroupSchema = z.object({
  combinator: z.enum(['AND', 'OR']),
  rules: z.array(conditionRuleSchema).min(1),
});

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Task title is required').max(255),
  description: z.string().optional(),
  taskType: z.enum([
    'DOCUMENT_COLLECTION',
    'APPROVAL',
    'ACCESS_GRANT',
    'ACCESS_REVOKE',
    'FINANCE_SETUP',
    'EQUIPMENT',
    'KNOWLEDGE_TRANSFER',
    'MEETING',
    'MANUAL',
    'NOTIFICATION',
  ]),
  sortOrder: z.number().int().nonnegative(),
  required: z.boolean(),
  assigneeMode: z.enum([
    'FIXED_USER',
    'ROLE_BASED',
    'CONTRACTOR_OWNER',
    'CONTRACT_OWNER',
    'PROJECT_MANAGER',
  ]),
  assigneeRole: z.enum(workflowAssignableRoleValues).optional(),
  assigneeUserId: z.string().optional(),
  dueOffsetDays: z.number().int().nonnegative().optional(),
  dueOffsetHours: z.number().int().nonnegative().optional(),
  dependsOnTaskTemplateId: z.string().optional(),
  externalUrl: z.url().optional().or(z.literal('')),
  conditions: conditionGroupSchema.nullish(),
});

export const templateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255),
  type: z.enum(['ONBOARDING', 'OFFBOARDING', 'DOCUMENT_COLLECTION', 'COMPLIANCE_REVIEW', 'CUSTOM']),
  description: z.string().optional(),
  tasks: z.array(taskSchema),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;
export type TaskFormValues = z.infer<typeof taskSchema>;

export function useTemplateForm(defaultValues?: Partial<TemplateFormValues>) {
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      type: 'CUSTOM',
      description: '',
      tasks: [],
      ...defaultValues,
    },
    mode: 'onChange',
  });

  const { fields, append, remove, move, replace } = useFieldArray({
    control: form.control,
    name: 'tasks',
  });

  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const addTask = useCallback(() => {
    append({
      title: '',
      taskType: 'MANUAL',
      sortOrder: fields.length,
      required: false,
      assigneeMode: 'ROLE_BASED',
      description: '',
      conditions: null,
    });
  }, [append, fields.length]);

  const removeTask = useCallback(
    (index: number) => {
      remove(index);
    },
    [remove],
  );

  const reorderTasks = useCallback(
    (oldIndex: number, newIndex: number) => {
      move(oldIndex, newIndex);
      const currentTasks = form.getValues('tasks');
      const updated = currentTasks.map((task, i) => ({
        ...task,
        sortOrder: i,
      }));
      replace(updated);
    },
    [move, form, replace],
  );

  return {
    form,
    fields,
    isDirty,
    addTask,
    removeTask,
    reorderTasks,
  };
}
