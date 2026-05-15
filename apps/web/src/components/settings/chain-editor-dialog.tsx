'use client';

import { workflowAssignableRoleValues } from '@contractor-ops/validators/roles';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Condition } from '@/components/settings/condition-builder';
import { ConditionBuilder } from '@/components/settings/condition-builder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Form schema (local wizard schema -- mirrors validators/approval.ts)
// ---------------------------------------------------------------------------

const APPROVER_ROLES = workflowAssignableRoleValues;

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

type ChainFormValues = z.infer<typeof chainFormSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ChainData = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  conditionsJson: unknown;
  stepsJson: unknown;
};

type ChainEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainData: ChainData | null;
};

// ---------------------------------------------------------------------------
// Default step
// ---------------------------------------------------------------------------

const DEFAULT_STEP: ChainFormValues['steps'][number] = {
  name: '',
  approverType: 'user',
  approverUserId: null,
  approverRole: null,
  slaHours: 24,
  required: true,
};

// ---------------------------------------------------------------------------
// User Picker Component
// ---------------------------------------------------------------------------

function UserPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
}) {
  const t = useTranslations('Settings');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  // user.list returns flattened members: { id, userId, name, email, role, ... }
  const rawMembers = usersQuery.data ?? [];
  const users = rawMembers.map(m => ({
    id: (m.userId ?? m.id) as string,
    name: (m.name ?? 'Unknown') as string,
    email: (m.email ?? '') as string,
    role: (m.role ?? '') as string,
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
    <Popover open={open} onOpenChange={setOpen}>
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
          <span className="text-muted-foreground">{t('approvals.editor.userPlaceholder')}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('approvals.editor.userPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {t('approvals.editor.noUsersFound' as Parameters<typeof t>[0])}
            </CommandEmpty>
            <CommandGroup>
              {filteredUsers.map(user => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  onSelect={() => {
                    onChange(user.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  data-checked={user.id === value || undefined}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <Badge variant="secondary" className="ms-auto">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
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

export function ChainEditorDialog({ open, onOpenChange, chainData }: ChainEditorDialogProps) {
  const id = useId();
  const t = useTranslations('Settings');
  const queryClient = useQueryClient();
  const isEditMode = chainData !== null;

  // ---- Form setup ----
  const form = useForm<z.input<typeof chainFormSchema>, unknown, ChainFormValues>({
    resolver: zodResolver(chainFormSchema),
    defaultValues: {
      name: '',
      isDefault: false,
      steps: [{ ...DEFAULT_STEP }],
      conditions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  // ---- Reset form when chainData changes ----
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
        steps: [{ ...DEFAULT_STEP }],
        conditions: [],
      });
    }
  }, [open, chainData, form]);

  // ---- Mutations ----
  const createMutation = useMutation(
    trpc.approval.createChain.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvals.toasts.created'));
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('approvals.toasts.saveFailed'));
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.approval.updateChain.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvals.toasts.updated'));
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('approvals.toasts.saveFailed'));
      },
    }),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ---- Submit handler ----
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
          {/* Section 1: Chain name + default toggle */}
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

          {/* Section 2: Approval levels */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">{t('approvals.editor.levelsHeading')}</h4>

            {!!form.formState.errors.steps?.root && (
              <p className="text-xs text-destructive">{form.formState.errors.steps.root.message}</p>
            )}

            {fields.map((field, index) => (
              <Card key={field.id}>
                <CardContent className="relative space-y-4 pt-4">
                  {/* Level badge + remove button */}
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

                  {/* Level name */}
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

                  {/* Approver type */}
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

                  {/* Conditional approver picker */}
                  {form.watch(`steps.${index}.approverType`) === 'user' ? (
                    <Controller
                      control={form.control}
                      name={`steps.${index}.approverUserId`}
                      // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                      render={({ field: userField }) => (
                        <UserPicker value={userField.value} onChange={userField.onChange} />
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
                                ? (ROLE_LABELS[roleField.value] ?? roleField.value)
                                : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {APPROVER_ROLES.map(role => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role] ?? role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}

                  {/* SLA hours */}
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

                  {/* Required toggle */}
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

            {/* Add level button */}
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
                onClick={() => append({ ...DEFAULT_STEP })}>
                <Plus className="me-1.5 size-3.5" />
                {t('approvals.editor.addLevel')}
              </Button>
            )}
          </div>

          {/* Section 3: Routing conditions */}
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

          {/* Footer */}
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
