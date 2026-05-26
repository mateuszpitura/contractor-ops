import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useId } from 'react';
import { Controller } from 'react-hook-form';
import type { useReminderRuleEditor } from './hooks/use-reminder-rule-editor.js';
import { REMINDER_ROLE_LABELS, REMINDER_ROLE_OPTIONS } from './hooks/use-reminder-rule-editor.js';
import { ReminderRuleUserPickerContainer } from './reminder-rule-user-picker-container.js';
import type { ReminderRule } from './reminder-rules-section';

type ReminderRuleEditorShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ReminderRule;
};

export type ReminderRuleEditorProps = ReminderRuleEditorShellProps &
  ReturnType<typeof useReminderRuleEditor>;

export function ReminderRuleEditor({
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[70vh] overflow-y-auto">
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

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

          {watchedRecipientMode === 'SPECIFIC_USER' && (
            <div className="space-y-2">
              <Controller
                control={form.control}
                name="configUserId"
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={({ field }) => (
                  <ReminderRuleUserPickerContainer value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          )}

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
                    items={REMINDER_ROLE_OPTIONS.map(r => ({
                      value: r,
                      label: REMINDER_ROLE_LABELS[r] ?? r,
                    }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('reminderRules.editor.rolePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_ROLE_OPTIONS.map(role => (
                        <SelectItem key={role} value={role}>
                          {REMINDER_ROLE_LABELS[role] ?? role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

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
