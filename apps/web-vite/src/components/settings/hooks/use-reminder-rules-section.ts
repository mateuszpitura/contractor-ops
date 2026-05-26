import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { tDynLoose } from '../../../i18n/typed-keys';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type ReminderRule = {
  id: string;
  name: string;
  entityType: string;
  triggerType: string;
  offsetDays: number | null;
  offsetHours: number | null;
  channel: string;
  recipientMode: string;
  configJson: unknown;
  active: boolean;
};

const TRIGGER_LABEL_KEYS: Record<string, string> = {
  BEFORE_CONTRACT_END: 'triggerBeforeContractEnd',
  BEFORE_DUE_DATE: 'triggerBeforeDueDate',
  ON_DUE_DATE: 'triggerOnDueDate',
  AFTER_DUE_DATE: 'triggerAfterDueDate',
  BEFORE_DOCUMENT_EXPIRY: 'triggerBeforeDocumentExpiry',
  ON_LIFECYCLE_CHANGE: 'triggerOnLifecycleChange',
};

const CHANNEL_LABEL_KEYS: Record<string, string> = {
  IN_APP: 'channelInApp',
  EMAIL: 'channelEmail',
  SLACK: 'channelSlack',
};

const RECIPIENT_LABEL_KEYS: Record<string, string> = {
  ENTITY_OWNER: 'recipientEntityOwner',
  FINANCE_TEAM: 'recipientFinanceTeam',
  ASSIGNEE: 'recipientAssignee',
  SPECIFIC_USER: 'recipientSpecificUser',
  ROLE: 'recipientRole',
};

export const CHANNEL_BADGE_VARIANT: Record<string, string> = {
  IN_APP: 'bg-primary/10 text-primary',
  EMAIL: 'bg-blue-500/10 text-blue-500',
  SLACK: 'bg-purple-500/10 text-purple-500',
};

export function useReminderRulesSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const rulesQuery = useQuery(trpc.reminder.list.queryOptions());
  const rules = (rulesQuery.data ?? []) as ReminderRule[];

  const toggleActiveMutation = useMutation(
    trpc.reminder.toggleActive.mutationOptions({
      onSuccess: () => {
        toast.success(t('reminderRules.toasts.toggled'));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('reminderRules.toasts.saveFailed'));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.reminder.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t('reminderRules.toasts.deleted'));
        queryClient.invalidateQueries({
          queryKey: trpc.reminder.list.queryKey(),
        });
        setDeletingRuleId(null);
      },
      onError: () => {
        toast.error(t('reminderRules.toasts.deleteFailed'));
      },
    }),
  );

  const handleToggleActive = (rule: ReminderRule) => {
    toggleActiveMutation.mutate({ id: rule.id, active: !rule.active });
  };

  const handleEdit = (rule: ReminderRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };

  const handleDelete = (ruleId: string) => {
    deleteMutation.mutate({ id: ruleId });
  };

  const getRuleDescription = (rule: ReminderRule): string => {
    const triggerKey = TRIGGER_LABEL_KEYS[rule.triggerType] ?? rule.triggerType;
    const recipientKey = RECIPIENT_LABEL_KEYS[rule.recipientMode] ?? rule.recipientMode;
    const channelKey = CHANNEL_LABEL_KEYS[rule.channel] ?? rule.channel;

    const triggerLabel = tDynLoose(t, 'reminderRules.editor', triggerKey);
    const recipientLabel = tDynLoose(t, 'reminderRules.editor', recipientKey);
    const channelLabel = tDynLoose(t, 'reminderRules.editor', channelKey);

    if (rule.offsetDays) {
      return `${rule.offsetDays} ${t('reminderRules.editor.offsetDaysPlaceholder')} ${triggerLabel.toLowerCase()}, ${recipientLabel} ${channelLabel}`;
    }

    return `${triggerLabel}, ${recipientLabel} ${channelLabel}`;
  };

  return {
    t,
    tAria,
    rulesQuery,
    rules,
    editorOpen,
    setEditorOpen,
    editingRule,
    deletingRuleId,
    setDeletingRuleId,
    toggleActiveMutation,
    deleteMutation,
    handleToggleActive,
    handleEdit,
    handleCreate,
    handleDelete,
    getRuleDescription,
    CHANNEL_LABEL_KEYS,
    RECIPIENT_LABEL_KEYS,
  } as const;
}
