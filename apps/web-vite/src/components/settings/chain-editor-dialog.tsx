import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
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
import { useCallback, useId } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { ChainEditorUserPicker } from './chain-editor-user-picker.js';
import type { Condition } from './condition-builder';
import { ConditionBuilder } from './condition-builder';
import {
  useChainEditorDialog,
  type useChainEditorDialog as UseChainEditorDialog,
} from './hooks/use-chain-editor-dialog.js';
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
  ReturnType<typeof UseChainEditorDialog>;

type FormApi = ChainEditorDialogProps['form'];
type TranslateFn = ChainEditorDialogProps['t'];

interface BooleanSwitchProps {
  id: string;
  field: ControllerRenderProps<any, any>;
}

function BooleanSwitch({ id, field }: BooleanSwitchProps) {
  return <Switch id={id} checked={field.value} onCheckedChange={field.onChange} />;
}

interface ApproverRadioGroupProps {
  field: ControllerRenderProps<any, any>;
  userLabel: string;
  roleLabel: string;
}

function ApproverRadioGroup({ field, userLabel, roleLabel }: ApproverRadioGroupProps) {
  return (
    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="user" />
        <Label className="cursor-pointer font-normal">{userLabel}</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="role" />
        <Label className="cursor-pointer font-normal">{roleLabel}</Label>
      </div>
    </RadioGroup>
  );
}

interface UserPickerFieldProps {
  field: ControllerRenderProps<any, any>;
}

function UserPickerField({ field }: UserPickerFieldProps) {
  return <ChainEditorUserPicker value={field.value} onChange={field.onChange} />;
}

interface RoleSelectFieldProps {
  field: ControllerRenderProps<any, any>;
  placeholder: string;
}

function RoleSelectField({ field, placeholder }: RoleSelectFieldProps) {
  return (
    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {field.value ? (CHAIN_ROLE_LABELS[field.value] ?? field.value) : null}
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
  );
}

interface ConditionsFieldProps {
  field: ControllerRenderProps<any, any>;
}

function ConditionsField({ field }: ConditionsFieldProps) {
  return <ConditionBuilder value={(field.value ?? []) as Condition[]} onChange={field.onChange} />;
}

interface StepCardProps {
  form: FormApi;
  t: TranslateFn;
  index: number;
  canRemove: boolean;
  onRemove: (index: number) => void;
}

function StepCard({ form, t, index, canRemove, onRemove }: StepCardProps) {
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);
  const renderRadio = useCallback(
    ({ field }: { field: ControllerRenderProps<any, any> }) => (
      <ApproverRadioGroup
        field={field}
        userLabel={t('approvals.editor.approverUser')}
        roleLabel={t('approvals.editor.approverRole')}
      />
    ),
    [t],
  );
  const renderUserPicker = useCallback(
    ({ field }: { field: ControllerRenderProps<any, any> }) => <UserPickerField field={field} />,
    [],
  );
  const rolePlaceholder = t('approvals.editor.rolePlaceholder');
  const renderRoleSelect = useCallback(
    ({ field }: { field: ControllerRenderProps<any, any> }) => (
      <RoleSelectField field={field} placeholder={rolePlaceholder} />
    ),
    [rolePlaceholder],
  );
  const renderRequiredSwitch = useCallback(
    ({ field }: { field: ControllerRenderProps<any, any> }) => (
      <BooleanSwitch id={`step-required-${index}`} field={field} />
    ),
    [index],
  );

  const approverType = form.watch(`steps.${index}.approverType` as const);

  return (
    <Card>
      <CardContent className="relative space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {index + 1}
          </div>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
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
            {...form.register(`steps.${index}.name` as const)}
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
            name={`steps.${index}.approverType` as const}
            render={renderRadio}
          />
        </div>

        {approverType === 'user' ? (
          <Controller
            control={form.control}
            name={`steps.${index}.approverUserId` as const}
            render={renderUserPicker}
          />
        ) : (
          <Controller
            control={form.control}
            name={`steps.${index}.approverRole` as const}
            render={renderRoleSelect}
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
            {...form.register(`steps.${index}.slaHours` as const, { valueAsNumber: true })}
            className="max-w-[120px]"
          />
          {!!form.formState.errors.steps?.[index]?.slaHours && (
            <p className="text-xs text-destructive">
              {form.formState.errors.steps[index].slaHours?.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor={`step-required-${index}`}>{t('approvals.editor.required')}</Label>
          <Controller
            control={form.control}
            name={`steps.${index}.required` as const}
            render={renderRequiredSwitch}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function ChainEditorDialogView({
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

  const renderDefaultSwitch = useCallback(
    ({ field }: { field: ControllerRenderProps<any, any> }) => (
      <BooleanSwitch id={`${id}-chain-default`} field={field} />
    ),
    [id],
  );
  const renderConditions = useCallback(
    ({ field }: { field: ControllerRenderProps<any, any> }) => <ConditionsField field={field} />,
    [],
  );
  const handleAddLevel = useCallback(() => append({ ...DEFAULT_CHAIN_STEP }), [append]);
  const handleDiscard = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-[640px]">
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

        <form onSubmit={form.handleSubmit(onSubmit)} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-6">
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
                  <Label htmlFor={`${id}-chain-default`}>
                    {t('approvals.editor.defaultToggle')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('approvals.editor.defaultHelp')}
                  </p>
                </div>
                <Controller control={form.control} name="isDefault" render={renderDefaultSwitch} />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t('approvals.editor.levelsHeading')}</h4>

              {!!form.formState.errors.steps?.root && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.steps.root.message}
                </p>
              )}

              {fields.map((field, index) => (
                <StepCard
                  key={field.id}
                  form={form}
                  t={t}
                  index={index}
                  canRemove={fields.length > 1}
                  onRemove={remove}
                />
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
                <Button type="button" variant="outline" size="sm" onClick={handleAddLevel}>
                  <Plus className="me-1.5 size-3.5" />
                  {t('approvals.editor.addLevel')}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t('approvals.editor.conditionsHeading')}</h4>
              <Controller control={form.control} name="conditions" render={renderConditions} />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleDiscard} disabled={isPending}>
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

export function ChainEditorDialog(props: ChainEditorDialogShellProps) {
  const editor = useChainEditorDialog(props);
  return <ChainEditorDialogView {...props} {...editor} />;
}
