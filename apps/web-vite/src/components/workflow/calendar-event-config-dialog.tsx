/**
 * Calendar event config dialog — workflow task → calendar sync settings
 * (title template, duration, attendees). Pure presentational; persistence
 * happens in the parent via `onSave`.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
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
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

interface CalendarTaskConfig {
  calendarEnabled: boolean;
  titleTemplate?: string;
  duration: '30m' | '1h' | '2h' | '4h' | 'full_day';
  attendees: string[];
}

const DURATION_OPTIONS = [
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: 'full_day', label: 'Full day' },
] as const;

interface CalendarEventConfigDialogProps {
  taskTemplateId: string;
  config: CalendarTaskConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: CalendarTaskConfig) => void;
}

export function CalendarEventConfigDialog({
  config,
  open,
  onOpenChange,
  onSave,
}: CalendarEventConfigDialogProps) {
  const t = useTranslations('CalendarSettings');
  const reactId = useId();

  const [titleTemplate, setTitleTemplate] = useState(config.titleTemplate ?? '');
  const [duration, setDuration] = useState<string>(config.duration ?? '1h');
  const [attendeesText, setAttendeesText] = useState((config.attendees ?? []).join(', '));

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setTitleTemplate(config.titleTemplate ?? '');
        setDuration(config.duration ?? '1h');
        setAttendeesText((config.attendees ?? []).join(', '));
      }
      onOpenChange(newOpen);
    },
    [config, onOpenChange],
  );

  const handleSave = useCallback(() => {
    const attendees: string[] = attendeesText
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0 && email.includes('@'));

    onSave({
      calendarEnabled: config.calendarEnabled,
      titleTemplate: titleTemplate || undefined,
      duration: duration as CalendarTaskConfig['duration'],
      attendees,
    });

    onOpenChange(false);
  }, [attendeesText, config.calendarEnabled, titleTemplate, duration, onSave, onOpenChange]);

  const handleTitleTemplateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTitleTemplate(e.target.value),
    [],
  );
  const handleDurationChange = useCallback(
    (val: string | null | undefined) => setDuration(val ?? '1h'),
    [],
  );
  const handleAttendeesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setAttendeesText(e.target.value),
    [],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('calendarEventTitle')}</DialogTitle>
          <DialogDescription>{t('calendarEventDescription')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${reactId}-calendar-event-title`}>{t('eventTitleLabel')}</Label>
            <Input
              id={`${reactId}-calendar-event-title`}
              value={titleTemplate}
              onChange={handleTitleTemplateChange}
              placeholder={t('eventTitlePlaceholder')}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">{t('eventTitleHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${reactId}-calendar-event-duration`}>{t('durationLabel')}</Label>
            <Select value={duration} onValueChange={handleDurationChange}>
              <SelectTrigger id={`${reactId}-calendar-event-duration`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${reactId}-calendar-event-attendees`}>{t('attendeesLabel')}</Label>
            <Textarea
              id={`${reactId}-calendar-event-attendees`}
              value={attendeesText}
              onChange={handleAttendeesChange}
              placeholder={t('attendeesPlaceholder')}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{t('attendeesHint')}</p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('cancelButton')}
          </Button>
          <Button onClick={handleSave}>{t('saveEventConfig')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
