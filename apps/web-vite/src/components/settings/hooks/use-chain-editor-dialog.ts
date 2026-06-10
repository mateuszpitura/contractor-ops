import { workflowAssignableRoleValues } from '@contractor-ops/validators/roles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ChainData } from '../chain-editor-dialog.js';
import type { Condition } from '../condition-builder.js';
import { useSettingsUsers } from './use-settings-users.js';

const APPROVER_ROLES = workflowAssignableRoleValues;

export const CHAIN_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  finance_admin: 'Finance Admin',
  ops_manager: 'Ops Manager',
  team_manager: 'Team Manager',
  legal_compliance_viewer: 'Legal Viewer',
  it_admin: 'IT Admin',
  external_accountant: 'Accountant',
  readonly: 'Read Only',
};

export { APPROVER_ROLES as CHAIN_APPROVER_ROLES };

const stepSchema = z.object({
  name: z.string().min(1, 'Level name is required').max(100),
  approverType: z.enum(['user', 'role']),
  approverUserId: z.string().nullish(),
  approverRole: z.enum(APPROVER_ROLES).nullish(),
  slaHours: z.coerce
    .number()
    .int()
    .min(1, 'SLA must be between 1 and 720 hours')
    .max(720, 'SLA must be between 1 and 720 hours'),
  required: z.boolean(),
});

const chainFormSchema = z.object({
  name: z.string().min(1, 'Chain name is required').max(100),
  isDefault: z.boolean(),
  steps: z.array(stepSchema).min(1, 'Add at least one approval level').max(3),
  conditions: z
    .array(
      z.object({
        field: z.enum(['amount', 'contractorType']),
        operator: z.enum(['gt', 'lt', 'eq']),
        value: z.union([z.number(), z.string()]),
      }),
    )
    .optional(),
});

export type ChainFormValues = z.infer<typeof chainFormSchema>;

export const DEFAULT_CHAIN_STEP: ChainFormValues['steps'][number] = {
  name: '',
  approverType: 'user',
  approverUserId: null,
  approverRole: null,
  slaHours: 24,
  required: true,
};

interface ChainEditorUserPickerOptions {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
}

export function useChainEditorUserPicker({ value, onChange }: ChainEditorUserPickerOptions) {
  const t = useTranslations('Settings');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { users: rawMembers } = useSettingsUsers();

  const users = useMemo(
    () =>
      rawMembers.map(m => ({
        id: (m.userId ?? m.id) as string,
        name: (m.name ?? 'Unknown') as string,
        email: (m.email ?? '') as string,
        role: (m.role ?? '') as string,
      })),
    [rawMembers],
  );

  const selectedUser = users.find(u => u.id === value);

  const filteredUsers = search
    ? users.filter(
        u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  const handleSelect = (userId: string) => {
    onChange(userId);
    setOpen(false);
    setSearch('');
  };

  return {
    t,
    open,
    setOpen,
    search,
    setSearch,
    selectedUser,
    filteredUsers,
    value,
    handleSelect,
    roleLabels: CHAIN_ROLE_LABELS,
  } as const;
}

interface UseChainEditorDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainData: ChainData | null;
}

export function useChainEditorDialog({
  open,
  onOpenChange,
  chainData,
}: UseChainEditorDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings');
  const isEditMode = chainData !== null;

  const form = useForm<z.input<typeof chainFormSchema>, unknown, ChainFormValues>({
    resolver: zodResolver(chainFormSchema),
    defaultValues: {
      name: '',
      isDefault: false,
      steps: [{ ...DEFAULT_CHAIN_STEP }],
      conditions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  useEffect(() => {
    if (!open) return;

    if (chainData) {
      const steps = Array.isArray(chainData.stepsJson) ? chainData.stepsJson : [];

      form.reset({
        name: chainData.name,
        isDefault: chainData.isDefault,
        steps: steps.map((s: Record<string, unknown>) => ({
          name: (s.name as string) ?? '',
          approverType: s.approverUserId ? ('user' as const) : ('role' as const),
          approverUserId: (s.approverUserId as string | null) ?? null,
          approverRole:
            (s.approverRole as ChainFormValues['steps'][number]['approverRole']) ?? null,
          slaHours: (s.slaHours as number) ?? 24,
          required: (s.required as boolean) ?? true,
        })),
        conditions: Array.isArray(chainData.conditionsJson)
          ? (chainData.conditionsJson as Condition[])
          : [],
      });
    } else {
      form.reset({
        name: '',
        isDefault: false,
        steps: [{ ...DEFAULT_CHAIN_STEP }],
        conditions: [],
      });
    }
  }, [open, chainData, form]);

  const createMutation = useResourceMutation(trpc.approval.createChain.mutationOptions(), {
    invalidate: [trpc.approval.listChains.queryKey()],
    successMessage: t('approvals.toasts.created'),
    errorMessage: t('approvals.toasts.saveFailed'),
    onClose: () => onOpenChange(false),
  });

  const updateMutation = useResourceMutation(trpc.approval.updateChain.mutationOptions(), {
    invalidate: [trpc.approval.listChains.queryKey()],
    successMessage: t('approvals.toasts.updated'),
    errorMessage: t('approvals.toasts.saveFailed'),
    onClose: () => onOpenChange(false),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = useCallback(
    (data: ChainFormValues) => {
      const stepsJson = data.steps.map(step => ({
        name: step.name,
        approverUserId: step.approverType === 'user' ? (step.approverUserId ?? null) : null,
        approverRole: step.approverType === 'role' ? (step.approverRole ?? null) : null,
        slaHours: step.slaHours,
        required: step.required,
      }));

      const conditionsJson =
        data.conditions && data.conditions.length > 0
          ? data.conditions.filter(c => c.value !== '' && c.value !== undefined)
          : null;

      if (isEditMode && chainData) {
        updateMutation.mutate({
          id: chainData.id,
          name: data.name,
          isDefault: data.isDefault,
          isActive: chainData.isActive,
          stepsJson,
          conditionsJson,
        });
      } else {
        createMutation.mutate({
          name: data.name,
          isDefault: data.isDefault,
          stepsJson,
          conditionsJson,
        });
      }
    },
    [isEditMode, chainData, createMutation, updateMutation],
  );

  return {
    t,
    form,
    fields,
    append,
    remove,
    isEditMode,
    isPending,
    onSubmit,
  } as const;
}
