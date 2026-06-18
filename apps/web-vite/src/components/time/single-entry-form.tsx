/**
 * Single time entry form.
 */

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
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface Contract {
  id: string;
  title: string;
}

interface SingleEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
  onSubmit: (entry: {
    contractId: string;
    entryDate: string;
    minutes: number;
    description?: string;
  }) => void;
  isSubmitting: boolean;
}

export function SingleEntryForm({
  open,
  onOpenChange,
  contracts,
  onSubmit,
  isSubmitting,
}: SingleEntryFormProps) {
  const t = useTranslations('Time.singleEntry');
  const id = useId();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [contractId, setContractId] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const resetForm = useCallback(() => {
    setDate(new Date());
    setContractId('');
    setHours('');
    setDescription('');
    setErrors({});
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!date) {
      newErrors.date = t('validation.dateRequired');
    }
    if (!contractId) {
      newErrors.contractId = t('validation.projectRequired');
    }
    const hoursVal = parseFloat(hours);
    if (!hours || Number.isNaN(hoursVal) || hoursVal < 0.25 || hoursVal > 24) {
      newErrors.hours = t('validation.hoursRange');
    }
    if (description && description.length > 500) {
      newErrors.description = t('validation.descriptionLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [date, contractId, hours, description, t]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;

    const hoursVal = parseFloat(hours);
    const minutes = Math.round(hoursVal * 60);

    onSubmit({
      contractId,
      entryDate: format(date as Date, 'yyyy-MM-dd'),
      minutes,
      description: description || undefined,
    });

    resetForm();
  }, [validate, hours, onSubmit, contractId, date, description, resetForm]);

  const handleDiscard = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  const handleCalendarSelect = useCallback((d: Date | undefined) => {
    setDate(d);
    setCalendarOpen(false);
  }, []);

  const handleContractChange = useCallback((value: string | null) => {
    if (value) setContractId(value);
  }, []);

  const handleHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHours(e.target.value);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-entry-date`}>{t('dateLabel')}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                id={`${id}-entry-date`}
                render={formControlPopoverRender(date ? undefined : 'text-muted-foreground')}>
                <CalendarDays className="me-2 h-4 w-4" />
                {date ? format(date, 'MMM d, yyyy') : t('datePlaceholder')}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleCalendarSelect}
                  defaultMonth={date}
                />
              </PopoverContent>
            </Popover>
            {!!errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-entry-project`}>{t('projectLabel')}</Label>
            <Select value={contractId} onValueChange={handleContractChange}>
              <SelectTrigger id={`${id}-entry-project`}>
                <SelectValue placeholder={t('projectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!!errors.contractId && <p className="text-sm text-destructive">{errors.contractId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-entry-hours`}>{t('hoursLabel')}</Label>
            <Input
              id={`${id}-entry-hours`}
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              placeholder={t('hoursPlaceholder')}
              value={hours}
              onChange={handleHoursChange}
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {!!errors.hours && <p className="text-sm text-destructive">{errors.hours}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-entry-description`}>
              {t('descriptionLabel')}{' '}
              <span className="font-normal text-muted-foreground">{t('descriptionOptional')}</span>
            </Label>
            <Textarea
              id={`${id}-entry-description`}
              rows={3}
              maxLength={500}
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={handleDescriptionChange}
            />
            {!!errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
            {description.length > 0 && (
              <p className="text-xs text-muted-foreground text-end">{description.length}/500</p>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDiscard}>
            {t('discardCta')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? t('addingCta') : t('addCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
