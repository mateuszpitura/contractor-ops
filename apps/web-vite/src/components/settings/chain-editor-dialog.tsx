import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
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
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { useId } from 'react';
import { Controller } from 'react-hook-form';
import { ChainEditorUserPickerContainer } from './chain-editor-user-picker-container.js';
import type { Condition } from './condition-builder';
import { ConditionBuilder } from './condition-builder';
import type { useChainEditorDialog } from './hooks/use-chain-editor-dialog.js';
import {
  CHAIN_APPROVER_ROLES,
  CHAIN_ROLE_LABELS,
  DEFAULT_CHAIN_STEP,
} from './hooks/use-chain-editor-dialog.js';

export type ChainData = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  conditionsJson: unknown;
  stepsJson: unknown;
};

type ChainEditorDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainData: ChainData | null;
};

export type ChainEditorDialogProps = ChainEditorDialogShellProps &
  ReturnType<typeof useChainEditorDialog>;

export function ChainEditorDialog({
  open,
  onOpenChange,
  chainData,
  t,
  form,
  fields,
  append,
  remove,
  isEditMode,
  isPending,
  onSubmit,
}: ChainEditorDialogProps) {
  const id = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? <Save className="size-4" /> : <Plus className="size-4" />}
            {isEditMode ? t('approvals.editor.editTitle') : t('approvals.editor.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('approvals.editor.editDescription')
              : t('approvals.editor.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-chain-name`}>{t('approvals.editor.chainName')}</Label>
              <Input
                id={`${id}-chain-name`}
                placeholder={t('approvals.editor.chainNamePlaceholder')}
                {...form.register('name')}
              />
              {!!form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`${id}-chain-default`}>{t('approvals.editor.defaultToggle')}</Label>
                <p className="text-xs text-muted-foreground">{t('approvals.editor.defaultHelp')}</p>
              </div>
              <Controller
                control={form.control}
                name="isDefault"
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={({ field }) => (
                  <Switch
                    id={`${id}-chain-default`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">{t('approvals.editor.levelsHeading')}</h4>

            {!!form.formState.errors.steps?.root && (
              <p className="text-xs text-destructive">{form.formState.errors.steps.root.message}</p>
            )}

            {fields.map((field, index) => (
              <Card key={field.id}>
                <CardContent className="relative space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() => remove(index)}
                        aria-label={t('approvals.editor.removeLevel')}>
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`step-name-${index}`}>{t('approvals.editor.levelName')}</Label>
                    <Input
                      id={`step-name-${index}`}
                      placeholder={t('approvals.editor.levelNamePlaceholder')}
                      {...form.register(`steps.${index}.name`)}
                    />
                    {!!form.formState.errors.steps?.[index]?.name && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.steps[index].name?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('approvals.editor.approver')}</Label>
                    <Controller
                      control={form.control}
                      name={`steps.${index}.approverType`}
                      // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                      render={({ field: radioField }) => (
                        <RadioGroup
                          value={radioField.value}
                          onValueChange={radioField.onChange}
                          className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="user" />
                            <Label className="cursor-pointer font-normal">
                              {t('approvals.editor.approverUser')}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="role" />
                            <Label className="cursor-pointer font-normal">
                              {t('approvals.editor.approverRole')}
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  </div>

                  {form.watch(`steps.${index}.approverType`) === 'user' ? (
                    <Controller
                      control={form.control}
                      name={`steps.${index}.approverUserId`}
                      // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                      render={({ field: userField }) => (
                        <ChainEditorUserPickerContainer
                          value={userField.value}
                          onChange={userField.onChange}
                        />
                      )}
                    />
                  ) : (
                    <Controller
                      control={form.control}
                      name={`steps.${index}.approverRole`}
                      // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                      render={({ field: roleField }) => (
                        <Select
                          value={roleField.value ?? undefined}
                          onValueChange={roleField.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('approvals.editor.rolePlaceholder')}>
                              {roleField.value
                                ? (CHAIN_ROLE_LABELS[roleField.value] ?? roleField.value)
                                : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {CHAIN_APPROVER_ROLES.map(role => (
                              <SelectItem key={role} value={role}>
                                {CHAIN_ROLE_LABELS[role] ?? role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}

                  <div className="space-y-2">
                    <Label htmlFor={`step-sla-${index}`}>{t('approvals.editor.slaHours')}</Label>
                    <Input
                      id={`step-sla-${index}`}
                      type="number"
                      placeholder={t('approvals.editor.slaPlaceholder')}
                      min={1}
                      max={720}
                      {...form.register(`steps.${index}.slaHours`, {
                        valueAsNumber: true,
                      })}
                      className="max-w-[120px]"
                    />
                    {!!form.formState.errors.steps?.[index]?.slaHours && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.steps[index].slaHours?.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor={`step-required-${index}`}>
                      {t('approvals.editor.required')}
                    </Label>
                    <Controller
                      control={form.control}
                      name={`steps.${index}.required`}
                      // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                      render={({ field: reqField }) => (
                        <Switch
                          id={`step-required-${index}`}
                          checked={reqField.value}
                          onCheckedChange={reqField.onChange}
                        />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {fields.length >= 3 ? (
              <Tooltip>
                <TooltipTrigger
                  render={<Button type="button" variant="outline" size="sm" disabled />}>
                  <Plus className="me-1.5 size-3.5" />
                  {t('approvals.editor.addLevel')}
                </TooltipTrigger>
                <TooltipContent>{t('approvals.editor.maxLevels')}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => append({ ...DEFAULT_CHAIN_STEP })}>
                <Plus className="me-1.5 size-3.5" />
                {t('approvals.editor.addLevel')}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">{t('approvals.editor.conditionsHeading')}</h4>
            <Controller
              control={form.control}
              name="conditions"
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={({ field: condField }) => (
                <ConditionBuilder
                  value={(condField.value ?? []) as Condition[]}
                  onChange={condField.onChange}
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
              {t('approvals.editor.discard')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t('approvals.editor.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
