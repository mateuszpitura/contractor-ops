import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { AbsenceKind, TimeEntryDraft } from './hooks/use-employee-time.js';

const ABSENCE_KINDS: AbsenceKind[] = [
  'VACATION',
  'SICK',
  'PARENTAL',
  'BEREAVEMENT',
  'STUDY',
  'UNPAID',
  'OTHER_JUSTIFIED',
  'UNJUSTIFIED',
];

const NO_ABSENCE = 'none';

interface EmployeeTimeEntryViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: TimeEntryDraft) => void;
  isSubmitting: boolean;
  disabled?: boolean;
}

function hoursToMinutes(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(Math.min(parsed, 24) * 60);
}

interface HourFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function HourField({ id, label, value, onChange }: HourFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step="0.25"
        min="0"
        max="24"
        inputMode="decimal"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

/**
 * Day-grain statutory time-entry form. Collects hours per bucket and converts to
 * the minute-grained upsert payload on submit; the sync WT-limit check runs
 * server-side and returns a non-blocking advisory the section surfaces.
 */
export function EmployeeTimeEntryView({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  disabled,
}: EmployeeTimeEntryViewProps) {
  const t = useTranslations('EmployeeTime.form');
  const id = useId();

  const [workDate, setWorkDate] = useState('');
  const [worked, setWorked] = useState('');
  const [night, setNight] = useState('');
  const [overtime50, setOvertime50] = useState('');
  const [overtime100, setOvertime100] = useState('');
  const [weekendHoliday, setWeekendHoliday] = useState('');
  const [onCall, setOnCall] = useState('');
  const [onCallLocation, setOnCallLocation] = useState('');
  const [absenceKind, setAbsenceKind] = useState<string>(NO_ABSENCE);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setWorkDate('');
    setWorked('');
    setNight('');
    setOvertime50('');
    setOvertime100('');
    setWeekendHoliday('');
    setOnCall('');
    setOnCallLocation('');
    setAbsenceKind(NO_ABSENCE);
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const handleSubmit = useCallback(() => {
    if (!workDate) {
      setError(t('validation.dateRequired'));
      return;
    }
    onSubmit({
      workDate,
      workedMinutes: hoursToMinutes(worked),
      nightMinutes: hoursToMinutes(night),
      overtimeMinutes50: hoursToMinutes(overtime50),
      overtimeMinutes100: hoursToMinutes(overtime100),
      weekendHolidayMinutes: hoursToMinutes(weekendHoliday),
      onCallMinutes: hoursToMinutes(onCall),
      onCallLocation: onCallLocation.trim() || undefined,
      absenceKind: absenceKind === NO_ABSENCE ? undefined : (absenceKind as AbsenceKind),
    });
    reset();
  }, [
    workDate,
    worked,
    night,
    overtime50,
    overtime100,
    weekendHoliday,
    onCall,
    onCallLocation,
    absenceKind,
    onSubmit,
    reset,
    t,
  ]);

  const tAbsence = useTranslations('EmployeeTime.absenceKind');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button disabled={disabled}>
            <Plus className="h-4 w-4" />
            {t('title')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-date`}>{t('date')}</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={workDate}
              onChange={event => {
                setWorkDate(event.target.value);
                setError(null);
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <HourField
              id={`${id}-worked`}
              label={t('hoursWorked')}
              value={worked}
              onChange={setWorked}
            />
            <HourField
              id={`${id}-night`}
              label={t('nightHours')}
              value={night}
              onChange={setNight}
            />
            <HourField
              id={`${id}-ot50`}
              label={`${t('overtime')} 50%`}
              value={overtime50}
              onChange={setOvertime50}
            />
            <HourField
              id={`${id}-ot100`}
              label={`${t('overtime')} 100%`}
              value={overtime100}
              onChange={setOvertime100}
            />
            <HourField
              id={`${id}-weekend`}
              label={t('weekendHoliday')}
              value={weekendHoliday}
              onChange={setWeekendHoliday}
            />
            <HourField
              id={`${id}-oncall`}
              label={t('onCall')}
              value={onCall}
              onChange={setOnCall}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-oncall-location`}>{t('onCallLocation')}</Label>
            <Input
              id={`${id}-oncall-location`}
              value={onCallLocation}
              maxLength={200}
              placeholder={t('onCallLocationPlaceholder')}
              onChange={event => setOnCallLocation(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-absence`}>{t('absenceType')}</Label>
            <Select
              value={absenceKind}
              onValueChange={value => setAbsenceKind(value ?? NO_ABSENCE)}>
              <SelectTrigger id={`${id}-absence`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ABSENCE}>{t('absenceNone')}</SelectItem>
                {ABSENCE_KINDS.map(kind => (
                  <SelectItem key={kind} value={kind}>
                    {tAbsence(kind)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
