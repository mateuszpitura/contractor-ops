'use client';

import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
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
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dialog form for ad-hoc time entry per UI-SPEC SingleEntryForm (D-01).
 *
 * Fields: Date (datepicker), Project (select), Hours (number), Description (textarea).
 * Footer: "Discard Entry" outline + "Add Entry" primary.
 */
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

  const resetForm = () => {
    setDate(new Date());
    setContractId('');
    setHours('');
    setDescription('');
    setErrors({});
  };

  const validate = (): boolean => {
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
  };

  const handleSubmit = () => {
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
  };

  const handleDiscard = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date picker */}
          <div className="space-y-2">
            <Label htmlFor={`${id}-entry-date`}>{t('dateLabel')}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id={`${id}-entry-date`}
                    variant="outline"
                    className={cn(
                      'w-full justify-start font-normal',
                      !date && 'text-muted-foreground',
                    )}
                  />
                }>
                <CalendarDays className="me-2 h-4 w-4" />
                {date ? format(date, 'MMM d, yyyy') : t('datePlaceholder')}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  onSelect={d => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                  defaultMonth={date}
                />
              </PopoverContent>
            </Popover>
            {!!errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </div>

          {/* Project select */}
          <div className="space-y-2">
            <Label htmlFor={`${id}-entry-project`}>{t('projectLabel')}</Label>
            <Select
              value={contractId}
              onValueChange={value => {
                if (value) setContractId(value);
              }}>
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

          {/* Hours input */}
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
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setHours(e.target.value)}
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {!!errors.hours && <p className="text-sm text-destructive">{errors.hours}</p>}
          </div>

          {/* Description textarea */}
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
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setDescription(e.target.value)}
            />
            {!!errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
            {description.length > 0 && (
              <p className="text-xs text-muted-foreground text-end">{description.length}/500</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button variant="outline" onClick={handleDiscard}>
            {t('discardCta')}
          </Button>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? t('addingCta') : t('addCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
