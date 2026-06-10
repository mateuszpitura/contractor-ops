import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormLayoutClassName,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Bell, Loader2, Save } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { useReminderRuleEditor as UseReminderRuleEditor } from './hooks/use-reminder-rule-editor.js';
import {
  REMINDER_ROLE_LABELS,
  REMINDER_ROLE_OPTIONS,
  useReminderRuleEditor,
} from './hooks/use-reminder-rule-editor.js';
import { ReminderRuleUserPicker } from './reminder-rule-user-picker.js';
import type { ReminderRule } from './reminder-rules-section';

type ReminderRuleEditorShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ReminderRule;
};

export type ReminderRuleEditorProps = ReminderRuleEditorShellProps &
  ReturnType<typeof UseReminderRuleEditor>;

interface SelectItemOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectControlFieldProps {
  control: ReminderRuleEditorProps['form']['control'];
  // biome-ignore lint/suspicious/noExplicitAny: Controller name spans many union members; runtime safe through react-hook-form.
  name: any;
  items: readonly SelectItemOption[];
  placeholder?: string;
  allowNull?: boolean;
}

function SelectControlField({
  control,
  name,
  items,
  placeholder,
  allowNull,
}: SelectControlFieldProps) {
  const renderSelect = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: react-hook-form Controller render expects strict form-shape types; widened intentionally for reuse.
    ({ field }: { field: ControllerRenderProps<any, any> }) => (
      <Select
        value={allowNull ? (field.value ?? undefined) : field.value}
        onValueChange={field.onChange}
        items={items}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ),
    [items, placeholder, allowNull],
  );
  return <Controller control={control} name={name} render={renderSelect} />;
}

interface SwitchControlFieldProps {
  control: ReminderRuleEditorProps['form']['control'];
  // biome-ignore lint/suspicious/noExplicitAny: Controller name spans many union members; runtime safe through react-hook-form.
  name: any;
  id: string;
}

function SwitchControlField({ control, name, id }: SwitchControlFieldProps) {
  const renderSwitch = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: react-hook-form Controller render expects strict form-shape types; widened intentionally for reuse.
    ({ field }: { field: ControllerRenderProps<any, any> }) => (
      <Switch id={id} checked={field.value} onCheckedChange={field.onChange} />
    ),
    [id],
  );
  return <Controller control={control} name={name} render={renderSwitch} />;
}

interface UserPickerControlFieldProps {
  control: ReminderRuleEditorProps['form']['control'];
  // biome-ignore lint/suspicious/noExplicitAny: Controller name spans many union members; runtime safe through react-hook-form.
  name: any;
}

function UserPickerControlField({ control, name }: UserPickerControlFieldProps) {
  const renderUserPicker = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: react-hook-form Controller render expects strict form-shape types; widened intentionally for reuse.
    ({ field }: { field: ControllerRenderProps<any, any> }) => (
      <ReminderRuleUserPicker value={field.value} onChange={field.onChange} />
    ),
    [],
  );
  return <Controller control={control} name={name} render={renderUserPicker} />;
}

export function ReminderRuleEditorView({
  open,
  onOpenChange,
  rule,
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
}: ReminderRuleEditorProps) {
  const id = useId();

  const channelItemsWithDisabled = useMemo(
    () =>
      channelItems.map(item => ({
        ...item,
        disabled: item.value === 'SLACK' && !isSlackConnected,
      })),
    [channelItems, isSlackConnected],
  );
  const roleItems = useMemo(
    () =>
      REMINDER_ROLE_OPTIONS.map(r => ({
        value: r,
        label: REMINDER_ROLE_LABELS[r] ?? r,
      })),
    [],
  );

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70vh] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? <Save className="size-4" /> : <Bell className="size-4" />}
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

        <form onSubmit={form.handleSubmit(onSubmit)} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-4">
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

            <div className="space-y-2">
              <Label>{t('reminderRules.editor.triggerType')}</Label>
              <SelectControlField
                control={form.control}
                name="triggerType"
                items={triggerItems}
                placeholder={t('reminderRules.editor.triggerType')}
              />
              {!!form.formState.errors.triggerType && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.triggerType.message}
                </p>
              )}
            </div>

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

            <div className="space-y-2">
              <Label>{t('reminderRules.editor.entityType')}</Label>
              <SelectControlField control={form.control} name="entityType" items={entityItems} />
            </div>

            <div className="space-y-2">
              <Label>{t('reminderRules.editor.channel')}</Label>
              <SelectControlField
                control={form.control}
                name="channel"
                items={channelItemsWithDisabled}
              />
              {!!form.formState.errors.channel && (
                <p className="text-xs text-destructive">{form.formState.errors.channel.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('reminderRules.editor.recipientMode')}</Label>
              <SelectControlField
                control={form.control}
                name="recipientMode"
                items={recipientItems}
              />
              {!!form.formState.errors.recipientMode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.recipientMode.message}
                </p>
              )}
            </div>

            {watchedRecipientMode === 'SPECIFIC_USER' && (
              <div className="space-y-2">
                <UserPickerControlField control={form.control} name="configUserId" />
              </div>
            )}

            {watchedRecipientMode === 'ROLE' && (
              <div className="space-y-2">
                <SelectControlField
                  control={form.control}
                  name="configRole"
                  items={roleItems}
                  placeholder={t('reminderRules.editor.rolePlaceholder')}
                  allowNull
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor={`${id}-rule-active`}>{t('reminderRules.editor.activeToggle')}</Label>
              <SwitchControlField control={form.control} name="active" id={`${id}-rule-active`} />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
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

export function ReminderRuleEditor(props: ReminderRuleEditorShellProps) {
  const editor = useReminderRuleEditor(props);
  return <ReminderRuleEditorView {...props} {...editor} />;
}
