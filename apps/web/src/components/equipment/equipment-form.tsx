'use client';

import type { EquipmentCreateInput } from '@contractor-ops/validators';
import { equipmentCreateSchema } from '@contractor-ops/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { Textarea } from '@/components/ui/textarea';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';
import { EquipmentTypeIcon } from './equipment-type-icon';
import { tDyn, tDynLoose } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const EQUIPMENT_TYPES = [
  'LAPTOP',
  'MONITOR',
  'PHONE',
  'HEADSET',
  'KEYBOARD',
  'MOUSE',
  'OTHER',
] as const;

interface EquipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, form is in edit mode with pre-filled values */
  equipment?: {
    id: string;
    name: string;
    serialNumber: string | null;
    type: string;
    customType: string | null;
    notes: string | null;
    purchaseDate: string | Date | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EquipmentForm({ open, onOpenChange, equipment }: EquipmentFormProps) {
  const id = useId();
  const t = useTranslations('Equipment');
  const queryClient = useQueryClient();
  const isEdit = !!equipment;

  const form = useForm<z.input<typeof equipmentCreateSchema>, unknown, EquipmentCreateInput>({
    resolver: zodResolver(equipmentCreateSchema),
    defaultValues: {
      name: '',
      serialNumber: '',
      type: 'LAPTOP',
      customType: '',
      notes: '',
      purchaseDate: undefined,
    },
  });

  // Reset form when dialog opens/closes or equipment changes
  useEffect(() => {
    if (open && equipment) {
      form.reset({
        name: equipment.name,
        serialNumber: equipment.serialNumber ?? '',
        type: equipment.type as EquipmentCreateInput['type'],
        customType: equipment.customType ?? '',
        notes: equipment.notes ?? '',
        purchaseDate: equipment.purchaseDate ? new Date(equipment.purchaseDate) : undefined,
      });
    } else if (open && !equipment) {
      form.reset({
        name: '',
        serialNumber: '',
        type: 'LAPTOP',
        customType: '',
        notes: '',
        purchaseDate: undefined,
      });
    }
  }, [open, equipment, form]);

  const createMutation = useMutation(
    trpc.equipment.create.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.created'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.equipment.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.updated'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit(data => {
    if (isEdit && equipment) {
      updateMutation.mutate({ id: equipment.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  });

  const watchedType = form.watch('type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor={`${id}-eq-name`}>{t('form.name')}</Label>
            <Input
              id={`${id}-eq-name`}
              placeholder={t('form.namePlaceholder')}
              {...form.register('name')}
              aria-invalid={!!form.formState.errors.name}
            />
            {!!form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Serial Number */}
          <div className="space-y-2">
            <Label htmlFor={`${id}-eq-serial`}>{t('form.serialNumber')}</Label>
            <Input
              id={`${id}-eq-serial`}
              placeholder={t('form.serialNumberPlaceholder')}
              className="font-mono"
              {...form.register('serialNumber')}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>{t('form.type')}</Label>
            <Select
              value={watchedType}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onValueChange={val =>
                val && form.setValue('type', val as EquipmentCreateInput['type'])
              }>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => (
                    <div className="flex items-center gap-2">
                      <EquipmentTypeIcon type={value} />
                      <span>{tDynLoose(t, 'type', enumKey(value))}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <EquipmentTypeIcon type={type} />
                      <span>{tDynLoose(t, 'type', enumKey(type))}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom type (shown when OTHER) */}
          {watchedType === 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-eq-custom-type`}>{t('form.customType')}</Label>
              <Input
                id={`${id}-eq-custom-type`}
                placeholder={t('form.customTypePlaceholder')}
                {...form.register('customType')}
              />
            </div>
          )}

          {/* Purchase Date */}
          <div className="flex flex-col gap-2">
            <Label>{t('form.purchaseDate')}</Label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 font-normal bg-background"
                  />
                }>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className={form.watch('purchaseDate') ? '' : 'text-muted-foreground'}>
                  {form.watch('purchaseDate')
                    ? new Date(form.watch('purchaseDate') as unknown as string).toLocaleDateString()
                    : t('form.purchaseDatePlaceholder')}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    form.watch('purchaseDate')
                      ? new Date(form.watch('purchaseDate') as unknown as string)
                      : undefined
                  }
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onSelect={date => form.setValue('purchaseDate', date, { shouldDirty: true })}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor={`${id}-eq-notes`}>{t('form.notes')}</Label>
            <Textarea id={`${id}-eq-notes`} rows={3} {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
              onClick={() => onOpenChange(false)}
              disabled={isPending}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {!!isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
