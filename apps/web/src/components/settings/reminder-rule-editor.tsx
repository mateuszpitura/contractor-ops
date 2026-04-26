'use client';

import { workflowAssignableRoleValues } from '@contractor-ops/validators/roles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { ReminderRule } from '@/components/settings/reminder-rules-section';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// Triggers that support offset (all except ON_LIFECYCLE_CHANGE and ON_DUE_DATE)
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

const ROLE_OPTIONS = workflowAssignableRoleValues;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  finance_admin: 'Finance Admin',
  ops_manager: 'Ops Manager',
  team_manager: 'Team Manager',
  legal_compliance_viewer: 'Legal Viewer',
  it_admin: 'IT Admin',
  external_accountant: 'Accountant',
  readonly: 'Read Only',
};

// ---------------------------------------------------------------------------
// Form schema (local mirror per project convention 02-02)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ReminderRuleEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ReminderRule;
};

// ---------------------------------------------------------------------------
// User Picker Sub-component
// ---------------------------------------------------------------------------

function RuleUserPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (userId: string) => void;
}) {
  const t = useTranslations('Settings');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const rawMembers = usersQuery.data ?? [];
  const users = rawMembers.map(m => ({
    id: (m.userId ?? m.id) as string,
    name: (m.name ?? 'Unknown') as string,
    email: (m.email ?? '') as string,
  }));

  const selectedUser = users.find(u => u.id === value);

  const filteredUsers = search
    ? users.filter(
        u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start font-normal"
            type="button"
          />
        }>
        {selectedUser ? (
          <span className="truncate">
            {selectedUser.name} ({selectedUser.email})
          </span>
        ) : (
          <span className="text-muted-foreground">{t('reminderRules.editor.userPlaceholder')}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('reminderRules.editor.userPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t('reminderRules.editor.noUsersFound')}</CommandEmpty>
            <CommandGroup>
              {filteredUsers.map(user => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  onSelect={() => {
                    onChange(user.id);
                    setPickerOpen(false);
                    setSearch('');
                  }}
                  data-checked={user.id === value || undefined}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Items arrays for Select components — built with translations
function useSelectorItems(t: ReturnType<typeof useTranslations<'Settings'>>) {
  const triggerItems = TRIGGER_TYPES.map(trigger => ({
    value: trigger,
    label: t(`reminderRules.editor.${TRIGGER_LABEL_KEYS[trigger]}` as Parameters<typeof t>[0]),
  }));

  const entityItems = ENTITY_TYPES.map(e => ({
    value: e.value,
    label: t(`reminderRules.editor.${e.labelKey}` as Parameters<typeof t>[0]),
  }));

  const channelItems = CHANNELS.map(ch => ({
    value: ch.value,
    label: t(`reminderRules.editor.${ch.labelKey}` as Parameters<typeof t>[0]),
  }));

  const recipientItems = RECIPIENT_MODES.map(m => ({
    value: m.value,
    label: t(`reminderRules.editor.${m.labelKey}` as Parameters<typeof t>[0]),
  }));

  return { triggerItems, entityItems, channelItems, recipientItems };
}

export function ReminderRuleEditor({ open, onOpenChange, rule }: ReminderRuleEditorProps) {
  const id = useId();
  const t = useTranslations('Settings');
  const { triggerItems, entityItems, channelItems, recipientItems } = useSelectorItems(t);
  const queryClient = useQueryClient();
  const isEditMode = !!rule;

  const slackStatusQuery = useQuery(trpc.integration.getSlackStatus.queryOptions());
  const isSlackConnected = slackStatusQuery.data?.connected === true;

  const form = useForm<ReminderRuleFormValues>({
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

  // Reset form when rule changes
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

  // ---- Mutations ----
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

  // ---- Submit ----
  const onSubmit = useCallback(
    (data: ReminderRuleFormValues) => {
      // Build configJson from form fields
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? t('reminderRules.editor.editTitle')
              : t('reminderRules.editor.createTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditMode
              ? t('reminderRules.editor.editTitle')
              : t('reminderRules.editor.createTitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* 1. Rule name */}
          <div className="space-y-2">
            <Label htmlFor={`${id}-rule-name`}>{t('reminderRules.editor.ruleName')}</Label>
            <Input
              id={`${id}-rule-name`}
              placeholder={t('reminderRules.editor.ruleNamePlaceholder')}
              {...form.register('name')}
            />
            {!!form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* 2. Trigger type */}
          <div className="space-y-2">
            <Label>{t('reminderRules.editor.triggerType')}</Label>
            <Controller
              control={form.control}
              name="triggerType"
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={triggerItems}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('reminderRules.editor.triggerType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerItems.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!!form.formState.errors.triggerType && (
              <p className="text-xs text-destructive">
                {form.formState.errors.triggerType.message}
              </p>
            )}
          </div>

          {/* 3. Offset (conditional) */}
          {showOffset && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-rule-offset`}>{t('reminderRules.editor.offset')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${id}-rule-offset`}
                  type="number"
                  placeholder="7"
                  min={1}
                  max={365}
                  className="max-w-[120px]"
                  {...form.register('offsetDays', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">
                  {t('reminderRules.editor.offsetDaysPlaceholder')}
                </span>
              </div>
              {!!form.formState.errors.offsetDays && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.offsetDays.message}
                </p>
              )}
            </div>
          )}

          {/* 4. Entity type */}
          <div className="space-y-2">
            <Label>{t('reminderRules.editor.entityType')}</Label>
            <Controller
              control={form.control}
              name="entityType"
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={entityItems}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entityItems.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* 5. Channel */}
          <div className="space-y-2">
            <Label>{t('reminderRules.editor.channel')}</Label>
            <Controller
              control={form.control}
              name="channel"
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={channelItems}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channelItems.map(item => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        disabled={item.value === 'SLACK' && !isSlackConnected}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!!form.formState.errors.channel && (
              <p className="text-xs text-destructive">{form.formState.errors.channel.message}</p>
            )}
          </div>

          {/* 6. Recipient mode */}
          <div className="space-y-2">
            <Label>{t('reminderRules.editor.recipientMode')}</Label>
            <Controller
              control={form.control}
              name="recipientMode"
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={recipientItems}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recipientItems.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!!form.formState.errors.recipientMode && (
              <p className="text-xs text-destructive">
                {form.formState.errors.recipientMode.message}
              </p>
            )}
          </div>

          {/* 7a. User picker (conditional) */}
          {watchedRecipientMode === 'SPECIFIC_USER' && (
            <div className="space-y-2">
              <Controller
                control={form.control}
                name="configUserId"
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={({ field }) => (
                  <RuleUserPicker value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          )}

          {/* 7b. Role picker (conditional) */}
          {watchedRecipientMode === 'ROLE' && (
            <div className="space-y-2">
              <Controller
                control={form.control}
                name="configRole"
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                    items={ROLE_OPTIONS.map(r => ({ value: r, label: ROLE_LABELS[r] ?? r }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('reminderRules.editor.rolePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(role => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role] ?? role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* 8. Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-rule-active`}>{t('reminderRules.editor.activeToggle')}</Label>
            <Controller
              control={form.control}
              name="active"
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={({ field }) => (
                <Switch
                  id={`${id}-rule-active`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
              onClick={() => onOpenChange(false)}
              disabled={isPending}>
              {t('reminderRules.editor.discard')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {!!isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t('reminderRules.editor.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
