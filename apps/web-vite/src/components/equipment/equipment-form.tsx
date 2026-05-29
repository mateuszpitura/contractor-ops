import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
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
import { formControlPopoverRender } from '@contractor-ops/ui/components/shadcn/form-control-trigger';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import type { EquipmentCreateInput } from '@contractor-ops/validators';
import { equipmentCreateSchema } from '@contractor-ops/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { EquipmentTypeIcon } from './equipment-type-icon.js';
import type { useEquipmentForm } from './hooks/use-equipment-form.js';

const EQUIPMENT_TYPES = [
  'LAPTOP',
  'MONITOR',
  'PHONE',
  'HEADSET',
  'KEYBOARD',
  'MOUSE',
  'OTHER',
] as const;

export interface EquipmentFormProps {
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

type EquipmentFormViewProps = EquipmentFormProps &
  Pick<ReturnType<typeof useEquipmentForm>, 'submit' | 'isPending'>;

export function EquipmentFormView({
  open,
  onOpenChange,
  equipment,
  submit,
  isPending,
}: EquipmentFormViewProps) {
  const id = useId();
  const t = useTranslations('Equipment');
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

  const onSubmit = form.handleSubmit(data => {
    submit(isEdit, equipment?.id, data);
  });

  const watchedType = form.watch('type');

  const handleTypeChange = useCallback(
    (val: unknown) => {
      if (val) form.setValue('type', val as EquipmentCreateInput['type']);
    },
    [form],
  );
  const handlePurchaseDateChange = useCallback(
    (date: Date | undefined) => {
      form.setValue('purchaseDate', date, { shouldDirty: true });
    },
    [form],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className={dialogFormLayoutClassName}>
          <DialogBody className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor={`${id}-eq-serial`}>{t('form.serialNumber')}</Label>
              <Input
                id={`${id}-eq-serial`}
                placeholder={t('form.serialNumberPlaceholder')}
                className="font-mono"
                {...form.register('serialNumber')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('form.type')}</Label>
              <Select value={watchedType} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full">
                  {watchedType ? (
                    <div className="flex items-center gap-2">
                      <EquipmentTypeIcon type={watchedType} />
                      <span>{tDynLoose(t, 'type', enumKey(watchedType))}</span>
                    </div>
                  ) : (
                    <SelectValue />
                  )}
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

            <div className="flex flex-col gap-2">
              <Label>{t('form.purchaseDate')}</Label>
              <Popover>
                <PopoverTrigger render={formControlPopoverRender('gap-2')}>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className={form.watch('purchaseDate') ? '' : 'text-muted-foreground'}>
                    {form.watch('purchaseDate')
                      ? new Date(
                          form.watch('purchaseDate') as unknown as string,
                        ).toLocaleDateString()
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
                    onSelect={handlePurchaseDateChange}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-eq-notes`}>{t('form.notes')}</Label>
              <Textarea id={`${id}-eq-notes`} rows={3} {...form.register('notes')} />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
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
