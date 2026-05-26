import { workflowAssignableRoleValues } from '@contractor-ops/validators/roles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tDyn, tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ReminderRule } from '../reminder-rules-section.js';
import { useSettingsUsers } from './use-settings-users.js';

const TRIGGER_TYPES = [
  'BEFORE_CONTRACT_END',
  'BEFORE_DUE_DATE',
  'AFTER_DUE_DATE',
  'BEFORE_DOCUMENT_EXPIRY',
  'ON_LIFECYCLE_CHANGE',
  'ON_DUE_DATE',
] as const;

const TRIGGER_LABEL_KEYS: Record<string, string> = {
  BEFORE_CONTRACT_END: 'triggerBeforeContractEnd',
  BEFORE_DUE_DATE: 'triggerBeforeDueDate',
  ON_DUE_DATE: 'triggerOnDueDate',
  AFTER_DUE_DATE: 'triggerAfterDueDate',
  BEFORE_DOCUMENT_EXPIRY: 'triggerBeforeDocumentExpiry',
  ON_LIFECYCLE_CHANGE: 'triggerOnLifecycleChange',
};

const OFFSET_TRIGGERS = new Set([
  'BEFORE_CONTRACT_END',
  'BEFORE_DUE_DATE',
  'AFTER_DUE_DATE',
  'BEFORE_DOCUMENT_EXPIRY',
]);

const ENTITY_TYPES = [
  { value: 'CONTRACT', labelKey: 'entityContract' },
  { value: 'INVOICE', labelKey: 'entityInvoice' },
  { value: 'WORKFLOW_TASK_RUN', labelKey: 'entityTask' },
  { value: 'DOCUMENT', labelKey: 'entityDocument' },
] as const;

const CHANNELS = [
  { value: 'IN_APP', labelKey: 'channelInApp' },
  { value: 'EMAIL', labelKey: 'channelEmail' },
  { value: 'SLACK', labelKey: 'channelSlack' },
] as const;

const RECIPIENT_MODES = [
  { value: 'ENTITY_OWNER', labelKey: 'recipientEntityOwner' },
  { value: 'FINANCE_TEAM', labelKey: 'recipientFinanceTeam' },
  { value: 'ASSIGNEE', labelKey: 'recipientAssignee' },
  { value: 'SPECIFIC_USER', labelKey: 'recipientSpecificUser' },
  { value: 'ROLE', labelKey: 'recipientRole' },
] as const;

export const REMINDER_ROLE_OPTIONS = workflowAssignableRoleValues;

export const REMINDER_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  finance_admin: 'Finance Admin',
  ops_manager: 'Ops Manager',
  team_manager: 'Team Manager',
  legal_compliance_viewer: 'Legal Viewer',
  it_admin: 'IT Admin',
  external_accountant: 'Accountant',
  readonly: 'Read Only',
};

const reminderRuleFormSchema = z
  .object({
    name: z.string().min(1, 'Rule name is required').max(100),
    triggerType: z.string().min(1, 'Select a trigger type'),
    offsetDays: z.coerce.number().int().min(1).max(365).optional(),
    entityType: z.string().min(1),
    channel: z.string().min(1, 'Select a notification channel'),
    recipientMode: z.string().min(1, 'Select who to notify'),
    configUserId: z.string().optional(),
    configRole: z.string().optional(),
    active: z.boolean(),
  })
  .refine(
    data => {
      if (OFFSET_TRIGGERS.has(data.triggerType)) {
        return data.offsetDays !== undefined && data.offsetDays >= 1;
      }
      return true;
    },
    {
      message: 'Offset must be a positive number',
      path: ['offsetDays'],
    },
  );

type ReminderRuleFormValues = z.infer<typeof reminderRuleFormSchema>;

function useSelectorItems(t: LooseTranslator) {
  const triggerItems = TRIGGER_TYPES.map(trigger => ({
    value: trigger,
    label: tDynLoose(t, 'reminderRules.editor', TRIGGER_LABEL_KEYS[trigger]),
  }));

  const entityItems = ENTITY_TYPES.map(e => ({
    value: e.value,
    label: tDyn(t, 'reminderRules.editor', e.labelKey),
  }));

  const channelItems = CHANNELS.map(ch => ({
    value: ch.value,
    label: tDyn(t, 'reminderRules.editor', ch.labelKey),
  }));

  const recipientItems = RECIPIENT_MODES.map(m => ({
    value: m.value,
    label: tDyn(t, 'reminderRules.editor', m.labelKey),
  }));

  return { triggerItems, entityItems, channelItems, recipientItems };
}

export function useReminderRuleSlackStatus() {
  const trpc = useTRPC();
  const slackStatusQuery = useQuery(trpc.integration.getSlackStatus.queryOptions());

  return {
    isSlackConnected: slackStatusQuery.data?.connected === true,
  } as const;
}

interface ReminderRuleUserPickerOptions {
  value: string | undefined;
  onChange: (userId: string) => void;
}

export function useReminderRuleUserPicker({ value, onChange }: ReminderRuleUserPickerOptions) {
  const t = useTranslations('Settings');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { users: rawMembers } = useSettingsUsers();

  const users = useMemo(
    () =>
      rawMembers.map(m => ({
        id: (m.userId ?? m.id) as string,
        name: (m.name ?? 'Unknown') as string,
        email: (m.email ?? '') as string,
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
    setPickerOpen(false);
    setSearch('');
  };

  return {
    t,
    pickerOpen,
    setPickerOpen,
    search,
    setSearch,
    selectedUser,
    filteredUsers,
    value,
    handleSelect,
  } as const;
}

interface UseReminderRuleEditorOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ReminderRule;
}

export function useReminderRuleEditor({ open, onOpenChange, rule }: UseReminderRuleEditorOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings');
  const { triggerItems, entityItems, channelItems, recipientItems } = useSelectorItems(t);
  const queryClient = useQueryClient();
  const isEditMode = !!rule;
  const { isSlackConnected } = useReminderRuleSlackStatus();

  const form = useForm<z.input<typeof reminderRuleFormSchema>, unknown, ReminderRuleFormValues>({
    resolver: zodResolver(reminderRuleFormSchema),
    defaultValues: {
      name: '',
      triggerType: '',
      offsetDays: undefined,
      entityType: 'CONTRACT',
      channel: 'IN_APP',
      recipientMode: 'ENTITY_OWNER',
      configUserId: undefined,
      configRole: undefined,
      active: true,
    },
  });

  const watchedTrigger = form.watch('triggerType');
  const watchedRecipientMode = form.watch('recipientMode');
  const showOffset = OFFSET_TRIGGERS.has(watchedTrigger);

  useEffect(() => {
    if (!open) return;

    if (rule) {
      const config = (rule.configJson ?? {}) as Record<string, unknown>;
      form.reset({
        name: rule.name,
        triggerType: rule.triggerType,
        offsetDays: rule.offsetDays ?? undefined,
        entityType: rule.entityType,
        channel: rule.channel,
        recipientMode: rule.recipientMode,
        configUserId: (config.userId as string) ?? undefined,
        configRole: (config.role as string) ?? undefined,
        active: rule.active,
      });
    } else {
      form.reset({
        name: '',
        triggerType: '',
        offsetDays: undefined,
        entityType: 'CONTRACT',
        channel: 'IN_APP',
        recipientMode: 'ENTITY_OWNER',
        configUserId: undefined,
        configRole: undefined,
        active: true,
      });
    }
  }, [open, rule, form]);

  const createMutation = useMutation(
    trpc.reminder.create.mutationOptions({
      onSuccess: () => {
        toast.success(t('reminderRules.toasts.created'));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('reminderRules.toasts.saveFailed'));
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.reminder.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('reminderRules.toasts.updated'));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('reminderRules.toasts.saveFailed'));
      },
    }),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = useCallback(
    (data: ReminderRuleFormValues) => {
      const configJson: Record<string, unknown> = {};
      if (data.recipientMode === 'SPECIFIC_USER' && data.configUserId) {
        configJson.userId = data.configUserId;
      }
      if (data.recipientMode === 'ROLE' && data.configRole) {
        configJson.role = data.configRole;
      }

      const payload = {
        name: data.name,
        entityType: data.entityType as 'CONTRACT' | 'INVOICE' | 'WORKFLOW_TASK_RUN' | 'DOCUMENT',
        triggerType: data.triggerType as
          | 'BEFORE_DUE_DATE'
          | 'ON_DUE_DATE'
          | 'AFTER_DUE_DATE'
          | 'BEFORE_CONTRACT_END'
          | 'BEFORE_DOCUMENT_EXPIRY'
          | 'ON_LIFECYCLE_CHANGE',
        offsetDays: showOffset ? data.offsetDays : undefined,
        channel: data.channel as 'IN_APP' | 'EMAIL' | 'SLACK',
        recipientMode: data.recipientMode as
          | 'ENTITY_OWNER'
          | 'FINANCE_TEAM'
          | 'ASSIGNEE'
          | 'SPECIFIC_USER'
          | 'ROLE',
        configJson: Object.keys(configJson).length > 0 ? configJson : undefined,
        active: data.active,
      };

      if (isEditMode && rule) {
        updateMutation.mutate({ id: rule.id, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
    [isEditMode, rule, showOffset, createMutation, updateMutation],
  );

  return {
    t,
    form,
    triggerItems,
    entityItems,
    channelItems,
    recipientItems,
    isEditMode,
    isPending,
    isSlackConnected,
    showOffset,
    watchedRecipientMode,
    onSubmit,
  } as const;
}
